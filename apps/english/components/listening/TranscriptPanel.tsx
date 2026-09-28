"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/client";
import type { Alignment, EpisodeDetail, Timing } from "@/lib/types";
import { termRegex } from "@/lib/listening/vocab";
import { usePlayer } from "../player";

function highlight(text: string, re: RegExp | null) {
  if (!re) return text;
  const g = new RegExp(re.source, "gi");
  const out: React.ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(g)) {
    out.push(text.slice(last, m.index));
    out.push(
      <mark key={m.index} className="rounded bg-accent-soft px-0.5 text-inherit">
        {m[0]}
      </mark>,
    );
    last = m.index! + m[0].length;
  }
  out.push(text.slice(last));
  return out;
}

export function TranscriptPanel({
  ep,
  alignment,
  onSaved,
  onRealign,
}: {
  ep: EpisodeDetail;
  alignment: Alignment | null;
  onSaved: (a: Alignment) => void;
  onRealign: () => void;
}) {
  const p = usePlayer();
  const [follow, setFollow] = useState(true);
  const [edit, setEdit] = useState(false);
  const [draft, setDraft] = useState<Timing[] | null>(null);
  const [saving, setSaving] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const vocabRe = useMemo(() => {
    const parts = ep.vocab.map((v) => termRegex(v.term)?.source).filter(Boolean);
    return parts.length ? new RegExp(parts.join("|"), "i") : null;
  }, [ep]);

  const timings = draft ?? alignment?.sentences ?? null;
  const current = p.playing ? p.currentIdx : -1;

  useEffect(() => {
    if (!follow || current < 0) return;
    rootRef.current?.querySelector(`[data-s="${current}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [current, follow]);

  const byTurn = useMemo(() => {
    const m = new Map<number, typeof ep.sentences>();
    for (const s of ep.sentences) m.set(s.turn, [...(m.get(s.turn) ?? []), s]);
    return m;
  }, [ep]);

  const nudge = (idx: number, field: "start" | "end", delta: number) => {
    const base = draft ?? alignment?.sentences ?? [];
    setDraft(base.map((t) => (t.idx === idx ? { ...t, [field]: Math.max(0, Math.round((t[field] + delta) * 100) / 100) } : t)));
  };

  const save = async () => {
    if (!draft || !alignment) return;
    setSaving(true);
    await api(`/api/episodes/${ep.id}/align`, { method: "PATCH", json: { sentences: draft } });
    onSaved({ ...alignment, sentences: draft, edited: true });
    setDraft(null);
    setSaving(false);
    setEdit(false);
  };

  return (
    <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-[1fr_280px]">
      <div ref={rootRef} className="space-y-4">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} className="accent-[var(--accent)]" />
            Follow audio
          </label>
          {alignment && (
            <button className="btn" onClick={() => (edit ? (setEdit(false), setDraft(null)) : setEdit(true))}>
              {edit ? "Cancel timing edits" : "Fix sentence timings"}
            </button>
          )}
          {edit && (
            <button className="btn-primary" onClick={save} disabled={!draft || saving}>
              {saving ? "Saving…" : "Save timings"}
            </button>
          )}
          <span className="text-xs text-muted">
            {timings ? "Click a sentence to play from there." : "Sentence timings not ready yet."} Transcript is not word-for-word.
          </span>
        </div>

        {ep.turns.map((turn, ti) => (
          <div key={ti} className="grid gap-1 sm:grid-cols-[130px_1fr]">
            <div className="pt-0.5 text-sm font-semibold text-muted">{turn.speaker}</div>
            <div className="leading-relaxed">
              {(byTurn.get(ti) ?? []).map((s) => {
                const t = timings?.[s.idx];
                return edit && t ? (
                  <div key={s.idx} className="mb-2 rounded-lg border border-line p-2">
                    <p className={t.matched < 0.6 ? "text-warn" : ""}>{s.text}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1 font-mono text-xs">
                      <button className="btn px-2 py-0.5" onClick={() => p.playRange(t.start, t.end)}>▶</button>
                      <span className="ml-2 text-muted">start {t.start.toFixed(1)}s</span>
                      <button className="btn px-1.5 py-0.5" onClick={() => nudge(s.idx, "start", -0.2)}>−</button>
                      <button className="btn px-1.5 py-0.5" onClick={() => nudge(s.idx, "start", 0.2)}>+</button>
                      <span className="ml-2 text-muted">end {t.end.toFixed(1)}s</span>
                      <button className="btn px-1.5 py-0.5" onClick={() => nudge(s.idx, "end", -0.2)}>−</button>
                      <button className="btn px-1.5 py-0.5" onClick={() => nudge(s.idx, "end", 0.2)}>+</button>
                      {t.matched < 0.6 && <span className="ml-2 text-warn">low confidence</span>}
                    </div>
                  </div>
                ) : (
                  <span
                    key={s.idx}
                    data-s={s.idx}
                    role={t ? "button" : undefined}
                    tabIndex={t ? 0 : undefined}
                    onClick={() => {
                      if (!t) return;
                      p.stopRange();
                      p.seek(t.start);
                      p.play();
                    }}
                    className={`rounded px-0.5 transition ${t ? "cursor-pointer hover:bg-surface-2" : ""} ${
                      current === s.idx ? "bg-warn-soft" : ""
                    }`}
                  >
                    {highlight(s.text, vocabRe)}{" "}
                  </span>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <aside className="space-y-4">
        <section className="card p-4">
          <h2 className="text-sm font-semibold">Vocabulary</h2>
          <dl className="mt-3 space-y-2 text-sm">
            {ep.vocab.map((v) => (
              <div key={v.term}>
                <dt className="font-medium">{v.term}</dt>
                <dd className="text-muted">{v.definition}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section className="card space-y-1 p-4 text-sm">
          {ep.worksheetPdf && <a className="block text-accent underline" href={ep.worksheetPdf} target="_blank" rel="noreferrer">Worksheet (PDF)</a>}
          {ep.transcriptPdf && <a className="block text-accent underline" href={ep.transcriptPdf} target="_blank" rel="noreferrer">Transcript (PDF)</a>}
          <a className="block text-accent underline" href={`https://www.bbc.co.uk${ep.path}`} target="_blank" rel="noreferrer">Open on BBC</a>
          {alignment && (
            <button className="mt-2 text-xs text-muted underline" onClick={() => confirm("Re-run Whisper alignment? Manual timing edits will be lost.") && onRealign()}>
              Re-run timing alignment ({alignment.model})
            </button>
          )}
        </section>
      </aside>
    </div>
  );
}
