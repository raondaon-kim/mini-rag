/**
 * File Watcher — docs/ 디렉토리 자동 인덱싱
 *
 * chokidar로 지정 디렉토리를 감시하여:
 * - 새 파일 추가 → 자동 인덱싱
 * - 파일 수정 → 재인덱싱 (해시 비교)
 * - 파일 삭제 → 인덱스에서 제거
 */
import chokidar from "chokidar";
import path from "path";
import { stat } from "fs/promises";
import { readDocument, getSupportedExtensions } from "./reader.js";
import { computeHash, isDuplicate } from "./deduplicator.js";
import { chunkDocument } from "./chunker.js";
import { indexDocument, deleteDocument } from "./indexer.js";
import { logTask } from "../memory/task-log.js";
import db from "../db/connection.js";

let watcher: ReturnType<typeof chokidar.watch> | null = null;
let processing = false;
const queue: { type: "add" | "change" | "unlink"; filePath: string }[] = [];

// 지원 확장자 세트
const SUPPORTED = new Set(getSupportedExtensions());

function isSupported(filePath: string): boolean {
  return SUPPORTED.has(path.extname(filePath).toLowerCase());
}

// 파일 경로 → document_id 조회
function getDocIdByPath(filePath: string): number | null {
  const stmt = db.prepare("SELECT id FROM documents WHERE file_path = ?");
  const row = stmt.get(filePath) as { id: number } | undefined;
  return row?.id ?? null;
}

async function processFile(type: string, filePath: string) {
  const absPath = path.resolve(filePath);

  if (type === "unlink") {
    // 파일 삭제 → 인덱스에서 제거
    const docId = getDocIdByPath(absPath);
    if (docId) {
      deleteDocument(docId);
      logTask(null, `Auto-removed: ${path.basename(filePath)}`, "File deleted, index updated", [filePath]);
      console.log("[Watcher] Removed from index:", path.basename(filePath));
    }
    return;
  }

  // add / change → 인덱싱
  try {
    const { content, metadata } = await readDocument(absPath);
    if (!content.trim()) return;

    const hash = computeHash(content);
    const existingId = isDuplicate(hash);
    if (existingId) {
      // 해시 동일 → 변경 없음, skip
      return;
    }

    const fileName = path.basename(filePath);
    const format = metadata.format as string;
    const chunks = chunkDocument(fileName, content, format, metadata);
    const fileSize = (await stat(absPath)).size;

    const result = await indexDocument(absPath, fileName, format, hash, metadata, fileSize, chunks);

    logTask(
      null,
      `Auto-indexed: ${fileName}`,
      `${result.chunks_created} chunks (${type === "change" ? "re-indexed" : "new"})`,
      [fileName]
    );
    console.log("[Watcher] %s: %s → %d chunks", type === "change" ? "Re-indexed" : "Indexed", fileName, result.chunks_created);
  } catch (e) {
    console.error("[Watcher] Failed to process %s:", path.basename(filePath), (e as Error).message?.slice(0, 80));
  }
}

async function drainQueue() {
  if (processing || queue.length === 0) return;
  processing = true;

  while (queue.length > 0) {
    const item = queue.shift()!;
    await processFile(item.type, item.filePath);
  }

  processing = false;
}

/**
 * docs/ 디렉토리 감시 시작
 */
export function startWatcher(docsPath: string) {
  const absDocsPath = path.resolve(docsPath);

  // 지원 확장자 glob 패턴
  const extensions = getSupportedExtensions().map((ext) => `*${ext}`);

  watcher = chokidar.watch(absDocsPath, {
    ignored: /(^|[\/\\])\../, // dotfiles 무시
    persistent: true,
    ignoreInitial: false, // 기존 파일도 처리
    awaitWriteFinish: {
      stabilityThreshold: 1000, // 1초 대기 후 안정되면 처리
      pollInterval: 200,
    },
    depth: 3, // 최대 3단계 하위 폴더
  });

  watcher
    .on("add", (filePath: string) => {
      if (!isSupported(filePath)) return;
      queue.push({ type: "add", filePath });
      drainQueue();
    })
    .on("change", (filePath: string) => {
      if (!isSupported(filePath)) return;
      queue.push({ type: "change", filePath });
      drainQueue();
    })
    .on("unlink", (filePath: string) => {
      if (!isSupported(filePath)) return;
      queue.push({ type: "unlink", filePath });
      drainQueue();
    })
    .on("ready", () => {
      console.log("[Watcher] Watching %s for document changes", absDocsPath);
    })
    .on("error", (error: unknown) => {
      console.error("[Watcher] Error:", (error as Error).message);
    });

  return watcher;
}

/**
 * 감시 중지
 */
export async function stopWatcher() {
  if (watcher) {
    await watcher.close();
    watcher = null;
    console.log("[Watcher] Stopped");
  }
}
