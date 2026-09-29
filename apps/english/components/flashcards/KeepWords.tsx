"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import type { EpisodeDetail } from "@/lib/types";

const SUGGESTED = 4;

/** End of an episode: choose which of its words become flashcards (3–4 keeps the daily review short). */
export function KeepWords({ ep, onFinish }: { ep: EpisodeDetail; onFinish: () => Promise<void> }) {
  const [keep, setKeep] = useState<Set<string>>(() => new Set(ep.vocab.slice(0, SUGGESTED).map((v) => v.term)));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<{ terms: string[] }>(`/api/cards?episode=${ep.id}`).then((r) => r.terms.length && setKeep(new Set(r.terms)));
  }, [ep.id]);

  const toggle = (t: string) =>
    setKeep((k) => {
      const n = new Set(k);
      if (n.has(t)) n.delete(t);
      else n.add(t);
      return n;
    });

  return (
    <div className="w-full space-y-6">
      <div>
        <h2 className="text-lg">Keep as flashcards</h2>
        <p className="mt-1 text-sm text-muted">Pick the words you want to be able to use. 3–4 keeps your daily review short; skip ones you already know.</p>
      </div>
      <ul className="space-y-1">
        {ep.vocab.map((v) => {
          const on = keep.has(v.term);
          return (
            <li key={v.term}>
              <button
                onClick={() => toggle(v.term)}
                className={`-mx-3 flex w-full items-baseline gap-4 rounded-xl px-3 py-2.5 text-left transition ${on ? "bg-surface" : "hover:bg-surface"}`}
                aria-pressed={on}
              >
                <span className={`mt-1.5 h-2 w-2 shrink-0 self-start rounded-full border transition ${on ? "border-accent bg-accent" : "border-line"}`} />
                <span className={`w-40 shrink-0 ${on ? "text-foreground" : "text-muted"}`}>{v.term}</span>
                <span className="text-sm text-muted">{v.definition}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <button
        className="btn-primary"
        disabled={saving}
        onClick={async () => {
          setSaving(true);
          if (keep.size) await api("/api/cards", { method: "POST", json: { episodeId: ep.id, terms: [...keep] } });
          await onFinish();
          setSaving(false);
        }}
      >
        Finish episode{keep.size ? ` · keep ${keep.size}` : ""}
      </button>
    </div>
  );
}
