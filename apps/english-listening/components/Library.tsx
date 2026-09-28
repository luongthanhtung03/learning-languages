"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api, pct } from "@/lib/client";
import type { Dashboard, EpisodeRow } from "@/lib/db";

const PAGE = 30;
const GOAL = { days: 30, perDay: 2 };

export function Library() {
  const [episodes, setEpisodes] = useState<EpisodeRow[] | null>(null);
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [year, setYear] = useState("all");
  const [status, setStatus] = useState("all");
  const [limit, setLimit] = useState(PAGE);
  const [refreshing, setRefreshing] = useState(false);

  const load = (refresh = false) =>
    api<{ episodes: EpisodeRow[] }>(`/api/episodes${refresh ? "?refresh=1" : ""}`).then(
      (r) => {
        setEpisodes(r.episodes);
        setError(null);
      },
      (e: Error) => setError(e.message),
    );

  useEffect(() => {
    api<{ episodes: EpisodeRow[] }>("/api/episodes").then(
      (r) => setEpisodes(r.episodes),
      (e: Error) => setError(e.message),
    );
    api<Dashboard>("/api/progress").then(setDash);
  }, []);

  const years = useMemo(() => [...new Set((episodes ?? []).map((e) => e.date.slice(0, 4)))].sort().reverse(), [episodes]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (episodes ?? []).filter(
      (e) =>
        (year === "all" || e.date.startsWith(year)) &&
        (status === "all" || e.status === status) &&
        (!needle || e.title.toLowerCase().includes(needle) || e.description.toLowerCase().includes(needle)),
    );
  }, [episodes, q, year, status]);

  const inProgress = (episodes ?? []).filter((e) => e.status === "in-progress").slice(0, 4);
  const nextUp = (episodes ?? []).find((e) => e.status === "new");

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">BBC Learning English</p>
          <h1 className="text-3xl font-semibold">6 Minute Listening</h1>
        </div>
        <button
          className="btn"
          disabled={refreshing}
          onClick={async () => {
            setRefreshing(true);
            await load(true);
            setRefreshing(false);
          }}
        >
          {refreshing ? "Refreshing…" : "Check for new episodes"}
        </button>
      </header>

      {dash && <DashboardCards dash={dash} />}

      {(inProgress.length > 0 || nextUp) && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Continue</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {inProgress.map((e) => (
              <EpisodeCard key={e.id} e={e} compact />
            ))}
            {inProgress.length === 0 && nextUp && <EpisodeCard e={nextUp} compact label="Newest episode" />}
          </div>
        </section>
      )}

      <section className="mt-8">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="mr-auto text-sm font-semibold uppercase tracking-wide text-muted">
            All episodes {episodes && <span className="font-normal normal-case">({filtered.length})</span>}
          </h2>
          <input
            className="input w-full py-1.5 text-sm sm:w-56"
            placeholder="Search topics…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setLimit(PAGE);
            }}
          />
          <select aria-label="Year" className="btn" value={year} onChange={(e) => (setYear(e.target.value), setLimit(PAGE))}>
            <option value="all">All years</option>
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <select aria-label="Status" className="btn" value={status} onChange={(e) => (setStatus(e.target.value), setLimit(PAGE))}>
            <option value="all">Any status</option>
            <option value="new">Not started</option>
            <option value="in-progress">In progress</option>
            <option value="done">Done</option>
          </select>
        </div>
        {error && <p className="rounded-lg bg-bad-soft p-3 text-sm text-bad">Couldn&apos;t load episodes from the BBC: {error}</p>}
        {!episodes && !error && <p className="text-muted">Loading episodes from the BBC…</p>}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.slice(0, limit).map((e) => (
            <EpisodeCard key={e.id} e={e} />
          ))}
        </div>
        {filtered.length > limit && (
          <div className="mt-6 text-center">
            <button className="btn" onClick={() => setLimit((l) => l + PAGE)}>Show more</button>
          </div>
        )}
      </section>
    </main>
  );
}

function StatusBadge({ e }: { e: EpisodeRow }) {
  if (e.status === "done")
    return (
      <span className="rounded-full bg-ok-soft px-2 py-0.5 text-xs font-medium text-ok">
        ✓ {e.mode === "light" ? "Light" : "Deep"}
        {e.first_listen_score !== null && ` · ${pct(e.first_listen_score)}`}
      </span>
    );
  if (e.status === "in-progress")
    return <span className="rounded-full bg-warn-soft px-2 py-0.5 text-xs font-medium text-warn">In progress</span>;
  return null;
}

function EpisodeCard({ e, compact, label }: { e: EpisodeRow; compact?: boolean; label?: string }) {
  return (
    <Link href={`/episode/${e.id}`} className="card group flex overflow-hidden transition hover:border-foreground/30">
      {e.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={e.image} alt="" loading="lazy" className={`${compact ? "w-28" : "w-24"} shrink-0 object-cover`} />
      )}
      <div className="min-w-0 flex-1 p-3">
        <div className="flex items-center justify-between gap-2 text-xs text-muted">
          <span>{label ?? new Date(e.date).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</span>
          <StatusBadge e={e} />
        </div>
        <h3 className="mt-1 font-medium leading-snug group-hover:underline">{e.title}</h3>
        <p className="mt-0.5 line-clamp-2 text-sm text-muted">{e.description}</p>
      </div>
    </Link>
  );
}

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

function DashboardCards({ dash }: { dash: Dashboard }) {
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
