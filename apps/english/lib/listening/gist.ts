import fs from "node:fs";
import path from "node:path";
import type { GistQuestion } from "../types";

// Comprehension questions written per episode, committed in content/gist/<id>.json
const DIR = path.join(process.cwd(), "content", "gist");

export function loadGist(id: string): GistQuestion[] | null {
  if (!/^\d+$/.test(id)) return null;
  try {
    const file = JSON.parse(fs.readFileSync(path.join(DIR, `${id}.json`), "utf8")) as { questions?: GistQuestion[] };
    const qs = (file.questions ?? []).filter(
      (q) => q.q && Array.isArray(q.options) && q.options.length >= 2 && Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length,
    );
    return qs.length ? qs : null;
  } catch {
    return null;
  }
}
