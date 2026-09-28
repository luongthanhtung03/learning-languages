"use client";

import { useMemo, useRef, useState } from "react";
import { api } from "@/lib/client";
import { isFiller, normWord, PAUSE_SECONDS, type Word } from "@/lib/speaking/stats";
import { ERROR_TAGS, type ErrorTag } from "@/lib/speaking/tags";
import type { SpeakingError } from "@/lib/speaking/store";

type Rec = { id: number; words: Word[] | null; errors: SpeakingError[] };

/**
 * Whisper transcript of a recording. Pauses and fillers are marked; click a word
 * (shift-click to extend) to log an error for the error log.
 */
export function TranscriptTagger({ rec, onChanged, audioSrc }: { rec: Rec; onChanged: () => void; audioSrc?: string }) {
  const words = useMemo(() => rec.words ?? [], [rec.words]);
  const [sel, setSel] = useState<{ a: number; b: number } | null>(null);
  const [tag, setTag] = useState<ErrorTag>("article");
  const [correct, setCorrect] = useState("");
  const [saving, setSaving] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const errorAt = useMemo(() => {
    const m = new Map<number, SpeakingError>();
    for (const e of rec.errors) for (let i = e.word_start; i <= e.word_end; i++) m.set(i, e);
    return m;
  }, [rec.errors]);

  const repeated = useMemo(() => {
    const s = new Set<number>();
    const idx = words.map((w, i) => ({ k: normWord(w.w), i })).filter((x) => x.k && !isFiller(words[x.i].w));
    for (let j = 0; j + 1 < idx.length; j++) if (idx[j].k === idx[j + 1].k) s.add(idx[j + 1].i);
    return s;
  }, [words]);

  if (!words.length) return <p className="text-sm text-muted">No words were recognised in this recording.</p>;

  const lo = sel ? Math.min(sel.a, sel.b) : -1;
  const hi = sel ? Math.max(sel.a, sel.b) : -1;
  const selectedText = sel ? words.slice(lo, hi + 1).map((w) => w.w).join(" ") : "";

  const click = (i: number, shift: boolean) => {
    if (sel && shift) setSel({ a: sel.a, b: i });
    else setSel(sel && sel.a === i && sel.b === i ? null : { a: i, b: i });
    setCorrect("");
  };

  const save = async () => {
    if (!sel) return;
    setSaving(true);
    await api("/api/speaking/errors", {
      method: "POST",
      json: { recordingId: rec.id, wordStart: lo, wordEnd: hi, tag, wrong: selectedText, correct },
    });
    setSaving(false);
    setSel(null);
    onChanged();
  };

  const remove = async (id: number) => {
    await api(`/api/speaking/errors/${id}`, { method: "DELETE" });
    onChanged();
  };

  const playFrom = (i: number) => {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = Math.max(0, words[i].start - 0.3);
    void a.play();
  };

  return (
    <div className="space-y-3">
      {audioSrc && <audio ref={audioRef} src={audioSrc} controls preload="metadata" className="h-9 w-full" />}
      <p className="leading-8">
        {words.map((w, i) => {
          const gap = i === 0 ? w.start : w.start - words[i - 1].end;
          const err = errorAt.get(i);
          const filler = isFiller(w.w);
          const inSel = i >= lo && i <= hi;
          return (
            <span key={i}>
              {gap >= PAUSE_SECONDS && (
                <span className="mx-1 rounded bg-warn-soft px-1 font-mono text-xs text-warn" title="Pause">
                  ⏸ {gap.toFixed(1)}s
                </span>
              )}
              <button
                type="button"
                onClick={(e) => click(i, e.shiftKey)}
                title={err ? ERROR_TAGS.find((t) => t.id === err.tag)?.label : (w.p ?? 1) < 0.5 ? "Whisper wasn't sure about this word" : undefined}
                className={`rounded px-0.5 transition hover:bg-surface-2 ${inSel ? "bg-foreground text-background hover:bg-foreground" : ""} ${
                  err && !inSel ? "bg-bad-soft text-bad" : ""
                } ${filler ? "italic text-muted" : ""} ${repeated.has(i) ? "underline decoration-warn decoration-wavy" : ""} ${
                  (w.p ?? 1) < 0.5 ? "decoration-dotted" : ""
                }`}
              >
                {w.w}
              </button>{" "}
            </span>
          );
        })}
      </p>
      <p className="flex flex-wrap gap-3 text-xs text-muted">
        <span><span className="italic">italic</span> = filler</span>
        <span><span className="underline decoration-warn decoration-wavy">wavy</span> = repeated word</span>
        <span><span className="rounded bg-bad-soft px-0.5 text-bad">red</span> = tagged error</span>
        <span>Click a word to tag an error · Shift-click to select several</span>
      </p>

      {sel && (
        <div className="space-y-3 rounded-lg border border-line bg-surface-2 p-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted">Selected:</span>
            <strong>“{selectedText}”</strong>
            {audioSrc && (
              <button className="btn px-2 py-0.5 text-xs" onClick={() => playFrom(lo)}>▶ Listen</button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {ERROR_TAGS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTag(t.id)}
                className={`rounded-full border px-2.5 py-1 text-xs ${tag === t.id ? "border-foreground bg-foreground text-background" : "border-line bg-surface hover:bg-surface-2"}`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              className="input flex-1 py-1.5 text-sm"
              placeholder="Correct form (optional), e.g. “a friend who lives…”"
              value={correct}
              onChange={(e) => setCorrect(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && save()}
            />
            <button className="btn-primary" onClick={save} disabled={saving}>Log error</button>
            <button className="btn" onClick={() => setSel(null)}>Cancel</button>
          </div>
        </div>
      )}

      {rec.errors.length > 0 && (
        <ul className="space-y-1 text-sm">
          {rec.errors.map((e) => (
            <li key={e.id} className="flex items-center gap-2">
              <span className="rounded bg-bad-soft px-1.5 text-xs text-bad">{ERROR_TAGS.find((t) => t.id === e.tag)?.label}</span>
              <span className="line-through decoration-bad/60">{e.wrong}</span>
              {e.correct && <span className="text-ok">→ {e.correct}</span>}
              <button className="ml-auto text-xs text-muted hover:text-bad" onClick={() => remove(e.id)} aria-label="Delete error">✕</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
