import { diffArrays } from "diff";

const NUMBERS: Record<string, string> = {
  zero: "0", one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8",
  nine: "9", ten: "10", eleven: "11", twelve: "12", twenty: "20", thirty: "30", forty: "40",
  fifty: "50", hundred: "100",
};

export function normWord(w: string) {
  const t = w.toLowerCase().replace(/[’‘`]/g, "'").replace(/[^a-z0-9']/g, "").replace(/^'+|'+$/g, "");
  return NUMBERS[t] ?? t;
}

/** Split text into display words, keeping the original spelling alongside a normalised key. */
export function words(text: string) {
  return text
    .split(/[\s–—-]+/)
    .map((raw) => ({ raw, key: normWord(raw) }))
    .filter((w) => w.key);
}

export type DiffPart = { kind: "ok" | "missing" | "extra"; text: string };

/**
 * Word-level comparison of what the learner typed against the reference.
 * accuracy = reference words heard correctly / reference words.
 */
export function compare(reference: string, typed: string) {
  const ref = words(reference);
  const got = words(typed);
  const changes = diffArrays(
    ref.map((w) => w.key),
    got.map((w) => w.key),
  );
  const parts: DiffPart[] = [];
  let ri = 0;
  let gi = 0;
  let correct = 0;
  for (const c of changes) {
    const n = c.count ?? c.value.length;
    if (c.added) {
      parts.push({ kind: "extra", text: got.slice(gi, gi + n).map((w) => w.raw).join(" ") });
      gi += n;
    } else if (c.removed) {
      parts.push({ kind: "missing", text: ref.slice(ri, ri + n).map((w) => w.raw).join(" ") });
      ri += n;
    } else {
      parts.push({ kind: "ok", text: ref.slice(ri, ri + n).map((w) => w.raw).join(" ") });
      correct += n;
      ri += n;
      gi += n;
    }
  }
  return { parts, accuracy: ref.length ? correct / ref.length : 0, correct, total: ref.length };
}
