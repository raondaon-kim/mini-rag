/**
 * Session Events — append-only 이벤트 로그
 *
 * Managed Agents 패턴 차용: 모든 대화 이벤트를 개별 행으로 기록.
 * 대화 재구성, 도구 추적, 디버깅에 활용.
 */
import db from "../db/connection.js";

export interface SessionEvent {
  id?: number;
  session_id: string;
  event_type: string;
  agent_name?: string;
  payload: Record<string, unknown>;
  created_at?: string;
}

// Lazy-init
let _stmts: {
  insert: any;
  getBySession: any;
  getByType: any;
  getMessages: any;
} | null = null;

function stmts() {
  if (!_stmts) {
    _stmts = {
      insert: db.prepare(
        "INSERT INTO session_events (session_id, event_type, agent_name, observation_type, payload) VALUES (?, ?, ?, ?, ?)"
      ),
      getBySession: db.prepare(
        "SELECT * FROM session_events WHERE session_id = ? ORDER BY id ASC"
      ),
      getByType: db.prepare(
        "SELECT * FROM session_events WHERE session_id = ? AND event_type = ? ORDER BY id ASC"
      ),
      getMessages: db.prepare(
        "SELECT * FROM session_events WHERE session_id = ? AND event_type IN ('user.message', 'agent.message') ORDER BY id ASC"
      ),
    };
  }
  return _stmts;
}

/**
 * 이벤트 기록 (append-only)
 */
/**
 * 이벤트 기록 (append-only)
 * @param observationType - 작업 분류: question, document_creation, analysis, search, memory, general
 */
export function appendEvent(
  sessionId: string,
  eventType: string,
  payload: Record<string, unknown>,
  agentName?: string,
  observationType?: string
): number {
  const result = stmts().insert.run(
    sessionId,
    eventType,
    agentName || null,
    observationType || null,
    JSON.stringify(payload)
  );
  return Number(result.lastInsertRowid);
}

/**
 * 세션의 모든 이벤트 조회
 */
export function getEvents(sessionId: string): SessionEvent[] {
  const rows = stmts().getBySession.all(sessionId) as any[];
  return rows.map((r) => ({
    ...r,
    payload: JSON.parse(r.payload),
  }));
}

/**
 * 특정 유형 이벤트만 조회
 */
export function getEventsByType(sessionId: string, eventType: string): SessionEvent[] {
  const rows = stmts().getByType.all(sessionId, eventType) as any[];
  return rows.map((r) => ({
    ...r,
    payload: JSON.parse(r.payload),
  }));
}

/**
 * 메시지만 조회 (user.message + agent.message) — 대화 복원용
 */
export function getSessionMessages(sessionId: string): Array<{
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  sources?: unknown[];
}> {
  const rows = stmts().getMessages.all(sessionId) as any[];
  return rows.map((r) => {
    const payload = JSON.parse(r.payload);
    return {
      role: r.event_type === "user.message" ? "user" as const : "assistant" as const,
      content: payload.content || "",
      timestamp: r.created_at,
      sources: payload.sources,
    };
  });
}
