/**
 * RRF Hybrid Search — FTS5 + Vector 결과를 Reciprocal Rank Fusion으로 합산
 *
 * RRF_score(d) = weight_fts / (k + rank_fts(d)) + weight_vec / (k + rank_vec(d))
 *
 * sqlite-rag 프로젝트 참고: rrf_k=60, weight_fts=1.5, weight_vec=1.0
 */
import { searchFTS, type SearchResult } from "./fts.js";
import { searchVector } from "./vector.js";
import db from "../db/connection.js";

let getSettingStmt: ReturnType<typeof db.prepare> | null = null;

function getSetting<T>(key: string, fallback: T): T {
  if (!getSettingStmt) {
    getSettingStmt = db.prepare("SELECT value FROM settings WHERE key = ?");
  }
  const row = getSettingStmt.get(key) as { value: string } | undefined;
  return row ? JSON.parse(row.value) : fallback;
}

/**
 * RRF 하이브리드 검색
 *
 * @param query - 검색 텍스트 (FTS5용)
 * @param queryEmbedding - 쿼리 임베딩 JSON string (Vector용)
 * @param topK - 최종 반환 수
 */
export function hybridSearch(
  query: string,
  queryEmbedding: Buffer,
  topK = 5
): SearchResult[] {
  const rrfK = getSetting("rrf_k", 60);
  const weightFTS = getSetting("weight_fts", 1.5);
  const weightVec = getSetting("weight_vec", 1.0);
  const candidateK = topK * 4; // 넓은 후보 집합

  // 병렬로 양쪽 검색
  const ftsResults = searchFTS(query, candidateK);
  const vecResults = searchVector(queryEmbedding, candidateK);

  // RRF 점수 합산
  const scores = new Map<number, number>();
  const chunks = new Map<number, SearchResult>();

  ftsResults.forEach((row, rank) => {
    const rrfScore = weightFTS / (rrfK + rank);
    scores.set(row.id, (scores.get(row.id) || 0) + rrfScore);
    chunks.set(row.id, row);
  });

  vecResults.forEach((row, rank) => {
    const rrfScore = weightVec / (rrfK + rank);
    scores.set(row.id, (scores.get(row.id) || 0) + rrfScore);
    if (!chunks.has(row.id)) chunks.set(row.id, row);
  });

  // 점수 내림차순 정렬 → topK 선택
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topK)
    .map(([id, score]) => ({
      ...chunks.get(id)!,
      score, // RRF 합산 점수로 덮어쓰기
    }));
}
