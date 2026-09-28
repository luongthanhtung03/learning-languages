import type { EpisodeDetail, Sentence } from "./types";

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** "itch / itchy" -> ["itch", "itchy"]; "catch (an illness)" -> ["catch"]; "to reset" -> ["reset"] */
export function termVariants(term: string): string[] {
  return term
    .split("/")
    .map((t) => t.replace(/\(.*?\)/g, "").replace(/^\s*to\s+/i, "").replace(/[‘’"“”]/g, "'").trim())
    .filter((t) => t.length >= 2);
}

/** Regex matching a vocab term with light inflection (itch -> itching, reset -> resetting). */
export function termRegex(term: string): RegExp | null {
  const variants = termVariants(term)
    .sort((a, b) => b.length - a.length)
    .map((v) =>
      v
        .split(/\s+/)
        .map((w) => (w.length >= 3 ? `${escape(w)}[a-z]{0,4}` : escape(w)))
        .join("\\s+"),
    );
  if (!variants.length) return null;
  return new RegExp(`\\b(?:${variants.join("|")})\\b`, "i");
}

export type GapItem = { sentence: Sentence; before: string; answer: string; after: string; term: string };

/** One gap-fill item per vocabulary term, preferring its second use (the first is often the quote). */
export function buildGaps(ep: EpisodeDetail, max = 8): GapItem[] {
  const items: GapItem[] = [];
  const used = new Set<number>();
  for (const v of ep.vocab) {
    const re = termRegex(v.term);
    if (!re) continue;
    const hits = ep.sentences.filter((s) => !used.has(s.idx) && re.test(s.text) && s.text.split(/\s+/).length >= 5);
    const pick = hits[1] ?? hits[0];
    if (!pick) continue;
    const m = pick.text.match(re)!;
    used.add(pick.idx);
    items.push({
      sentence: pick,
      before: pick.text.slice(0, m.index),
      answer: m[0],
      after: pick.text.slice(m.index! + m[0].length),
      term: v.term,
    });
    if (items.length >= max) break;
  }
  return items.sort((a, b) => a.sentence.idx - b.sentence.idx);
}

/** Try to find the correct weekly-question option from the answer turns. */
export function detectAnswer(ep: EpisodeDetail): string | null {
  if (!ep.question?.options.length) return null;
  const text = ep.answerTurns.map((i) => ep.turns[i]?.text ?? "").join(" ").toLowerCase();
  const found = ep.question.options.filter((o) => {
    const key = o.text.toLowerCase().replace(/^(a|an|the|some)\s+/, "").replace(/[.,!?]$/, "");
    return key.length >= 2 && new RegExp(`\\b${escape(key)}\\b`).test(text);
  });
  return found.length === 1 ? found[0].letter : null;
}
