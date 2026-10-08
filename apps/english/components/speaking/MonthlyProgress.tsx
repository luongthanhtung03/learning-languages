"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import type { SpeechStats } from "@/lib/speaking/stats";

type Point = SpeechStats & { date: string; kind: string };

const METRICS: { key: keyof SpeechStats; label: string; better: string }[] = [
  { key: "wpm", label: "Words per minute", better: "higher is better" },
  { key: "pauses", label: "Pauses ≥ 2s", better: "lower is better" },
  { key: "repetitions", label: "Repetitions / false starts", better: "lower is better" },
];

function LineChart({ points, metric }: { points: Point[]; metric: keyof SpeechStats }) {
  const W = 520;
  const H = 160;
  const P = { l: 36, r: 12, t: 12, b: 28 };
  const vals = points.map((p) => p[metric] as number);
  const max = Math.max(1, ...vals) * 1.15;
  const x = (i: number) => P.l + (points.length === 1 ? (W - P.l - P.r) / 2 : (i / (points.length - 1)) * (W - P.l - P.r));
  const y = (v: number) => H - P.b - (v / max) * (H - P.t - P.b);
  const ticks = [0, max / 2, max].map((v) => Math.round(v));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${metric} over time`}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeDasharray="2 4" />
          <text x={P.l - 6} y={y(t) + 4} textAnchor="end" fontSize="10" fill="var(--muted)">{t}</text>
        </g>
      ))}
      <polyline fill="none" stroke="var(--accent)" strokeWidth="1.5" points={points.map((p, i) => `${x(i)},${y(p[metric] as number)}`).join(" ")} />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(p[metric] as number)} r="3" fill="var(--background)" stroke="var(--accent)" strokeWidth="1.5">
            <title>{`${p.date}: ${p[metric]}`}</title>
          </circle>
          <text x={x(i)} y={H - 8} textAnchor="middle" fontSize="10" fill="var(--muted)">{p.date.slice(5)}</text>
        </g>
      ))}
    </svg>
  );
}

export function MonthlyProgress() {
  const [points, setPoints] = useState<Point[] | null>(null);
  useEffect(() => {
    api<Point[]>("/api/speaking/overview?monthly=1").then(setPoints);
  }, []);

  const last = points?.at(-1);
  const prev = points && points.length > 1 ? points[points.length - 2] : null;
  const fasterButNotCleaner =
    last && prev && last.wpm > prev.wpm && last.pauses + last.repetitions >= prev.pauses + prev.repetitions;

  return (
    <main className="enter-stagger mx-auto w-full max-w-4xl space-y-12 px-6 py-12">
      <header>
        <Link href="/speaking" className="link">← Speaking</Link>
        <h1 className="mt-6 text-4xl font-semibold tracking-tight">Monthly self-check</h1>
        <p className="mt-2 text-sm text-muted">“Tell me about yourself”, cold first round, every 4 weeks. It shows up in Today when due.</p>
      </header>
      {!points ? (
        <p className="text-muted">Loading…</p>
      ) : points.length === 0 ? (
        <p className="text-center text-muted">No “Tell me about yourself” recordings yet. It comes up in Block 3, and the monthly re-record starts 4 weeks later.</p>
      ) : (
        <>
          {fasterButNotCleaner && (
            <p className="text-sm text-accent">
              Your speed is rising but errors aren&apos;t falling. You&apos;re getting faster at speaking badly. Add a second transcribe day each week.
            </p>
          )}
          <div className="grid gap-12">
            {METRICS.map((m) => (
              <section key={m.key} >
                <h2 className="mb-3 text-sm text-muted">{m.label} · {m.better}</h2>
                <LineChart points={points} metric={m.key} />
              </section>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
