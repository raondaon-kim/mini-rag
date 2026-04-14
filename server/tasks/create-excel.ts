/**
 * Excel 파일 생성 헬퍼 — 프로페셔널 디자인
 *
 * 디자인 원칙 (Tufte Data-Ink + IBCS + Schwabish):
 * - 헤더: #1B2A4A 배경 + 흰 글씨 + 볼드 + 필터
 * - 데이터: 정렬(텍스트 왼쪽, 숫자 오른쪽), 천단위 콤마
 * - 테두리: 얇은 회색 가로선만 (세로선 최소화)
 * - 행 높이: 헤더 24, 데이터 18
 * - 열 너비: 자동 조절 + 패딩
 * - 첫 행 고정(freeze), 자동 필터
 */
import ExcelJS from "exceljs";
import path from "path";

const COLORS = {
  headerBg: "1B2A4A",
  headerFont: "FFFFFF",
  accentBg: "E8A84C",
  zebraLight: "F8FAFC",
  border: "E2E8F0",
  text: "334155",
  number: "1E293B",
  negative: "DC2626",
  totalBg: "F1F5F9",
};

export interface SheetData {
  name: string;
  headers: string[];
  rows: (string | number | boolean | null)[][];
}

export async function createExcel(
  fileName: string,
  sheets: SheetData[],
  outputDir = "data/output"
): Promise<string> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Mini-RAG";
  wb.created = new Date();
  wb.calcProperties = { fullCalcOnLoad: true };

  for (const sheet of sheets) {
    const ws = wb.addWorksheet(sheet.name, {
      views: [{ state: "frozen", ySplit: 1 }], // 첫 행 고정
    });

    // ========== 헤더 행 ==========
    const headerRow = ws.addRow(sheet.headers);
    headerRow.height = 28;
    headerRow.eachCell((cell, colNumber) => {
      cell.font = { bold: true, color: { argb: `FF${COLORS.headerFont}` }, size: 11, name: "Calibri" };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${COLORS.headerBg}` } };
      cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      cell.border = {
        bottom: { style: "medium", color: { argb: `FF${COLORS.headerBg}` } },
      };
    });

    // ========== 데이터 행 ==========
    for (let rowIdx = 0; rowIdx < sheet.rows.length; rowIdx++) {
      const dataRow = ws.addRow(sheet.rows[rowIdx]);
      dataRow.height = 22;
      const isEven = rowIdx % 2 === 0;

      dataRow.eachCell((cell, colNumber) => {
        const value = cell.value;

        // 폰트
        cell.font = { size: 10.5, color: { argb: `FF${COLORS.text}` }, name: "Calibri" };

        // 정렬: 숫자=오른쪽, 텍스트=왼쪽
        if (typeof value === "number") {
          cell.alignment = { vertical: "middle", horizontal: "right" };
          cell.font = { size: 10.5, color: { argb: `FF${COLORS.number}` }, name: "Calibri" };
          // 음수 빨간색
          if (value < 0) {
            cell.font = { size: 10.5, color: { argb: `FF${COLORS.negative}` }, name: "Calibri" };
          }
          // 천단위 콤마
          if (Number.isInteger(value) && Math.abs(value) >= 1000) {
            cell.numFmt = "#,##0";
          } else if (!Number.isInteger(value)) {
            cell.numFmt = "#,##0.00";
          }
        } else {
          cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
        }

        // 교차 행 색상 (Zebra stripe — 미묘하게)
        if (isEven) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${COLORS.zebraLight}` } };
        }

        // 하단 테두리 (얇은 회색 가로선만 — Tufte)
        cell.border = {
          bottom: { style: "thin", color: { argb: `FF${COLORS.border}` } },
        };
      });
    }

    // ========== 열 너비 자동 조절 ==========
    ws.columns.forEach((col, idx) => {
      let maxLen = sheet.headers[idx]?.length || 8;
      col.eachCell?.({ includeEmpty: false }, (cell) => {
        const len = String(cell.value ?? "").length;
        if (len > maxLen) maxLen = len;
      });
      col.width = Math.min(Math.max(maxLen + 3, 10), 45);
    });

    // ========== 자동 필터 ==========
    ws.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: sheet.headers.length },
    };

    // ========== 인쇄 설정 ==========
    ws.pageSetup = {
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    };
    ws.headerFooter = {
      oddFooter: `&L${sheet.name}&C&P / &N&R${new Date().toLocaleDateString("ko-KR")}`,
    };
  }

  const outPath = path.resolve(outputDir, fileName);
  await wb.xlsx.writeFile(outPath);
  return outPath;
}
