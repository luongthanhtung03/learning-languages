// Validate content/topics/<no>.json research packs: node scripts/check-topics.mjs
import fs from "node:fs";
import path from "node:path";

const root = path.join(import.meta.dirname, "..");
const dir = path.join(root, "content", "topics");
const { termRegex } = await import(new URL("../lib/listening/vocab.ts", import.meta.url).href); // Node 22.18+ runs .ts directly

// topic number -> type, from the topics file
const md = fs.readFileSync(process.env.TOPICS_FILE ?? path.join(root, "..", "..", "120-speaking-topics.md"), "utf8");
const types = new Map([...md.matchAll(/^(\d+)\.\s*\((P2|P3|TQ)\)/gm)].map((m) => [Number(m[1]), m[2]]));
const TARGET_WORDS = { P2: 220, P3: 160, TQ: 160 };

let problems = 0;
const found = new Set();
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".json"))) {
  const no = Number(f.replace(/\.json$/, ""));
  const bad = (msg) => (problems++, console.log(`${f}: ${msg}`));
  if (!types.has(no)) {
    bad("not a topic number in the topics file");
    continue;
  }
  found.add(no);
  let p;
  try {
    p = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
  } catch (e) {
    bad(`invalid JSON (${e.message})`);
    continue;
  }
  if (!Array.isArray(p.ideas) || p.ideas.length < 2 || p.ideas.length > 3) bad("needs 2-3 ideas");
  else p.ideas.forEach((x, i) => typeof x === "string" && x.split(/\s+/).length <= 14 ? null : bad(`idea ${i + 1} too long or not text`));
  if (!Array.isArray(p.phrases) || p.phrases.length !== 8) bad(`needs 8 phrases, got ${p.phrases?.length}`);
  else p.phrases.forEach((x, i) => (x?.phrase && x?.meaning ? null : bad(`phrase ${i + 1} needs phrase + meaning`)));
  if (typeof p.model !== "string") {
    bad("missing model answer");
    continue;
  }
  const words = p.model.split(/\s+/).filter(Boolean).length;
  const target = TARGET_WORDS[types.get(no)];
  if (words < target * 0.75 || words > target * 1.25) bad(`model is ${words} words (aim ~${target})`);
  const used = (p.phrases ?? []).filter((x) => x?.phrase && termRegex(x.phrase)?.test(p.model)).length;
  if (used < 4) bad(`model uses only ${used} of the phrases (need 4+)`);
}
const missing = [...types.keys()].filter((n) => !found.has(n));
if (missing.length) console.log(`missing packs: ${missing.join(", ")}`);
console.log(`${found.size}/${types.size} packs, ${problems} problems`);
process.exit(problems || missing.length ? 1 : 0);
