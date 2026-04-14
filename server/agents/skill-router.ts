/**
 * Skill Router — 사용자 메시지에서 필요한 에이전트를 예측
 *
 * Registry의 키워드를 기반으로 매칭 점수를 계산하여
 * 상위 N개 에이전트만 Skills를 로드하도록 지원.
 *
 * 비용 절감: 22K tokens (doc-writer 전체) → 필요한 Skills만 (~5K)
 */
import { AGENT_REGISTRY } from "./registry.js";

/**
 * 다국어 동의어 확장 — 영어/일본어 키워드를 한국어 동의어로 변환하여 메시지에 병합
 * registry.ts의 한국어 키워드와 매칭 가능하게 함
 */
const MULTILINGUAL_MAP: Record<string, string[]> = {
  // 교육/HR
  "교육": ["education", "training", "learning", "教育", "学習"],
  "커리큘럼": ["curriculum", "カリキュラム"],
  "직무 분석": ["job analysis", "competency analysis", "職務分析"],
  "역량 분석": ["skill analysis", "competency assessment"],
  "미래 일자리": ["future job", "career path", "将来の仕事"],
  "스킬 갭": ["skill gap", "skills gap", "スキルギャップ"],
  "채용": ["recruitment", "hiring", "採用"],
  // 문서 생성
  "보고서": ["report", "レポート"],
  "PPT": ["presentation", "slides", "プレゼン"],
  "엑셀": ["excel", "spreadsheet", "エクセル"],
  // 분석
  "경쟁사": ["competitor", "competitive", "競合"],
  "전략": ["strategy", "strategic", "戦略"],
  "재무": ["financial", "finance", "財務"],
  "데이터 분석": ["data analysis", "analytics", "データ分析"],
  // 일반
  "번역": ["translate", "translation", "翻訳"],
  "요약": ["summary", "summarize", "要約"],
  "검색": ["search", "find", "検索"],
  "이메일": ["email", "メール"],
  "프로젝트": ["project", "プロジェクト"],
};

function expandMultilingual(lowerMsg: string): string {
  let expanded = lowerMsg;
  for (const [korean, synonyms] of Object.entries(MULTILINGUAL_MAP)) {
    for (const syn of synonyms) {
      if (lowerMsg.includes(syn.toLowerCase())) {
        expanded += ` ${korean}`;
        break; // 하나만 매칭되면 충분
      }
    }
  }
  return expanded;
}

/**
 * 사용자 메시지에서 필요한 에이전트 이름 목록을 반환
 * @param message - 사용자 메시지
 * @param maxAgents - 최대 반환 에이전트 수 (기본 3)
 * @returns 매칭된 에이전트 이름 배열 (점수 높은 순)
 */
export function predictNeededAgents(message: string, maxAgents = 3): string[] {
  // 다국어 지원: 메시지를 원문 + 동의어 확장으로 매칭
  const lowerMsg = expandMultilingual(message.toLowerCase());

  const scores: { name: string; score: number }[] = [];

  for (const entry of AGENT_REGISTRY) {
    let score = 0;

    // 키워드 매칭 (가장 중요)
    for (const kw of entry.keywords) {
      if (lowerMsg.includes(kw.toLowerCase())) {
        score += 10;
      }
    }

    // capabilities 매칭
    for (const cap of entry.capabilities) {
      if (lowerMsg.includes(cap.toLowerCase())) {
        score += 5;
      }
    }

    if (score > 0) {
      scores.push({ name: entry.name, score });
    }
  }

  // 점수 높은 순 정렬
  scores.sort((a, b) => b.score - a.score);

  // 상위 N개 반환
  const result = scores.slice(0, maxAgents).map((s) => s.name);

  // rag-search는 항상 포함 (문서 질문 가능성)
  if (!result.includes("rag-search")) result.push("rag-search");

  // memory는 프로파일링 키워드가 있을 때만 포함 (MCP 서버 시작 비용 절감)
  const memoryKeywords = ["기억", "이전에", "저장", "나는", "제 이름", "우리 회사", "목표", "하려고"];
  const needsMemory = memoryKeywords.some((kw) => lowerMsg.includes(kw));
  if (needsMemory && !result.includes("memory")) result.push("memory");

  return result;
}
