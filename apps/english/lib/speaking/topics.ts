import fs from "node:fs";
import path from "node:path";

export type TopicType = "P2" | "P3" | "TQ";

export type Topic = { no: number; type: TopicType; text: string; block: number };

export type Block = { no: number; name: string; target: string; topics: Topic[] };

export type TopicBook = { blocks: Block[]; topics: Topic[]; fillers: string[]; file: string };

const DEFAULT_FILLERS = ["the thing is…", "what I mean is…", "something along those lines"];

export function topicsFile() {
  return process.env.TOPICS_FILE ?? path.join(process.cwd(), "..", "..", "120-speaking-topics.md");
}

/** Parse 120-speaking-topics.md. Read on every call so edits to the file show up immediately. */
export function loadTopics(): TopicBook {
  const file = topicsFile();
  const md = fs.readFileSync(/*turbopackIgnore: true*/ file, "utf-8");
  const blocks: Block[] = [];
  const clean = (s: string) => s.replace(/\*\*|\*/g, "").trim();

  for (const line of md.split(/\r?\n/)) {
    const b = line.match(/^##\s+Block\s+(\d+)\s*[—–-]\s*(.+)$/);
    if (b) {
      blocks.push({ no: Number(b[1]), name: clean(b[2]), target: "", topics: [] });
      continue;
    }
    const cur = blocks[blocks.length - 1];
    if (!cur) continue;
    if (/^##\s/.test(line)) {
      // a non-block section (e.g. "Error log") ends the block list
      blocks.push({ no: -1, name: "", target: "", topics: [] });
      continue;
    }
    const t = line.match(/^\*\*Language target:\*\*\s*(.+)$/i);
    if (t) {
      cur.target = clean(t[1]);
      continue;
    }
    const q = line.match(/^(\d+)\.\s*\((P2|P3|TQ)\)\s*(.+)$/);
    if (q && cur.no > 0) cur.topics.push({ no: Number(q[1]), type: q[2] as TopicType, text: q[3].trim(), block: cur.no });
  }

  const real = blocks.filter((b) => b.no > 0);
  const rule = md.match(/filler phrase\s*\(([^)]*)\)/i);
  const fillers = rule ? [...rule[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]) : [];
  return {
    blocks: real,
    topics: real.flatMap((b) => b.topics),
    fillers: fillers.length ? fillers : DEFAULT_FILLERS,
    file,
  };
}

export function findTopic(book: TopicBook, no: number) {
  return book.topics.find((t) => t.no === no) ?? null;
}
