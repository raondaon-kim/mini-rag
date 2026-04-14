import db from "../db/connection.js";
import { randomUUID } from "crypto";

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  sources?: unknown[];
}

let _stmts: {
  insert: any;
  update: any;
  get: any;
  list: any;
} | null = null;

function cs() {
  if (!_stmts) {
    _stmts = {
      insert: db.prepare("INSERT INTO conversations (id, title, messages) VALUES (?, ?, ?)"),
      update: db.prepare("UPDATE conversations SET messages = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"),
      get: db.prepare("SELECT * FROM conversations WHERE id = ?"),
      list: db.prepare("SELECT id, title, created_at, updated_at FROM conversations ORDER BY updated_at DESC LIMIT ?"),
    };
  }
  return _stmts;
}

export function createConversation(title?: string): string {
  const id = randomUUID();
  cs().insert.run(id, title || `Session ${new Date().toISOString().slice(0, 16)}`, "[]");
  return id;
}

export function addMessage(conversationId: string, message: ConversationMessage): void {
  const conv = cs().get.get(conversationId) as { messages: string } | undefined;
  if (!conv) return;
  const messages: ConversationMessage[] = JSON.parse(conv.messages);
  messages.push(message);
  cs().update.run(JSON.stringify(messages), conversationId);
}

export function getConversation(conversationId: string) {
  return cs().get.get(conversationId) as {
    id: string; title: string; messages: string;
    created_at: string; updated_at: string;
  } | undefined;
}

export function listConversations(limit = 20) {
  return cs().list.all(limit);
}
