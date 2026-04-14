/**
 * Agent Registry — 에이전트 메타데이터 + 라우팅 규칙
 *
 * 오케스트레이터가 사용자 자연어 요청을 분석할 때
 * 이 레지스트리를 참고하여 최적의 에이전트를 선택합니다.
 *
 * 장점:
 * - 에이전트 추가/수정 시 definitions.ts만 변경
 * - 오케스트레이터 프롬프트를 간결하게 유지
 * - 라우팅 로직의 단일 진실 소스 (Single Source of Truth)
 */

export interface AgentRegistryEntry {
  name: string;
  description: string;
  /** 이 에이전트가 처리하는 업무 카테고리 */
  capabilities: string[];
  /** 라우팅에 사용할 한국어/영어 키워드 */
  keywords: string[];
  /** 산출물 형태 */
  outputType: "text" | "docx" | "pdf" | "pptx" | "xlsx" | "mixed";
  /** 그룹 — 오케스트레이터가 먼저 그룹으로 분류 후 에이전트 선택 */
  group: "information" | "document" | "analysis" | "specialist";
}

/**
 * 에이전트 레지스트리
 */
export const AGENT_REGISTRY: AgentRegistryEntry[] = [
  // ===== 정보 그룹 =====
  {
    name: "rag-search",
    description: "업로드된 문서에서 검색하여 답변",
    capabilities: ["문서 검색", "RAG 질의응답", "문서 내용 요약"],
    keywords: ["문서", "검색", "찾아", "업로드한", "파일에서", "내용", "요약"],
    outputType: "text",
    group: "information",
  },
  {
    name: "web-research",
    description: "웹에서 최신 정보 검색 및 수집",
    capabilities: ["웹 검색", "최신 정보", "트렌드 조사", "URL 내용 수집"],
    keywords: ["최신", "요즘", "현재", "뉴스", "트렌드", "검색해", "찾아봐", "인터넷", "웹"],
    outputType: "text",
    group: "information",
  },
  {
    name: "file-analyst",
    description: "로컬 파일 직접 읽기 및 분석",
    capabilities: ["파일 분석", "코드 분석", "설정 파일 확인"],
    keywords: ["파일", "코드", "설정", "config", "분석해", "읽어"],
    outputType: "text",
    group: "information",
  },
  {
    name: "memory",
    description: "사용자 의도/목표 추적 및 지식 기억",
    capabilities: ["의도 저장", "목표 추적", "지식 기억", "맥락 조회"],
    keywords: ["기억", "저장", "목표", "의도", "이전에", "지난번", "~하려고"],
    outputType: "text",
    group: "information",
  },

  // ===== 문서 생성 그룹 =====
  {
    name: "doc-writer",
    description: "보고서, 제안서, 이메일, 회의록, 블로그, 에세이 → DOCX/PDF",
    capabilities: [
      "보고서 작성", "제안서 작성", "이메일 작성", "회의록 작성",
      "블로그 글", "에세이", "학술 논문", "기술 문서", "마케팅 카피",
      "뉴스레터", "공지문", "사내 문서",
    ],
    keywords: [
      "보고서", "제안서", "이메일", "메일", "회의록", "미팅노트",
      "블로그", "에세이", "논문", "기술문서", "카피", "글쓰기",
      "DOCX", "PDF", "워드", "문서 작성", "편지", "공지",
      "AIDA", "SCQA", "SPIN", "STAR", "BLUF",
    ],
    outputType: "docx",
    group: "document",
  },
  {
    name: "presentation-maker",
    description: "피치덱, 보고 PPT, 교육 자료, 크리에이티브 → PPTX",
    capabilities: [
      "피치덱", "사업 보고 PPT", "교육 자료", "크리에이티브 프레젠테이션",
      "IR 자료", "발표 자료",
    ],
    keywords: [
      "PPT", "PPTX", "파워포인트", "발표", "슬라이드", "프레젠테이션",
      "피치덱", "교육자료", "IR",
    ],
    outputType: "pptx",
    group: "document",
  },
  {
    name: "spreadsheet-maker",
    description: "대시보드, 데이터 테이블, 재무 모델 → XLSX",
    capabilities: [
      "대시보드", "데이터 테이블", "재무 모델", "분석 시트",
      "차트/그래프", "피벗 테이블",
    ],
    keywords: [
      "엑셀", "XLSX", "스프레드시트", "표", "대시보드",
      "데이터 테이블", "차트", "그래프", "피벗",
    ],
    outputType: "xlsx",
    group: "document",
  },

  // ===== 분석 그룹 =====
  {
    name: "business-analyst",
    description: "전략/재무/경쟁사/시장 분석, 경영진 보고, 시나리오, 제품 기획, 로드맵",
    capabilities: [
      "경쟁사 분석", "시장 조사", "SWOT", "전략 기획",
      "재무 분석", "경영진 보고", "이사회 보고", "시나리오 분석",
      "제품 기획", "로드맵", "매출 분석", "사업 계획",
      "OKR", "KPI", "투자 제안", "M&A", "Unit Economics",
    ],
    keywords: [
      "경쟁사", "시장", "SWOT", "전략", "사업계획", "OKR",
      "재무", "예산", "손익", "매출", "MRR", "ARR", "LTV", "CAC",
      "경영진", "CEO", "이사회", "IR", "시나리오", "워게임",
      "제품기획", "PRD", "로드맵", "백로그", "비즈니스 모델",
      "투자", "밸류에이션", "벤치마킹", "Porter",
    ],
    outputType: "mixed",
    group: "analysis",
  },

  // ===== 전문가 그룹 =====
  {
    name: "hr-specialist",
    description: "채용, 면접, 평가, 온보딩, 조직 설계, 변화관리",
    capabilities: [
      "채용공고", "면접질문", "성과평가",
      "온보딩", "조직 설계", "변화관리", "역량 모델",
    ],
    keywords: [
      "채용", "JD", "면접", "평가표", "성과평가",
      "온보딩",
      "조직설계", "조직도", "R&R", "RACI",
      "변화관리", "ADKAR",
    ],
    outputType: "mixed",
    group: "specialist",
  },
  {
    name: "education-specialist",
    description: "교육과정 설계, 커리큘럼, 학습 평가, 인강 스크립트, 교재 기획, AI 교육, 교육 사업",
    capabilities: [
      "교육과정 설계", "커리큘럼 구성", "학습 평가 설계",
      "인강 스크립트", "교재/도서 기획", "AI 교육 설계",
      "교육 콘텐츠 제작", "교육 사업 기획", "학습 분석",
      "교육 훈련 (HRD)", "퀴즈/시험 출제",
    ],
    keywords: [
      "교육", "교육과정", "커리큘럼", "학습", "강의",
      "인강", "스크립트", "교재", "도서", "교안",
      "시험", "퀴즈", "평가", "루브릭", "문항",
      "ADDIE", "SAM", "Bloom", "Gagne",
      "AI 교육", "AIED", "적응형", "AI 튜터",
      "수강", "수강생", "LMS", "이러닝", "e-learning",
      "연수", "교육 사업", "교육 ROI", "완료율",
      "출판", "목차", "원고", "집필",
      "학습목표", "차시", "모듈", "코스",
      // 직무분석 + 미래일자리 파이프라인
      "직무 분석", "직무분석", "역량 분석", "역량분석",
      "스킬 갭", "스킬갭", "역량 차이", "부족한 역량",
      "미래 일자리", "유망 직종", "커리어", "커리어 전환",
      "경력 경로", "직업 추천", "취업 추천", "AI 대체",
      "교육 이력", "교육이력", "자격증 분석",
    ],
    outputType: "mixed",
    group: "specialist",
  },
  {
    name: "operations-support",
    description: "PM, 법무, 고객서비스, 번역, 품질관리, 영업 지원",
    capabilities: [
      "프로젝트 관리", "법무/컴플라이언스", "고객 서비스",
      "번역", "품질관리", "감사", "영업 지원",
    ],
    keywords: [
      "프로젝트", "WBS", "스프린트", "리스크", "간트",
      "계약서", "NDA", "컴플라이언스", "감사", "ISO", "GDPR",
      "FAQ", "고객응대", "CS", "에스컬레이션",
      "번역", "영어로", "한국어로", "다국어", "현지화",
      "영업", "세일즈", "콜드메일", "품질", "CAPA", "PDCA",
    ],
    outputType: "mixed",
    group: "specialist",
  },
];

/**
 * 레지스트리를 오케스트레이터 시스템 프롬프트용 텍스트로 변환
 *
 * 그룹별로 정리하여 오케스트레이터가 2단계 라우팅을 수행할 수 있도록:
 * 1단계: 그룹 분류 (information/document/analysis/specialist)
 * 2단계: 그룹 내 에이전트 선택 (키워드 + capabilities 매칭)
 */
export function buildRoutingPrompt(): string {
  const groups: Record<string, AgentRegistryEntry[]> = {};
  for (const entry of AGENT_REGISTRY) {
    if (!groups[entry.group]) groups[entry.group] = [];
    groups[entry.group].push(entry);
  }

  const groupNames: Record<string, string> = {
    information: "정보 조회",
    document: "파일 생성",
    analysis: "비즈니스 분석",
    specialist: "전문 업무",
  };

  let prompt = "## 에이전트 라우팅 가이드\n\n";
  prompt += "### 2단계 라우팅: 먼저 그룹 → 그룹 내 에이전트\n\n";

  for (const [group, entries] of Object.entries(groups)) {
    prompt += `#### ${groupNames[group] || group}\n`;
    for (const entry of entries) {
      prompt += `- **${entry.name}**: ${entry.description}\n`;
      prompt += `  키워드: ${entry.keywords.slice(0, 10).join(", ")}\n`;
    }
    prompt += "\n";
  }

  prompt += `### 라우팅 규칙
1. 업로드 문서 관련 질문 → rag-search (최우선)
2. "최신/요즘/현재" + 정보 요청 → web-research
3. 파일 경로/코드 언급 → file-analyst
4. "~하려고 해" / 이전 맥락 참조 → memory
5. 문서/PPT/엑셀 생성 요청 → 해당 document 그룹 에이전트
6. 분석/전략/재무/경영 → business-analyst
7. HR/채용/조직 → hr-specialist
8. 교육/커리큘럼/인강/교재/평가/AI교육 → education-specialist
9. PM/법무/CS/번역/품질/영업 → operations-support
9. 복합 요청 → 순서대로 여러 에이전트 위임
10. 일반 대화 → 직접 답변 (에이전트 불필요)`;

  return prompt;
}
