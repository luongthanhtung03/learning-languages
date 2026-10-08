import { db, localDay } from "./db";
import { getSettings } from "./speaking/store";

export const SKILLS = ["listening", "speaking"] as const;
export type Skill = (typeof SKILLS)[number];

const MAX_BEAT = 90; // the client flushes every 30 s; anything bigger is a bug or a stale tab
const PACE_DAYS = 14;

export function addStudyTime(skill: Skill, seconds: number) {
  const s = Math.round(Math.min(MAX_BEAT, Math.max(0, seconds)));
  if (!s) return;
  db()
    .prepare(
      `INSERT INTO study_time (day, skill, seconds) VALUES (?, ?, ?)
       ON CONFLICT(day, skill) DO UPDATE SET seconds = seconds + excluded.seconds`,
    )
    .run(localDay(new Date()), skill, s);
}

type Split = Record<Skill, number>;
const zero = (): Split => ({ listening: 0, speaking: 0 });

export function getStudyTime() {
  const rows = db().prepare("SELECT day, skill, seconds FROM study_time").all() as { day: string; skill: Skill; seconds: number }[];
  const d = new Date();
  const today = localDay(d);
  const daysAgo = (n: number) => localDay(new Date(d.getFullYear(), d.getMonth(), d.getDate() - n));
  const weekStart = daysAgo((d.getDay() + 6) % 7); // Monday
  const paceStart = daysAgo(PACE_DAYS - 1);

  const total = zero(), week = zero(), todaySplit = zero(), pace = zero();
  const byDay = new Map<string, Split>();
  for (const r of rows) {
    if (!SKILLS.includes(r.skill)) continue;
    total[r.skill] += r.seconds;
    if (r.day >= weekStart) week[r.skill] += r.seconds;
    if (r.day === today) todaySplit[r.skill] += r.seconds;
    if (r.day >= paceStart) {
      pace[r.skill] += r.seconds / PACE_DAYS;
      const s = byDay.get(r.day) ?? zero();
      s[r.skill] += r.seconds;
      byDay.set(r.day, s);
    }
  }
  const days = Array.from({ length: PACE_DAYS }, (_, i) => {
    const day = daysAgo(PACE_DAYS - 1 - i);
    return { day, ...(byDay.get(day) ?? zero()) };
  });

  const s = getSettings();
  return {
    today: todaySplit,
    week,
    total,
    days,
    pace, // average seconds per day over the last 14 days
    goal: { listening: s.goal_listening_hours * 3600, speaking: s.goal_speaking_hours * 3600 },
  };
}

export type StudyTime = ReturnType<typeof getStudyTime>;
