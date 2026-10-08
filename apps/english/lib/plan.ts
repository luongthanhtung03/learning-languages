import { db, getEpisodeRows, localDay } from "./db";
import { DAY_LABEL, itemKey, type DayType, type PlanItem, type TodayPlan } from "./plan-types";
import { activeCardCount, sessionStatus } from "./flashcards/store";
import { completedTopicCounts, getSettings, recentRecordings, saveSettings } from "./speaking/store";
import { loadTopics, MONTHLY_TOPIC, type Topic, type TopicBook } from "./speaking/topics";

type Stored = TodayPlan & { exclude: { episodes: string[]; topics: number[]; recordings: number[] } };

const DAY_MS = 86400000;
const toDate = (s: string) => new Date(`${s}T00:00:00`);
const daysBetween = (a: string, b: string) => Math.round((toDate(b).getTime() - toDate(a).getTime()) / DAY_MS);
const shiftDate = (s: string, days: number) => localDay(new Date(toDate(s).getTime() + days * DAY_MS));

export const today = () => localDay(new Date());
export { DAY_LABEL };

// ---------- topic rotation ----------

function rotation(book: TopicBook) {
  const counts = completedTopicCounts();
  const count = (t: Topic) => counts.get(t.no) ?? 0;
  // "pass" = how many times the whole list has been completed; the current block is the first with an unfinished topic
  const pass = Math.min(...book.topics.map(count));
  const pending = book.topics.filter((t) => count(t) === pass); // in file order
  const current = book.blocks.find((b) => b.no === pending[0]?.block) ?? book.blocks[0];
  const prevNo = current.no === 1 ? book.blocks[book.blocks.length - 1].no : current.no - 1;
  const previous = book.blocks.find((b) => b.no === prevNo)!;
  const previousDone = previous.topics.filter((t) => count(t) > 0);
  return { pending, current, previousDone, counts };
}

/** Deterministic shuffle so the same day gives the same revisit picks. */
function seeded<T>(xs: T[], seed: number) {
  const a = [...xs];
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function monthlyDue(date: string) {
  // The monthly topic is re-recorded every 4 weeks, starting 28 days after it was first done
  const row = db()
    .prepare(
      `SELECT MAX(date) AS last FROM speaking_sessions WHERE topic_no = ? AND completed_at IS NOT NULL AND date < ?`,
    )
    .get(MONTHLY_TOPIC, date) as { last: string | null };
  return !!row.last && daysBetween(row.last, date) >= 28;
}

function transcribeCandidates(date: string, exclude: number[]) {
  return recentRecordings({ sinceDate: shiftDate(date, -7), limit: 100 })
    .filter((r) => r.status === "done" && !r.edited_text && !exclude.includes(r.id))
    .sort((a, b) => b.round - a.round); // prefer round 3, the one you listen back to
}

// ---------- building ----------

function speakingItem(t: Topic, sessionKind: "new" | "revisit" | "monthly"): PlanItem {
  return { kind: "speaking", sessionKind, topicNo: t.no, title: t.text, type: t.type, done: false };
}

function listeningCandidates(exclude: string[]) {
  const rows = getEpisodeRows().filter((e) => e.status !== "done" && !exclude.includes(e.id));
  return [...rows.filter((e) => e.status === "in-progress"), ...rows.filter((e) => e.status === "new")];
}

function build(date: string): Stored {
  const settings = getSettings();
  const start = settings.start_date ?? date;
  const cycleDay = (((daysBetween(start, date) % 7) + 7) % 7) + 1;
  const book = loadTopics();
  const rot = rotation(book);
  const items: PlanItem[] = [];

  // Listening: 1 deep episode
  const ep = listeningCandidates([])[0];
  if (ep) items.push({ kind: "listening", mode: "deep", episodeId: ep.id, title: ep.title, done: false });

  // Speaking: follow the weekly rhythm
  let dayType: DayType = "new";
  const tr = cycleDay === 6 ? transcribeCandidates(date, [])[0] : undefined;
  if (tr) {
    dayType = "transcribe";
    const t = book.topics.find((x) => x.no === tr.topic_no);
    items.push({ kind: "transcribe", recordingId: tr.id, topicNo: tr.topic_no, title: t?.text ?? `Topic ${tr.topic_no}`, done: false });
  } else if (cycleDay === 7 && rot.previousDone.length) {
    dayType = "revisit";
    for (const t of seeded(rot.previousDone, Number(date.replaceAll("-", ""))).slice(0, 2)) items.push(speakingItem(t, "revisit"));
  } else {
    for (const t of rot.pending.slice(0, 1)) items.push(speakingItem(t, "new"));
  }
  if (monthlyDue(date)) {
    const t = book.topics.find((x) => x.no === MONTHLY_TOPIC);
    if (t) items.push(speakingItem(t, "monthly"));
  }

  return {
    date,
    cycleDay,
    dayType,
    block: { no: rot.current.no, name: rot.current.name, target: rot.current.target },
    items,
    exclude: { episodes: [], topics: [], recordings: [] },
  };
}

// ---------- persistence + status ----------

function load(date: string): Stored | null {
  const row = db().prepare("SELECT json FROM daily_plan WHERE date = ?").get(date) as { json: string } | undefined;
  if (!row) return null;
  const plan = JSON.parse(row.json) as Stored;
  // plans saved before listening went deep-only may still hold a "light" episode
  plan.items = plan.items.filter((i) => !(i.kind === "listening" && (i.mode as string) === "light"));
  return plan;
}

function save(plan: Stored) {
  db().prepare("INSERT OR REPLACE INTO daily_plan (date, json) VALUES (?, ?)").run(plan.date, JSON.stringify(plan));
}

function withStatus(plan: Stored): TodayPlan {
  const d = db();
  const items = plan.items.map((i): PlanItem => {
    if (i.kind === "listening") {
      const r = d.prepare("SELECT status FROM episode_status WHERE episode_id = ?").get(i.episodeId) as { status: string } | undefined;
      return { ...i, done: r?.status === "done" };
    }
    if (i.kind === "speaking") {
      const r = d
        .prepare("SELECT 1 FROM speaking_sessions WHERE topic_no = ? AND kind = ? AND date = ? AND completed_at IS NOT NULL")
        .get(i.topicNo, i.sessionKind, plan.date);
      return { ...i, done: !!r };
    }
    if (i.kind === "review") return i; // never stored; added fresh by reviewItems()
    const r = d.prepare("SELECT edited_text FROM recordings WHERE id = ?").get(i.recordingId) as { edited_text: string | null } | undefined;
    return { ...i, done: !!r?.edited_text };
  });
  const { exclude: _exclude, ...rest } = plan;
  void _exclude;
  return { ...rest, items: [...reviewItems(plan.cycleDay, plan.date), ...items] };
}

/** Flashcard review comes first each day; the weekly review day (day 7) adds an uncapped catch-up session. */
function reviewItems(cycleDay: number, date: string): PlanItem[] {
  if (!activeCardCount()) return [];
  const sessions: (1 | 2)[] = cycleDay === 7 ? [1, 2] : [1];
  return sessions.map((session) => {
    const s = sessionStatus(session, date);
    const n = `${s.left} card${s.left === 1 ? "" : "s"}`;
    const title = s.complete ? "Cards reviewed" : session === 2 ? `Catch-up · ${n}` : n;
    return { kind: "review", session, title, left: s.left, done: s.complete };
  });
}

export function getPlan(date = today()): TodayPlan {
  if (!getSettings().start_date) saveSettings({ start_date: date });
  let plan = load(date);
  if (!plan) {
    plan = build(date);
    save(plan);
  }
  // a plan saved before the topics file changed can point at topics that no longer exist
  const known = new Set(loadTopics().topics.map((t) => t.no));
  if (plan.items.some((i) => i.kind === "speaking" && !known.has(i.topicNo))) {
    const fresh = build(date);
    plan.items = [...plan.items.filter((i) => i.kind !== "speaking"), ...fresh.items.filter((i) => i.kind === "speaking")];
    plan.block = fresh.block;
    save(plan);
  }
  return withStatus(plan);
}

/** Append another round after the plan: the next episode and the next new topic in rotation order. */
export function addRound(date: string): TodayPlan {
  getPlan(date);
  const plan = load(date)!;
  const book = loadTopics();

  const episodes = plan.items.flatMap((i) => (i.kind === "listening" ? [i.episodeId] : []));
  const ep = listeningCandidates([...plan.exclude.episodes, ...episodes])[0];
  if (ep) plan.items.push({ kind: "listening", mode: "deep", episodeId: ep.id, title: ep.title, done: false });

  const topics = new Set([...plan.exclude.topics, ...plan.items.flatMap((i) => (i.kind === "speaking" ? [i.topicNo] : []))]);
  const next = [...rotation(book).pending, ...book.topics].find((t) => !topics.has(t.no));
  if (next) plan.items.push(speakingItem(next, "new"));

  save(plan);
  return withStatus(plan);
}

/** Replace one not-yet-done item with the next candidate of the same kind. */
export function skipItem(date: string, key: string): TodayPlan {
  getPlan(date);
  const plan = load(date)!;
  const idx = plan.items.findIndex((i) => itemKey(i) === key && i.kind !== "review");
  if (idx < 0) return withStatus(plan);
  const item = plan.items[idx];
  const book = loadTopics();
  let replacement: PlanItem | null = null;

  if (item.kind === "listening") {
    plan.exclude.episodes.push(item.episodeId);
    const inPlan = plan.items.flatMap((i) => (i.kind === "listening" ? [i.episodeId] : []));
    const next = listeningCandidates([...plan.exclude.episodes, ...inPlan])[0];
    if (next) replacement = { ...item, episodeId: next.id, title: next.title, done: false };
  } else if (item.kind === "speaking") {
    plan.exclude.topics.push(item.topicNo);
    const inPlan = plan.items.flatMap((i) => (i.kind === "speaking" ? [i.topicNo] : []));
    const skip = new Set([...plan.exclude.topics, ...inPlan]);
    const rot = rotation(book);
    const pool =
      item.sessionKind === "revisit"
        ? seeded(rot.previousDone, Number(date.replaceAll("-", "")))
        : item.sessionKind === "new"
          ? [...rot.pending, ...book.topics]
          : [];
    const next = pool.find((t) => !skip.has(t.no));
    if (next) replacement = speakingItem(next, item.sessionKind);
  } else if (item.kind === "transcribe") {
    plan.exclude.recordings.push(item.recordingId);
    const next = transcribeCandidates(date, plan.exclude.recordings)[0];
    if (next) {
      const t = book.topics.find((x) => x.no === next.topic_no);
      replacement = { kind: "transcribe", recordingId: next.id, topicNo: next.topic_no, title: t?.text ?? "", done: false };
    }
  }

  if (replacement) plan.items[idx] = replacement;
  else plan.items.splice(idx, 1);
  save(plan);
  return withStatus(plan);
}
