# Mini-RAG: Local AI Cowork Platform

**English** | **[한국어](README.ko.md)**

---

A local-first AI platform that turns your documents into an intelligent workspace. Upload Excel, PDF, DOCX, or PPTX files, ask questions in any language, generate new documents, and get career analysis — all powered by 11 specialized AI agents working together.

## Why Mini-RAG?

Most RAG systems stop at "upload a PDF and ask questions." Mini-RAG goes further:

- **Structured data understanding** — Upload an Excel with employee records, and ask "Who in the engineering team has Python experience?" The system preserves row/column relationships, not just text.
- **Document generation** — Ask "Create a financial report based on our data" and get a real `.docx` file, not just a chat response.
- **Multi-agent orchestration** — 11 specialized agents (education, HR, finance, etc.) each with domain-specific skills, automatically selected based on your question.
- **Career intelligence** — Upload education/certification data and get competency analysis, skill gap reports, and future job recommendations.
- **Multilingual** — Ask in Korean, English, or Japanese. The system searches Korean-indexed documents even when you ask in English.

## What Can You Do?

### 1. Ask questions about your documents

Upload any document and ask questions. The system searches using hybrid FTS5 + vector search and cites sources.

```
User: 재무회계의 핵심 개념을 정리해줘
AI: ## 재무회계란?
    재무회계는 기업 외부정보이용자를 대상으로 하는 회계입니다. [testfile.pdf p.3]
    ...
```

### 2. Query structured Excel data

Upload an Excel file with employee data, project lists, or any tabular data. Ask specific questions about rows and columns.

```
User: 홍길동의 이메일 주소와 전화번호를 알려줘
AI: 홍길동 (영업부 과장)
    - 이메일: hong@company.com
    - 전화번호: 010-1234-5678
    출처: [employees.xlsx]
```

```
User: 개발부에 소속된 사람들은 누구야?
AI: | 이름   | 직급 | 이메일           |
    |--------|------|------------------|
    | 김철수 | 대리 | kim@company.com  |
    | 최지은 | 팀장 | choi@company.com |
    | 윤태호 | 사원 | yoon@company.com |
    출처: [employees.xlsx]
```

### 3. Analyze education & recommend careers

Upload education history data and get AI-powered career analysis.

```
User: 김민지의 교육 이력을 분석하고 미래 일자리를 추천해줘

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
    1. 금융 데이터분석가 ⭐⭐⭐ (적합도 85%)
    2. AI 신용평가 전문가 ⭐⭐⭐ (성장성 최고)
    3. 핀테크 데이터분석가 ⭐⭐
```

### 4. Generate documents

Ask the AI to create reports, presentations, or spreadsheets based on your indexed data.

```
User: 재무회계에 대한 보고서를 만들어줘
AI: ✅ 재무회계의_이해와_체계.docx 생성 완료 (12KB)
    - 6개 섹션, 출처 표기 포함
    📥 다운로드: /api/files/재무회계의_이해와_체계.docx
```

### 5. Ask in any language

The system automatically translates search queries to match indexed documents.

```
User: Analyze Park Seoyeon's competencies and recommend career paths
AI: ## Park Seoyeon - Career Analysis
    - Education: Bachelor's in Education, ADDIE Instructional Design (30h)
    - Certifications: Teaching Certificate, Google Educator
    - Recommended: EdTech Designer ⭐⭐⭐
    Source: [education_history.xlsx]
```

## Architecture

```
Browser (React + Tailwind)
  │ HTTP / SSE streaming
  ▼
Express Server (Node.js + TypeScript)
  │
  ├── Orchestrator (Claude Haiku 4.5 via Agent SDK)
  │   │
  │   ├── Pre-Search ──── server-side RAG search before LLM
  │   │                    (keyword extraction + multilingual expansion)
  │   │
  │   └── 11 Specialized Agents
  │       ├── rag-search ─────── Document Q&A with source citations
  │       ├── web-research ────── Web search + URL fetching
  │       ├── file-analyst ────── Local file analysis
  │       ├── memory ──────────── Intent tracking + knowledge graph
  │       ├── doc-writer ──────── Reports, emails, meeting notes (DOCX/PDF)
  │       ├── presentation-maker ─ Pitch decks, training slides (PPTX)
  │       ├── spreadsheet-maker ── Dashboards, data tables (XLSX)
  │       ├── business-analyst ─── Strategy, finance, competitive analysis
  │       ├── hr-specialist ────── Recruitment, org design, change mgmt
  │       ├── education-specialist ─ Curriculum, career analysis, AIED
  │       └── operations-support ── PM, legal, CS, translation, QA
  │
  ├── Custom MCP Server ── 11 RAG tools (search, status, journal, etc.)
  ├── External MCP ─────── memory, sequential-thinking, fetch
  │
  └── SQLite
      ├── FTS5 (BM25 keyword search)
      ├── sqlite-vec (vector KNN search)
      └── RRF hybrid fusion (weight_fts=1.5, weight_vec=1.0)
```

### How Search Works

1. **Document Upload** → parsed by format (PDF pages, Excel rows, Markdown headings)
2. **Excel Special Treatment** → headers preserved in every chunk as markdown tables
3. **FTS5 Indexing** → immediate, Korean phrase matching optimized
4. **Vector Embedding** → background async (all-MiniLM-L6-v2, 384 dim)
5. **Query Time**:
   - Server pre-searches with full message + individual keywords + multilingual expansion
   - Results injected into LLM prompt before agent execution
   - Agent can call `search_documents` for additional searches

### How Agent Routing Works

1. **Keyword Matching** → `skill-router.ts` scores agents by keyword hits
2. **Multilingual Expansion** → English "education" → Korean "교육" for matching
3. **Dynamic Skill Loading** → only matched agents get their Skills loaded (saves tokens)
4. **LLM Orchestration** → Claude decides which agent to delegate to
5. **Pre-Search Injection** → search results included in prompt regardless of agent choice

## 76 Skills

Skills are markdown frameworks embedded into agent prompts at runtime. They give each agent domain expertise.

| Category | Skills | Purpose |
|----------|--------|---------|
| **Writing (15)** | Pyramid/SCQA, BLUF, PAS, AIDA, SPIN, StoryBrand, STAR, PSB, PRFAQ, Executive Summary, 3-Act Story, Show-Don't-Tell, Blog/SEO, Narrative Essay, Email | Document frameworks for different genres |
| **Education (14)** | Course Design, Curriculum Builder, Learning Assessment, AI Education, Education Business, Education Content, HRD Training, Lecture Script, Textbook Planning, Training Slides, Career Pathway Analyzer, Skills Gap Analyzer, Future Job Recommender, Work Journal | Full education-to-career pipeline |
| **Business (11)** | Competitor Analysis, Strategic Planning, Financial Report, Data Analysis, Executive Briefing, Board Report, Scenario Analysis, Product Planning, Roadmap Builder, Revenue Analysis, AB Testing | Strategy and analytics |
| **HR (4)** | HR Recruitment, Change Management, Org Design, HRD Training | People operations |
| **Office (8)** | DOCX Official, PPTX Official, XLSX Official, PDF Official, PPT Selector/Design Rules, Excel Selector/Design Rules | File generation with python-pptx, openpyxl, etc. |
| **PPT (4)** | Pitch Deck, Status Report, Training Slides, Creative Presentation | Presentation types |
| **Operations (8)** | Project Management, Legal Compliance, Customer Service, Customer Success, Translation Guide, Quality Management, Compliance Audit, Sales Outreach | Cross-functional support |
| **System (6)** | Domain Selector, Search Strategy, Source Attribution, Intent Tracking, User Profiling, Writing Selector | Internal routing and quality |
| **Content (4)** | Content Strategy, Social Media, Campaign Planning, Technical Document | Marketing and content |

## Quick Start

### Prerequisites

| Requirement | Version | Purpose |
|-------------|---------|---------|
| **Node.js** | 20+ | Server runtime |
| **npm** | 10+ | Package management |
| **Python** | 3.10+ | Document generation (DOCX, PPTX, XLSX) |
| **Anthropic API Key** | — | LLM (Claude Haiku 4.5) |

### Step 1: Clone & Install

```bash
git clone https://github.com/raondaon-kim/mini-rag.git
cd mini-rag

# Server dependencies
npm install

# Client dependencies
cd client && npm install && cd ..
```

### Step 2: Python Libraries (for document generation)

```bash
pip install python-pptx openpyxl xlsxwriter python-docx reportlab Pillow
```

These are required for the AI to generate `.docx`, `.pptx`, `.xlsx`, and `.pdf` files.
The server checks for these at startup and will warn if any are missing.

### Step 3: Environment Configuration

```bash
cp .env.example .env
```

Edit `.env`:
```env
# Required — get from https://console.anthropic.com
ANTHROPIC_API_KEY=sk-ant-api03-your-key-here

# Server port (default: 4001)
PORT=4001

# Document folder (auto-indexed on startup)
DOCS_PATH=./docs

# Data folder (SQLite DB, generated files)
DATA_PATH=./data
DB_PATH=./data/rag.sqlite
```

> **Note:** The vector embedding model (`all-MiniLM-L6-v2`) is downloaded automatically on first run (~80MB). No OpenAI key needed — embedding runs locally.

### Step 4: Run

```bash
# Terminal 1: Start backend (port 4001)
npm start

# Terminal 2: Start frontend dev server (port 5173)
npm run dev:client
```

Open **http://localhost:5173** in your browser.

### Step 5: Upload Documents

- **Drag & drop** files onto the browser window
- Or place files in the `docs/` folder (auto-indexed on server start)
- **Supported formats:** `.pdf`, `.docx`, `.pptx`, `.xlsx`, `.md`, `.txt`, and 20+ code file types

### Production Build (Single Server)

```bash
npm run build:start   # Builds frontend + starts integrated server on port 4001
```

This serves both API and frontend from a single Express server.

### First-Time Checklist

After starting:
1. Upload an Excel file (e.g., employee data, education records)
2. Try: "Tell me about [person name]" or "Who works in [department]?"
3. Try: "Create a report about [topic]"
4. Check the sidebar for generated files and conversation history

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/chat` | RAG chat with SSE streaming. Body: `{message, top_k?, search_mode?}` |
| `POST` | `/api/upload` | Upload document. Multipart form: `file` |
| `POST` | `/api/search` | Direct search (no LLM). Body: `{query, top_k?, search_mode?}` |
| `GET` | `/api/documents` | List indexed documents |
| `GET` | `/api/status` | Index stats + usage tracking |
| `GET` | `/api/conversations` | Conversation history |
| `GET` | `/api/conversations/:id` | Single conversation messages |
| `DELETE` | `/api/documents/:id` | Delete a document |
| `GET` | `/api/output-files` | List generated files |
| `GET` | `/api/files/:name` | Download generated file |

### SSE Events (Chat)

```
event: token     → {text: "partial response..."}
event: status    → {text: "문서 검색...", tool: "mcp__rag__search_documents"}
event: sources   → {chunks: [...], session_id: "..."}
event: done      → {session_id: "..."}
event: error     → {error: "message"}
```

## Project Structure

```
mini-rag/
├── server/
│   ├── agents/          # 11 agent definitions + registry + skill router
│   ├── orchestrator/    # Agent SDK query handler + pre-search
│   ├── mcp/             # Custom MCP server (11 RAG tools)
│   ├── db/              # SQLite connection + schema
│   ├── ingestion/       # Document parser, chunker, indexer
│   ├── search/          # FTS5 + Vector + RRF hybrid
│   ├── memory/          # Conversations, intents, work journal, sessions
│   ├── llm/             # Claude API, embedder, prompts
│   └── routes/          # Express routes
├── client/
│   ├── src/components/  # React UI (ChatView, Sidebar, InputBar, etc.)
│   └── src/hooks/       # useChat (SSE), useUpload (phases), useApi
├── .claude/skills/      # 76 SKILL.md files
├── data/                # SQLite DB + generated files (gitignored)
└── docs/                # Document folder (auto-indexed)
```

## Key Design Decisions

- **FTS5 > Vector for Korean** — all-MiniLM-L6-v2 is weak on Korean, so FTS5 gets higher weight (1.5 vs 1.0)
- **Server-side pre-search** — LLM sometimes skips calling search tools, so we always inject search results into the prompt
- **Excel as markdown tables** — ExcelJS parses sheets into header+row markdown, with headers repeated per chunk for searchability
- **Dynamic skill loading** — only matched agents load their skills (~5K tokens vs 22K), saving cost per query
- **Background vector embedding** — FTS5 indexed immediately for fast search, vectors generated async

## License

MIT
