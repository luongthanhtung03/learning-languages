import fs from "node:fs";
import path from "node:path";

export type Phrase = { phrase: string; meaning: string };

/** Offline research pack for a topic, committed in content/topics/<no>.json. Everything you need to practise without searching. */
export type TopicPack = {
  ideas: string[];
  phrases: Phrase[];
  model: string; // EX: non-technical manager version · BQ: STAR answer · WS: spoken reply
  short: string | null; // EX: executive summary · BQ/WS: the tight 1-minute version
  engineer: string | null; // EX only: the version for an engineer
  learn: {
    explain: string;
    points: string[];
    analogy: string | null;
    glossary: { term: string; meaning: string }[];
    mistakes: string[];
  } | null;
  framework: { step: string; starter: string }[];
  betterWays: { weak: string; strong: string; why: string }[];
  followUps: { q: string; answer: string }[];
  jargon: string[];
  selfCheck: string[];
};

const DIR = path.join(process.cwd(), "content", "topics");

const arr = <T>(x: unknown, ok: (v: T) => boolean): T[] => (Array.isArray(x) ? (x as T[]).filter((v) => v && ok(v)) : []);
const str = (x: unknown) => (typeof x === "string" && x.trim() ? x : null);

export function loadPack(no: number): TopicPack | null {
  if (!Number.isInteger(no) || no < 1) return null;
  try {
    const p = JSON.parse(fs.readFileSync(path.join(DIR, `${no}.json`), "utf8"));
    if (typeof p.model !== "string" || !Array.isArray(p.phrases)) return null;
    const l = p.learn;
    return {
      ideas: arr<string>(p.ideas, (x) => typeof x === "string"),
      phrases: arr<Phrase>(p.phrases, (x) => !!x.phrase),
      model: p.model,
      short: str(p.short),
      engineer: str(p.audience?.engineer),
      learn:
        l && typeof l.explain === "string"
          ? {
              explain: l.explain,
              points: arr<string>(l.points, (x) => typeof x === "string"),
              analogy: str(l.analogy),
              glossary: arr<{ term: string; meaning: string }>(l.glossary, (x) => !!x.term),
              mistakes: arr<string>(l.mistakes, (x) => typeof x === "string"),
            }
          : null,
      framework: arr<{ step: string; starter: string }>(p.framework, (x) => !!x.step),
      betterWays: arr<{ weak: string; strong: string; why: string }>(p.betterWays, (x) => !!x.strong),
      followUps: arr<{ q: string; answer: string }>(p.followUps, (x) => !!x.q),
      jargon: arr<string>(p.jargon, (x) => typeof x === "string"),
      selfCheck: arr<string>(p.selfCheck, (x) => typeof x === "string"),
    };
  } catch {
    return null;
  }
}
