// SM-2-style spacing for flashcards. Pure functions, so the schedule can be checked on its own.

export type Rating = 0 | 1 | 2 | 3; // Again, Hard, Good, Easy
export const RATING_LABEL = ["Again", "Hard", "Good", "Easy"] as const;

export type CardState = { interval: number; ease: number; reps: number; lapses: number; due: string; last_review: string | null };

const DAY_MS = 86400000;
const toTime = (d: string) => new Date(`${d}T00:00:00`).getTime();
export const addDays = (d: string, n: number) => {
  const t = new Date(toTime(d) + n * DAY_MS);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
};
export const daysBetween = (a: string, b: string) => Math.round((toTime(b) - toTime(a)) / DAY_MS);

const FIRST = [1, 2, 3, 4]; // days after the first review, by rating
const MIN_EASE = 1.3;
const MAX_INTERVAL = 365;

/** Next state after reviewing on `today`. Late reviews count the real gap, so a card remembered after a long wait jumps further. */
export function nextState(card: CardState, rating: Rating, today: string): CardState {
  let { interval, ease } = card;
  const reps = card.reps + 1;
  let lapses = card.lapses;
  // days past the due date; like Anki, only part of that delay counts (Hard ¼, Good ½, Easy all)
  const late = card.last_review ? Math.max(0, daysBetween(card.last_review, today) - interval) : 0;

  if (rating === 0) {
    interval = 1;
    ease = Math.max(MIN_EASE, ease - 0.2);
    lapses++;
  } else if (card.reps === 0 || interval === 0) {
    interval = FIRST[rating];
  } else if (rating === 1) {
    interval = Math.max(interval + 1, Math.round((interval + late / 4) * 1.2));
    ease = Math.max(MIN_EASE, ease - 0.15);
  } else if (rating === 2) {
    interval = Math.max(interval + 1, Math.round((interval + late / 2) * ease));
  } else {
    interval = Math.max(interval + 2, Math.round((interval + late) * ease * 1.3));
    ease += 0.15;
  }
  interval = Math.min(interval, MAX_INTERVAL);
  return { interval, ease: Math.round(ease * 100) / 100, reps, lapses, due: addDays(today, interval), last_review: today };
}

/** Rating suggested from the automatic checks and the self-ticks; the learner can override it. */
export function suggestRating(c: {
  wordUsed: boolean | null;
  patternUsed: boolean | null;
  grammarIssues: number | null;
  meaningWrong?: boolean;
  notFluent?: boolean;
  easy?: boolean;
}): Rating {
  if (c.wordUsed === false || c.meaningWrong) return 0;
  if (c.patternUsed === false || (c.grammarIssues ?? 0) > 0 || c.notFluent) return 1;
  return c.easy ? 3 : 2;
}
