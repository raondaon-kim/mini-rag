import { useState, useCallback, useRef } from "react";

export interface UploadResult {
  document_id: number;
  file_name: string;
  format: string;
  chunks_created: number;
  status: string;
  duplicate: boolean;
  summary_status?: string;
}

export type UploadPhase = "idle" | "uploading" | "indexing" | "summarizing" | "done" | "error";

export function useUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [phase, setPhase] = useState<UploadPhase>("idle");
  const [progress, setProgress] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<UploadResult | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const upload = useCallback(async (file: File): Promise<UploadResult> => {
    setIsUploading(true);
    setPhase("uploading");
    setProgress(`${file.name} 업로드 중...`);

    try {
      const form = new FormData();
      form.append("file", file);

      setPhase("indexing");
      setProgress(`${file.name} 인덱싱 중...`);

      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data: UploadResult = await res.json();
      setLastResult(data);

      if (data.duplicate) {
        setPhase("done");
        setProgress(`${file.name} — 이미 등록된 문서`);
        setIsUploading(false);
        return data;
      }

      // 요약 생성 폴링 시작
      if (data.summary_status === "generating") {
        setPhase("summarizing");
        setProgress(`${file.name} — ${data.chunks_created}개 청크 인덱싱 완료. AI 요약 생성 중...`);

        // 3초마다 요약 상태 확인
        pollRef.current = setInterval(async () => {
          try {
            const statusRes = await fetch(`/api/documents/${data.document_id}/summary-status`);
            const status = await statusRes.json();

            if (status.status === "done") {
              setPhase("done");
              setProgress(`${file.name} — 인덱싱 + 요약 완료!`);
              setIsUploading(false);
              stopPolling();
            } else if (status.status === "failed") {
              setPhase("done");
              setProgress(`${file.name} — ${data.chunks_created}개 청크 인덱싱 완료 (요약 생성 실패)`);
              setIsUploading(false);
              stopPolling();
            }
          } catch { /* ignore */ }
        }, 3000);

        // 3분 타임아웃
        setTimeout(() => {
          if (pollRef.current) {
            stopPolling();
            setPhase("done");
            setProgress(`${file.name} — ${data.chunks_created}개 청크 인덱싱 완료 (요약 생성 진행 중)`);
            setIsUploading(false);
          }
        }, 180000);
      } else {
        setPhase("done");
        setProgress(`${file.name} — ${data.chunks_created}개 청크 인덱싱 완료!`);
        setIsUploading(false);
      }

      return data;
    } catch (e) {
      setPhase("error");
      setProgress(`업로드 실패`);
      setIsUploading(false);
      throw e;
    }
  }, [stopPolling]);

  const resetProgress = useCallback(() => {
    setPhase("idle");
    setProgress(null);
    stopPolling();
  }, [stopPolling]);

  return { upload, isUploading, phase, progress, lastResult, resetProgress };
}
