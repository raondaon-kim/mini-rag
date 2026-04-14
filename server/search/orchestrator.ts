/**
 * Search Orchestrator — 검색 모드 라우팅
 *
 * auto → vectorEnabled이면 hybrid, 아니면 fts
 * fts → FTS5 BM25 only
 * hybrid → FTS5 + Vector RRF
 */
import { searchFTS, type SearchResult } from "./fts.js";
import { hybridSearch } from "./hybrid.js";
import { vectorEnabled } from "../db/connection.js";
import { generateEmbedding, embeddingToBuffer } from "../llm/embedder.js";
import db from "../db/connection.js";

export type SearchMode = "fts" | "hybrid" | "auto";

interface SearchOptions {
  searchMode?: SearchMode;
  topK?: number;
}

let getSettingStmt: ReturnType<typeof db.prepare> | null = null;

function getSetting<T>(key: string, fallback: T): T {
  if (!getSettingStmt) {
    getSettingStmt = db.prepare("SELECT value FROM settings WHERE key = ?");
  }
  const row = getSettingStmt.get(key) as { value: string } | undefined;
  return row ? JSON.parse(row.value) : fallback;
}

export async function search(
  query: string,
  options: SearchOptions = {}
): Promise<SearchResult[]> {
  const topK = options.topK ?? getSetting("top_k", 5);
  const mode = resolveSearchMode(options.searchMode ?? "auto");

  switch (mode) {
    case "fts":
      return searchFTS(query, topK);

    case "hybrid": {
      // 쿼리 임베딩 생성 → RRF 하이브리드 검색
      const embedding = await generateEmbedding(query);
      const embBuf = embeddingToBuffer(embedding);
      return hybridSearch(query, embBuf, topK);
    }

    default:
      return searchFTS(query, topK);
  }
}

function resolveSearchMode(requested: SearchMode): SearchMode {
  if (requested !== "auto") return requested;
  if (vectorEnabled) return "hybrid";
  return "fts";
}

export { getSetting };
