// Validate content/topics/<no>.json topic packs: node scripts/check-topics.mjs [first-no] [last-no]
import fs from "node:fs";
import path from "node:path";

const root = path.join(import.meta.dirname, "..");
const dir = path.join(root, "content", "topics");
const { termRegex } = await import(new URL("../lib/listening/vocab.ts", import.meta.url).href); // Node 22.18+ runs .ts directly

// topic number -> type, from the topics file
const md = fs.readFileSync(process.env.TOPICS_FILE ?? path.join(root, "..", "..", "fde-speaking-topics.md"), "utf8");
const types = new Map([...md.matchAll(/^(\d+)\.\s*\((EX|BQ|WS)\)/gm)].map((m) => [Number(m[1]), m[2]]));
const [from, to] = process.argv.slice(2).map(Number);
if (from) for (const n of types.keys()) if (n < from || n > (to || from)) types.delete(n);

// word targets: [model, short, engineer]
const TARGET_WORDS = { EX: [190, 70, 140], BQ: [220, 75], WS: [190, 75] };

const words = (s) => s.split(/\s+/).filter(Boolean).length;
const isText = (x, max = Infinity) => typeof x === "string" && x.trim().length > 0 && words(x) <= max;

let problems = 0;
const found = new Set();
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".json"))) {
  const no = Number(f.replace(/\.json$/, ""));
  if (from && !types.has(no)) continue;
  const bad = (msg) => (problems++, console.log(`${f}: ${msg}`));
  if (!types.has(no)) {
    bad("not a topic number in the topics file");
    continue;
  }
  const type = types.get(no);
  found.add(no);
  let p;
  try {
    p = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
  } catch (e) {
    bad(`invalid JSON (${e.message})`);
    continue;
  }
  const near = (label, text, target) => {
    if (!isText(text)) return bad(`missing ${label}`);
    const n = words(text);
    if (n < target * 0.7 || n > target * 1.35) bad(`${label} is ${n} words (aim ~${target})`);
  };

  if (!Array.isArray(p.ideas) || p.ideas.length !== 3 || !p.ideas.every((x) => isText(x, 16))) bad("needs 3 short ideas (≤16 words)");
  if (!Array.isArray(p.phrases) || p.phrases.length !== 8 || !p.phrases.every((x) => x?.phrase && x?.meaning)) bad("needs 8 phrases with phrase + meaning");

  const l = p.learn ?? {};
  if (!isText(l.explain)) bad("learn.explain missing");
  else if (words(l.explain) < 60 || words(l.explain) > 180) bad(`learn.explain is ${words(l.explain)} words (aim 80–150)`);
  if (!Array.isArray(l.points) || l.points.length !== 3 || !l.points.every((x) => isText(x, 30))) bad("learn.points needs 3 items");
  if (!Array.isArray(l.mistakes) || l.mistakes.length < 2 || l.mistakes.length > 3 || !l.mistakes.every((x) => isText(x, 30))) bad("learn.mistakes needs 2–3 items");
  if (type === "EX") {
    if (!isText(l.analogy, 90)) bad("EX needs learn.analogy (≤90 words)");
    if (!Array.isArray(l.glossary) || l.glossary.length < 3 || l.glossary.length > 6 || !l.glossary.every((g) => g?.term && g?.meaning)) bad("EX needs 3–6 glossary terms");
  }

  if (!Array.isArray(p.framework) || p.framework.length < 3 || p.framework.length > 5 || !p.framework.every((x) => x?.step && isText(x.starter, 16)))
    bad("framework needs 3–5 { step, starter } (starter ≤16 words)");
  if (!Array.isArray(p.betterWays) || p.betterWays.length !== 5 || !p.betterWays.every((x) => x?.weak && x?.strong && x?.why)) bad("betterWays needs 5 { weak, strong, why }");
  if (!Array.isArray(p.followUps) || p.followUps.length !== 3 || !p.followUps.every((x) => isText(x?.q, 30) && isText(x?.answer, 90))) bad("followUps needs 3 { q, answer ≤90 words }");
  if (!Array.isArray(p.selfCheck) || p.selfCheck.length < 4 || p.selfCheck.length > 5 || !p.selfCheck.every((x) => isText(x, 20))) bad("selfCheck needs 4–5 short items");

  const [m, s, e] = TARGET_WORDS[type];
  near("model", p.model, m);
  near("short", p.short, s);
  if (type === "EX") {
    near("audience.engineer", p.audience?.engineer, e);
    if (!Array.isArray(p.jargon) || p.jargon.length < 5 || p.jargon.length > 10) bad("EX needs 5–10 jargon terms");
    else {
      // the manager and executive versions are for non-technical people: no jargon in them
      for (const j of p.jargon) for (const [label, text] of [["model", p.model], ["short", p.short]])
        if (typeof text === "string" && termRegex(j)?.test(text)) bad(`jargon "${j}" appears in ${label}`);
    }
  }
  if (typeof p.model === "string") {
    const used = (p.phrases ?? []).filter((x) => x?.phrase && termRegex(x.phrase)?.test(p.model)).length;
    if (used < 4) bad(`model uses only ${used} of the phrases (need 4+)`);
  }
}
const missing = [...types.keys()].filter((n) => !found.has(n));
if (missing.length) console.log(`missing packs: ${missing.join(", ")}`);
console.log(`${found.size}/${types.size} packs, ${problems} problems`);
process.exit(problems || missing.length ? 1 : 0);
