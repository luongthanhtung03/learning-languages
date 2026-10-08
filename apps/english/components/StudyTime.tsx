"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import type { Settings } from "@/lib/speaking/store";
import type { StudyTime as Data } from "@/lib/study-time";

/** "1 h 05 m", "42 m", "0 m" */
export function fmtDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m} m`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")} m`;
}

const hours = (s: number) => (s / 3600).toFixed(s < 36000 ? 1 : 0);

function eta(leftSeconds: number, perDay: number) {
  if (leftSeconds <= 0) return "reached";
  if (perDay < 60) return "practise a few days to see an ETA";
  const days = Math.ceil(leftSeconds / perDay);
  const when = new Date(Date.now() + days * 86400000).toLocaleDateString(undefined, { month: "short", year: "numeric" });
  const span = days < 60 ? `${days} days` : `${Math.round(days / 30.4)} months`;
  return `~${span} at ${Math.round(perDay / 60)} min/day · ${when}`;
}

/** C1-progress ring with the percentage in the middle */
function Ring({ value, size = 64 }: { value: number; size?: number }) {
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={3} className="stroke-surface-2" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - value)}
          className="stroke-accent transition-[stroke-dashoffset] duration-1000"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-xs tabular-nums">{Math.floor(value * 100)}%</span>
    </div>
  );
}

/** Compact card for the Today page: today's time and its split, week, and C1 progress */
export function TimeSummary({ data }: { data: Data }) {
  const today = data.today.listening + data.today.speaking;
  const done = data.total.listening + data.total.speaking;
  const goal = data.goal.listening + data.goal.speaking;
  const pct = (s: number) => `${today ? (s / today) * 100 : 0}%`;

  return (
    <Link href="/time" className="card group mt-6 flex items-center gap-6 p-5 transition hover:bg-surface-2">
      <Ring value={goal ? Math.min(done / goal, 1) : 0} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-4">
          <p>
            <span className="text-2xl font-light tabular-nums">{fmtDuration(today)}</span>
            <span className="ml-2 text-xs text-muted">today</span>
          </p>
          <p className="text-xs tabular-nums text-muted">
            {fmtDuration(data.week.listening + data.week.speaking)} this week · {hours(done)} / {hours(goal)} h to C1
          </p>
        </div>
        <div className="mt-3 flex h-1 overflow-hidden rounded-full bg-background">
          <div className="bg-foreground/40 transition-[width] duration-700" style={{ width: pct(data.today.listening) }} />
          <div className="bg-accent transition-[width] duration-700" style={{ width: pct(data.today.speaking) }} />
        </div>
        <p className="mt-2 flex gap-4 text-xs tabular-nums text-muted">
          <span><span className="mr-1.5 inline-block h-2 w-2 rounded-sm bg-foreground/40" />listen {fmtDuration(data.today.listening)}</span>
          <span><span className="mr-1.5 inline-block h-2 w-2 rounded-sm bg-accent" />speak {fmtDuration(data.today.speaking)}</span>
          <span className="ml-auto opacity-0 transition group-hover:opacity-100">details →</span>
        </p>
      </div>
    </Link>
  );
}

export function StudyTime() {
  const [data, setData] = useState<Data | null>(null);

  useEffect(() => {
    api<Data>("/api/time").then(setData);
  }, []);

  if (!data) return <main className="mx-auto w-full max-w-4xl px-6 py-12 text-muted">Loading…</main>;
  const sum = (s: { listening: number; speaking: number }) => s.listening + s.speaking;
  const peak = Math.max(1, ...data.days.map(sum));

  const goalTotal = sum(data.goal);
  const doneTotal = sum(data.total);
  const paceTotal = sum(data.pace);

  return (
    <main className="enter-stagger mx-auto w-full max-w-4xl space-y-14 px-6 py-12">
      <section className="flex flex-wrap gap-x-14 gap-y-8">
        {(["today", "week", "total"] as const).map((k) => (
          <div key={k}>
            <p className="text-3xl font-light tabular-nums">{fmtDuration(sum(data[k]))}</p>
            <p className="text-xs text-muted">{k === "week" ? "this week" : k}</p>
            <p className="mt-2 text-xs tabular-nums text-muted">
              listen {fmtDuration(data[k].listening)} · speak {fmtDuration(data[k].speaking)}
            </p>
          </div>
        ))}
      </section>

      <section>
        <p className="mb-3 text-xs text-muted">Last 14 days</p>
        <div className="flex h-24 items-end gap-1.5">
          {data.days.map((d) => (
            <div key={d.day} className="flex h-full flex-1 flex-col justify-end" title={`${d.day} · listen ${fmtDuration(d.listening)} · speak ${fmtDuration(d.speaking)}`}>
              <div className="rounded-t-sm bg-accent" style={{ height: `${(d.speaking / peak) * 100}%` }} />
              <div className="bg-foreground/40" style={{ height: `${(d.listening / peak) * 100}%` }} />
            </div>
          ))}
        </div>
        <p className="mt-2 flex gap-4 text-xs text-muted">
          <span><span className="mr-1.5 inline-block h-2 w-2 rounded-sm bg-foreground/40" />listening</span>
          <span><span className="mr-1.5 inline-block h-2 w-2 rounded-sm bg-accent" />speaking</span>
        </p>
      </section>

      <section className="max-w-md space-y-6">
        <h2 className="text-2xl font-light">Road to C1<span className="text-accent">.</span></h2>
        <Meter label="Total" done={doneTotal} goal={goalTotal} pace={paceTotal} milestone={{ at: 0.5, label: "B2" }} />
        <Meter label="Listening" done={data.total.listening} goal={data.goal.listening} pace={data.pace.listening} />
        <Meter label="Speaking" done={data.total.speaking} goal={data.goal.speaking} pace={data.pace.speaking} />
        <GoalEditor goal={data.goal} onSaved={() => api<Data>("/api/time").then(setData)} />
        <p className="text-xs leading-relaxed text-muted">
          Estimate: Cambridge puts each CEFR level at ~200 guided hours across all skills, so B1 → C1 ≈ 400 h. Speaking gets
          the bigger share because it&apos;s your weakest skill. Only active time counts: the clock stops after 2 minutes
          without input, audio or recording.
        </p>
      </section>
    </main>
  );
}

function Meter({ label, done, goal, pace, milestone }: { label: string; done: number; goal: number; pace: number; milestone?: { at: number; label: string } }) {
  const v = goal ? Math.min(done / goal, 1) : 0;
  return (
    <div>
      <div className="flex justify-between text-xs">
        <span className="text-muted">{label}</span>
        <span className={`tabular-nums ${v >= 1 ? "text-accent" : "text-muted"}`}>
          {hours(done)} / {hours(goal)} h
        </span>
      </div>
      <div className="relative mt-2 h-[3px] rounded-full bg-surface-2">
        <div className={`h-full rounded-full transition-[width] duration-700 ${v >= 1 ? "bg-accent" : "bg-foreground/50"}`} style={{ width: `${v * 100}%` }} />
        {milestone && (
          <div className="absolute -top-1 h-[11px] w-px bg-foreground/40" style={{ left: `${milestone.at * 100}%` }}>
            <span className="absolute left-1 top-3 text-[10px] text-muted">{milestone.label}</span>
          </div>
        )}
      </div>
      <p className={`text-xs text-muted ${milestone ? "mt-4" : "mt-1.5"}`}>
        {hours(Math.max(0, goal - done))} h left · {eta(goal - done, pace)}
      </p>
    </div>
  );
}

function GoalEditor({ goal, onSaved }: { goal: { listening: number; speaking: number }; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [listening, setListening] = useState(goal.listening / 3600);
  const [speaking, setSpeaking] = useState(goal.speaking / 3600);

  if (!open) return <button className="link" onClick={() => setOpen(true)}>Edit goal hours</button>;

  const save = async () => {
    await api<Settings>("/api/settings", { method: "PATCH", json: { goal_listening_hours: listening, goal_speaking_hours: speaking } });
    setOpen(false);
    onSaved();
  };

  return (
    <div className="flex items-end gap-4 text-sm">
      <label className="w-28">
        <span className="text-xs text-muted">Listening h</span>
        <input className="input tabular-nums" type="number" min={10} max={2000} value={listening} onChange={(e) => setListening(Number(e.target.value))} />
      </label>
      <label className="w-28">
        <span className="text-xs text-muted">Speaking h</span>
        <input className="input tabular-nums" type="number" min={10} max={2000} value={speaking} onChange={(e) => setSpeaking(Number(e.target.value))} />
      </label>
      <button className="btn-primary" onClick={save}>Save</button>
      <button className="link" onClick={() => setOpen(false)}>Cancel</button>
    </div>
  );
}
