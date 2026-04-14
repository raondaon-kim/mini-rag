/**
 * Session Summary — claude-mem 패턴 차용
 *
 * 세션 종료 시 AI가 대화를 요약하여 저장.
 * 다음 세션 시작 시 이전 요약을 컨텍스트에 주입.
 *
 * 요약 구조: request / investigated / learned / completed / next_steps
 */
import db from "../db/connection.js";
import Anthropic from "@anthropic-ai/sdk";

export interface SessionSummary {
  id?: number;
  session_id: string;
  request: string;
  investigated: string;
  learned: string;
  completed: string;
  next_steps: string;
  created_at?: string;
}

// Lazy-init
let _stmts: {
  upsert: any;
  getBySession: any;
  getRecent: any;
} | null = null;

function stmts() {
  if (!_stmts) {
    _stmts = {
      upsert: db.prepare(`
        INSERT INTO session_summaries (session_id, request, investigated, learned, completed, next_steps)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(session_id) DO UPDATE SET
          request = excluded.request,
          investigated = excluded.investigated,
          learned = excluded.learned,
          completed = excluded.completed,
          next_steps = excluded.next_steps
      `),
      getBySession: db.prepare(
        "SELECT * FROM session_summaries WHERE session_id = ?"
      ),
      getRecent: db.prepare(
        "SELECT * FROM session_summaries ORDER BY created_at DESC LIMIT ?"
      ),
    };
  }
  return _stmts;
}

/**
 * 세션 요약 저장 (upsert)
 */
export function saveSessionSummary(summary: SessionSummary): void {
  stmts().upsert.run(
    summary.session_id,
    summary.request,
    summary.investigated,
    summary.learned,
    summary.completed,
    summary.next_steps
  );
}

/**
 * 세션 요약 조회
 */
export function getSessionSummary(sessionId: string): SessionSummary | null {
  return stmts().getBySession.get(sessionId) as SessionSummary | null;
}

/**
 * 최근 세션 요약 조회 (컨텍스트 주입용)
 */
export function getRecentSummaries(limit = 3): SessionSummary[] {
  return stmts().getRecent.all(limit) as SessionSummary[];
}

/**
 * AI로 세션 요약 생성 (Haiku 직접 호출 — 비용 절감)
 *
 * Agent SDK가 아닌 Messages API 직접 호출로 빠르고 저렴하게 요약.
 */
export async function generateSessionSummary(
  sessionId: string,
  messages: Array<{ role: string; content: string }>
): Promise<SessionSummary | null> {
  if (messages.length < 2) return null; // 단순 인사는 요약 불필요

  try {
    const client = new Anthropic();

    // 대화 내용을 간결하게 정리 (최대 3000자)
    const conversation = messages
      .map((m) => `${m.role === "user" ? "사용자" : "AI"}: ${m.content.slice(0, 500)}`)
      .join("\n")
      .slice(0, 3000);

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: `다음 대화를 요약하세요. 각 항목을 1-2문장으로 간결하게 작성하세요.

대화:
${conversation}

JSON으로 응답하세요:
{"request":"사용자가 요청한 것","investigated":"탐색/조사한 것","learned":"핵심 학습 내용","completed":"완료된 작업","next_steps":"다음 단계 제안"}`,
        },
      ],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";

    // JSON 파싱 시도
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);

    const summary: SessionSummary = {
      session_id: sessionId,
      request: parsed.request || "",
      investigated: parsed.investigated || "",
      learned: parsed.learned || "",
      completed: parsed.completed || "",
      next_steps: parsed.next_steps || "",
    };

    saveSessionSummary(summary);
    console.log(`[Summary] Session ${sessionId.slice(0, 8)} summarized`);
    return summary;
  } catch (e) {
    console.warn("[Summary] Failed to generate:", (e as Error).message?.slice(0, 60));
    return null;
  }
}
