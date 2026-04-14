/**
 * Python 환경 검증
 *
 * 서버 시작 시 Python과 필수 라이브러리가 설치되어 있는지 확인.
 * 없으면 경고 출력 (서버는 계속 실행 — 문서 생성만 안 됨).
 */
import { execSync } from "child_process";

const REQUIRED_LIBS = [
  "pptx",        // python-pptx
  "openpyxl",    // openpyxl
  "xlsxwriter",  // xlsxwriter
  "docx",        // python-docx
  "pypdf",       // pypdf
  "reportlab",   // reportlab
];

export function checkPythonEnvironment(): {
  pythonAvailable: boolean;
  pythonPath: string;
  missingLibs: string[];
} {
  // Python 실행 가능 여부
  let pythonPath = "";
  for (const cmd of ["python", "python3", "py"]) {
    try {
      const version = execSync(`${cmd} --version 2>&1`, { encoding: "utf-8" }).trim();
      pythonPath = cmd;
      console.log(`[Python] Found: ${version} (${cmd})`);
      break;
    } catch {
      // try next
    }
  }

  if (!pythonPath) {
    console.warn("[Python] ⚠️ Python not found! Document generation (PPT/Excel/Word) will not work.");
    console.warn("[Python] Install Python 3.10+ from https://www.python.org/downloads/");
    return { pythonAvailable: false, pythonPath: "", missingLibs: REQUIRED_LIBS };
  }

  // 라이브러리 확인
  const missingLibs: string[] = [];
  for (const lib of REQUIRED_LIBS) {
    try {
      execSync(`${pythonPath} -c "import ${lib}" 2>&1`, { encoding: "utf-8" });
    } catch {
      missingLibs.push(lib);
    }
  }

  if (missingLibs.length > 0) {
    console.warn(`[Python] ⚠️ Missing libraries: ${missingLibs.join(", ")}`);
    console.warn(`[Python] Run: pip install python-pptx openpyxl xlsxwriter python-docx pypdf reportlab`);
  } else {
    console.log("[Python] All document generation libraries available");
  }

  return { pythonAvailable: true, pythonPath, missingLibs };
}
