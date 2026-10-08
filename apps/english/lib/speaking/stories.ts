import { db, now } from "../db";

/** A STAR story from your own experience. A handful of good ones covers most behavioural questions. */
export type Story = {
  id: number;
  title: string;
  situation: string | null;
  task: string | null;
  action: string | null;
  result: string | null;
  lesson: string | null;
  created_at: string;
  updated_at: string;
};

export type StoryInput = Partial<Pick<Story, "title" | "situation" | "task" | "action" | "result" | "lesson">>;

const FIELDS = ["title", "situation", "task", "action", "result", "lesson"] as const;
const clean = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

export function listStories(): (Story & { uses: number })[] {
  return db()
    .prepare(
      `SELECT s.*, (SELECT COUNT(*) FROM speaking_sessions x WHERE json_extract(x.notes, '$.story') = s.id) AS uses
       FROM stories s ORDER BY s.updated_at DESC`,
    )
    .all() as (Story & { uses: number })[];
}

export function getStory(id: number) {
  return (db().prepare("SELECT * FROM stories WHERE id = ?").get(id) as Story | undefined) ?? null;
}

export function saveStory(input: StoryInput, id?: number): Story | null {
  const d = db();
  if (id === undefined) {
    const title = clean(input.title);
    if (!title) return null;
    const r = d
      .prepare("INSERT INTO stories (title, situation, task, action, result, lesson, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .run(title, clean(input.situation), clean(input.task), clean(input.action), clean(input.result), clean(input.lesson), now(), now());
    return getStory(Number(r.lastInsertRowid));
  }
  const cur = getStory(id);
  if (!cur) return null;
  const next = { ...cur };
  for (const f of FIELDS) if (f in input) next[f] = clean(input[f]) as never;
  if (!next.title) return null;
  d.prepare("UPDATE stories SET title = ?, situation = ?, task = ?, action = ?, result = ?, lesson = ?, updated_at = ? WHERE id = ?").run(
    next.title, next.situation, next.task, next.action, next.result, next.lesson, now(), id,
  );
  return getStory(id);
}

export function deleteStory(id: number) {
  db().prepare("DELETE FROM stories WHERE id = ?").run(id);
}
