"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client";
import type { SpeakingError } from "@/lib/speaking/store";
import { ERROR_TAGS } from "@/lib/speaking/tags";

type Data = {
  errors: (SpeakingError & { topic_no: number; date: string; round: number })[];
  counts: { id: string; label: string; count: number }[];
  secondary: { label: string; target: string; count: number } | null;
};

export function ErrorLog() {
  const [data, setData] = useState<Data | null>(null);
  const load = useCallback(() => api<Data>("/api/speaking/errors").then(setData), []);
  useEffect(() => {
    api<Data>("/api/speaking/errors").then(setData);
  }, []);

  if (!data) return <main className="mx-auto max-w-5xl p-6 text-muted">Loading…</main>;
  const max = Math.max(1, ...data.counts.map((c) => c.count));

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8">
      <header>
        <Link href="/speaking" className="text-sm text-muted hover:underline">← Speaking</Link>
        <h1 className="mt-2 text-3xl font-semibold">Error log</h1>
        <p className="mt-1 text-sm text-muted">
          Track patterns, not individual slips. When the same pattern appears 3 times in 14 days, it becomes your secondary target.
        </p>
      </header>

      <section className={`card p-4 ${data.secondary ? "border-warn/50" : ""}`}>
        <p className="text-xs uppercase tracking-wide text-muted">Current secondary target</p>
        <p className="mt-1 text-lg font-medium">
          {data.secondary ? `${data.secondary.target || data.secondary.label} (${data.secondary.count}× in 14 days)` : "None yet"}
        </p>
      </section>

      <section className="card space-y-2 p-4">
        <h2 className="text-sm font-semibold">By pattern (all time)</h2>
        {data.counts.map((c) => (
          <div key={c.id} className="grid grid-cols-[200px_1fr_40px] items-center gap-3 text-sm">
            <span className="truncate text-muted">{c.label}</span>
            <div className="h-2 rounded bg-surface-2">
              <div className="h-full rounded bg-bad" style={{ width: `${(c.count / max) * 100}%` }} />
            </div>
            <span className="text-right tabular-nums">{c.count}</span>
          </div>
        ))}
      </section>

      <section className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="px-4 py-2 font-medium">Date</th>
              <th className="px-2 py-2 font-medium">Topic #</th>
              <th className="px-2 py-2 font-medium">Recurring error</th>
              <th className="px-2 py-2 font-medium">You said</th>
              <th className="px-2 py-2 font-medium">Correct form</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {data.errors.map((e) => (
              <tr key={e.id} className="border-t border-line">
                <td className="px-4 py-2 tabular-nums text-muted">{e.date}</td>
                <td className="px-2 py-2 tabular-nums">{e.topic_no} <span className="text-xs text-muted">R{e.round}</span></td>
                <td className="px-2 py-2">{ERROR_TAGS.find((t) => t.id === e.tag)?.label}</td>
                <td className="px-2 py-2 text-bad">{e.wrong}</td>
                <td className="px-2 py-2 text-ok">{e.correct}</td>
                <td className="px-4 py-2 text-right">
                  <button
                    className="text-xs text-muted hover:text-bad"
                    onClick={async () => {
                      await api(`/api/speaking/errors/${e.id}`, { method: "DELETE" });
                      void load();
                    }}
                    aria-label="Delete"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
            {!data.errors.length && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted">
                  No errors logged yet. Click words in your transcripts to tag them.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}
