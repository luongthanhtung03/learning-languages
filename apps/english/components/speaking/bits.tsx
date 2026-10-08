"use client";

import type { SpeechStats } from "@/lib/speaking/stats";
import { fmtClock } from "./hooks";

export function CountdownRing({ left, total, tone = "neutral", label }: { left: number; total: number; tone?: "neutral" | "rec"; label?: string }) {
  const r = 88;
  const c = 2 * Math.PI * r;
  const frac = total ? left / total : 0;
  return (
    <div className="relative mx-auto h-60 w-60">
      <svg viewBox="0 0 200 200" className={`h-full w-full -rotate-90 ${tone === "rec" ? "breathe" : ""}`} aria-hidden>
        <circle cx="100" cy="100" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="3" />
        <circle
          cx="100"
          cy="100"
          r={r}
          fill="none"
          stroke={tone === "rec" ? "var(--accent)" : "var(--foreground)"}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - frac)}
          style={{ transition: "stroke-dashoffset 0.25s linear" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center" role="timer" aria-live="off">
        <span className="font-mono text-6xl font-extralight tabular-nums">{fmtClock(left)}</span>
        {label && <span className="mt-1 text-sm text-muted">{label}</span>}
      </div>
    </div>
  );
}

export function MicLevel({ level }: { level: number }) {
  return (
    <div className="flex items-center gap-2 text-xs text-muted" aria-label="Microphone level">
      <span>mic</span>
      <div className="h-[3px] w-32 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full bg-accent transition-[width] duration-75" style={{ width: `${Math.round(level * 100)}%` }} />
      </div>
    </div>
  );
}

const ROWS: { key: keyof SpeechStats; label: string; better: "up" | "down" | "none"; unit?: string }[] = [
  { key: "wpm", label: "Words per minute", better: "up" },
  { key: "words", label: "Words", better: "none" }, // rounds have different lengths
  { key: "pauses", label: "Pauses ≥ 2s", better: "down" },
  { key: "longestPause", label: "Longest pause", better: "down", unit: "s" },
  { key: "fillers", label: "Fillers (um, uh…)", better: "down" },
  { key: "repetitions", label: "Repetitions / restarts", better: "down" },
];

export function StatsTable({ columns }: { columns: { label: string; stats: SpeechStats | null }[] }) {
  const first = columns[0]?.stats;
  const last = columns[columns.length - 1]?.stats;
  const showDelta = columns.length > 1 && first && last;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm tabular-nums">
        <thead>
          <tr className="text-left text-xs text-muted">
            <th className="py-1.5 pr-3 font-medium" />
            {columns.map((c) => (
              <th key={c.label} className="px-2 py-1.5 text-right font-medium">{c.label}</th>
            ))}
            {showDelta && <th className="px-2 py-1.5 text-right font-medium">Change</th>}
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row) => {
            const d = showDelta ? (last![row.key] as number) - (first![row.key] as number) : 0;
            const good = row.better === "up" ? d > 0 : d < 0;
            return (
              <tr key={row.key} className="border-t border-line/60">
                <td className="py-1.5 pr-3 text-muted">{row.label}</td>
                {columns.map((c) => (
                  <td key={c.label} className="px-2 py-1.5 text-right">
                    {c.stats ? `${c.stats[row.key]}${row.unit ?? ""}` : "…"}
                  </td>
                ))}
                {showDelta && (
                  <td className={`px-2 py-1.5 text-right ${d === 0 || row.better === "none" ? "text-muted" : good ? "text-ok" : "text-bad"}`}>
                    {d > 0 ? "+" : ""}
                    {Math.round(d * 10) / 10}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export const TYPE_LABEL: Record<string, string> = {
  EX: "Explain a concept",
  BQ: "Behavioural interview",
  WS: "Work situation",
};
