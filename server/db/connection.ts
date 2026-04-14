import Database, { type Database as DatabaseType } from "better-sqlite3";
import * as sqliteVec from "sqlite-vec";
import path from "path";

const DB_PATH = process.env.DB_PATH || "./data/rag.sqlite";

const db: DatabaseType = new Database(path.resolve(DB_PATH));

// Performance settings
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.pragma("busy_timeout = 5000");
db.pragma("synchronous = NORMAL");
db.pragma("cache_size = -64000"); // 64MB

// sqlite-vec extension loading
let vectorEnabled = false;
try {
  sqliteVec.load(db);
  const version = db.prepare("SELECT vec_version()").get() as Record<string, string>;
  vectorEnabled = true;
  console.log("[DB] sqlite-vec loaded:", Object.values(version)[0], "— hybrid search enabled");
} catch (e) {
  console.log("[DB] sqlite-vec not available:", (e as Error).message?.slice(0, 60));
  console.log("[DB] Running in FTS5-only mode");
}

export { db, vectorEnabled };
export default db;
