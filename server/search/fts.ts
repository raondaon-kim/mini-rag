import db from "../db/connection.js";

export interface SearchResult {
  id: number;
  document_id: number;
  chunk_index: number;
  title: string;
  content: string;
  metadata: string;
  token_count: number;
  file_path: string;
  file_name: string;
  format: string;
  score: number;
}

let searchStmt: any | null = null;

function getSearchStmt() {
  if (!searchStmt) {
    searchStmt = db.prepare(`
      SELECT c.id, c.document_id, c.chunk_index, c.title, c.content,
             c.metadata, c.token_count,
             d.file_path, d.file_name, d.format,
             bm25(chunks_fts, 2.0, 1.0) AS score
      FROM chunks_fts
      JOIN chunks c ON c.id = chunks_fts.rowid
      JOIN documents d ON d.id = c.document_id
      WHERE chunks_fts MATCH ?
      ORDER BY score
      LIMIT ?
    `);
  }
  return searchStmt;
}

export function searchFTS(query: string, topK = 20): SearchResult[] {
  const ftsQuery = buildFTSQuery(query);
  if (!ftsQuery) return [];

  const stmt = getSearchStmt();
  try {
    return stmt.all(ftsQuery, topK) as SearchResult[];
  } catch (e1) {
    console.warn("[FTS] Primary query failed:", (e1 as Error).message?.slice(0, 60), "query:", ftsQuery);
    try {
      return stmt.all(`"${query}"`, topK) as SearchResult[];
    } catch (e2) {
      console.warn("[FTS] Fallback query failed:", (e2 as Error).message?.slice(0, 60));
      return [];
    }
  }
}

function buildFTSQuery(query: string): string {
  const cleaned = query.replace(/['"]/g, "").trim();
  if (!cleaned) return "";

  const words = cleaned.split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return "";

  if (words.length === 1) {
    // 단일어: 구(phrase) 매칭 우선 + prefix 매칭 폴백
    // "재무회계" → 통째로 매칭 시도, 없으면 prefix
    return `"${words[0]}" OR "${words[0]}"*`;
  }

  // 다중어: 전체 구 매칭 OR 개별 AND 매칭
  // "재무 회계" → "재무 회계" 통째로 OR ("재무"* AND "회계"*)
  const phrase = words.join(" ");
  const andQuery = words.map((w) => `"${w}"*`).join(" AND ");
  return `"${phrase}" OR (${andQuery})`;
}
