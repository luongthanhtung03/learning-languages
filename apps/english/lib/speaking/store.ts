import { db, now } from "../db";
import type { SpeechStats, Word } from "./stats";
import type { TopicType } from "./topics";
import { ERROR_TAGS, type ErrorTag } from "./tags";

export { ERROR_TAGS, type ErrorTag };

// ---------- settings ----------

export type Settings = {
  start_date: string | null; // first practice day (YYYY-MM-DD), anchors the 7-day rhythm
  prep_seconds: number;
  research_minutes: number;
};

const DEFAULTS: Settings = { start_date: null, prep_seconds: 30, research_minutes: 5 };

export function getSettings(): Settings {
  const rows = db().prepare("SELECT key, value FROM settings").all() as { key: string; value: string }[];
  const s: Record<string, unknown> = { ...DEFAULTS };
  for (const r of rows) if (r.key in DEFAULTS) s[r.key] = r.key === "start_date" ? r.value : Number(r.value);
  return s as Settings;
}

export function saveSettings(patch: Partial<Settings>) {
  const stmt = db().prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)");
  for (const [k, v] of Object.entries(patch)) {
    if (!(k in DEFAULTS) || v === undefined || v === null) continue;
    stmt.run(k, String(v));
  }
  return getSettings();
}

export type SessionKind = "new" | "revisit" | "monthly";

/** Round lengths from 120-speaking-topics.md: runs 1–2 at 90s (P2) / 60s, run 3 compressed to 60s / 45s. */
export function roundPlan(type: TopicType, kind: SessionKind): { round: number; seconds: number; label: string }[] {
  const long = type === "P2";
  if (kind === "revisit") return [{ round: 1, seconds: 60, label: "Revisit" }];
  if (kind === "monthly") return [{ round: 1, seconds: long ? 90 : 60, label: "Monthly check" }];
  return [
    { round: 1, seconds: long ? 90 : 60, label: "Round 1 · Cold" },
    { round: 2, seconds: long ? 90 : 60, label: "Round 2 · Target" },
    { round: 3, seconds: long ? 60 : 45, label: "Round 3 · Compress" },
  ];
}

// ---------- sessions ----------

export type SessionNotes = { phrases?: string; targetSentence?: string; idea?: string; targetUsed?: boolean };

export type SessionRow = {
  id: number;
  topic_no: number;
  kind: SessionKind;
  date: string;
  notes: SessionNotes;
  started_at: string;
  completed_at: string | null;
};

type RawSession = Omit<SessionRow, "notes"> & { notes: string | null };
const parseSession = (r: RawSession): SessionRow => ({ ...r, notes: r.notes ? JSON.parse(r.notes) : {} });

export function getSession(id: number): SessionRow | null {
  const r = db().prepare("SELECT * FROM speaking_sessions WHERE id = ?").get(id) as RawSession | undefined;
  return r ? parseSession(r) : null;
}

/** Resume today's session for this topic and kind, or start a new one. */
export function findOrCreateSession(topicNo: number, kind: SessionKind, date: string): SessionRow {
  const d = db();
  const existing = d
    .prepare("SELECT * FROM speaking_sessions WHERE topic_no = ? AND kind = ? AND date = ? ORDER BY id DESC LIMIT 1")
    .get(topicNo, kind, date) as RawSession | undefined;
  if (existing) return parseSession(existing);
  const r = d
    .prepare("INSERT INTO speaking_sessions (topic_no, kind, date, notes, started_at) VALUES (?, ?, ?, '{}', ?)")
    .run(topicNo, kind, date, now());
  return getSession(Number(r.lastInsertRowid))!;
}

export function updateSession(id: number, patch: { notes?: SessionNotes; completed?: boolean }) {
  const d = db();
  if (patch.notes) {
    const cur = getSession(id);
    d.prepare("UPDATE speaking_sessions SET notes = ? WHERE id = ?").run(JSON.stringify({ ...cur?.notes, ...patch.notes }), id);
  }
  if (patch.completed !== undefined)
    d.prepare("UPDATE speaking_sessions SET completed_at = ? WHERE id = ?").run(patch.completed ? now() : null, id);
  return getSession(id);
}

export function listSessions(limit = 50) {
  return (db().prepare("SELECT * FROM speaking_sessions ORDER BY started_at DESC LIMIT ?").all(limit) as RawSession[]).map(parseSession);
}

/** topic_no -> number of completed "new" sessions */
export function completedTopicCounts(): Map<number, number> {
  const rows = db()
    .prepare("SELECT topic_no, COUNT(*) AS n FROM speaking_sessions WHERE kind = 'new' AND completed_at IS NOT NULL GROUP BY topic_no")
    .all() as { topic_no: number; n: number }[];
  return new Map(rows.map((r) => [r.topic_no, r.n]));
}

// ---------- recordings ----------

export type RecordingRow = {
  id: number;
  session_id: number;
  round: number;
  duration: number | null;
  file: string;
  status: "pending" | "done" | "error";
  error: string | null;
  words: Word[] | null;
  text: string | null;
  edited_text: string | null;
  stats: SpeechStats | null;
  created_at: string;
};

type RawRecording = Omit<RecordingRow, "words" | "stats"> & { words: string | null; stats: string | null };
const parseRecording = (r: RawRecording): RecordingRow => ({
  ...r,
  words: r.words ? JSON.parse(r.words) : null,
  stats: r.stats ? JSON.parse(r.stats) : null,
});

export function createRecording(sessionId: number, round: number, duration: number, file: string) {
  const d = db();
  // one recording per round: a re-upload (e.g. after a reload) replaces the earlier one
  d.prepare("DELETE FROM recordings WHERE session_id = ? AND round = ?").run(sessionId, round);
  const r = d
    .prepare("INSERT INTO recordings (session_id, round, duration, file, status, created_at) VALUES (?, ?, ?, ?, 'pending', ?)")
    .run(sessionId, round, duration, file, now());
  return getRecording(Number(r.lastInsertRowid))!;
}

export function getRecording(id: number): RecordingRow | null {
  const r = db().prepare("SELECT * FROM recordings WHERE id = ?").get(id) as RawRecording | undefined;
  return r ? parseRecording(r) : null;
}

export function sessionRecordings(sessionId: number): RecordingRow[] {
  return (db().prepare("SELECT * FROM recordings WHERE session_id = ? ORDER BY round").all(sessionId) as RawRecording[]).map(parseRecording);
}

export function saveTranscript(id: number, words: Word[], text: string, stats: SpeechStats) {
  db()
    .prepare("UPDATE recordings SET status = 'done', error = NULL, words = ?, text = ?, stats = ? WHERE id = ?")
    .run(JSON.stringify(words), text, JSON.stringify(stats), id);
}

export function failRecording(id: number, error: string) {
  db().prepare("UPDATE recordings SET status = 'error', error = ? WHERE id = ?").run(error, id);
}

export function saveEditedText(id: number, text: string) {
  db().prepare("UPDATE recordings SET edited_text = ? WHERE id = ?").run(text, id);
}

/** Recordings with their session info, newest first. */
export function recentRecordings(opts: { round?: number; sinceDate?: string; limit?: number } = {}) {
  const rows = db()
    .prepare(
      `SELECT r.*, s.topic_no, s.kind, s.date FROM recordings r JOIN speaking_sessions s ON s.id = r.session_id
       WHERE (? IS NULL OR r.round = ?) AND (? IS NULL OR s.date >= ?)
       ORDER BY r.created_at DESC LIMIT ?`,
    )
    .all(opts.round ?? null, opts.round ?? null, opts.sinceDate ?? null, opts.sinceDate ?? null, opts.limit ?? 50) as (RawRecording & {
    topic_no: number;
    kind: SessionKind;
    date: string;
  })[];
  return rows.map((r) => ({ ...parseRecording(r), topic_no: r.topic_no, kind: r.kind, date: r.date }));
}

// ---------- error log ----------



export type SpeakingError = {
  id: number;
  recording_id: number;
  word_start: number;
  word_end: number;
  tag: ErrorTag;
  wrong: string | null;
  correct: string | null;
  created_at: string;
};

export function addError(e: Omit<SpeakingError, "id" | "created_at">) {
  const r = db()
    .prepare(
      "INSERT INTO speaking_errors (recording_id, word_start, word_end, tag, wrong, correct, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .run(e.recording_id, e.word_start, e.word_end, e.tag, e.wrong, e.correct, now());
  return Number(r.lastInsertRowid);
}

export function deleteError(id: number) {
  db().prepare("DELETE FROM speaking_errors WHERE id = ?").run(id);
}

export function recordingErrors(recordingId: number): SpeakingError[] {
  return db().prepare("SELECT * FROM speaking_errors WHERE recording_id = ? ORDER BY word_start").all(recordingId) as SpeakingError[];
}

export function allErrors() {
  return db()
    .prepare(
      `SELECT e.*, s.topic_no, s.date, r.round FROM speaking_errors e
       JOIN recordings r ON r.id = e.recording_id JOIN speaking_sessions s ON s.id = r.session_id
       ORDER BY e.created_at DESC`,
    )
    .all() as (SpeakingError & { topic_no: number; date: string; round: number })[];
}

/** A pattern that shows up 3+ times in the last 14 days becomes the secondary target (as the topics file says). */
export function secondaryTarget(): { tag: ErrorTag; label: string; target: string; count: number } | null {
  const since = new Date(Date.now() - 14 * 86400000).toISOString();
  const row = db()
    .prepare(
      `SELECT tag, COUNT(*) AS n FROM speaking_errors WHERE created_at >= ? AND tag != 'other'
       GROUP BY tag HAVING n >= 3 ORDER BY n DESC LIMIT 1`,
    )
    .get(since) as { tag: ErrorTag; n: number } | undefined;
  if (!row) return null;
  const t = ERROR_TAGS.find((x) => x.id === row.tag)!;
  return { tag: row.tag, label: t.label, target: t.target, count: row.n };
}
