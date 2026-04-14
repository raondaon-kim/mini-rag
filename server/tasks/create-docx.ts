/**
 * Word 문서 생성 헬퍼 — 프로페셔널 디자인
 *
 * 디자인 원칙:
 * - 표지: 제목 + 날짜 + 작성자 + 구분선
 * - 본문: Heading 1/2/3 스타일 체계, 줄간격 1.5, 단락 간격
 * - 머리글/바닥글: 문서 제목 + 페이지 번호
 * - 마진: 2.54cm (표준)
 * - 색상: Navy #1B2A4A (헤딩), Accent #E8A84C (구분선)
 */
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  PageNumber,
  Header,
  Footer,
  Tab,
  TabStopPosition,
  TabStopType,
  BorderStyle,
  PageBreak,
  ShadingType,
} from "docx";
import { writeFile } from "fs/promises";
import path from "path";

const COLORS = {
  navy: "1B2A4A",
  blue: "2F5496",
  accent: "E8A84C",
  text: "334155",
  lightText: "94A3B8",
};

export interface SectionData {
  heading?: string;
  headingLevel?: 1 | 2 | 3;
  content: string;
}

export async function createDocx(
  fileName: string,
  sections: SectionData[],
  options: { title?: string; author?: string } = {},
  outputDir = "data/output"
): Promise<string> {
  const children: Paragraph[] = [];
  const docTitle = options.title || fileName.replace(".docx", "");
  const date = new Date().toLocaleDateString("ko-KR", {
    year: "numeric", month: "long", day: "numeric",
  });

  // ========== 표지 ==========
  // 상단 여백
  children.push(new Paragraph({ spacing: { after: 600 }, children: [] }));
  children.push(new Paragraph({ spacing: { after: 600 }, children: [] }));

  // 엑센트 라인
  children.push(
    new Paragraph({
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: COLORS.accent } },
      spacing: { after: 200 },
      children: [],
    })
  );

  // 메인 타이틀
  children.push(
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: docTitle,
          bold: true,
          size: 56, // 28pt
          color: COLORS.navy,
          font: "Calibri",
        }),
      ],
    })
  );

  // 엑센트 라인
  children.push(
    new Paragraph({
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: COLORS.accent } },
      spacing: { after: 400 },
      children: [],
    })
  );

  // 날짜 + 작성자
  children.push(
    new Paragraph({
      spacing: { after: 60 },
      children: [
        new TextRun({ text: "작성일: ", size: 22, color: COLORS.lightText, font: "Calibri" }),
        new TextRun({ text: date, size: 22, color: COLORS.text, font: "Calibri" }),
      ],
    })
  );
  children.push(
    new Paragraph({
      spacing: { after: 200 },
      children: [
        new TextRun({ text: "작성자: ", size: 22, color: COLORS.lightText, font: "Calibri" }),
        new TextRun({ text: options.author || "Mini-RAG", size: 22, color: COLORS.text, font: "Calibri" }),
      ],
    })
  );

  // 페이지 브레이크
  children.push(
    new Paragraph({ children: [new PageBreak()] })
  );

  // ========== 섹션별 내용 ==========
  for (const section of sections) {
    if (section.heading) {
      const isH1 = section.headingLevel === 1 || !section.headingLevel;
      const isH3 = section.headingLevel === 3;
      const level = isH1 ? HeadingLevel.HEADING_1 : isH3 ? HeadingLevel.HEADING_3 : HeadingLevel.HEADING_2;
      const fontSize = isH1 ? 32 : isH3 ? 24 : 28;

      // H1 앞에 구분선
      if (isH1 && children.length > 5) {
        children.push(
          new Paragraph({
            border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: COLORS.lightText } },
            spacing: { before: 360, after: 200 },
            children: [],
          })
        );
      }

      children.push(
        new Paragraph({
          heading: level,
          spacing: { before: isH1 ? 360 : 240, after: 120 },
          children: [
            new TextRun({
              text: section.heading,
              bold: true,
              size: fontSize,
              color: COLORS.navy,
              font: "Calibri",
            }),
          ],
        })
      );
    }

    // 본문 — 줄바꿈 기준으로 문단 분리 + 불릿 처리
    const paragraphs = section.content.split("\n");
    for (const para of paragraphs) {
      const trimmed = para.trim();
      if (!trimmed) continue;

      const isBullet = trimmed.startsWith("- ") || trimmed.startsWith("• ") || trimmed.startsWith("* ");
      const isNumbered = /^\d+[\.\)]\s/.test(trimmed);

      if (isBullet) {
        const cleanText = trimmed.replace(/^[-•*]\s+/, "");
        children.push(
          new Paragraph({
            bullet: { level: 0 },
            spacing: { after: 60, line: 360 },
            children: [
              new TextRun({ text: cleanText, size: 22, color: COLORS.text, font: "Calibri" }),
            ],
          })
        );
      } else if (isNumbered) {
        const cleanText = trimmed.replace(/^\d+[\.\)]\s+/, "");
        children.push(
          new Paragraph({
            numbering: { reference: "default-numbering", level: 0 },
            spacing: { after: 60, line: 360 },
            children: [
              new TextRun({ text: cleanText, size: 22, color: COLORS.text, font: "Calibri" }),
            ],
          })
        );
      } else {
        // 볼드 처리: **텍스트** 파싱
        const runs = parseBoldText(trimmed);
        children.push(
          new Paragraph({
            spacing: { after: 120, line: 360 },
            children: runs,
          })
        );
      }
    }
  }

  // ========== 문서 생성 ==========
  const doc = new Document({
    creator: options.author || "Mini-RAG",
    title: docTitle,
    styles: {
      default: {
        document: {
          run: { size: 22, color: COLORS.text, font: "Calibri" },
          paragraph: { spacing: { line: 360 } },
        },
      },
    },
    numbering: {
      config: [{
        reference: "default-numbering",
        levels: [{
          level: 0,
          format: "decimal",
          text: "%1.",
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        }],
      }],
    },
    sections: [{
      properties: {
        page: {
          margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 }, // 2.54cm
        },
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [
                new TextRun({ text: docTitle, size: 16, color: COLORS.lightText, font: "Calibri", italics: true }),
              ],
            }),
          ],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({ children: [PageNumber.CURRENT], size: 16, color: COLORS.lightText, font: "Calibri" }),
                new TextRun({ text: " / ", size: 16, color: COLORS.lightText, font: "Calibri" }),
                new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: COLORS.lightText, font: "Calibri" }),
              ],
            }),
          ],
        }),
      },
      children,
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  const outPath = path.resolve(outputDir, fileName);
  await writeFile(outPath, buffer);
  return outPath;
}

/** **볼드** 마크다운 파싱 */
function parseBoldText(text: string): TextRun[] {
  const runs: TextRun[] = [];
  const parts = text.split(/(\*\*[^*]+\*\*)/g);

  for (const part of parts) {
    if (part.startsWith("**") && part.endsWith("**")) {
      runs.push(new TextRun({
        text: part.slice(2, -2),
        bold: true, size: 22, color: COLORS.navy, font: "Calibri",
      }));
    } else if (part) {
      runs.push(new TextRun({
        text: part,
        size: 22, color: COLORS.text, font: "Calibri",
      }));
    }
  }
  return runs;
}
