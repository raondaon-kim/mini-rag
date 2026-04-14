/**
 * Vector KNN Search via sqlite-vec
 *
 * vec0 가상 테이블에서 코사인 거리 기반 KNN 검색.
 * chunks 테이블과 JOIN하여 전체 청크 정보 반환.
 */
import db from "../db/connection.js";
import type { SearchResult } from "./fts.js";

let searchStmt: any | null = null;

function getVecSearchStmt() {
  if (!searchStmt) {
    searchStmt = db.prepare(`
      SELECT
        v.rowid AS id,
        c.document_id,
        c.chunk_index,
        c.title,
        c.content,
        c.metadata,
        c.token_count,
        d.file_path,
        d.file_name,
        d.format,
        v.distance AS score
      FROM chunks_vec v
      JOIN chunks c ON c.id = v.rowid
      JOIN documents d ON d.id = c.document_id
      WHERE v.embedding MATCH ?
        AND k = ?
      ORDER BY v.distance
    `);
  }
  return searchStmt;
}

/**
 * 벡터 KNN 검색
 * @param queryEmbedding - JSON string of float array (e.g. "[0.1, 0.2, ...]")
 * @param topK - 상위 K개 결과
 */
export function searchVector(queryEmbedding: Buffer, topK = 20): SearchResult[] {
  try {
    // vec0는 k를 JOIN 전에 적용하므로 orphan rowid 대비 넉넉하게 요청
    const results = getVecSearchStmt().all(queryEmbedding, topK * 10) as SearchResult[];
    return results.slice(0, topK);
  } catch (e) {
    console.warn("[Vector] Search failed:", (e as Error).message?.slice(0, 80));
    return [];
  }
}
