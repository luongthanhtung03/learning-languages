// Validate content/gist/*.json: node scripts/check-gist.mjs [--missing]
import fs from "node:fs";
import path from "node:path";

const dir = path.join(import.meta.dirname, "..", "content", "gist");
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
const positions = [0, 0, 0, 0];
let longest = 0; // the correct option shouldn't give itself away by being the longest
let problems = 0;

for (const f of files) {
  const bad = (msg) => (problems++, console.log(`${f}: ${msg}`));
  let data;
  try {
    data = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
  } catch (e) {
    bad(`invalid JSON (${e.message})`);
    continue;
  }
  const qs = data.questions;
  if (!Array.isArray(qs) || qs.length < 5 || qs.length > 10) {
    bad(`expected 5-10 questions, got ${qs?.length}`);
    continue;
  }
  qs.forEach((q, i) => {
    const n = i + 1;
    if (typeof q.q !== "string" || !q.q.trim()) bad(`q${n}: empty question`);
    if (!Array.isArray(q.options) || q.options.length !== 4) return bad(`q${n}: needs 4 options`);
    if (new Set(q.options.map((o) => String(o).trim().toLowerCase())).size !== 4) bad(`q${n}: duplicate options`);
    if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer > 3) return bad(`q${n}: answer must be 0-3`);
    if (typeof q.why !== "string" || !q.why.trim()) bad(`q${n}: missing why`);
    if (q.options.some((o) => /all of the above|none of the above/i.test(o))) bad(`q${n}: avoid "all/none of the above"`);
    positions[q.answer]++;
    const lens = q.options.map((o) => String(o).length);
    if (lens[q.answer] > Math.max(...lens.filter((_, j) => j !== q.answer)) + 10) longest++;
  });
}

const total = positions.reduce((a, b) => a + b, 0);
console.log(`${files.length} files, ${total} questions, ${problems} problems`);
console.log(`answer positions A-D: ${positions.map((p) => `${Math.round((p / (total || 1)) * 100)}%`).join(" ")}`);
console.log(`correct option clearly the longest: ${Math.round((longest / (total || 1)) * 100)}% (aim for under 15%)`);

if (process.argv.includes("--missing")) {
  // episodes the app knows about (from its database) that have no questions yet
  const { DatabaseSync } = await import("node:sqlite");
  const dataDir = process.env.APP_DATA_DIR ?? path.join(import.meta.dirname, "..", "data");
  const db = new DatabaseSync(path.join(dataDir, "app.db"), { readOnly: true });
  const have = new Set(files.map((f) => f.replace(/\.json$/, "")));
  const missing = db.prepare("SELECT id, title FROM episodes ORDER BY date DESC").all().filter((e) => !have.has(e.id));
  console.log(`${missing.length} episodes without questions`);
  for (const e of missing) console.log(`  ${e.id}  ${e.title}`);
}
process.exit(problems ? 1 : 0);
