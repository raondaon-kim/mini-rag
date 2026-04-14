/**
 * Centralized path configuration
 *
 * All file paths use DATA_PATH as base directory.
 * Supports Render.com Persistent Disk: set DATA_PATH=/opt/render/project/data
 */
import path from "path";

export const DATA_PATH = process.env.DATA_PATH || "./data";
export const DOCS_PATH = process.env.DOCS_PATH || "./docs";

export const PATHS = {
  db: process.env.DB_PATH || path.join(DATA_PATH, "rag.sqlite"),
  output: path.resolve(DATA_PATH, "output"),
  summaries: path.resolve(DATA_PATH, "output/summaries"),
  memory: path.resolve(DATA_PATH, "memory"),
  knowledgeGraph: path.resolve(DATA_PATH, "memory/knowledge-graph.json"),
  intents: path.resolve(DATA_PATH, "memory/intents"),
  conversations: path.resolve(DATA_PATH, "memory/conversations"),
  taskLog: path.resolve(DATA_PATH, "memory/task-log"),
  docs: path.resolve(DOCS_PATH),
};
