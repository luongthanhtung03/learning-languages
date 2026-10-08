import { db } from "../db";
import type { SpeechStats } from "./stats";
import { completedTopicCounts, listSessions, sessionRecordings } from "./store";
import { loadTopics, MONTHLY_TOPIC } from "./topics";

export function speakingOverview() {
  const book = loadTopics();
  const counts = completedTopicCounts();
  const pass = Math.min(...book.topics.map((t) => counts.get(t.no) ?? 0));
  const currentBlock = book.topics.find((t) => (counts.get(t.no) ?? 0) === pass)?.block ?? 1;
  const byNo = new Map(book.topics.map((t) => [t.no, t]));

  const sessions = listSessions(30).map((s) => {
    const recs = sessionRecordings(s.id);
    const first = recs.find((r) => r.round === 1)?.stats ?? null;
    const last = recs.length ? recs[recs.length - 1].stats : null;
    return { ...s, topic: byNo.get(s.topic_no) ?? null, rounds: recs.length, first, last };
  });

  return {
    file: book.file,
    currentBlock,
    blocks: book.blocks.map((b) => ({
      ...b,
      topics: b.topics.map((t) => ({ ...t, done: counts.get(t.no) ?? 0 })),
    })),
    sessions,
    trend: speakingTrend(),
  };
}

/** Average round-3 fluency over the last 7 completed topics. */
export function speakingTrend() {
  const rows = db()
    .prepare(
      `SELECT r.stats FROM recordings r JOIN speaking_sessions s ON s.id = r.session_id
       WHERE s.kind = 'new' AND r.round = 3 AND r.stats IS NOT NULL ORDER BY r.created_at DESC LIMIT 7`,
    )
    .all() as { stats: string }[];
  const stats = rows.map((r) => JSON.parse(r.stats) as SpeechStats);
  if (!stats.length) return null;
  const avg = (f: (s: SpeechStats) => number) => stats.reduce((a, s) => a + f(s), 0) / stats.length;
  return {
    n: stats.length,
    wpm: Math.round(avg((s) => s.wpm)),
    pausesPerMin: Math.round(avg((s) => (s.speakingTime ? (s.pauses / s.speakingTime) * 60 : 0)) * 10) / 10,
    fillersPerMin: Math.round(avg((s) => (s.speakingTime ? (s.fillers / s.speakingTime) * 60 : 0)) * 10) / 10,
  };
}

/** Monthly self-check: the monthly topic, first (cold) round each time, compared over time. */
export function monthlySeries() {
  const rows = db()
    .prepare(
      `SELECT s.date, s.kind, r.stats FROM speaking_sessions s JOIN recordings r ON r.session_id = s.id
       WHERE s.topic_no = ? AND r.round = 1 AND r.stats IS NOT NULL ORDER BY s.date`,
    )
    .all(MONTHLY_TOPIC) as { date: string; kind: string; stats: string }[];
  return rows.map((r) => ({ date: r.date, kind: r.kind, ...(JSON.parse(r.stats) as SpeechStats) }));
}
