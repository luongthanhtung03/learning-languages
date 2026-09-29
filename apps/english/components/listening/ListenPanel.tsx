"use client";

import { useState } from "react";
import type { EpisodeDetail } from "@/lib/types";
import { usePlayer } from "../player";

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
    <fieldset className="space-y-1">
      <legend className="mb-4 text-lg">{ep.question.text}</legend>
      {ep.question.options.map((o) => (
        <label
          key={o.letter}
          className={`-mx-3 flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 transition ${
            guess === o.letter ? "bg-surface text-foreground" : "text-foreground/80 hover:bg-surface"
          } ${disabled ? "pointer-events-none" : ""}`}
        >
          <input
            type="radio"
            name="weekly-question"
            className="sr-only"
            checked={guess === o.letter}
            onChange={() => setGuess(o.letter)}
            disabled={disabled}
          />
          <span
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] transition ${
              guess === o.letter ? "border-accent bg-accent text-background" : "border-line text-muted"
            }`}
          >
            {o.letter}
          </span>
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
}: {
  ep: EpisodeDetail;
  guess: string | null;
  setGuess: (g: string) => void;
}) {
  const p = usePlayer();
  const [showVocab, setShowVocab] = useState(false);
  const listened = p.duration ? p.time / p.duration : 0;

  return (
    <div className="enter-stagger max-w-2xl space-y-12">
      <section className="space-y-6">
        <p className="text-lg leading-relaxed text-foreground/85">{ep.intro}</p>
        <p className="text-sm text-muted">Guess the answer below, then listen once at 1× without the transcript. Take the quiz straight after.</p>
        <div className="flex items-center gap-5">
          <button className="btn-primary" onClick={p.toggle}>{p.playing ? "Pause" : p.time > 0 ? "Resume" : "Start listening"}</button>
          <span className="text-sm tabular-nums text-muted">{Math.round(listened * 100)}% heard</span>
        </div>
      </section>

      {ep.question && <QuestionOptions ep={ep} guess={guess} setGuess={setGuess} />}

      <section className="space-y-4">
        <div className="flex flex-wrap gap-x-5 gap-y-1">
          <button className="link" onClick={() => setShowVocab((s) => !s)}>
            {showVocab ? "hide vocabulary" : `vocabulary (${ep.vocab.length})`}
          </button>
          {ep.worksheetPdf && <a className="link" href={ep.worksheetPdf} target="_blank" rel="noreferrer">worksheet</a>}
          {ep.transcriptPdf && <a className="link" href={ep.transcriptPdf} target="_blank" rel="noreferrer">transcript pdf</a>}
          <a className="link" href={`https://www.bbc.co.uk${ep.path}`} target="_blank" rel="noreferrer">bbc</a>
        </div>
        {showVocab && (
          <dl className="enter-stagger space-y-3 text-sm">
            {ep.vocab.map((v) => (
              <div key={v.term}>
                <dt>{v.term}</dt>
                <dd className="text-muted">{v.definition}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>
    </div>
  );
}
