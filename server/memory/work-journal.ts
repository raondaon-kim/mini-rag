/**
 * Work Journal — 작업 학습 기록
 *
 * 작업 수행 시 어떤 Skill/프레임워크를 적용했고 결과가 어땠는지 기록.
 * 같은 유형의 작업 반복 시 이전 기록을 참조하여 개선.
 */
import db from "../db/connection.js";

export interface WorkJournalEntry {
  id?: number;
  task_type: string;
  skill_used: string;
  description: string;
  output_file?: string;
  user_feedback?: string;
  lessons?: string;
  quality_notes?: string;
  created_at?: string;
}

// Lazy-init stmts
let _stmts: {
  insert: any;
  queryByType: any;
  queryRecent: any;
  queryBySkill: any;
  search: any;
  updateFeedback: any;
  getById: any;
} | null = null;

function stmts() {
  if (!_stmts) {
    _stmts = {
      insert: db.prepare(`
        INSERT INTO work_journal (task_type, skill_used, description, output_file, user_feedback, lessons, quality_notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `),
      queryByType: db.prepare(`
        SELECT * FROM work_journal WHERE task_type = ? ORDER BY created_at DESC LIMIT ?
      `),
      queryRecent: db.prepare(`
        SELECT * FROM work_journal ORDER BY created_at DESC LIMIT ?
      `),
      queryBySkill: db.prepare(`
        SELECT * FROM work_journal WHERE skill_used = ? ORDER BY created_at DESC LIMIT ?
      `),
      search: db.prepare(`
        SELECT * FROM work_journal
        WHERE task_type LIKE ? OR skill_used LIKE ? OR description LIKE ? OR lessons LIKE ?
        ORDER BY created_at DESC LIMIT ?
      `),
      updateFeedback: db.prepare(`
        UPDATE work_journal SET user_feedback = ?, lessons = COALESCE(lessons || '\n' || ?, lessons)
        WHERE id = ?
      `),
      getById: db.prepare(`SELECT * FROM work_journal WHERE id = ?`),
    };
  }
  return _stmts;
}

export function saveWorkJournal(entry: WorkJournalEntry): number {
  const result = stmts().insert.run(
    entry.task_type,
    entry.skill_used,
    entry.description,
    entry.output_file || null,
    entry.user_feedback || null,
    entry.lessons || null,
    entry.quality_notes || null
  );
  return Number(result.lastInsertRowid);
}

export function queryWorkJournal(
  taskType?: string,
  limit = 5
): WorkJournalEntry[] {
  if (taskType) {
    return stmts().queryByType.all(taskType, limit) as WorkJournalEntry[];
  }
  return stmts().queryRecent.all(limit) as WorkJournalEntry[];
}

export function queryBySkill(
  skillUsed: string,
  limit = 5
): WorkJournalEntry[] {
  return stmts().queryBySkill.all(skillUsed, limit) as WorkJournalEntry[];
}

export function searchWorkJournal(
  keyword: string,
  limit = 10
): WorkJournalEntry[] {
  const pattern = `%${keyword}%`;
  return stmts().search.all(pattern, pattern, pattern, pattern, limit) as WorkJournalEntry[];
}

export function addFeedbackToJournal(
  journalId: number,
  feedback: string,
  lesson?: string
): void {
  stmts().updateFeedback.run(feedback, lesson || null, journalId);
}

export function getJournalEntry(id: number): WorkJournalEntry | undefined {
  return stmts().getById.get(id) as WorkJournalEntry | undefined;
}

// ==============================
// 압축 (Digest) 시스템
// ==============================

export interface WorkDigest {
  task_type: string;
  total_count: number;
  skills_used: string[];
  common_lessons: string[];
  common_feedback: string[];
  last_updated: string;
}

/**
 * task_type별 압축 요약을 생성합니다.
 * 최근 5건은 전문 유지, 나머지는 패턴만 추출.
 */
export function getDigest(taskType: string): WorkDigest {
  const all = stmts().queryByType.all(taskType, 100) as WorkJournalEntry[];

  const skills = new Set<string>();
  const lessons: string[] = [];
  const feedbacks: string[] = [];

  for (const entry of all) {
    skills.add(entry.skill_used);
    if (entry.lessons) lessons.push(entry.lessons);
    if (entry.user_feedback) feedbacks.push(entry.user_feedback);
  }

  // 반복되는 교훈/피드백만 추출 (2회 이상 등장)
  const countMap = (arr: string[]) => {
    const map = new Map<string, number>();
    for (const item of arr) {
      // 간단 정규화: 공백 제거, 소문자
      const key = item.trim().toLowerCase().slice(0, 100);
      map.set(key, (map.get(key) || 0) + 1);
    }
    return [...map.entries()]
      .filter(([, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .map(([text]) => text);
  };

  return {
    task_type: taskType,
    total_count: all.length,
    skills_used: [...skills],
    common_lessons: countMap(lessons).slice(0, 5),
    common_feedback: countMap(feedbacks).slice(0, 5),
    last_updated: all[0]?.created_at || "",
  };
}

/**
 * 작업 조회 시 스마트하게 반환:
 * - 최근 3건은 전문 (상세 참고용)
 * - + 전체 압축 요약 (패턴 파악용)
 */
export function getSmartContext(taskType: string): {
  recent: WorkJournalEntry[];
  digest: WorkDigest;
} {
  const recent = stmts().queryByType.all(taskType, 3) as WorkJournalEntry[];
  const digest = getDigest(taskType);
  return { recent, digest };
}

/**
 * 오래된 기록 정리 (90일 이전, task_type별 최신 5건 제외)
 */
export function pruneOldEntries(daysOld = 90): number {
  const cutoff = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000).toISOString();
  const result = db.prepare(`
    DELETE FROM work_journal
    WHERE created_at < ?
    AND id NOT IN (
      SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY task_type ORDER BY created_at DESC) as rn
        FROM work_journal
      ) WHERE rn <= 5
    )
  `).run(cutoff);
  return result.changes;
}
