# Mini-RAG: 로컬 AI 코워크 플랫폼

**[English](README.md)** | **한국어**

---

로컬 문서를 지능형 워크스페이스로 전환하는 AI 플랫폼입니다. Excel, PDF, DOCX, PPTX 파일을 업로드하고, 어떤 언어로든 질문하고, 새 문서를 생성하고, 커리어 분석까지 — 11개의 전문 AI 에이전트가 협력합니다.

## 왜 Mini-RAG인가?

대부분의 RAG 시스템은 "PDF 올리고 질문하기"에서 멈춥니다. Mini-RAG는 더 나아갑니다:

- **구조화된 데이터 이해** — 직원 명부 엑셀을 올리고 "개발부에서 Python 경험이 있는 사람은?"이라고 물어보세요. 행/열 관계를 보존합니다.
- **문서 생성** — "우리 데이터를 기반으로 재무 보고서 만들어줘"라고 하면 실제 `.docx` 파일이 생성됩니다.
- **멀티 에이전트 오케스트레이션** — 교육, HR, 재무 등 11개 전문 에이전트가 각자의 도메인 스킬을 가지고, 질문에 따라 자동 선택됩니다.
- **커리어 인텔리전스** — 교육/자격증 데이터를 올리면 역량 분석, 스킬 갭 보고서, 미래 일자리 추천을 받을 수 있습니다.
- **다국어 지원** — 한국어, 영어, 일본어로 질문하세요. 영어로 질문해도 한국어 문서에서 검색합니다.

## 무엇을 할 수 있나요?

### 1. 문서에 대해 질문하기

문서를 업로드하고 질문하면, 하이브리드 FTS5 + 벡터 검색으로 출처와 함께 답변합니다.

```
사용자: 재무회계의 핵심 개념을 정리해줘
AI: ## 재무회계란?
    재무회계는 기업 외부정보이용자를 대상으로 하는 회계입니다. [testfile.pdf p.3]
    ...
```

### 2. 엑셀 데이터 조회

직원 데이터, 프로젝트 목록 등 엑셀 파일을 올리고 행/열 단위로 질문합니다.

```
사용자: 홍길동의 이메일 주소와 전화번호를 알려줘
AI: 홍길동 (영업부 과장)
    - 이메일: hong@company.com
    - 전화번호: 010-1234-5678
    출처: [employees.xlsx]
```

```
사용자: 개발부에 소속된 사람들은 누구야?
AI: | 이름   | 직급 | 이메일           |
    |--------|------|------------------|
    | 김철수 | 대리 | kim@company.com  |
    | 최지은 | 팀장 | choi@company.com |
    | 윤태호 | 사원 | yoon@company.com |
    출처: [employees.xlsx]
```

### 3. 교육 이력 분석 & 커리어 추천

교육 이력 데이터를 올리면 AI가 역량 분석, 갭 분석, 미래 일자리를 추천합니다.

```
사용자: 김민지의 교육 이력을 분석하고 미래 일자리를 추천해줘

AI: ## 김민지 역량 프로필
    | 역량       | 수준 | 근거                     |
    |------------|------|--------------------------|
    | 신용평가   | L4   | 신용분석사 자격 + 실무 3년 |
    | 데이터분석 | L2   | Python 교육 수료          |

    ## 스킬 갭 분석 — 목표: 데이터분석가
    | 역량       | 현재 | 목표 | Gap |
    |------------|------|------|-----|
    | Python     | L2   | L4   | -2  |
    | 통계분석   | L1   | L4   | -3  |

    ## 미래 일자리 추천
    1. 금융 데이터분석가 (적합도 85%)
    2. AI 신용평가 전문가 (성장성 최고)
    3. 핀테크 데이터분석가
```

### 4. 문서 생성

인덱싱된 데이터를 기반으로 보고서, PPT, 엑셀 파일을 AI가 직접 생성합니다.

```
사용자: 재무회계에 대한 보고서를 만들어줘
AI: 재무회계의_이해와_체계.docx 생성 완료 (12KB)
    - 6개 섹션, 출처 표기 포함
    다운로드: /api/files/재무회계의_이해와_체계.docx
```

### 5. 다국어 질의

영어로 질문해도 한국어 문서를 검색하고, 영어로 답변합니다.

```
User: Analyze Park Seoyeon's competencies and recommend career paths
AI: ## Park Seoyeon - Career Analysis
    - Education: Bachelor's in Education, ADDIE Instructional Design (30h)
    - Certifications: Teaching Certificate, Google Educator
    - Recommended: EdTech Designer
    Source: [education_history.xlsx]
```

## 아키텍처

```
브라우저 (React + Tailwind)
  │ HTTP / SSE 스트리밍
  ▼
Express 서버 (Node.js + TypeScript)
  │
  ├── 오케스트레이터 (Claude Haiku 4.5, Agent SDK)
  │   │
  │   ├── 사전 검색 ──── LLM 호출 전 서버 측 RAG 검색
  │   │                   (키워드 추출 + 다국어 확장)
  │   │
  │   └── 11개 전문 에이전트
  │       ├── rag-search ─────── 문서 Q&A + 출처 표시
  │       ├── web-research ────── 웹 검색 + URL 수집
  │       ├── file-analyst ────── 로컬 파일 분석
  │       ├── memory ──────────── 의도 추적 + 지식 그래프
  │       ├── doc-writer ──────── 보고서, 이메일, 회의록 (DOCX/PDF)
  │       ├── presentation-maker ─ 피치덱, 교육 PPT (PPTX)
  │       ├── spreadsheet-maker ── 대시보드, 데이터 테이블 (XLSX)
  │       ├── business-analyst ─── 전략, 재무, 경쟁 분석
  │       ├── hr-specialist ────── 채용, 조직 설계, 변화관리
  │       ├── education-specialist ─ 커리큘럼, 커리어 분석, AIED
  │       └── operations-support ── PM, 법무, CS, 번역, 품질
  │
  ├── Custom MCP Server ── RAG 도구 11개 (검색, 상태, 저널 등)
  ├── External MCP ─────── memory, sequential-thinking, fetch
  │
  └── SQLite
      ├── FTS5 (BM25 키워드 검색)
      ├── sqlite-vec (벡터 KNN 검색)
      └── RRF 하이브리드 융합 (weight_fts=1.5, weight_vec=1.0)
```

### 검색 작동 방식

1. **문서 업로드** → 포맷별 파싱 (PDF 페이지, Excel 행, Markdown 헤딩)
2. **엑셀 특별 처리** → 매 청크마다 헤더를 포함한 마크다운 테이블 보존
3. **FTS5 인덱싱** → 즉시 실행, 한국어 구문 매칭 최적화
4. **벡터 임베딩** → 백그라운드 비동기 처리 (all-MiniLM-L6-v2, 384차원)
5. **쿼리 시**:
   - 서버가 전체 메시지 + 개별 키워드 + 다국어 확장으로 사전 검색
   - 결과를 에이전트 실행 전에 LLM 프롬프트에 주입
   - 에이전트가 추가 검색을 위해 `search_documents` 호출 가능

### 에이전트 라우팅 방식

1. **키워드 매칭** → `skill-router.ts`가 키워드 적중률로 에이전트 점수 산출
2. **다국어 확장** → 영어 "education" → 한국어 "교육"으로 변환 후 매칭
3. **동적 스킬 로딩** → 매칭된 에이전트만 Skills 로드 (토큰 절약)
4. **LLM 오케스트레이션** → Claude가 최종 위임 대상 결정
5. **사전 검색 주입** → 에이전트 선택과 관계없이 검색 결과가 프롬프트에 포함

## 76개 Skills

Skills는 런타임에 에이전트 프롬프트에 임베딩되는 마크다운 프레임워크입니다. 각 에이전트에게 도메인 전문성을 부여합니다.

| 카테고리 | Skills | 용도 |
|----------|--------|------|
| **글쓰기 (15)** | Pyramid/SCQA, BLUF, PAS, AIDA, SPIN, StoryBrand, STAR, PSB, PRFAQ, Executive Summary, 3막 구조, Show-Don't-Tell, 블로그/SEO, 에세이, 이메일 | 장르별 문서 프레임워크 |
| **교육 (14)** | 교육과정 설계, 커리큘럼 빌더, 학습 평가, AI 교육, 교육 사업, 교육 콘텐츠, HRD 훈련, 강의 스크립트, 교재 기획, 교육 PPT, 경력 경로 분석, 스킬 갭 분석, 미래 일자리 추천, 작업 일지 | 교육-커리어 전체 파이프라인 |
| **비즈니스 (11)** | 경쟁사 분석, 전략 기획, 재무 보고, 데이터 분석, 경영진 브리핑, 이사회 보고, 시나리오 분석, 제품 기획, 로드맵, 매출 분석, AB 테스트 | 전략 및 분석 |
| **HR (4)** | 채용, 변화관리, 조직 설계, HRD 훈련 | 인사 운영 |
| **오피스 (8)** | DOCX, PPTX, XLSX, PDF 공식 스킬, PPT/엑셀 선택기/디자인 규칙 | python-pptx, openpyxl 등으로 파일 생성 |
| **PPT (4)** | 피치덱, 상태 보고, 교육 슬라이드, 크리에이티브 | 프레젠테이션 유형별 |
| **운영 (8)** | 프로젝트 관리, 법무, 고객 서비스, 고객 성공, 번역, 품질관리, 컴플라이언스 감사, 영업 | 교차 기능 지원 |
| **시스템 (6)** | 도메인 선택, 검색 전략, 출처 표시, 의도 추적, 사용자 프로파일링, 글쓰기 선택 | 내부 라우팅 및 품질 |
| **콘텐츠 (4)** | 콘텐츠 전략, 소셜 미디어, 캠페인 기획, 기술 문서 | 마케팅 및 콘텐츠 |

## 빠른 시작

### 사전 요구사항

| 요구사항 | 버전 | 용도 |
|----------|------|------|
| **Node.js** | 20+ | 서버 런타임 |
| **npm** | 10+ | 패키지 관리 |
| **Python** | 3.10+ | 문서 생성 (DOCX, PPTX, XLSX) |
| **Anthropic API Key** | — | LLM (Claude Haiku 4.5) |

### 1단계: 클론 & 설치

```bash
git clone https://github.com/raondaon-kim/mini-rag.git
cd mini-rag

# 서버 의존성
npm install

# 클라이언트 의존성
cd client && npm install && cd ..
```

### 2단계: Python 라이브러리 (문서 생성용)

```bash
pip install python-pptx openpyxl xlsxwriter python-docx reportlab Pillow
```

AI가 `.docx`, `.pptx`, `.xlsx`, `.pdf` 파일을 생성하는 데 필요합니다.
서버 시작 시 설치 여부를 확인하고, 없으면 경고합니다.

### 3단계: 환경 설정

```bash
cp .env.example .env
```

`.env` 편집:
```env
# 필수 — https://console.anthropic.com 에서 발급
ANTHROPIC_API_KEY=sk-ant-api03-your-key-here

# 서버 포트 (기본: 4001)
PORT=4001

# 문서 폴더 (서버 시작 시 자동 인덱싱)
DOCS_PATH=./docs

# 데이터 폴더 (SQLite DB, 생성된 파일)
DATA_PATH=./data
DB_PATH=./data/rag.sqlite
```

> **참고:** 벡터 임베딩 모델(`all-MiniLM-L6-v2`)은 첫 실행 시 자동 다운로드됩니다 (~80MB). OpenAI 키는 필요 없습니다 — 임베딩은 로컬에서 실행됩니다.

### 4단계: 실행

```bash
# 터미널 1: 백엔드 시작 (포트 4001)
npm start

# 터미널 2: 프론트엔드 개발 서버 시작 (포트 5173)
npm run dev:client
```

브라우저에서 **http://localhost:5173** 접속

### 5단계: 문서 업로드

- 브라우저 창에 **드래그 앤 드롭**
- 또는 `docs/` 폴더에 파일 배치 (서버 시작 시 자동 인덱싱)
- **지원 포맷:** `.pdf`, `.docx`, `.pptx`, `.xlsx`, `.md`, `.txt` 및 20+ 코드 파일

### 프로덕션 빌드 (단일 서버)

```bash
npm run build:start   # 프론트엔드 빌드 + 통합 서버 시작 (포트 4001)
```

API와 프론트엔드를 하나의 Express 서버에서 제공합니다.

### 처음 사용 체크리스트

시작 후:
1. 엑셀 파일 업로드 (직원 데이터, 교육 기록 등)
2. 시도: "[이름]에 대해 알려줘" 또는 "[부서]에 누가 있어?"
3. 시도: "[주제]에 대한 보고서 만들어줘"
4. 사이드바에서 생성된 파일과 대화 이력 확인

## API 레퍼런스

| 메서드 | 엔드포인트 | 설명 |
|--------|----------|------|
| `POST` | `/api/chat` | RAG 채팅 (SSE 스트리밍). Body: `{message, top_k?, search_mode?}` |
| `POST` | `/api/upload` | 문서 업로드. Multipart form: `file` |
| `POST` | `/api/search` | 직접 검색 (LLM 없이). Body: `{query, top_k?, search_mode?}` |
| `GET` | `/api/documents` | 인덱싱된 문서 목록 |
| `GET` | `/api/status` | 인덱스 통계 + 사용량 추적 |
| `GET` | `/api/conversations` | 대화 이력 |
| `GET` | `/api/conversations/:id` | 단일 대화 메시지 |
| `DELETE` | `/api/documents/:id` | 문서 삭제 |
| `GET` | `/api/output-files` | 생성된 파일 목록 |
| `GET` | `/api/files/:name` | 생성된 파일 다운로드 |

### SSE 이벤트 (채팅)

```
event: token     → {text: "부분 응답..."}
event: status    → {text: "문서 검색...", tool: "mcp__rag__search_documents"}
event: sources   → {chunks: [...], session_id: "..."}
event: done      → {session_id: "..."}
event: error     → {error: "메시지"}
```

## 프로젝트 구조

```
mini-rag/
├── server/
│   ├── agents/          # 11개 에이전트 정의 + registry + skill router
│   ├── orchestrator/    # Agent SDK 쿼리 핸들러 + 사전 검색
│   ├── mcp/             # Custom MCP 서버 (RAG 도구 11개)
│   ├── db/              # SQLite 연결 + 스키마
│   ├── ingestion/       # 문서 파서, 청커, 인덱서
│   ├── search/          # FTS5 + Vector + RRF 하이브리드
│   ├── memory/          # 대화, 의도, 작업 일지, 세션
│   ├── llm/             # Claude API, 임베더, 프롬프트
│   └── routes/          # Express 라우트
├── client/
│   ├── src/components/  # React UI (ChatView, Sidebar, InputBar 등)
│   └── src/hooks/       # useChat (SSE), useUpload (단계별), useApi
├── .claude/skills/      # 76개 SKILL.md 파일
├── data/                # SQLite DB + 생성 파일 (gitignore 대상)
└── docs/                # 문서 폴더 (자동 인덱싱)
```

## 핵심 설계 결정

- **한국어에서 FTS5 > Vector** — all-MiniLM-L6-v2가 한국어에 약하므로 FTS5에 더 높은 가중치 부여 (1.5 vs 1.0)
- **서버 측 사전 검색** — LLM이 검색 도구 호출을 건너뛸 수 있으므로, 항상 검색 결과를 프롬프트에 주입
- **엑셀을 마크다운 테이블로** — ExcelJS가 시트를 헤더+행 마크다운으로 파싱, 청크마다 헤더 반복하여 검색 가능성 보장
- **동적 스킬 로딩** — 매칭된 에이전트만 Skills 로드 (쿼리당 ~5K 토큰 vs 22K, 비용 절약)
- **백그라운드 벡터 임베딩** — FTS5는 즉시 인덱싱하여 빠른 검색, 벡터는 비동기 생성

## 라이선스

MIT
