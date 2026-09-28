import type { Sentence, Turn } from "./types";

const ABBREVIATIONS = ["Dr", "Mr", "Mrs", "Ms", "St", "Prof", "vs", "etc", "e.g", "i.e", "approx", "No"];

/** Split transcript turns into sentences for dictation / shadowing. */
export function splitSentences(turns: Turn[]): Sentence[] {
  const out: Sentence[] = [];
  turns.forEach((turn, t) => {
    let pieces = splitText(turn.text);
    // Merge 1–2 word fragments ("OK.", "Yes!") into the following sentence of the same turn
    pieces = pieces.reduce<string[]>((acc, p) => {
      const prev = acc[acc.length - 1];
      if (prev !== undefined && wordCount(prev) <= 2) acc[acc.length - 1] = `${prev} ${p}`;
      else acc.push(p);
      return acc;
    }, []);
    for (const text of pieces) out.push({ idx: out.length, turn: t, speaker: turn.speaker, text });
  });
  return out;
}

function splitText(text: string): string[] {
  const abbr = new RegExp(`\b(${ABBREVIATIONS.map((a) => a.replace(".", "\.")).join("|")})\.\s`, "g");
  const protectedText = text.replace(abbr, "$1\u0000 ");
  return protectedText
    .split(/(?<=[.!?…]["'’”)]?)\s+(?=["'‘“(]?[A-Z0-9])/)
    .map((s) => s.replace(/\u0000/g, ".").trim())
    .filter(Boolean);
}

export function wordCount(s: string) {
  return s.split(/\s+/).filter(Boolean).length;
}
