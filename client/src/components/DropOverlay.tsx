import type { UploadPhase } from "../hooks/useUpload";

interface Props {
  isActive: boolean;
  phase: UploadPhase;
  progress: string | null;
}

const PHASE_ICONS: Record<UploadPhase, "spin" | "check" | "error" | "none"> = {
  idle: "none",
  uploading: "spin",
  indexing: "spin",
  summarizing: "spin",
  done: "check",
  error: "error",
};

const PHASE_LABELS: Record<UploadPhase, string> = {
  idle: "",
  uploading: "파일 업로드 중",
  indexing: "문서 분석 및 인덱싱 중",
  summarizing: "AI 요약 생성 중 (전체 문서 분석)",
  done: "완료",
  error: "오류 발생",
};

export default function DropOverlay({ isActive, phase, progress }: Props) {
  const isProcessing = phase !== "idle";
  if (!isActive && !isProcessing) return null;

  const icon = PHASE_ICONS[phase] || "none";
  const label = PHASE_LABELS[phase] || "";

  return (
    <div className="fixed inset-0 z-[100] animate-drop-zone flex items-center justify-center">
      <div className="absolute inset-0 bg-desk-bg/85 backdrop-blur-md" />

      <div className="relative text-center max-w-md">
        {isProcessing ? (
          <div className="animate-fade-in">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-amber-glow/10 border-2 border-amber-glow/30 flex items-center justify-center shadow-lg shadow-amber-dim/20">
              {icon === "spin" && (
                <div className="w-7 h-7 border-2 border-amber-glow border-t-transparent rounded-full animate-spin" />
              )}
              {icon === "check" && (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#e8a84c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
              {icon === "error" && (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              )}
            </div>
            <p className="font-display text-xl text-paper-white mb-2">
              {progress || label}
            </p>
            {phase === "summarizing" && (
              <p className="font-body text-sm text-ink-400">
                대용량 문서는 수 분이 소요될 수 있습니다. 완료 시 자동으로 닫힙니다.
              </p>
            )}
            {phase !== "done" && phase !== "error" && (
              <div className="mt-4 flex items-center justify-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-glow animate-pulse" />
                <span className="text-xs font-body text-ink-500">{label}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="animate-fade-in">
            <div className="w-24 h-24 mx-auto mb-6 rounded-2xl border-2 border-dashed border-amber-glow/40 flex items-center justify-center animate-pulse-glow">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#e8a84c" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <p className="font-display text-2xl text-paper-white mb-2">파일을 여기에 놓으세요</p>
            <p className="font-body text-sm text-ink-400">PDF, DOCX, PPTX, XLSX, Markdown, 코드 파일</p>
          </div>
        )}
      </div>
    </div>
  );
}
