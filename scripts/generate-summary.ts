/**
 * 기존 인덱싱된 문서에 대해 요약을 수동 생성하는 스크립트
 * 사용: npx tsx scripts/generate-summary.ts [document_id]
 */
import "dotenv/config";
import db from "../server/db/connection.js";
import { initializeSchema } from "../server/db/schema.js";
import { generateDocumentSummary, getDocumentSummary } from "../server/memory/document-summary.js";

initializeSchema();

const docId = parseInt(process.argv[2] || "0");

if (docId === 0) {
  // 요약이 없는 모든 문서에 대해 생성
  const docs = db.prepare(`
    SELECT d.id, d.file_name, d.format, COUNT(c.id) as chunk_count
    FROM documents d
    LEFT JOIN chunks c ON c.document_id = d.id
    LEFT JOIN document_summaries ds ON ds.document_id = d.id
    WHERE ds.id IS NULL
    GROUP BY d.id
  `).all() as any[];

  console.log(`Found ${docs.length} documents without summaries`);

  for (const doc of docs) {
    console.log(`\n--- Processing: ${doc.file_name} (${doc.chunk_count} chunks) ---`);
    const chunks = db.prepare(
      "SELECT title, content FROM chunks WHERE document_id = ? AND LENGTH(content) > 50 ORDER BY chunk_index"
    ).all(doc.id) as any[];

    if (chunks.length === 0) {
      console.log("  Skipped (no meaningful chunks)");
      continue;
    }

    const result = await generateDocumentSummary(doc.id, doc.file_name, chunks);
    if (result) {
      console.log(`  Summary: ${result.summary.slice(0, 100)}...`);
    } else {
      console.log("  Failed to generate summary");
    }
  }
} else {
  // 특정 문서 ID에 대해 생성
  const doc = db.prepare("SELECT id, file_name FROM documents WHERE id = ?").get(docId) as any;
  if (!doc) { console.error(`Document ${docId} not found`); process.exit(1); }

  const existing = getDocumentSummary(docId);
  if (existing) {
    console.log(`Summary already exists for "${doc.file_name}". Regenerating...`);
  }

  const chunks = db.prepare(
    "SELECT title, content FROM chunks WHERE document_id = ? AND LENGTH(content) > 50 ORDER BY chunk_index"
  ).all(docId) as any[];

  console.log(`Processing: ${doc.file_name} (${chunks.length} meaningful chunks)`);
  const result = await generateDocumentSummary(docId, doc.file_name, chunks);

  if (result) {
    console.log("\n=== Summary Generated ===");
    console.log("Title:", result.title);
    console.log("Summary:", result.summary);
    console.log("Key Concepts:", result.key_concepts);
    console.log("Structure:", result.structure);
  }
}

process.exit(0);
