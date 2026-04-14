/**
 * Skill Loader — SKILL.md 파일을 읽어서 에이전트 프롬프트에 주입
 *
 * Claude Code CLI 없이도 Skills가 동작하도록,
 * 서버 시작 시 .claude/skills/ 디렉토리에서 SKILL.md를 읽어
 * 에이전트 프롬프트에 직접 포함시킵니다.
 *
 * 이 방식이면 npm install → npx tsx server/index.ts 만으로
 * 모든 Skills가 동작합니다.
 */
import { readFile, readdir, stat } from "fs/promises";
import path from "path";

const SKILLS_DIR = path.resolve(".claude/skills");

// 캐시 — 서버 시작 시 한 번만 로드
const skillCache = new Map<string, string>();

/**
 * 단일 Skill의 SKILL.md 내용을 로드
 */
export async function loadSkill(skillName: string): Promise<string> {
  if (skillCache.has(skillName)) {
    return skillCache.get(skillName)!;
  }

  const skillPath = path.join(SKILLS_DIR, skillName, "SKILL.md");
  try {
    const content = await readFile(skillPath, "utf-8");
    skillCache.set(skillName, content);
    return content;
  } catch {
    console.warn(`[SkillLoader] Skill not found: ${skillName} (${skillPath})`);
    return "";
  }
}

/**
 * 여러 Skills를 로드하여 하나의 문자열로 합침
 */
export async function loadSkills(skillNames: string[]): Promise<string> {
  const sections: string[] = [];

  for (const name of skillNames) {
    const content = await loadSkill(name);
    if (content) {
      sections.push(`\n${"=".repeat(60)}\n## Skill: ${name}\n${"=".repeat(60)}\n${content}`);
    }
  }

  return sections.join("\n");
}

/**
 * 에이전트의 기본 프롬프트에 Skills 내용을 주입하여 최종 프롬프트 생성
 */
export async function buildPromptWithSkills(
  basePrompt: string,
  skillNames: string[]
): Promise<string> {
  if (skillNames.length === 0) return basePrompt;

  const skillsContent = await loadSkills(skillNames);
  if (!skillsContent) return basePrompt;

  return `${basePrompt}

${"#".repeat(60)}
# 참고 Skills (아래 프레임워크를 반드시 따르세요)
${"#".repeat(60)}
${skillsContent}`;
}

/**
 * 사용 가능한 모든 Skills 목록 반환
 */
export async function listAvailableSkills(): Promise<string[]> {
  try {
    const entries = await readdir(SKILLS_DIR);
    const skills: string[] = [];

    for (const entry of entries) {
      const skillMd = path.join(SKILLS_DIR, entry, "SKILL.md");
      try {
        await stat(skillMd);
        skills.push(entry);
      } catch {
        // SKILL.md 없으면 스킬 아님
      }
    }

    return skills.sort();
  } catch {
    return [];
  }
}

/**
 * 모든 Skills를 미리 로드 (서버 시작 시 호출)
 */
export async function preloadAllSkills(): Promise<void> {
  const skills = await listAvailableSkills();
  let loaded = 0;

  for (const name of skills) {
    const content = await loadSkill(name);
    if (content) loaded++;
  }

  console.log(`[SkillLoader] Loaded ${loaded}/${skills.length} skills from ${SKILLS_DIR}`);
}
