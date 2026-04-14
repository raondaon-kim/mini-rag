import { encode } from "gpt-tokenizer";

export interface Chunk {
  title: string;
  content: string;
  token_count: number;
  chunk_index: number;
  metadata: Record<string, unknown>;
}

const DEFAULT_MAX_TOKENS = 512;
const DEFAULT_OVERLAP_TOKENS = 50;

export function countTokens(text: string): number {
  return encode(text).length;
}

export function chunkDocument(
  fileName: string,
  content: string,
  format: string,
  extraMeta: Record<string, unknown> = {},
  maxTokens = DEFAULT_MAX_TOKENS,
  overlapTokens = DEFAULT_OVERLAP_TOKENS
): Chunk[] {
  if (!content.trim()) return [];

  switch (format) {
    case "markdown":
    case "mdx":
      return chunkMarkdown(fileName, content, extraMeta, maxTokens, overlapTokens);
    case "pdf":
      return chunkByPages(fileName, content, extraMeta, maxTokens, overlapTokens);
    case "xlsx":
    case "xls":
      return chunkExcel(fileName, content, extraMeta, maxTokens);
    default:
      return chunkPlainText(fileName, content, format, extraMeta, maxTokens, overlapTokens);
  }
}

function chunkMarkdown(
  fileName: string,
  content: string,
  extraMeta: Record<string, unknown>,
  maxTokens: number,
  overlapTokens: number
): Chunk[] {
  const sections = content.split(/^(?=##\s)/m);
  const chunks: Chunk[] = [];

  for (const section of sections) {
    const titleMatch = section.match(/^##\s+(.+)/m);
    const title = titleMatch
      ? titleMatch[1].trim()
      : (extraMeta.title as string) || fileName;
    const text = section.replace(/^##\s+.+\n/, "").trim();

    if (!text) continue;

    const tokenCount = countTokens(text);

    if (tokenCount > maxTokens) {
      const subs = splitByParagraphs(text, maxTokens, overlapTokens);
      for (let i = 0; i < subs.length; i++) {
        chunks.push({
          title,
          content: subs[i].text,
          token_count: subs[i].tokens,
          chunk_index: chunks.length,
          metadata: { ...extraMeta, sub_index: i },
        });
      }
    } else {
      chunks.push({
        title,
        content: text,
        token_count: tokenCount,
        chunk_index: chunks.length,
        metadata: extraMeta,
      });
    }
  }

  // If no headings found, fall back to paragraph chunking
  if (chunks.length === 0 && content.trim()) {
    const subs = splitByParagraphs(content.trim(), maxTokens, overlapTokens);
    for (let i = 0; i < subs.length; i++) {
      chunks.push({
        title: (extraMeta.title as string) || fileName,
        content: subs[i].text,
        token_count: subs[i].tokens,
        chunk_index: i,
        metadata: extraMeta,
      });
    }
  }

  return chunks;
}

function chunkByPages(
  fileName: string,
  content: string,
  extraMeta: Record<string, unknown>,
  maxTokens: number,
  overlapTokens: number
): Chunk[] {
  // PDF text often has form-feed or multiple newlines between pages
  const pages = content.split(/\f|\n{4,}/);
  const chunks: Chunk[] = [];

  for (let pageNum = 0; pageNum < pages.length; pageNum++) {
    const pageText = pages[pageNum].trim();
    if (!pageText) continue;

    // 내용 힌트: 첫 줄에서 50자 추출 (FTS5 title 검색 개선)
    const firstLine = pageText.split(/\n/)[0]?.trim().slice(0, 50) || "";
    const titleHint = firstLine ? ` — ${firstLine}` : "";
    const pageTitle = `${fileName} p.${pageNum + 1}${titleHint}`;

    const tokenCount = countTokens(pageText);

    if (tokenCount > maxTokens) {
      const subs = splitByParagraphs(pageText, maxTokens, overlapTokens);
      for (let i = 0; i < subs.length; i++) {
        chunks.push({
          title: pageTitle,
          content: subs[i].text,
          token_count: subs[i].tokens,
          chunk_index: chunks.length,
          metadata: { ...extraMeta, page: pageNum + 1, sub_index: i },
        });
      }
    } else {
      chunks.push({
        title: pageTitle,
        content: pageText,
        token_count: tokenCount,
        chunk_index: chunks.length,
        metadata: { ...extraMeta, page: pageNum + 1 },
      });
    }
  }

  // Fallback if no page breaks detected
  if (chunks.length === 0 && content.trim()) {
    return chunkPlainText(fileName, content, "pdf", extraMeta, maxTokens, overlapTokens);
  }

  return chunks;
}

function chunkPlainText(
  fileName: string,
  content: string,
  format: string,
  extraMeta: Record<string, unknown>,
  maxTokens: number,
  overlapTokens: number
): Chunk[] {
  const tokenCount = countTokens(content);

  if (tokenCount <= maxTokens) {
    return [{
      title: fileName,
      content,
      token_count: tokenCount,
      chunk_index: 0,
      metadata: { ...extraMeta, format },
    }];
  }

  const subs = splitByParagraphs(content, maxTokens, overlapTokens);
  return subs.map((sub, i) => ({
    title: fileName,
    content: sub.text,
    token_count: sub.tokens,
    chunk_index: i,
    metadata: { ...extraMeta, format, sub_index: i },
  }));
}

/**
 * Excel 전용 청킹 — 헤더+N행 묶음으로 행 단위 검색 가능
 *
 * 마크다운 테이블 형태:
 * | 이름 | 아이디 | 부서 |
 * | --- | --- | --- |
 * | 홍길동 | hong01 | 영업 |
 * | 김철수 | kim02 | 개발 |
 *
 * 매 청크마다 헤더 포함 → 검색 시 컬럼 의미 유지
 */
function chunkExcel(
  fileName: string,
  content: string,
  extraMeta: Record<string, unknown>,
  maxTokens: number
): Chunk[] {
  // reader.ts가 시트별 ## 섹션으로 만들어줌
  const sheets = content.split(/^(?=## )/m).filter((s) => s.trim());
  const chunks: Chunk[] = [];

  for (const sheetBlock of sheets) {
    const lines = sheetBlock.split("\n");
    const titleLine = lines[0]?.replace(/^##\s*/, "").trim() || "Sheet";
    const tableLines = lines.slice(1).filter((l) => l.startsWith("|"));

    if (tableLines.length < 2) continue; // 최소 헤더 + 구분선

    const headerLine = tableLines[0];
    const separatorLine = tableLines[1];
    const dataLines = tableLines.slice(2);

    if (dataLines.length === 0) continue;

    // 헤더 토큰 비용 (매 청크마다 반복됨)
    const headerBlock = `${headerLine}\n${separatorLine}`;
    const headerTokens = countTokens(headerBlock);
    const availableTokens = maxTokens - headerTokens - 20; // 여유분

    if (availableTokens <= 0) {
      // 헤더만으로도 너무 큼 → 통째로 하나의 청크
      chunks.push({
        title: `${fileName} [${titleLine}]`,
        content: sheetBlock.trim(),
        token_count: countTokens(sheetBlock),
        chunk_index: chunks.length,
        metadata: { ...extraMeta, sheet: titleLine },
      });
      continue;
    }

    // 행을 묶어서 청크 단위로 분할
    let currentRows: string[] = [];
    let currentTokens = 0;

    for (let i = 0; i < dataLines.length; i++) {
      const rowTokens = countTokens(dataLines[i]);

      if (currentTokens + rowTokens > availableTokens && currentRows.length > 0) {
        // 현재 묶음을 청크로 저장
        const tableContent = `${headerBlock}\n${currentRows.join("\n")}`;
        const rowRange = `row ${i + 2 - currentRows.length}-${i + 1}`;
        chunks.push({
          title: `${fileName} [${titleLine}] ${rowRange}`,
          content: tableContent,
          token_count: headerTokens + currentTokens,
          chunk_index: chunks.length,
          metadata: {
            ...extraMeta,
            sheet: titleLine,
            row_start: i + 2 - currentRows.length,
            row_end: i + 1,
          },
        });
        currentRows = [];
        currentTokens = 0;
      }

      currentRows.push(dataLines[i]);
      currentTokens += rowTokens;
    }

    // 마지막 묶음
    if (currentRows.length > 0) {
      const tableContent = `${headerBlock}\n${currentRows.join("\n")}`;
      const startRow = dataLines.length + 2 - currentRows.length;
      const endRow = dataLines.length + 1;
      const rowRange = currentRows.length === dataLines.length
        ? `all ${dataLines.length} rows`
        : `row ${startRow}-${endRow}`;
      chunks.push({
        title: `${fileName} [${titleLine}] ${rowRange}`,
        content: tableContent,
        token_count: headerTokens + currentTokens,
        chunk_index: chunks.length,
        metadata: {
          ...extraMeta,
          sheet: titleLine,
          row_start: startRow,
          row_end: endRow,
        },
      });
    }
  }

  // 시트가 전혀 파싱되지 않은 경우 fallback
  if (chunks.length === 0 && content.trim()) {
    return chunkPlainText(fileName, content, "xlsx", extraMeta, maxTokens, 50);
  }

  return chunks;
}

interface SubChunk {
  text: string;
  tokens: number;
}

function splitByParagraphs(
  text: string,
  maxTokens: number,
  overlapTokens: number
): SubChunk[] {
  const paragraphs = text.split(/\n\n+/);
  const chunks: SubChunk[] = [];
  let current = "";
  let currentTokens = 0;

  for (const para of paragraphs) {
    const paraTokens = countTokens(para);

    // Single paragraph exceeds max — force split by sentences
    if (paraTokens > maxTokens && !current) {
      const sentences = para.split(/(?<=[.!?。！？])\s+/);
      for (const sentence of sentences) {
        const sentTokens = countTokens(sentence);
        if (currentTokens + sentTokens > maxTokens && current) {
          chunks.push({ text: current.trim(), tokens: currentTokens });
          current = sentence;
          currentTokens = sentTokens;
        } else {
          current += (current ? " " : "") + sentence;
          currentTokens += sentTokens;
        }
      }
      continue;
    }

    if (currentTokens + paraTokens > maxTokens && current) {
      chunks.push({ text: current.trim(), tokens: currentTokens });

      // Overlap: carry last paragraph into next chunk
      if (overlapTokens > 0) {
        const lastPara = current.split(/\n\n+/).pop() || "";
        const lastTokens = countTokens(lastPara);
        if (lastTokens <= overlapTokens) {
          current = lastPara + "\n\n" + para;
          currentTokens = lastTokens + paraTokens;
        } else {
          current = para;
          currentTokens = paraTokens;
        }
      } else {
        current = para;
        currentTokens = paraTokens;
      }
    } else {
      current += (current ? "\n\n" : "") + para;
      currentTokens += paraTokens;
    }
  }

  if (current.trim()) {
    chunks.push({ text: current.trim(), tokens: countTokens(current.trim()) });
  }

  return chunks;
}
