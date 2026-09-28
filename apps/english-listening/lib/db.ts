import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import type { Alignment, EpisodeDetail, EpisodeStatus, EpisodeSummary, StudyMode } from "./types";

export const DATA_DIR = path.join(process.cwd(), "data");

const globalForDb = globalThis as unknown as { __db?: DatabaseSync };

export function db(): DatabaseSync {
  if (globalForDb.__db) return globalForDb.__db;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const d = new DatabaseSync(path.join(DATA_DIR, "app.db"));
  d.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS episodes (
      id TEXT PRIMARY KEY, path TEXT NOT NULL, title TEXT NOT NULL, date TEXT NOT NULL,
      description TEXT, image TEXT
    );
    CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
    CREATE TABLE IF NOT EXISTS episode_cache (id TEXT PRIMARY KEY, json TEXT NOT NULL, fetched_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS alignments (id TEXT PRIMARY KEY, json TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS episode_status (
      episode_id TEXT PRIMARY KEY, status TEXT NOT NULL, mode TEXT,
      first_listen_score REAL, started_at TEXT, completed_at TEXT
    );
    CREATE TABLE IF NOT EXISTS quiz_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT, episode_id TEXT NOT NULL,
      score INTEGER NOT NULL, total INTEGER NOT NULL, details TEXT, at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS dictation_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT, episode_id TEXT NOT NULL, sentence_idx INTEGER NOT NULL,
      accuracy REAL NOT NULL, text TEXT, speed REAL, first INTEGER NOT NULL, at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS dictation_ep ON dictation_attempts(episode_id, sentence_idx);
    CREATE INDEX IF NOT EXISTS quiz_ep ON quiz_attempts(episode_id);
  `);
  globalForDb.__db = d;
  return d;
}

const now = () => new Date().toISOString();
const localDay = (dt: Date) =>
  `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;

// ---------- episodes ----------

export function saveEpisodeList(list: EpisodeSummary[]) {
  const d = db();
  const stmt = d.prepare(
    `INSERT INTO episodes (id, path, title, date, description, image) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET path=excluded.path, title=excluded.title, date=excluded.date,
       description=excluded.description, image=excluded.image`,
  );
  d.exec("BEGIN");
  for (const e of list) stmt.run(e.id, e.path, e.title, e.date, e.description, e.image);
  d.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('list_fetched_at', ?)").run(now());
  d.exec("COMMIT");
}

export function listFetchedAt(): string | null {
  const row = db().prepare("SELECT value FROM meta WHERE key = 'list_fetched_at'").get() as { value: string } | undefined;
  return row?.value ?? null;
}

export type EpisodeRow = EpisodeSummary & {
  status: EpisodeStatus;
  mode: StudyMode | null;
  first_listen_score: number | null;
  completed_at: string | null;
};

export function getEpisodeRows(): EpisodeRow[] {
  return db()
    .prepare(
      `SELECT e.*, COALESCE(s.status, 'new') AS status, s.mode, s.first_listen_score, s.completed_at
       FROM episodes e LEFT JOIN episode_status s ON s.episode_id = e.id ORDER BY e.date DESC`,
    )
    .all() as unknown as EpisodeRow[];
}

export function getEpisodeSummary(id: string): EpisodeSummary | null {
  return (db().prepare("SELECT * FROM episodes WHERE id = ?").get(id) as unknown as EpisodeSummary) ?? null;
}

export function getCachedDetail(id: string): EpisodeDetail | null {
  const row = db().prepare("SELECT json FROM episode_cache WHERE id = ?").get(id) as { json: string } | undefined;
  return row ? (JSON.parse(row.json) as EpisodeDetail) : null;
}

export function saveDetail(detail: EpisodeDetail) {
  db()
    .prepare("INSERT OR REPLACE INTO episode_cache (id, json, fetched_at) VALUES (?, ?, ?)")
    .run(detail.id, JSON.stringify(detail), now());
}

// ---------- alignment ----------

export function getAlignment(id: string): Alignment | null {
  const row = db().prepare("SELECT json FROM alignments WHERE id = ?").get(id) as { json: string } | undefined;
  return row ? (JSON.parse(row.json) as Alignment) : null;
}

export function saveAlignment(id: string, a: Alignment) {
  db()
    .prepare("INSERT OR REPLACE INTO alignments (id, json, created_at) VALUES (?, ?, ?)")
    .run(id, JSON.stringify(a), now());
}

// ---------- progress ----------

export function getStatus(id: string) {
  return (
    (db().prepare("SELECT * FROM episode_status WHERE episode_id = ?").get(id) as
      | { status: EpisodeStatus; mode: StudyMode | null; first_listen_score: number | null; completed_at: string | null }
      | undefined) ?? null
  );
}

export function markStarted(id: string) {
  db()
    .prepare(
      `INSERT INTO episode_status (episode_id, status, started_at) VALUES (?, 'in-progress', ?)
       ON CONFLICT(episode_id) DO NOTHING`,
    )
    .run(id, now());
}

export function setStatus(id: string, status: EpisodeStatus, mode: StudyMode | null) {
  markStarted(id);
  db()
    .prepare("UPDATE episode_status SET status = ?, mode = COALESCE(?, mode), completed_at = ? WHERE episode_id = ?")
    .run(status, mode, status === "done" ? now() : null, id);
}

export function addQuizAttempt(id: string, score: number, total: number, details: unknown) {
  markStarted(id);
  const d = db();
  d.prepare("INSERT INTO quiz_attempts (episode_id, score, total, details, at) VALUES (?, ?, ?, ?, ?)").run(
    id, score, total, JSON.stringify(details), now(),
  );
  // the very first quiz attempt is the "first listen" score
  d.prepare(
    "UPDATE episode_status SET first_listen_score = ? WHERE episode_id = ? AND first_listen_score IS NULL",
  ).run(total ? score / total : 0, id);
}

export function addDictationAttempt(id: string, sentenceIdx: number, accuracy: number, text: string, speed: number) {
  markStarted(id);
  const d = db();
  const prev = d
    .prepare("SELECT COUNT(*) AS n FROM dictation_attempts WHERE episode_id = ? AND sentence_idx = ?")
    .get(id, sentenceIdx) as { n: number };
  d.prepare(
    "INSERT INTO dictation_attempts (episode_id, sentence_idx, accuracy, text, speed, first, at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).run(id, sentenceIdx, accuracy, text, speed, prev.n === 0 ? 1 : 0, now());
}

export function getEpisodeProgress(id: string) {
  const d = db();
  const dictation = d
    .prepare(
      `SELECT sentence_idx, MAX(accuracy) AS best,
         (SELECT accuracy FROM dictation_attempts f WHERE f.episode_id = a.episode_id AND f.sentence_idx = a.sentence_idx AND f.first = 1) AS first,
         COUNT(*) AS attempts
       FROM dictation_attempts a WHERE episode_id = ? GROUP BY sentence_idx`,
    )
    .all(id) as { sentence_idx: number; best: number; first: number | null; attempts: number }[];
  const quizzes = d
    .prepare("SELECT score, total, at FROM quiz_attempts WHERE episode_id = ? ORDER BY at")
    .all(id) as { score: number; total: number; at: string }[];
  return { status: getStatus(id), dictation, quizzes };
}

// ---------- dashboard ----------

const LEVEL_WINDOW = 10;
export const LEVEL_UP = { quiz: 0.8, dictation: 0.9, episodes: LEVEL_WINDOW };

export function getDashboard() {
  const d = db();
  const done = d
    .prepare(
      `SELECT s.episode_id, s.mode, s.first_listen_score, s.completed_at,
         (SELECT AVG(accuracy) FROM dictation_attempts a
            WHERE a.episode_id = s.episode_id AND a.first = 1 AND a.sentence_idx >= 0 AND COALESCE(a.speed, 1) >= 1) AS dictation_first
       FROM episode_status s WHERE s.status = 'done' ORDER BY s.completed_at DESC`,
    )
    .all() as {
    episode_id: string; mode: StudyMode | null; first_listen_score: number | null;
    completed_at: string; dictation_first: number | null;
  }[];

  // Activity days (in the PC's local timezone): any attempt or completion counts towards the streak
  const days = new Set(
    (
      d
        .prepare(
          `SELECT at FROM quiz_attempts UNION ALL SELECT at FROM dictation_attempts
           UNION ALL SELECT completed_at FROM episode_status WHERE completed_at IS NOT NULL`,
        )
        .all() as { at: string }[]
    ).map((r) => localDay(new Date(r.at))),
  );
  let streak = 0;
  const cursor = new Date();
  if (!days.has(localDay(cursor))) cursor.setDate(cursor.getDate() - 1); // today not started yet
  while (days.has(localDay(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  const today = localDay(new Date());
  const doneToday = done.filter((r) => r.completed_at && localDay(new Date(r.completed_at)) === today);

  const recent = done.slice(0, LEVEL_WINDOW);
  const avg = (xs: (number | null)[]) => {
    const v = xs.filter((x): x is number => x !== null);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };
  const quizAvg = avg(recent.map((r) => r.first_listen_score));
  const dictationAvg = avg(recent.map((r) => r.dictation_first));
  const ready =
    recent.length >= LEVEL_WINDOW &&
    quizAvg !== null && quizAvg >= LEVEL_UP.quiz &&
    dictationAvg !== null && dictationAvg >= LEVEL_UP.dictation;

  return {
    totalDone: done.length,
    deepDone: done.filter((r) => r.mode === "deep").length,
    today: { deep: doneToday.filter((r) => r.mode === "deep").length, light: doneToday.filter((r) => r.mode !== "deep").length },
    streak,
    level: { window: recent.length, quizAvg, dictationAvg, ready, thresholds: LEVEL_UP },
  };
}

export type Dashboard = ReturnType<typeof getDashboard>;
