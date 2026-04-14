import officeparser from "officeparser";
import pdfParse from "pdf-parse";
import matter from "gray-matter";
import ExcelJS from "exceljs";
import { readFile } from "fs/promises";
import { extname, basename } from "path";

export interface ReadResult {
  content: string;
  metadata: Record<string, unknown>;
}

const DOCUMENT_FORMATS = [".docx", ".pptx", ".xlsx", ".odt", ".odp", ".ods"];
const TEXT_FORMATS = [".md", ".mdx", ".txt"];
const CODE_FORMATS = [
  ".js", ".ts", ".tsx", ".jsx", ".py", ".java", ".go", ".rs",
  ".cpp", ".c", ".h", ".hpp", ".rb", ".php", ".swift", ".kt",
  ".css", ".html", ".svelte", ".vue", ".json", ".yaml", ".yml",
  ".xml", ".csv", ".sql", ".sh", ".bat",
];

export async function readDocument(filePath: string): Promise<ReadResult> {
  const ext = extname(filePath).toLowerCase();
  const fileName = basename(filePath);

  // PDF
  if (ext === ".pdf") {
    const buffer = await readFile(filePath);
    const data = await pdfParse(buffer);
    return {
      content: data.text,
      metadata: {
        format: "pdf",
        pages: data.numpages,
        file_name: fileName,
      },
    };
  }

  // Excel — 구조화 파싱 (시트별 헤더+행 보존)
  if (ext === ".xlsx" || ext === ".xls") {
    return readExcel(filePath, fileName);
  }

  // Office documents (DOCX, PPTX)
  if (DOCUMENT_FORMATS.includes(ext)) {
    const text = await officeparser.parseOfficeAsync(filePath);
    return {
      content: text,
      metadata: {
        format: ext.slice(1),
        file_name: fileName,
      },
    };
  }

  // Markdown (with frontmatter)
  if (ext === ".md" || ext === ".mdx") {
    const raw = await readFile(filePath, "utf-8");
    const { data: frontmatter, content } = matter(raw);
    return {
      content,
      metadata: {
        format: "markdown",
        file_name: fileName,
        ...frontmatter,
      },
    };
  }

  // Plain text
  if (TEXT_FORMATS.includes(ext)) {
    const content = await readFile(filePath, "utf-8");
    return {
      content,
      metadata: { format: "text", file_name: fileName },
    };
  }

  // Code files
  if (CODE_FORMATS.includes(ext)) {
    const code = await readFile(filePath, "utf-8");
    const lang = ext.slice(1);
    return {
      content: `\`\`\`${lang}\n${code}\n\`\`\``,
      metadata: { format: "code", language: lang, file_name: fileName },
    };
  }

  // Fallback: treat as plain text
  const content = await readFile(filePath, "utf-8");
  return {
    content,
    metadata: { format: ext.slice(1) || "unknown", file_name: fileName },
  };
}

export function getSupportedExtensions(): string[] {
  return [".pdf", ...DOCUMENT_FORMATS, ...TEXT_FORMATS, ...CODE_FORMATS];
}

// ==============================
// Excel 구조화 파서
// ==============================

export interface SheetData {
  sheetName: string;
  headers: string[];
  rows: Record<string, string>[]; // { headerName: cellValue }
}

async function readExcel(filePath: string, fileName: string): Promise<ReadResult> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const sheets: SheetData[] = [];
  const markdownParts: string[] = [];

  workbook.eachSheet((worksheet) => {
    const headers: string[] = [];
    const rows: Record<string, string>[] = [];

    // 첫 번째 행을 헤더로 사용
    const headerRow = worksheet.getRow(1);
    headerRow.eachCell({ includeEmpty: true }, (cell, colNum) => {
      headers[colNum - 1] = String(cell.value ?? `col_${colNum}`).trim();
    });

    if (headers.length === 0) return;

    // 데이터 행 파싱
    for (let rowNum = 2; rowNum <= worksheet.rowCount; rowNum++) {
      const row = worksheet.getRow(rowNum);
      const record: Record<string, string> = {};
      let hasValue = false;

      headers.forEach((header, idx) => {
        const cell = row.getCell(idx + 1);
        const val = cellToString(cell);
        record[header] = val;
        if (val) hasValue = true;
      });

      if (hasValue) rows.push(record);
    }

    if (rows.length === 0) return;

    sheets.push({ sheetName: worksheet.name, headers, rows });

    // 마크다운 테이블로 변환
    markdownParts.push(`## ${worksheet.name}\n`);
    markdownParts.push(`| ${headers.join(" | ")} |`);
    markdownParts.push(`| ${headers.map(() => "---").join(" | ")} |`);

    for (const row of rows) {
      const cells = headers.map((h) => (row[h] || "").replace(/\|/g, "\\|").replace(/\n/g, " "));
      markdownParts.push(`| ${cells.join(" | ")} |`);
    }

    markdownParts.push(""); // blank line between sheets
  });

  return {
    content: markdownParts.join("\n"),
    metadata: {
      format: "xlsx",
      file_name: fileName,
      sheet_count: sheets.length,
      total_rows: sheets.reduce((sum, s) => sum + s.rows.length, 0),
      sheets: sheets.map((s) => ({ name: s.sheetName, headers: s.headers, rowCount: s.rows.length })),
    },
  };
}

function cellToString(cell: ExcelJS.Cell): string {
  if (cell.value === null || cell.value === undefined) return "";

  // 날짜
  if (cell.value instanceof Date) {
    return cell.value.toISOString().slice(0, 10);
  }

  // 수식 결과
  if (typeof cell.value === "object" && "result" in cell.value) {
    return String((cell.value as any).result ?? "");
  }

  // 리치 텍스트
  if (typeof cell.value === "object" && "richText" in cell.value) {
    return ((cell.value as any).richText || []).map((r: any) => r.text).join("");
  }

  return String(cell.value);
}
