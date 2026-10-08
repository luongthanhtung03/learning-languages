"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import type { speakingOverview } from "@/lib/speaking/overview";
import type { Settings } from "@/lib/speaking/store";
import { TYPE_LABEL } from "./bits";

type Overview = ReturnType<typeof speakingOverview>;

export function SpeakingOverview() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    api<Overview>("/api/speaking/overview").then(
      (d) => {
        setData(d);
        setOpen(d.currentBlock);
      },
      (e: Error) => setError(e.message),
    );
    api<Settings>("/api/settings").then(setSettings);
  }, []);

  const updateSettings = async (patch: Partial<Settings>) => setSettings(await api<Settings>("/api/settings", { method: "PATCH", json: patch }));

  if (error) return <main className="mx-auto w-full max-w-4xl px-6 py-12 text-bad">{error}</main>;
  if (!data) return <main className="mx-auto w-full max-w-4xl px-6 py-12 text-muted">Loading…</main>;

  const doneTotal = data.blocks.reduce((a, b) => a + b.topics.filter((t) => t.done > 0).length, 0);
  const topicTotal = data.blocks.reduce((a, b) => a + b.topics.length, 0);
  const { trend } = data;

  return (
    <main className="enter-stagger mx-auto w-full max-w-4xl space-y-14 px-6 py-12">
      <header className="space-y-6">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight">Speaking</h1>
          <p className="mt-2 text-sm text-muted">{doneTotal} of {topicTotal} topics</p>
        </div>
        {trend && (
          <div className="flex gap-10">
            <Stat value={trend.wpm} label="words / min" />
            <Stat value={trend.pausesPerMin} label="pauses / min" />
            <Stat value={trend.fillersPerMin} label="fillers / min" />
          </div>
        )}
        <div className="flex gap-5">
          <Link className="link" href="/speaking/stories">Story bank</Link>
          <Link className="link" href="/speaking/errors">Error log</Link>
          <Link className="link" href="/speaking/progress">Monthly self-check</Link>
        </div>
      </header>

      <section>
        {data.blocks.map((b) => {
          const done = b.topics.filter((t) => t.done > 0).length;
          const isOpen = open === b.no;
          const current = b.no === data.currentBlock;
          return (
            <div key={b.no} className="border-b border-line/60">
              <button className="group flex w-full items-baseline gap-4 py-4 text-left" onClick={() => setOpen(isOpen ? null : b.no)} aria-expanded={isOpen}>
                <span className={`w-6 font-mono text-xs ${current ? "text-accent" : "text-muted"}`}>{String(b.no).padStart(2, "0")}</span>
                <span className="flex-1">
                  <span className={`transition ${current ? "text-foreground" : "text-foreground/80 group-hover:text-foreground"}`}>{b.name}</span>
                  <span className="block text-xs text-muted">{b.target}</span>
                </span>
                <span className="text-xs tabular-nums text-muted">{done}/{b.topics.length}</span>
              </button>
              <div className={`grid transition-[grid-template-rows] duration-300 ${isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                <ul className="overflow-hidden">
                  {b.topics.map((t) => (
                    <li key={t.no}>
                      <Link href={`/speaking/practice/${t.no}`} className="group flex items-baseline gap-4 py-2 pl-10 text-sm">
                        <span className="w-6 text-xs text-muted" title={TYPE_LABEL[t.type]}>{t.type}</span>
                        <span className={`flex-1 transition group-hover:text-foreground ${t.done ? "text-muted" : "text-foreground/85"}`}>{t.text}</span>
                        {t.done > 0 && <span className="text-xs text-accent">✓{t.done > 1 ? ` ×${t.done}` : ""}</span>}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })}
      </section>

      {data.sessions.length > 0 && (
        <section>
          <h2 className="mb-4 text-sm text-muted">Recent</h2>
          <ul className="space-y-1 text-sm">
            {data.sessions.map((s) => (
              <li key={s.id}>
                <Link href={`/speaking/session/${s.id}`} className="-mx-3 flex items-baseline gap-4 rounded-lg px-3 py-2 transition hover:bg-surface">
                  <span className="w-20 shrink-0 tabular-nums text-muted">{s.date.slice(5)}</span>
                  <span className="min-w-0 flex-1 truncate">
                    {s.topic?.text ?? `Topic ${s.topic_no}`}
                    {!s.completed_at && <span className="text-muted"> · unfinished</span>}
                  </span>
                  <span className="shrink-0 tabular-nums text-muted">{s.first ? `${s.first.wpm} → ${s.last?.wpm ?? "…"} wpm` : ""}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {settings && (
        <section className="flex flex-wrap gap-x-8 gap-y-2 text-sm text-muted">
          <label className="flex items-center gap-2">
            Prep
            <select className="text-foreground outline-none" value={settings.prep_seconds} onChange={(e) => updateSettings({ prep_seconds: Number(e.target.value) })}>
              {withValue([15, 30, 45, 60], settings.prep_seconds).map((n) => <option key={n} value={n}>{n}s</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2">
            Study
            <select className="text-foreground outline-none" value={settings.research_minutes} onChange={(e) => updateSettings({ research_minutes: Number(e.target.value) })}>
              {withValue([3, 5, 8, 10], settings.research_minutes).map((n) => <option key={n} value={n}>{n} min</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2">
            Cards per review
            <select className="text-foreground outline-none" value={settings.review_cap} onChange={(e) => updateSettings({ review_cap: Number(e.target.value) })}>
              {withValue([10, 15, 20], settings.review_cap).map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        </section>
      )}
    </main>
  );
}

const withValue = (opts: number[], v: number) => (opts.includes(v) ? opts : [...opts, v].sort((a, b) => a - b));

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <p className="text-3xl font-light tabular-nums">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}
