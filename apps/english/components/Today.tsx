"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import type { Dashboard } from "@/lib/db";
import { DAY_LABEL, itemKey, type PlanItem, type TodayPlan } from "@/lib/plan-types";
import type { Settings } from "@/lib/speaking/store";
import { ListeningStats } from "./listening/ListeningStats";

type Trend = { n: number; wpm: number; pausesPerMin: number; fillersPerMin: number } | null;

export function itemHref(i: PlanItem) {
  if (i.kind === "listening") return `/listening/${i.episodeId}`;
  if (i.kind === "speaking") return `/speaking/practice/${i.topicNo}?kind=${i.sessionKind}`;
  return `/speaking/transcribe/${i.recordingId}`;
}

export function itemLabel(i: PlanItem) {
  if (i.kind === "listening") return i.mode === "deep" ? "Listening · deep" : "Listening · light";
  if (i.kind === "speaking")
    return i.sessionKind === "new" ? `Speaking · topic #${i.topicNo}` : i.sessionKind === "revisit" ? `Revisit · topic #${i.topicNo}` : "Monthly self-check · topic #11";
  return `Transcribe · topic #${i.topicNo}`;
}

export function Today() {
  const router = useRouter();
  const [plan, setPlan] = useState<TodayPlan | null>(null);
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [trend, setTrend] = useState<Trend>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<TodayPlan>("/api/plan").then(setPlan, (e: Error) => setError(e.message));
    api<Dashboard>("/api/progress").then(setDash);
    api<{ trend: Trend }>("/api/speaking/overview").then((o) => setTrend(o.trend));
    api<Settings>("/api/settings").then(setSettings);
  }, []);

  const startFocus = async () => {
    try {
      await document.documentElement.requestFullscreen();
    } catch {
      // the focus room shows its own "enter fullscreen" gate
    }
    router.push("/focus");
  };

  const skip = async (i: PlanItem) => setPlan(await api<TodayPlan>("/api/plan", { method: "POST", json: { action: "skip", key: itemKey(i) } }));

  const updateSettings = async (patch: Partial<Settings>) => setSettings(await api<Settings>("/api/settings", { method: "PATCH", json: patch }));

  const doneCount = plan?.items.filter((i) => i.done).length ?? 0;

  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 px-4 py-8">
      {error && <p className="rounded-lg bg-bad-soft p-3 text-bad">{error}</p>}
      {plan && (
        <section className="card overflow-hidden">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line p-5">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted">
                {new Date(`${plan.date}T00:00:00`).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })} · day {plan.cycleDay} of 7
              </p>
              <h1 className="mt-1 text-2xl font-semibold">
                {DAY_LABEL[plan.dayType]}
                {plan.block && plan.dayType === "new" && <span className="text-muted"> · Block {plan.block.no}: {plan.block.name}</span>}
              </h1>
              {plan.block && plan.dayType === "new" && <p className="mt-1 text-sm text-muted">Language target: {plan.block.target}</p>}
            </div>
            <button className="btn-primary px-5 py-2.5 text-base" onClick={startFocus} disabled={!plan.items.length}>
              {doneCount === plan.items.length && plan.items.length ? "All done ✓ · open focus" : "Start focus session ⛶"}
            </button>
          </div>
          <ul className="divide-y divide-line">
            {plan.items.map((i) => (
              <li key={itemKey(i)} className="flex items-center gap-3 px-5 py-3">
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs ${
                    i.done ? "border-ok bg-ok text-background" : "border-line"
                  }`}
                  aria-label={i.done ? "Done" : "Not done"}
                >
                  {i.done ? "✓" : ""}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted">{itemLabel(i)}</p>
                  <p className={`truncate ${i.done ? "text-muted line-through" : ""}`}>{i.title}</p>
                </div>
                {!i.done && (
                  <button className="text-xs text-muted hover:underline" onClick={() => skip(i)} title="Swap for another">
                    swap
                  </button>
                )}
                <Link href={itemHref(i)} className="btn">Open</Link>
              </li>
            ))}
            {!plan.items.length && <li className="px-5 py-4 text-muted">Nothing planned today.</li>}
          </ul>
          <p className="border-t border-line bg-surface-2 px-5 py-2 text-xs text-muted">
            Focus mode goes fullscreen with only this list. Leaving fullscreen pauses everything until you come back.
          </p>
        </section>
      )}

      {dash && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Listening</h2>
          <ListeningStats dash={dash} />
        </section>
      )}

      <section className="grid gap-3 md:grid-cols-[2fr_1fr]">
        <div className="card p-4">
          <h2 className="text-xs uppercase tracking-wide text-muted">Speaking trend (Round 3, last {trend?.n ?? 0} topics)</h2>
          {trend ? (
            <div className="mt-2 flex gap-8">
              <Stat value={trend.wpm} label="words / min" />
              <Stat value={trend.pausesPerMin} label="long pauses / min" />
              <Stat value={trend.fillersPerMin} label="fillers / min" />
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted">Finish your first speaking topic to see your fluency trend.</p>
          )}
          <div className="mt-3 flex gap-3 text-sm">
            <Link className="text-accent underline" href="/speaking/errors">Error log</Link>
            <Link className="text-accent underline" href="/speaking/progress">Monthly self-check</Link>
          </div>
        </div>
        {settings && (
          <div className="card space-y-2 p-4 text-sm">
            <h2 className="text-xs uppercase tracking-wide text-muted">Settings</h2>
            <label className="flex items-center justify-between gap-2">
              New speaking topics / day
              <select className="btn" value={settings.topics_per_day} onChange={(e) => updateSettings({ topics_per_day: Number(e.target.value) })}>
                {[1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <label className="flex items-center justify-between gap-2">
              Prep time (s)
              <select className="btn" value={settings.prep_seconds} onChange={(e) => updateSettings({ prep_seconds: Number(e.target.value) })}>
                {withValue([15, 30, 45, 60], settings.prep_seconds).map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <label className="flex items-center justify-between gap-2">
              Research (min)
              <select className="btn" value={settings.research_minutes} onChange={(e) => updateSettings({ research_minutes: Number(e.target.value) })}>
                {withValue([3, 5, 8, 10], settings.research_minutes).map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <p className="text-xs text-muted">Topics/day applies from tomorrow&apos;s plan.</p>
          </div>
        )}
      </section>
    </main>
  );
}

const withValue = (opts: number[], v: number) => (opts.includes(v) ? opts : [...opts, v].sort((a, b) => a - b));

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}
