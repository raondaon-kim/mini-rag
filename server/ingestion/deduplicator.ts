import { createHash } from "crypto";
import db from "../db/connection.js";

let checkHashStmt: ReturnType<typeof db.prepare> | null = null;

export function computeHash(content: string): string {
  return createHash("sha256").update(content, "utf-8").digest("hex");
}

export function isDuplicate(contentHash: string): number | null {
  if (!checkHashStmt) {
    checkHashStmt = db.prepare("SELECT id FROM documents WHERE content_hash = ?");
  }
  const row = checkHashStmt.get(contentHash) as { id: number } | undefined;
  return row ? row.id : null;
}
