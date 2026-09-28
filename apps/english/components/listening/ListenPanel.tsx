"use client";

import { useState } from "react";
import type { EpisodeDetail } from "@/lib/types";
import { fmt, usePlayer } from "../player";

export function QuestionOptions({
  ep,
  guess,
  setGuess,
  disabled,
}: {
  ep: EpisodeDetail;
  guess: string | null;
  setGuess: (g: string) => void;
  disabled?: boolean;
}) {
  if (!ep.question) return null;
  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 font-medium">{ep.question.text}</legend>
      {ep.question.options.map((o) => (
        <label
          key={o.letter}
          className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 transition ${
            guess === o.letter ? "border-foreground bg-surface-2" : "border-line hover:bg-surface-2"
          } ${disabled ? "pointer-events-none" : ""}`}
        >
          <input
            type="radio"
            name="weekly-question"
            className="accent-[var(--accent)]"
            checked={guess === o.letter}
            onChange={() => setGuess(o.letter)}
            disabled={disabled}
          />
          <span className="font-mono text-sm text-muted">{o.letter})</span>
          <span>{o.text}</span>
        </label>
      ))}
    </fieldset>
  );
}

export function ListenPanel({
  ep,
  guess,
  setGuess,
  onNext,
}: {
  ep: EpisodeDetail;
  guess: string | null;
  setGuess: (g: string) => void;
  onNext: () => void;
}) {
  const p = usePlayer();
  const [showVocab, setShowVocab] = useState(false);
  const listened = p.duration ? p.time / p.duration : 0;

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_280px]">
      <div className="space-y-6">
        <section className="card p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">First listen</h2>
          <p className="mt-2 leading-relaxed">{ep.intro}</p>
          <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm text-muted">
            <li>Read the question below and make a guess.</li>
            <li>Listen to the whole programme once at 1× without the transcript. Don&apos;t pause much.</li>
            <li>Take the quiz straight away. Your first attempt is saved as your first-listen score.</li>
          </ol>
          <div className="mt-4 flex items-center gap-3">
            <button className="btn-primary" onClick={p.toggle}>{p.playing ? "Pause" : p.time > 0 ? "Resume" : "Start listening"}</button>
            <span className="text-sm text-muted">
              {fmt(p.time)} / {fmt(p.duration)} · {Math.round(listened * 100)}% heard
            </span>
          </div>
        </section>

        {ep.question && (
          <section className="card p-5">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">This week&apos;s question</h2>
            <QuestionOptions ep={ep} guess={guess} setGuess={setGuess} />
          </section>
        )}

        <button className="btn-primary" onClick={onNext}>I&apos;ve listened → take the quiz</button>
      </div>

      <aside className="space-y-4">
        <section className="card p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Vocabulary ({ep.vocab.length})</h2>
            <button className="text-xs text-muted underline" onClick={() => setShowVocab((s) => !s)}>
              {showVocab ? "hide" : "preview"}
            </button>
          </div>
          {showVocab ? (
            <dl className="mt-3 space-y-2 text-sm">
              {ep.vocab.map((v) => (
                <div key={v.term}>
                  <dt className="font-medium">{v.term}</dt>
                  <dd className="text-muted">{v.definition}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="mt-2 text-xs text-muted">Hidden so the quiz still tests you. Preview it if you&apos;d rather learn the words first.</p>
          )}
        </section>
        {(ep.worksheetPdf || ep.transcriptPdf) && (
          <section className="card space-y-1 p-4 text-sm">
            <h2 className="font-semibold">BBC downloads</h2>
            {ep.worksheetPdf && <a className="block text-accent underline" href={ep.worksheetPdf} target="_blank" rel="noreferrer">Worksheet (PDF)</a>}
            {ep.transcriptPdf && <a className="block text-accent underline" href={ep.transcriptPdf} target="_blank" rel="noreferrer">Transcript (PDF)</a>}
            <a className="block text-accent underline" href={`https://www.bbc.co.uk${ep.path}`} target="_blank" rel="noreferrer">Open on BBC</a>
          </section>
        )}
      </aside>
    </div>
  );
}
