import db, { vectorEnabled } from "../db/connection.js";
import type { Chunk } from "./chunker.js";
import { generateEmbedding, embeddingToHex } from "../llm/embedder.js";

// Lazy-initialized prepared statements (schema must exist before use)
const stmts = {
  insertDoc: null as any | null,
  insertChunk: null as any | null,
  deleteDocChunks: null as any | null,
  deleteDoc: null as any | null,
  getDocByPath: null as any | null,
  docStats: null as any | null,
  chunkStats: null as any | null,
  byFormat: null as any | null,
};

function s() {
  if (!stmts.insertDoc) {
    stmts.insertDoc = db.prepare(`INSERT INTO documents (file_path, file_name, format, content_hash, metadata, file_size) VALUES (?, ?, ?, ?, ?, ?)`);
    stmts.insertChunk = db.prepare(`INSERT INTO chunks (document_id, chunk_index, title, content, metadata, token_count) VALUES (?, ?, ?, ?, ?, ?)`);
    stmts.deleteDocChunks = db.prepare("DELETE FROM chunks WHERE document_id = ?");
    stmts.deleteDoc = db.prepare("DELETE FROM documents WHERE id = ?");
    stmts.getDocByPath = db.prepare("SELECT id FROM documents WHERE file_path = ?");
    stmts.docStats = db.prepare("SELECT COUNT(*) as count FROM documents");
    stmts.chunkStats = db.prepare("SELECT COUNT(*) as count FROM chunks");
    stmts.byFormat = db.prepare(`SELECT d.format, COUNT(DISTINCT d.id) as doc_count, COUNT(c.id) as chunk_count FROM documents d LEFT JOIN chunks c ON c.document_id = d.id GROUP BY d.format`);
  }
  return stmts as { [K in keyof typeof stmts]: NonNullable<typeof stmts[K]> };
}

export interface IndexResult {
  document_id: number;
  chunks_created: number;
}

/**
 * 문서 인덱싱 — FTS5 + (벡터) 인덱싱
 *
 * 1단계: 동기 트랜잭션으로 documents + chunks + FTS5 삽입
 * 2단계: vectorEnabled이면 비동기로 임베딩 생성 → chunks_vec 삽입
 */
export async function indexDocument(
  filePath: string,
  fileName: string,
  format: string,
  contentHash: string,
  metadata: Record<string, unknown>,
  fileSize: number,
  chunks: Chunk[]
): Promise<IndexResult> {
  const st = s();

  // 1단계: 동기 트랜잭션 (기존과 동일)
  const { document_id: documentId, chunkIds } = db.transaction(() => {
    const existing = st.getDocByPath.get(filePath) as { id: number } | undefined;
    if (existing) {
      // 기존 벡터도 삭제
      if (vectorEnabled) {
        try {
          const oldChunkIds = db.prepare("SELECT id FROM chunks WHERE document_id = ?").all(existing.id) as { id: number }[];
          const delVec = db.prepare("DELETE FROM chunks_vec WHERE rowid = ?");
          for (const c of oldChunkIds) delVec.run(c.id);
        } catch { /* vec table might not exist yet */ }
      }
      st.deleteDocChunks.run(existing.id);
      st.deleteDoc.run(existing.id);
    }

    const docResult = st.insertDoc.run(
      filePath, fileName, format, contentHash,
      JSON.stringify(metadata), fileSize
    );
    const docId = Number(docResult.lastInsertRowid);

    const ids: number[] = [];
    for (const chunk of chunks) {
      const res = st.insertChunk.run(
        docId, chunk.chunk_index, chunk.title,
        chunk.content, JSON.stringify(chunk.metadata), chunk.token_count
      );
      ids.push(Number(res.lastInsertRowid));
    }

    return { document_id: docId, chunkIds: ids };
  })();

  // 2단계: 벡터 인덱싱 — 완전 백그라운드 (응답 지연 없음)
  if (vectorEnabled && chunks.length > 0) {
    indexVectorsBackground(chunks, chunkIds).catch(() => {});
  }

  // 3단계: 문서 요약 비동기 생성 (Karpathy Wiki 패턴)
  import("../memory/document-summary.js").then(({ generateDocumentSummary }) => {
    if (metadata.type === "summary") return;
    generateDocumentSummary(
      documentId,
      fileName,
      chunks.map((c) => ({ title: c.title, content: c.content }))
    ).catch(() => {});
  }).catch(() => {});

  return { document_id: documentId, chunks_created: chunks.length };
}

/**
 * 벡터 인덱싱 — 완전 백그라운드
 * FTS5 인덱싱 후 즉시 반환, 벡터는 백그라운드에서 처리
 */
async function indexVectorsBackground(chunks: Chunk[], chunkIds: number[]): Promise<void> {
  try {
    const t0 = Date.now();
    console.log("[Indexer] Background: embedding %d chunks...", chunks.length);

    const BATCH_SIZE = 50;
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batchChunks = chunks.slice(i, i + BATCH_SIZE);
      const batchIds = chunkIds.slice(i, i + BATCH_SIZE);

      let sql = "";
      for (let j = 0; j < batchChunks.length; j++) {
        const text = `${batchChunks[j].title}: ${batchChunks[j].content}`.slice(0, 8000);
        const embedding = await generateEmbedding(text);
        const hex = embeddingToHex(embedding);
        sql += `INSERT INTO chunks_vec(rowid, embedding) VALUES(${batchIds[j]}, x'${hex}');\n`;
      }

      db.exec(sql);

      if (i + BATCH_SIZE < chunks.length) {
        console.log("[Indexer] Background: %d/%d embedded", i + BATCH_SIZE, chunks.length);
      }
    }

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log("[Indexer] Background: all %d embeddings done (%ss)", chunks.length, elapsed);
  } catch (e) {
    console.warn("[Indexer] Background embedding failed (FTS5 still works):", (e as Error).message?.slice(0, 80));
  }
}

export function deleteDocument(documentId: number): boolean {
  const st = s();
  const result = db.transaction(() => {
    st.deleteDocChunks.run(documentId);
    const res = st.deleteDoc.run(documentId);
    return res.changes > 0;
  })();
  return result;
}

export function getDocumentStats() {
  const st = s();
  const total = st.docStats.get() as { count: number };
  const totalChunks = st.chunkStats.get() as { count: number };
  const byFormat = st.byFormat.all();
  return { total_documents: total.count, total_chunks: totalChunks.count, by_format: byFormat };
}

export function listDocuments(format?: string, limit = 50) {
  let query = `SELECT d.*, COUNT(c.id) as chunk_count FROM documents d LEFT JOIN chunks c ON c.document_id = d.id`;
  const params: unknown[] = [];
  if (format) { query += " WHERE d.format = ?"; params.push(format); }
  query += " GROUP BY d.id ORDER BY d.created_at DESC LIMIT ?";
  params.push(limit);
  return db.prepare(query).all(...params);
}
