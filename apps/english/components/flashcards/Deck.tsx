"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client";
import type { deckOverview } from "@/lib/flashcards/store";

type Overview = ReturnType<typeof deckOverview>;

/** All cards, what's due, and which patterns you get wrong most. */
export function Deck() {
  const [data, setData] = useState<Overview | null>(null);
  const load = useCallback(() => api<Overview>("/api/cards").then(setData), []);
  useEffect(() => {
    api<Overview>("/api/cards").then(setData);
  }, []);
  if (!data) return null;

  const toggle = async (id: number, suspended: boolean) => {
    await api(`/api/cards/${id}`, { method: "PATCH", json: { suspended } });
    void load();
  };

  return (
    <section className="enter-stagger space-y-12">
      <div className="flex gap-10">
        <Stat value={data.total} label="cards" />
        <Stat value={data.dueToday} label="due today" />
        <Stat value={data.status.reviewedToday} label="reviewed today" />
      </div>

      {data.patterns.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm text-muted">Patterns · last 5 uses</h2>
          <ul className="space-y-2 text-sm">
            {data.patterns.slice(0, 8).map((p) => (
              <li key={p.id} className="grid grid-cols-[1fr_120px_36px] items-center gap-4">
                <span className="truncate text-foreground/85">{p.label}</span>
                <div className="h-[3px] rounded-full bg-surface-2">
                  <div className="h-full rounded-full bg-accent transition-[width] duration-700" style={{ width: `${(p.ok / p.recent) * 100}%` }} />
                </div>
                <span className="text-right tabular-nums text-muted">{p.ok}/{p.recent}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.cards.length > 0 ? (
        <details>
          <summary>all cards ({data.cards.length})</summary>
          <ul className="mt-4">
            {data.cards.map((c) => (
              <li key={c.id} className="group flex items-baseline gap-4 border-b border-line/50 py-2.5 text-sm">
                <span className={`w-44 shrink-0 truncate ${c.suspended ? "text-muted line-through" : ""}`}>{c.term}</span>
                <span className="min-w-0 flex-1 truncate text-muted">{c.definition ?? c.source_title}</span>
                <span className="shrink-0 tabular-nums text-muted">{c.suspended ? "removed" : c.due.slice(5)}</span>
                <button className="link opacity-0 transition group-hover:opacity-100" onClick={() => void toggle(c.id, !c.suspended)}>
                  {c.suspended ? "restore" : "remove"}
                </button>
              </li>
            ))}
          </ul>
        </details>
      ) : (
        <p className="text-muted">No cards yet. Finish an episode or a speaking topic to add some.</p>
      )}
    </section>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <p className="text-3xl font-light tabular-nums">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}
