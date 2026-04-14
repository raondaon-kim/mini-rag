import db from "../db/connection.js";

let _tl: {
  insert: any;
  list: any;
  bySession: any;
} | null = null;

function tl() {
  if (!_tl) {
    _tl = {
      insert: db.prepare("INSERT INTO task_log (session_id, action, result, related_files) VALUES (?, ?, ?, ?)"),
      list: db.prepare("SELECT * FROM task_log ORDER BY created_at DESC LIMIT ?"),
      bySession: db.prepare("SELECT * FROM task_log WHERE session_id = ? ORDER BY created_at DESC"),
    };
  }
  return _tl;
}

export function logTask(
  sessionId: string | null,
  action: string,
  result: string,
  relatedFiles: string[] = []
): void {
  tl().insert.run(sessionId, action, result, JSON.stringify(relatedFiles));
}

export function getTaskLog(limit = 50) {
  return tl().list.all(limit);
}

export function getSessionTaskLog(sessionId: string) {
  return tl().bySession.all(sessionId);
}
