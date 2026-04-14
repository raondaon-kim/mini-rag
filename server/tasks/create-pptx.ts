/**
 * PowerPoint 파일 생성 헬퍼 — 프로페셔널 디자인
 *
 * 디자인 원칙:
 * - 슬라이드 마스터: 다크 네이비 헤더 바 + 클린 화이트 본문
 * - 색상 팔레트: Navy #1B2A4A, Blue #2F5496, Accent #E8A84C, Gray #6B7280
 * - 폰트: 제목 28pt bold, 본문 16pt, 각주 10pt
 * - 요소: 하단 진행 바, 슬라이드 번호, 로고 영역, 구분선
 */
import pptxgenjs from "pptxgenjs";
import { writeFile } from "fs/promises";
import path from "path";

const PptxGenJS = (pptxgenjs as any).default || pptxgenjs;

// 디자인 상수
const COLORS = {
  navy: "1B2A4A",
  blue: "2F5496",
  accent: "E8A84C",
  dark: "1E293B",
  text: "334155",
  lightText: "94A3B8",
  white: "FFFFFF",
  bgLight: "F8FAFC",
  border: "E2E8F0",
};

export interface SlideData {
  title: string;
  content: string;
  notes?: string;
  layout?: "title" | "content" | "two-column" | "section";
}

export async function createPptx(
  fileName: string,
  slides: SlideData[],
  options: { author?: string; title?: string } = {},
  outputDir = "data/output"
): Promise<string> {
  const pptx = new PptxGenJS();
  pptx.author = options.author || "Mini-RAG";
  pptx.title = options.title || fileName.replace(".pptx", "");
  pptx.layout = "LAYOUT_WIDE"; // 16:9

  // 슬라이드 마스터 정의
  pptx.defineSlideMaster({
    title: "MASTER",
    background: { color: COLORS.white },
    objects: [
      // 상단 네이비 바
      { rect: { x: 0, y: 0, w: "100%", h: 0.08, fill: { color: COLORS.navy } } },
      // 하단 바 (슬라이드 번호용)
      { rect: { x: 0, y: 7.1, w: "100%", h: 0.4, fill: { color: COLORS.bgLight } } },
      // 하단 구분선
      { line: { x1: 0, y1: 7.1, x2: 13.33, y2: 7.1, line: { color: COLORS.border, width: 1 } } },
      // 프레젠테이션 제목 (하단 좌측)
      {
        text: {
          text: options.title || fileName.replace(".pptx", ""),
          options: { x: 0.5, y: 7.15, w: 5, h: 0.3, fontSize: 8, color: COLORS.lightText },
        },
      },
    ],
    slideNumber: { x: 12.4, y: 7.15, fontSize: 8, color: COLORS.lightText },
  });

  for (let i = 0; i < slides.length; i++) {
    const slideData = slides[i];
    const isFirst = i === 0;
    const layout = slideData.layout || (isFirst ? "title" : "content");

    if (layout === "title" && isFirst) {
      addTitleSlide(pptx, slideData, options.title || slideData.title);
    } else if (layout === "section") {
      addSectionSlide(pptx, slideData);
    } else {
      addContentSlide(pptx, slideData, i + 1, slides.length);
    }

    // 발표자 노트는 마지막에 추가 (pptxgenjs API 제약)
  }

  const outPath = path.resolve(outputDir, fileName);
  const buf = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
  await writeFile(outPath, buf);
  return outPath;
}

function addTitleSlide(pptx: any, data: SlideData, presentationTitle: string) {
  const slide = pptx.addSlide({ masterName: "MASTER" });

  // 전체 배경을 네이비로
  slide.background = { color: COLORS.navy };

  // 상단 엑센트 라인
  slide.addShape("rect", {
    x: 0, y: 0, w: "100%", h: 0.06,
    fill: { color: COLORS.accent },
  });

  // 메인 타이틀
  slide.addText(data.title, {
    x: 1, y: 2.2, w: 11.33, h: 1.5,
    fontSize: 36, bold: true, color: COLORS.white,
    align: "left", valign: "bottom",
  });

  // 구분선
  slide.addShape("line", {
    x: 1, y: 3.9, w: 2, h: 0,
    line: { color: COLORS.accent, width: 3 },
  });

  // 부제목 / 내용
  if (data.content) {
    slide.addText(data.content, {
      x: 1, y: 4.2, w: 11.33, h: 1.5,
      fontSize: 18, color: COLORS.lightText,
      align: "left", valign: "top",
    });
  }

  // 하단 정보
  slide.addText(new Date().toLocaleDateString("ko-KR"), {
    x: 1, y: 6.5, w: 4, h: 0.4,
    fontSize: 12, color: COLORS.lightText,
  });

  if (data.notes) slide.addNotes(data.notes);
}

function addSectionSlide(pptx: any, data: SlideData) {
  const slide = pptx.addSlide({ masterName: "MASTER" });
  slide.background = { color: COLORS.blue };

  slide.addText(data.title, {
    x: 1, y: 2.5, w: 11.33, h: 2,
    fontSize: 32, bold: true, color: COLORS.white,
    align: "left", valign: "middle",
  });

  slide.addShape("line", {
    x: 1, y: 4.7, w: 1.5, h: 0,
    line: { color: COLORS.accent, width: 3 },
  });

  if (data.notes) slide.addNotes(data.notes);
}

function addContentSlide(pptx: any, data: SlideData, num: number, total: number) {
  const slide = pptx.addSlide({ masterName: "MASTER" });

  // 제목 영역 (상단)
  slide.addText(data.title, {
    x: 0.7, y: 0.3, w: 11.9, h: 0.9,
    fontSize: 24, bold: true, color: COLORS.navy,
    valign: "middle",
  });

  // 제목 하단 엑센트 라인
  slide.addShape("line", {
    x: 0.7, y: 1.25, w: 1.2, h: 0,
    line: { color: COLORS.accent, width: 2.5 },
  });

  // 본문 — 불릿 파싱
  const lines = data.content.split("\n").filter((l) => l.trim());
  const textItems: Array<{ text: string; options: Record<string, unknown> }> = [];

  for (const line of lines) {
    const trimmed = line.trim();
    const isBullet = trimmed.startsWith("- ") || trimmed.startsWith("• ") || trimmed.startsWith("* ");
    const isNumbered = /^\d+[\.\)]\s/.test(trimmed);
    const isSubBullet = trimmed.startsWith("  - ") || trimmed.startsWith("  • ");

    if (isBullet || isNumbered) {
      const cleanText = trimmed.replace(/^[-•*]\s+/, "").replace(/^\d+[\.\)]\s+/, "");
      textItems.push({
        text: cleanText,
        options: {
          fontSize: 15,
          color: COLORS.text,
          bullet: { type: "bullet", style: "•", indent: isBullet ? 18 : 0 },
          paraSpaceAfter: 6,
          ...(isSubBullet ? { indentLevel: 1 } : {}),
        },
      });
    } else if (trimmed.startsWith("**") && trimmed.endsWith("**")) {
      // 볼드 섹션 헤더
      textItems.push({
        text: trimmed.replace(/\*\*/g, ""),
        options: {
          fontSize: 16, bold: true, color: COLORS.blue,
          paraSpaceBefore: 10, paraSpaceAfter: 4,
        },
      });
    } else {
      textItems.push({
        text: trimmed,
        options: {
          fontSize: 15, color: COLORS.text,
          paraSpaceAfter: 6,
        },
      });
    }
  }

  slide.addText(textItems, {
    x: 0.7, y: 1.5, w: 11.9, h: 5.3,
    valign: "top",
    wrap: true,
  });

  // 진행 바 (하단)
  const progress = num / total;
  slide.addShape("rect", {
    x: 0, y: 7.05, w: 13.33 * progress, h: 0.05,
    fill: { color: COLORS.accent },
  });

  if (data.notes) slide.addNotes(data.notes);
}
