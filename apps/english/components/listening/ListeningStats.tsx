"use client";

import { pct } from "@/lib/client";
import type { Dashboard } from "@/lib/db";

const GOAL = { days: 30, perDay: 2 };

function Meter({ value, target, label }: { value: number | null; target: number; label: string }) {
  const v = value ?? 0;
  const ok = value !== null && v >= target;
  return (
    <div>
      <div className="flex justify-between text-xs">
        <span className="text-muted">{label}</span>
        <span className={ok ? "font-medium text-ok" : ""}>
          {pct(value)} <span className="text-muted">/ {pct(target)}</span>
        </span>
      </div>
      <div className="relative mt-1 h-1.5 rounded bg-surface-2">
        <div className={`h-full rounded ${ok ? "bg-ok" : "bg-foreground/60"}`} style={{ width: `${Math.min(v, 1) * 100}%` }} />
        <div className="absolute top-[-3px] h-3 w-px bg-foreground" style={{ left: `${target * 100}%` }} />
      </div>
    </div>
  );
}

export function ListeningStats({ dash }: { dash: Dashboard }) {
  const goal = GOAL.days * GOAL.perDay;
  const { level } = dash;
  return (
    <section className="mt-6 grid gap-3 md:grid-cols-3">
      <div className="card p-4">
        <p className="text-xs uppercase tracking-wide text-muted">Today</p>
        <div className="mt-2 flex gap-4">
          <div>
            <p className="text-2xl font-semibold tabular-nums">{Math.min(dash.today.deep, 1)}/1</p>
            <p className="text-xs text-muted">deep episode</p>
          </div>
          <div>
            <p className="text-2xl font-semibold tabular-nums">{Math.min(dash.today.light, 1)}/1</p>
            <p className="text-xs text-muted">light episode</p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-2xl font-semibold tabular-nums">{dash.streak}</p>
            <p className="text-xs text-muted">day streak</p>
          </div>
        </div>
      </div>
      <div className="card p-4">
        <p className="text-xs uppercase tracking-wide text-muted">30-day plan</p>
        <p className="mt-2 text-2xl font-semibold tabular-nums">
          {dash.totalDone}<span className="text-base font-normal text-muted"> / {goal} episodes</span>
        </p>
        <div className="mt-2 h-1.5 rounded bg-surface-2">
          <div className="h-full rounded bg-accent" style={{ width: `${Math.min(dash.totalDone / goal, 1) * 100}%` }} />
        </div>
        <p className="mt-1 text-xs text-muted">{dash.deepDone} deep · {dash.totalDone - dash.deepDone} light</p>
      </div>
      <div className={`card p-4 ${level.ready ? "border-ok" : ""}`}>
        <p className="text-xs uppercase tracking-wide text-muted">
          Level-up check <span className="normal-case">(last {level.window}/{level.thresholds.episodes} episodes)</span>
        </p>
        <div className="mt-2 space-y-2">
          <Meter label="First-listen quiz" value={level.quizAvg} target={level.thresholds.quiz} />
          <Meter label="First-try dictation (1×)" value={level.dictationAvg} target={level.thresholds.dictation} />
        </div>
        <p className={`mt-2 text-xs ${level.ready ? "font-medium text-ok" : "text-muted"}`}>
          {level.ready
            ? "Ready for the next level: try Learning English from the News or The English We Speak."
            : level.window < level.thresholds.episodes
              ? `Finish ${level.thresholds.episodes - level.window} more episodes to get a reading.`
              : "Keep going. Both bars need to pass their marks."}
        </p>
      </div>
    </section>
  );
}
