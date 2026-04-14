import { Router, type Request, type Response } from "express";
import multer from "multer";
import { readDocument } from "../ingestion/reader.js";
import { computeHash, isDuplicate } from "../ingestion/deduplicator.js";
import { chunkDocument } from "../ingestion/chunker.js";
import { indexDocument } from "../ingestion/indexer.js";
import { logTask } from "../memory/task-log.js";
import { getDocumentSummary } from "../memory/document-summary.js";
import { stat } from "fs/promises";
import path from "path";

// 요약 생성 진행 상태 추적
const summaryStatus = new Map<number, { status: string; progress?: string }>();

export function getSummaryStatus(docId: number) {
  return summaryStatus.get(docId) || null;
}

const router = Router();

const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (_req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

router.post("/api/upload", upload.single("file"), async (req: Request, res: Response) => {
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: "No file provided" });
    return;
  }

  try {
    const t0 = Date.now();

    // 1. Read and convert document
    const { content, metadata } = await readDocument(file.path);
    const t1 = Date.now();
    console.log(`[Upload] Step 1 Read: ${t1 - t0}ms`);

    if (!content.trim()) {
      res.status(400).json({ error: "Document is empty or could not be parsed" });
      return;
    }

    // 2. Dedup check
    const hash = computeHash(content);
    const existingId = isDuplicate(hash);
    if (existingId) {
      res.json({
        document_id: existingId,
        file_name: file.originalname,
        format: metadata.format,
        chunks_created: 0,
        status: "duplicate",
        duplicate: true,
      });
      return;
    }

    // 3. Chunk
    const format = metadata.format as string;
    const chunks = chunkDocument(file.originalname, content, format, metadata);
    const t2 = Date.now();
    console.log(`[Upload] Step 3 Chunk: ${t2 - t1}ms (${chunks.length} chunks)`);

    // 4. Index
    const fileSize = (await stat(file.path)).size;
    const result = await indexDocument(
      file.path,
      file.originalname,
      format,
      hash,
      metadata,
      fileSize,
      chunks
    );

    const t3 = Date.now();
    console.log(`[Upload] Step 4 Index: ${t3 - t2}ms`);
    console.log(`[Upload] Total (upload→index): ${t3 - t0}ms`);

    // 5. Log task
    logTask(
      null,
      `Document uploaded: ${file.originalname}`,
      `${result.chunks_created} chunks indexed`,
      [file.originalname]
    );

    // 요약 상태 추적 시작
    summaryStatus.set(result.document_id, { status: "generating", progress: "요약 생성 중..." });

    res.json({
      document_id: result.document_id,
      file_name: file.originalname,
      format,
      chunks_created: result.chunks_created,
      status: "indexed",
      duplicate: false,
      summary_status: "generating",
    });

    // 요약 생성 완료 시 상태 업데이트 (indexer에서 비동기로 실행 중)
    // 폴링으로 확인 가능
    const checkSummary = setInterval(() => {
      const summary = getDocumentSummary(result.document_id);
      if (summary) {
        summaryStatus.set(result.document_id, { status: "done", progress: "요약 완료" });
        clearInterval(checkSummary);
      }
    }, 3000);

    // 5분 후 타임아웃
    setTimeout(() => {
      clearInterval(checkSummary);
      if (!getDocumentSummary(result.document_id)) {
        summaryStatus.set(result.document_id, { status: "failed", progress: "요약 생성 시간 초과" });
      }
    }, 300000);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: errMsg });
  }
});

// 요약 생성 상태 확인 API
router.get("/api/documents/:id/summary-status", (req: Request, res: Response) => {
  const docId = parseInt(req.params.id as string);
  const status = summaryStatus.get(docId);
  const summary = getDocumentSummary(docId);

  if (summary) {
    res.json({ status: "done", title: summary.title, summary: summary.summary.slice(0, 200) });
  } else if (status) {
    res.json(status);
  } else {
    res.json({ status: "none" });
  }
});

export default router;
