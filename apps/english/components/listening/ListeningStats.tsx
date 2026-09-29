"use client";

import { pct } from "@/lib/client";
import type { Dashboard } from "@/lib/db";

const GOAL = 30; // one deep episode a day for 30 days

function Meter({ value, target, label }: { value: number | null; target: number; label: string }) {
  const v = value ?? 0;
  const ok = value !== null && v >= target;
  return (
    <div>
      <div className="flex justify-between text-xs">
        <span className="text-muted">{label}</span>
        <span className={`tabular-nums ${ok ? "text-accent" : "text-muted"}`}>{pct(value)} / {pct(target)}</span>
      </div>
      <div className="relative mt-2 h-[3px] rounded-full bg-surface-2">
        <div className={`h-full rounded-full transition-[width] duration-700 ${ok ? "bg-accent" : "bg-foreground/50"}`} style={{ width: `${Math.min(v, 1) * 100}%` }} />
        <div className="absolute -top-1 h-[11px] w-px bg-foreground/40" style={{ left: `${target * 100}%` }} />
      </div>
    </div>
  );
}

export function ListeningStats({ dash }: { dash: Dashboard }) {
  const { level } = dash;
  return (
    <section className="space-y-8">
      <div className="flex gap-10">
        <Stat value={`${Math.min(dash.doneToday, 1)}/1`} label="today" />
        <Stat value={dash.streak} label="day streak" />
        <Stat value={`${dash.totalDone}/${GOAL}`} label="episodes" />
      </div>
      <div className="grid max-w-md gap-4">
        <Meter label="First-listen quiz" value={level.quizAvg} target={level.thresholds.quiz} />
        <Meter label="First-try dictation" value={level.dictationAvg} target={level.thresholds.dictation} />
        <p className={`text-xs ${level.ready ? "text-accent" : "text-muted"}`}>
          {level.ready
            ? "Ready to level up: try Learning English from the News or The English We Speak."
            : level.window < level.thresholds.episodes
              ? `Level-up check after ${level.thresholds.episodes - level.window} more episodes.`
              : `Level-up check over your last ${level.window} episodes.`}
        </p>
      </div>
    </section>
  );
}

function Stat({ value, label }: { value: React.ReactNode; label: string }) {
  return (
    <div>
      <p className="text-3xl font-light tabular-nums">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}
