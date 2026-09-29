import { termRegex } from "../listening/vocab";
import { patternById } from "./patterns";

export type GrammarIssue = { message: string; text: string; suggestion: string | null; offset: number; length: number };

export type Checks = {
  wordUsed: boolean | null;
  patternUsed: boolean | null; // null = this pattern can only be self-checked
  grammarIssues: GrammarIssue[] | null; // null = grammar check unavailable (offline / service error)
  grammarError?: string;
};

const LT_URL = process.env.LANGUAGETOOL_URL ?? "https://api.languagetool.org/v2/check";
// Only categories that matter for speech: Whisper decides punctuation, casing and spelling, not the speaker
const KEEP = new Set(["GRAMMAR", "CONFUSED_WORDS", "COLLOCATIONS", "NONSTANDARD_PHRASES", "SEMANTICS", "MISC"]);

type LtMatch = {
  message: string;
  offset: number;
  length: number;
  replacements: { value: string }[];
  rule: { category: { id: string }; issueType?: string };
};

async function languageTool(text: string): Promise<GrammarIssue[]> {
  const res = await fetch(LT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({ text, language: "en-GB" }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`LanguageTool returned ${res.status}`);
  const data = (await res.json()) as { matches: LtMatch[] };
  return data.matches
    .filter((m) => KEEP.has(m.rule.category.id) && m.rule.issueType !== "typographical")
    .map((m) => ({
      message: m.message,
      text: text.slice(m.offset, m.offset + m.length),
      suggestion: m.replacements[0]?.value ?? null,
      offset: m.offset,
      length: m.length,
    }));
}

export async function evaluate(transcript: string, term: string, patternId: string): Promise<Checks> {
  const text = transcript.trim();
  const re = termRegex(term);
  const pattern = patternById(patternId);
  const checks: Checks = {
    wordUsed: re ? re.test(text) : null,
    patternUsed: pattern?.detect ? pattern.detect.test(text) : null,
    grammarIssues: null,
  };
  if (!text) return { ...checks, wordUsed: false, grammarIssues: [] };
  try {
    checks.grammarIssues = await languageTool(text);
  } catch (e) {
    checks.grammarError = (e as Error).message;
  }
  return checks;
}
