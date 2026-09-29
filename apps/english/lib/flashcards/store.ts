import { db, localDay, now } from "../db";
import { completedTopicCounts, getSettings, secondaryTarget } from "../speaking/store";
import { loadTopics } from "../speaking/topics";
import type { Checks } from "./evaluate";
import { PATTERNS, TAG_PATTERN, type Pattern } from "./patterns";
import { addDays, nextState, type Rating } from "./schedule";

export type Card = {
  id: number;
  kind: "word" | "phrase";
  term: string;
  definition: string | null;
  example: string | null;
  source: "episode" | "topic";
  source_id: string;
  source_title: string | null;
  created_at: string;
  due: string;
  interval: number;
  ease: number;
  reps: number;
  lapses: number;
  last_review: string | null;
  suspended: number;
};

export type Review = {
  id: number;
  card_id: number;
  date: string;
  pattern_id: string;
  audio_file: string | null;
  status: "pending" | "done" | "error";
  error: string | null;
  transcript: string | null;
  edited: number;
  checks: Checks | null;
  self: { meaningWrong?: boolean; notFluent?: boolean; easy?: boolean } | null;
  rating: Rating | null;
  at: string;
};

const today = () => localDay(new Date());

// ---------- cards ----------

export function addCards(cards: Pick<Card, "kind" | "term" | "definition" | "example" | "source" | "source_id" | "source_title">[]) {
  const stmt = db().prepare(
    `INSERT INTO cards (kind, term, definition, example, source, source_id, source_title, created_at, due)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(source, source_id, term) DO UPDATE SET suspended = 0`,
  );
  const due = addDays(today(), 1); // you just met the word today; first review is tomorrow
  for (const c of cards) stmt.run(c.kind, c.term, c.definition, c.example, c.source, c.source_id, c.source_title, now(), due);
}

export function listCards(): Card[] {
  return db().prepare("SELECT * FROM cards ORDER BY created_at DESC").all() as Card[];
}

export function getCard(id: number): Card | null {
  return (db().prepare("SELECT * FROM cards WHERE id = ?").get(id) as Card | undefined) ?? null;
}

export function setSuspended(id: number, suspended: boolean) {
  db().prepare("UPDATE cards SET suspended = ? WHERE id = ?").run(suspended ? 1 : 0, id);
}

export function cardsFor(source: Card["source"], sourceId: string): string[] {
  return (db().prepare("SELECT term FROM cards WHERE source = ? AND source_id = ? AND suspended = 0").all(source, sourceId) as { term: string }[]).map(
    (r) => r.term,
  );
}

export function activeCardCount() {
  return (db().prepare("SELECT COUNT(*) AS n FROM cards WHERE suspended = 0").get() as { n: number }).n;
}

function dueNow(date: string): Card[] {
  // most overdue first, then the hardest
  return db().prepare("SELECT * FROM cards WHERE suspended = 0 AND due <= ? ORDER BY due, ease").all(date) as Card[];
}

function ratedToday(date: string) {
  return (db().prepare("SELECT COUNT(*) AS n FROM card_reviews WHERE date = ? AND rating IS NOT NULL").get(date) as { n: number }).n;
}

/**
 * One capped session a day. On the weekly review day (cycle day 7) there's a second, uncapped
 * session to catch up on whatever the cap pushed back.
 */
export function sessionStatus(session: 1 | 2, date = today()) {
  const cap = getSettings().review_cap;
  const done = ratedToday(date);
  const due = dueNow(date).length;
  const first = Math.max(0, Math.min(due, cap - done)); // what's left of the capped daily session
  const left = session === 1 ? first : due - first; // the catch-up takes everything after it
  return { cap, reviewedToday: done, dueNow: due, left, first, complete: left === 0 };
}

export function sessionCards(session: 1 | 2, date = today()) {
  const { left, first } = sessionStatus(session, date);
  const start = session === 1 ? 0 : first;
  const cards = dueNow(date).slice(start, start + left);
  const patterns = pickPatterns(cards.length);
  return cards.map((c, i) => ({ card: c, pattern: patterns[i] }));
}

// ---------- patterns ----------

function currentBlock() {
  const book = loadTopics();
  const counts = completedTopicCounts();
  const pass = Math.min(...book.topics.map((t) => counts.get(t.no) ?? 0));
  return book.topics.find((t) => (counts.get(t.no) ?? 0) === pass)?.block ?? 1;
}

type PatternStat = { id: string; uses: number; recent: boolean[]; last: string | null };

export function patternStats(): Map<string, PatternStat> {
  const rows = db()
    .prepare("SELECT pattern_id, date, checks, rating FROM card_reviews WHERE rating IS NOT NULL ORDER BY at DESC")
    .all() as { pattern_id: string; date: string; checks: string | null; rating: number }[];
  const stats = new Map<string, PatternStat>();
  for (const r of rows) {
    const s = stats.get(r.pattern_id) ?? { id: r.pattern_id, uses: 0, recent: [], last: r.date };
    s.uses++;
    if (s.recent.length < 5) s.recent.push(patternOk(r.checks ? (JSON.parse(r.checks) as Checks) : null, r.rating));
    stats.set(r.pattern_id, s);
  }
  return stats;
}

/** A pattern "worked" if it was detected (or couldn't be, and you rated Good+) with no grammar issues. */
function patternOk(c: Checks | null, rating: number) {
  if (!c) return rating >= 2;
  const used = c.patternUsed ?? rating >= 2;
  return used && !(c.grammarIssues?.length ?? 0);
}

/** Weighted random: weak, unused and current-block patterns come up more often. Only blocks you've reached. */
export function pickPatterns(n: number): Pattern[] {
  const block = currentBlock();
  const pool = PATTERNS.filter((p) => p.block <= block);
  const stats = patternStats();
  const secondary = secondaryTarget();
  const boosted = secondary ? TAG_PATTERN[secondary.tag] : undefined;
  const date = today();
  const weight = (p: Pattern) => {
    const s = stats.get(p.id);
    const failRate = s?.recent.length ? s.recent.filter((ok) => !ok).length / s.recent.length : 0;
    const stale = !s?.last || date > addDays(s.last, 7);
    let w = 1 + 2 * failRate + (stale ? 1 : 0);
    if (p.block === block) w *= 2;
    if (p.id === boosted) w *= 2;
    return w;
  };
  const out: Pattern[] = [];
  for (let i = 0; i < n; i++) {
    // avoid the same pattern twice in a row
    const choices = pool.length > 1 ? pool.filter((p) => p.id !== out[out.length - 1]?.id) : pool;
    const ws = choices.map(weight);
    let r = Math.random() * ws.reduce((a, b) => a + b, 0);
    out.push(choices.find((_, j) => (r -= ws[j]) <= 0) ?? choices[choices.length - 1]);
  }
  return out;
}

// ---------- reviews ----------

const parseReview = (r: Record<string, unknown> | undefined): Review | null =>
  r ? ({ ...r, checks: r.checks ? JSON.parse(r.checks as string) : null, self: r.self ? JSON.parse(r.self as string) : null } as Review) : null;

export function createReview(cardId: number, patternId: string, audioFile: string) {
  const res = db()
    .prepare("INSERT INTO card_reviews (card_id, date, pattern_id, audio_file, status, at) VALUES (?, ?, ?, ?, 'pending', ?)")
    .run(cardId, today(), patternId, audioFile, now());
  return getReview(Number(res.lastInsertRowid))!;
}

export function getReview(id: number): Review | null {
  return parseReview(db().prepare("SELECT * FROM card_reviews WHERE id = ?").get(id) as Record<string, unknown> | undefined);
}

export function saveReviewResult(id: number, patch: { transcript?: string; edited?: boolean; checks?: Checks; status?: Review["status"]; error?: string }) {
  const r = getReview(id);
  if (!r) return null;
  db()
    .prepare("UPDATE card_reviews SET transcript = ?, edited = ?, checks = ?, status = ?, error = ? WHERE id = ?")
    .run(
      patch.transcript ?? r.transcript,
      patch.edited === undefined ? r.edited : patch.edited ? 1 : 0,
      patch.checks ? JSON.stringify(patch.checks) : r.checks ? JSON.stringify(r.checks) : null,
      patch.status ?? r.status,
      patch.error ?? r.error,
      id,
    );
  return getReview(id);
}

/** Save the final rating and move the card to its next due date. Rating twice only counts once. */
export function rateReview(id: number, rating: Rating, self: Review["self"]) {
  const r = getReview(id);
  if (!r) return null;
  const card = getCard(r.card_id)!;
  if (r.rating === null) {
    const next = nextState(card, rating, today());
    db()
      .prepare("UPDATE cards SET interval = ?, ease = ?, reps = ?, lapses = ?, due = ?, last_review = ? WHERE id = ?")
      .run(next.interval, next.ease, next.reps, next.lapses, next.due, next.last_review, card.id);
  }
  db().prepare("UPDATE card_reviews SET rating = ?, self = ? WHERE id = ?").run(rating, JSON.stringify(self ?? {}), id);
  return { review: getReview(id)!, card: getCard(card.id)! };
}

export function deckOverview() {
  const cards = listCards();
  const date = today();
  const stats = patternStats();
  const patterns = PATTERNS.map((p) => {
    const s = stats.get(p.id);
    return { id: p.id, label: p.label, uses: s?.uses ?? 0, ok: s ? s.recent.filter(Boolean).length : 0, recent: s?.recent.length ?? 0 };
  })
    .filter((p) => p.recent > 0)
    .sort((a, b) => a.ok / a.recent - b.ok / b.recent);
  return {
    cards,
    total: cards.filter((c) => !c.suspended).length,
    dueToday: cards.filter((c) => !c.suspended && c.due <= date).length,
    status: sessionStatus(1, date),
    patterns,
  };
}
