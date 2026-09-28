"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import type { speakingOverview } from "@/lib/speaking/overview";
import { TYPE_LABEL } from "./bits";

type Overview = ReturnType<typeof speakingOverview>;

export function SpeakingOverview() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    api<Overview>("/api/speaking/overview").then(
      (d) => {
        setData(d);
        setOpen(d.currentBlock);
      },
      (e: Error) => setError(e.message),
    );
  }, []);

  if (error) return <main className="mx-auto max-w-5xl p-6"><p className="rounded-lg bg-bad-soft p-4 text-bad">{error}</p></main>;
  if (!data) return <main className="mx-auto max-w-5xl p-6 text-muted">Loading…</main>;

  const doneTotal = data.blocks.reduce((a, b) => a + b.topics.filter((t) => t.done > 0).length, 0);

  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 px-4 py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">120 topics · 12-block rotation</p>
          <h1 className="text-3xl font-semibold">Speaking</h1>
          <p className="mt-1 text-sm text-muted">{doneTotal}/120 topics done · topics come from 120-speaking-topics.md</p>
        </div>
        <div className="flex gap-2">
          <Link className="btn" href="/speaking/errors">Error log</Link>
          <Link className="btn" href="/speaking/progress">Monthly self-check</Link>
        </div>
      </header>

      <section className="space-y-2">
        {data.blocks.map((b) => {
          const done = b.topics.filter((t) => t.done > 0).length;
          const isOpen = open === b.no;
          return (
            <div key={b.no} className={`card overflow-hidden ${b.no === data.currentBlock ? "border-foreground/40" : ""}`}>
              <button className="flex w-full items-center gap-3 px-4 py-3 text-left" onClick={() => setOpen(isOpen ? null : b.no)} aria-expanded={isOpen}>
                <span className="w-8 font-mono text-sm text-muted">{String(b.no).padStart(2, "0")}</span>
                <span className="flex-1">
                  <span className="font-medium">{b.name}</span>
                  {b.no === data.currentBlock && <span className="ml-2 rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent">current</span>}
                  <span className="block text-xs text-muted">{b.target}</span>
                </span>
                <span className="text-sm tabular-nums text-muted">{done}/10</span>
              </button>
              {isOpen && (
                <ul className="divide-y divide-line border-t border-line">
                  {b.topics.map((t) => (
                    <li key={t.no} className="flex items-center gap-3 px-4 py-2 text-sm">
                      <span className="w-8 font-mono text-xs text-muted">{t.no}</span>
                      <span className="w-8 text-xs text-muted" title={TYPE_LABEL[t.type]}>{t.type}</span>
                      <span className={`flex-1 ${t.done ? "text-muted" : ""}`}>{t.text}</span>
                      {t.done > 0 && <span className="text-xs text-ok">✓{t.done > 1 ? ` ×${t.done}` : ""}</span>}
                      <Link className="btn px-2 py-1 text-xs" href={`/speaking/practice/${t.no}`}>Practise</Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Recent sessions</h2>
        {data.sessions.length === 0 ? (
          <p className="text-sm text-muted">No sessions yet. Start from Today or pick a topic above.</p>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th className="px-4 py-2 font-medium">Date</th>
                  <th className="px-2 py-2 font-medium">Topic</th>
                  <th className="px-2 py-2 text-right font-medium">Rounds</th>
                  <th className="px-2 py-2 text-right font-medium">WPM R1 → last</th>
                  <th className="px-4 py-2 text-right font-medium">Pauses R1 → last</th>
                </tr>
              </thead>
              <tbody>
                {data.sessions.map((s) => (
                  <tr key={s.id} className="border-t border-line">
                    <td className="px-4 py-2 tabular-nums text-muted">{s.date}</td>
                    <td className="px-2 py-2">
                      <Link className="hover:underline" href={`/speaking/session/${s.id}`}>
                        #{s.topic_no} {s.topic?.text}
                      </Link>
                      {s.kind !== "new" && <span className="ml-1 text-xs text-warn">({s.kind})</span>}
                      {!s.completed_at && <span className="ml-1 text-xs text-muted">· unfinished</span>}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">{s.rounds}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{s.first ? `${s.first.wpm} → ${s.last?.wpm ?? "…"}` : "—"}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{s.first ? `${s.first.pauses} → ${s.last?.pauses ?? "…"}` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
