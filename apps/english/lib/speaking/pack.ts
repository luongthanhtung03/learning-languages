import fs from "node:fs";
import path from "node:path";

/** Offline research pack for a topic, committed in content/topics/<no>.json. */
export type TopicPack = { ideas: string[]; phrases: { phrase: string; meaning: string }[]; model: string };

const DIR = path.join(process.cwd(), "content", "topics");

export function loadPack(no: number): TopicPack | null {
  if (!Number.isInteger(no) || no < 1) return null;
  try {
    const p = JSON.parse(fs.readFileSync(path.join(DIR, `${no}.json`), "utf8")) as Partial<TopicPack>;
    if (typeof p.model !== "string" || !Array.isArray(p.phrases)) return null;
    return { ideas: Array.isArray(p.ideas) ? p.ideas : [], phrases: p.phrases.filter((x) => x?.phrase), model: p.model };
  } catch {
    return null;
  }
}
