import { writeFile, readFile, readdir, mkdir } from "fs/promises";
import path from "path";

import { PATHS } from "../config.js";

const INTENTS_DIR = PATHS.intents;

export interface Intent {
  title: string;
  content: string;
  tags: string[];
  status: "new" | "in_progress" | "done";
  date: string;
  filePath: string;
}

export async function saveIntent(
  title: string,
  content: string,
  tags: string[] = [],
  status: "new" | "in_progress" | "done" = "new"
): Promise<string> {
  await mkdir(INTENTS_DIR, { recursive: true });
  const date = new Date().toISOString().slice(0, 10);
  const slug = title
    .replace(/[^a-zA-Z0-9가-힣\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 50);
  const filePath = path.join(INTENTS_DIR, `${date}-${slug}.md`);

  const md = `---
date: ${date}
status: ${status}
tags: [${tags.join(", ")}]
---

# ${title}

${content}
`;

  await writeFile(filePath, md, "utf-8");
  return filePath;
}

export async function listIntents(): Promise<Intent[]> {
  await mkdir(INTENTS_DIR, { recursive: true });
  const files = await readdir(INTENTS_DIR);
  const intents: Intent[] = [];

  for (const file of files) {
    if (!file.endsWith(".md")) continue;
    try {
      const raw = await readFile(path.join(INTENTS_DIR, file), "utf-8");
      const frontmatterMatch = raw.match(/^---\n([\s\S]*?)\n---/);
      const titleMatch = raw.match(/^# (.+)$/m);

      const date = frontmatterMatch
        ? (frontmatterMatch[1].match(/date:\s*(.+)/)?.[1] || "").trim()
        : "";
      const status = frontmatterMatch
        ? ((frontmatterMatch[1].match(/status:\s*(.+)/)?.[1] || "new").trim() as Intent["status"])
        : "new";
      const tagsStr = frontmatterMatch
        ? (frontmatterMatch[1].match(/tags:\s*\[(.+)\]/)?.[1] || "")
        : "";
      const tags = tagsStr.split(",").map((t) => t.trim()).filter(Boolean);

      intents.push({
        title: titleMatch?.[1] || file,
        content: raw,
        tags,
        status,
        date,
        filePath: path.join(INTENTS_DIR, file),
      });
    } catch {
      // skip unreadable files
    }
  }

  return intents.sort((a, b) => b.date.localeCompare(a.date));
}
