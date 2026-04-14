# Mini-RAG: 로컬 AI 코워크 플랫폼

업무 문서(PDF, DOCX, PPTX, XLSX)를 업로드하고, 대화하며 요약하고, 문서를 재생산하는 로컬 AI 플랫폼입니다.

## 주요 기능

- **문서 대화**: 파일 업로드 → RAG 검색 → Claude AI 답변 + 출처 표시
- **문서 재생산**: PPT, Excel, Word, PDF 파일을 AI가 직접 생성 (python-pptx, openpyxl 등)
- **업무 기억**: 대화 기록, 사용자 의도, 작업 일지를 저장하여 다음 작업 시 참고
- **자동 인덱싱**: `docs/` 폴더에 파일을 넣으면 자동으로 인덱싱
- **하이브리드 검색**: FTS5 키워드 + 벡터 유사도 RRF 합산

## 빠른 시작

### 1. 요구사항

- **Node.js 20+**
- **Python 3.10+** (문서 생성용)
- **Anthropic API Key** ([platform.claude.com](https://platform.claude.com)에서 발급)

### 2. 설치

```bash
# 저장소 클론
git clone <repo-url> mini-rag
cd mini-rag

# 서버 의존성 설치
npm install

# 클라이언트 의존성 설치
cd client && npm install && cd ..

# Python 라이브러리 설치 (문서 생성용)
pip install python-pptx openpyxl xlsxwriter python-docx pypdf reportlab Pillow markitdown
```

### 3. 환경 설정

```bash
# .env 파일 생성
cp .env.example .env
# .env를 열어서 ANTHROPIC_API_KEY 입력
```

`.env` 내용:
```
ANTHROPIC_API_KEY=sk-ant-api03-...
PORT=4001
DOCS_PATH=./docs
DB_PATH=./data/rag.sqlite
```

### 4. 실행

```bash
# 서버 실행 (포트 4001)
npm run dev

# 다른 터미널에서 클라이언트 실행 (포트 5173)
npm run dev:client
```

브라우저에서 **http://localhost:5173** 접속

### 5. 사용

1. `docs/` 폴더에 파일을 넣거나, 브라우저에서 드래그앤드롭으로 업로드
2. 채팅창에서 질문 → AI가 문서에서 검색하여 답변
3. "보고서 만들어줘", "PPT 만들어줘" → AI가 직접 파일 생성
4. 사이드바에서 대화 이력, 생성된 파일, 업로드 문서 관리

## 아키텍처

```
사용자 (브라우저)
  │
  ▼
React 프론트엔드 (Vite, Tailwind)
  │ HTTP / SSE
  ▼
Express 서버 (Node.js)
  │
  ├── Agent SDK 오케스트레이터 (Claude Haiku)
  │   ├── rag-search     — 문서 검색 + 답변
  │   ├── web-research   — 웹 검색
  │   ├── file-analyst   — 파일 분석
  │   ├── memory         — 의도 추적
  │   └── task-executor  — 문서 생성 (Bash + Python)
  │
  ├── Custom MCP Server — 검색, 기록, 학습 도구 11개
  ├── 외부 MCP — memory (지식그래프), sequential-thinking, fetch
  │
  └── SQLite (FTS5 + sqlite-vec)
      ├── documents, chunks, chunks_fts, chunks_vec
      ├── conversations, task_log, work_journal
      └── settings, files
```

## Skills (34개)

AI가 문서를 만들 때 참고하는 검증된 프레임워크:

| 카테고리 | Skills |
|---------|--------|
| 글쓰기 (7) | Pyramid/SCQA, PSB, SPIN, PRFAQ, BLUF, Executive Summary, STAR |
| 마케팅 (3) | AIDA, PAS, StoryBrand |
| PPT (5) | Pitch Deck, Status Report, Training, Creative, Design Rules |
| 엑셀 (3) | Dashboard, Data Table, Design Rules |
| 공식 (4) | Anthropic pptx/xlsx/docx/pdf (python-pptx, openpyxl 등) |
| 기타 | 학술(IMRaD), 기술문서(IEEE), 블로그/SEO, 에세이, 스토리텔링 |

## API

| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/api/chat` | RAG 채팅 (SSE 스트리밍) |
| POST | `/api/upload` | 문서 업로드 |
| GET | `/api/documents` | 문서 목록 |
| GET | `/api/status` | 인덱스 통계 |
| GET | `/api/files/:name` | 생성된 파일 다운로드 |
| GET | `/api/output-files` | 생성된 파일 목록 |
| GET | `/api/conversations` | 대화 이력 |
| POST | `/api/search` | 문서 검색 (LLM 없이) |

## 라이선스

MIT
