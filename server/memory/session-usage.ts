/**
 * Session Usage — 토큰 사용량 + 비용 추적
 *
 * Agent SDK의 result 이벤트에서 usage 정보를 추출하여 저장.
 * 세션별 비용 추적, 에이전트별 비교에 활용.
 */
import db from "../db/connection.js";

export interface SessionUsage {
  session_id: string;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  total_cost_usd: number;
  num_turns: number;
  model?: string;
}

// Lazy-init
let _stmts: {
  upsert: any;
  getBySession: any;
  getTotals: any;
} | null = null;

function stmts() {
  if (!_stmts) {
    _stmts = {
      upsert: db.prepare(`
        INSERT INTO session_usage (session_id, input_tokens, output_tokens, cache_read_tokens, total_cost_usd, num_turns, model)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(session_id) DO UPDATE SET
          input_tokens = excluded.input_tokens,
          output_tokens = excluded.output_tokens,
          cache_read_tokens = excluded.cache_read_tokens,
          total_cost_usd = excluded.total_cost_usd,
          num_turns = excluded.num_turns,
          model = excluded.model
      `),
      getBySession: db.prepare(
        "SELECT * FROM session_usage WHERE session_id = ?"
      ),
      getTotals: db.prepare(`
        SELECT
          COUNT(*) as total_sessions,
          SUM(input_tokens) as total_input_tokens,
          SUM(output_tokens) as total_output_tokens,
          SUM(total_cost_usd) as total_cost_usd,
          SUM(num_turns) as total_turns
        FROM session_usage
      `),
    };
  }
  return _stmts;
}

/**
 * 세션 사용량 저장 (upsert)
 */
export function saveSessionUsage(usage: SessionUsage): void {
  stmts().upsert.run(
    usage.session_id,
    usage.input_tokens,
    usage.output_tokens,
    usage.cache_read_tokens,
    usage.total_cost_usd,
    usage.num_turns,
    usage.model || null
  );
}

/**
 * 세션별 사용량 조회
 */
export function getSessionUsage(sessionId: string): SessionUsage | null {
  return stmts().getBySession.get(sessionId) as SessionUsage | null;
}

/**
 * 전체 사용량 합계 (status API용)
 */
export function getTotalUsage(): {
  total_sessions: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cost_usd: number;
  total_turns: number;
} {
  return stmts().getTotals.get() as any;
}
