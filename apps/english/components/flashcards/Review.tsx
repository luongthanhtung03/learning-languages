"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/client";
import type { Checks } from "@/lib/flashcards/evaluate";
import type { Pattern } from "@/lib/flashcards/patterns";
import { RATING_LABEL, suggestRating, type Rating } from "@/lib/flashcards/schedule";
import type { Card, Review as ReviewRow } from "@/lib/flashcards/store";
import { termRegex } from "@/lib/listening/vocab";
import type { WhisperJob } from "@/lib/whisper";
import { useFocus } from "../focus-context";
import { MicLevel } from "../speaking/bits";
import { fmtClock, useCountdown, useRecorder } from "../speaking/hooks";

const MAX_SECONDS = 30;

type Item = { card: Card; pattern: Omit<Pattern, "detect"> };
type Session = { session: 1 | 2; status: { left: number; cap: number; reviewedToday: number; dueNow: number }; items: Item[] };
type Phase = "front" | "recording" | "uploading" | "listen" | "back";
type Self = { meaningWrong?: boolean; notFluent?: boolean; easy?: boolean };

/** One review session: for each card, say a sentence with the word + a pattern, listen back, flip, rate. */
export function Review({ session = 1, onDone }: { session?: 1 | 2; onDone?: () => void }) {
  const [data, setData] = useState<Session | null>(null);
  const [idx, setIdx] = useState(0);
  const [results, setResults] = useState<{ pattern: string; ok: boolean; rating: Rating }[]>([]);

  useEffect(() => {
    api<Session>(`/api/cards/session?n=${session}`).then(setData);
  }, [session]);

  if (!data) return <p className="fade text-muted">Loading cards…</p>;
  const total = data.items.length;
  if (idx >= total)
    return <Summary total={total} results={results} empty={total === 0} onDone={onDone} />;

  const item = data.items[idx];
  return (
    <CardReview
      key={item.card.id}
      item={item}
      position={`${idx + 1} / ${total}`}
      onRated={(r) => {
        setResults((xs) => [...xs, r]);
        setIdx((i) => i + 1);
        if (idx + 1 >= total) onDone?.();
      }}
    />
  );
}

function CardReview({ item, position, onRated }: { item: Item; position: string; onRated: (r: { pattern: string; ok: boolean; rating: Rating }) => void }) {
  const { card, pattern } = item;
  const { paused } = useFocus();
  const mic = useRecorder();
  const { pause: pauseMic, resume: resumeMic } = mic;
  const [phase, setPhase] = useState<Phase>("front");
  const [review, setReview] = useState<ReviewRow | null>(null);
  const [job, setJob] = useState<WhisperJob | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const [self, setSelf] = useState<Self>({});
  const [saving, setSaving] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (phase !== "recording") return;
    if (paused) pauseMic();
    else resumeMic();
  }, [paused, phase, pauseMic, resumeMic]);

  const stop = useCallback(async () => {
    setPhase("uploading");
    const blob = await mic.stop();
    if (!blob) return setPhase("front");
    const form = new FormData();
    form.set("patternId", pattern.id);
    form.set("audio", blob, "card.webm");
    const res = await fetch(`/api/cards/${card.id}/reviews`, { method: "POST", body: form });
    setReview((await res.json()) as ReviewRow);
    setDraft(null);
    setPhase("listen");
  }, [mic, pattern.id, card.id]);

  const left = useCountdown(MAX_SECONDS, phase === "recording" && !paused, () => void stop(), `rec-${card.id}-${review?.id ?? 0}`);

  // poll while Whisper + the grammar check run
  const pending = review?.status === "pending";
  useEffect(() => {
    if (!pending || !review) return;
    const t = setInterval(async () => {
      const r = await api<{ review: ReviewRow; job: WhisperJob | null }>(`/api/cards/reviews/${review.id}`);
      setJob(r.job);
      if (r.review.status !== "pending") setReview(r.review);
    }, 1500);
    return () => clearInterval(t);
  }, [pending, review]);

  const record = async () => {
    if (!(await mic.prepare())) return;
    mic.start();
    setPhase("recording");
  };

  const recheck = async () => {
    if (!review || draft === null || draft === review.transcript) return;
    const r = await api<{ review: ReviewRow }>(`/api/cards/reviews/${review.id}`, { method: "PATCH", json: { transcript: draft } });
    setReview(r.review);
  };

  const checks: Checks | null = review?.checks ?? null;
  const suggested = suggestRating({
    wordUsed: checks?.wordUsed ?? null,
    patternUsed: checks?.patternUsed ?? null,
    grammarIssues: checks?.grammarIssues?.length ?? null,
    ...self,
  });

  const rate = async (rating: Rating) => {
    if (!review) return;
    setSaving(true);
    await api(`/api/cards/reviews/${review.id}`, { method: "POST", json: { rating, self } });
    const patternOk = (checks?.patternUsed ?? rating >= 2) && !(checks?.grammarIssues?.length ?? 0);
    onRated({ pattern: pattern.label, ok: patternOk, rating });
  };

  const front = (
    <div className="space-y-6">
      <p className="text-sm tabular-nums text-muted">{position}</p>
      <h2 className="text-5xl font-semibold tracking-tight">{card.term}</h2>
      <div className="space-y-1">
        <p className="text-lg">
          <span className="text-muted">Say a sentence with </span>
          <span className="text-accent">{pattern.label}</span>
        </p>
        <p className="text-sm italic text-muted/70">e.g. {pattern.example}</p>
      </div>
    </div>
  );

  if (phase === "front" || phase === "recording" || phase === "uploading")
    return (
      <div key="front" className="enter max-w-3xl space-y-10">
        {front}
        {mic.error && <p className="text-sm text-bad">Microphone: {mic.error}</p>}
        {phase === "front" && <button className="btn-primary px-8 py-3 text-base" onClick={record}>● Record</button>}
        {phase === "recording" && (
          <div className="flex flex-wrap items-center gap-6">
            <button className="btn-primary px-8 py-3 text-base shadow-[0_0_32px_-6px_var(--accent)]" onClick={() => void stop()}>■ Stop</button>
            <span className="flex items-center gap-2 font-mono text-sm tabular-nums text-accent">
              <span className="h-2 w-2 animate-pulse rounded-full bg-accent" /> {fmtClock(left)}
            </span>
            <MicLevel level={mic.level} />
          </div>
        )}
        {phase === "uploading" && <p className="animate-pulse text-muted">Saving…</p>}
      </div>
    );

  const audioSrc = review ? `/api/cards/reviews/${review.id}/audio` : undefined;

  if (phase === "listen")
    return (
      <div key="listen" className="enter max-w-3xl space-y-10">
        {front}
        <div className="space-y-4">
          <p className="text-sm text-muted">Listen to yourself first. Was the word right? Did you use the pattern?</p>
          <audio ref={audioRef} src={audioSrc} autoPlay controls className="h-9 w-full max-w-md" />
          <div className="flex flex-wrap items-center gap-6">
            <button className="btn-primary px-8 py-3 text-base" onClick={() => setPhase("back")}>Flip</button>
            <button className="link" onClick={() => (setReview(null), setPhase("front"))}>record again</button>
          </div>
        </div>
      </div>
    );

  // back
  return (
    <div key="back" className="flip max-w-3xl space-y-10">
      <div className="space-y-3">
        <p className="text-sm text-muted">
          {position} · {card.kind === "phrase" ? "your phrase" : "word"} · {card.source_title}
        </p>
        <h2 className="text-4xl font-semibold tracking-tight">{card.term}</h2>
        {card.definition && <p className="text-lg text-foreground/85">{card.definition}</p>}
        {card.example && <Example text={card.example} term={card.term} />}
      </div>

      <section className="space-y-4">
        <div className="flex items-center gap-4">
          <h3 className="text-sm text-muted">You said</h3>
          {audioSrc && <button className="link" onClick={() => void new Audio(audioSrc).play()}>▶ play</button>}
        </div>
        {review?.status === "pending" ? (
          <p className="animate-pulse text-muted">
            Transcribing{job?.stage === "checking grammar" ? " · checking grammar" : ""}… {Math.round((job?.progress ?? 0) * 100)}%
          </p>
        ) : review?.status === "error" ? (
          <p className="text-sm text-bad">Transcription failed: {review.error}. Rate it from what you heard.</p>
        ) : (
          <>
            <textarea
              className="input min-h-20 text-lg leading-relaxed"
              value={draft ?? review?.transcript ?? ""}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => void recheck()}
              spellCheck={false}
            />
            <p className="text-xs text-muted/70">Whisper tends to tidy up mistakes. Edit this to exactly what you said, then click outside to re-check.</p>
            {checks && <CheckList checks={checks} />}
          </>
        )}
      </section>

      <section className="space-y-6">
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <Tick on={!!self.meaningWrong} onClick={() => setSelf((s) => ({ ...s, meaningWrong: !s.meaningWrong }))}>meaning was wrong</Tick>
          <Tick on={!!self.notFluent} onClick={() => setSelf((s) => ({ ...s, notFluent: !s.notFluent }))}>not fluent</Tick>
          <Tick on={!!self.easy} onClick={() => setSelf((s) => ({ ...s, easy: !s.easy }))}>felt easy</Tick>
        </div>
        <div className="flex flex-wrap gap-3">
          {RATING_LABEL.map((label, r) => (
            <button
              key={label}
              disabled={saving || !review}
              onClick={() => void rate(r as Rating)}
              className={`rounded-full px-5 py-2 text-sm transition duration-200 active:scale-[.97] disabled:opacity-30 ${
                r === suggested ? "bg-accent text-background hover:shadow-[0_0_24px_-4px_var(--accent)]" : "bg-surface text-muted hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function Example({ text, term }: { text: string; term: string }) {
  const parts = useMemo(() => {
    const re = termRegex(term);
    const m = re ? text.match(re) : null;
    if (!m || m.index === undefined) return [text, "", ""];
    return [text.slice(0, m.index), m[0], text.slice(m.index + m[0].length)];
  }, [text, term]);
  return (
    <p className="border-l border-accent/50 pl-4 text-foreground/75">
      {parts[0]}
      <span className="text-accent">{parts[1]}</span>
      {parts[2]}
    </p>
  );
}

function CheckList({ checks }: { checks: Checks }) {
  const mark = (v: boolean | null, yes: string, no: string, unknown: string) =>
    v === null ? <li className="text-muted">· {unknown}</li> : <li className={v ? "text-ok" : "text-bad"}>{v ? "✓" : "✗"} {v ? yes : no}</li>;
  return (
    <ul className="enter-stagger space-y-1.5 text-sm">
      {mark(checks.wordUsed, "used the word", "the word isn't in your sentence", "word check unavailable")}
      {mark(checks.patternUsed, "used the pattern", "couldn't find the pattern", "check the pattern yourself")}
      {checks.grammarIssues === null ? (
        <li className="text-muted">· grammar check unavailable{checks.grammarError ? ` (${checks.grammarError})` : ""}</li>
      ) : checks.grammarIssues.length === 0 ? (
        <li className="text-ok">✓ no grammar issues found</li>
      ) : (
        checks.grammarIssues.map((g, i) => (
          <li key={i} className="text-bad">
            ✗ <span className="line-through decoration-bad/60">{g.text}</span>
            {g.suggestion && <span className="text-ok"> → {g.suggestion}</span>}
            <span className="text-muted"> · {g.message}</span>
          </li>
        ))
      )}
    </ul>
  );
}

function Tick({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button className={`flex items-center gap-2 transition ${on ? "text-accent" : "text-muted hover:text-foreground"}`} onClick={onClick} aria-pressed={on}>
      <span className={`h-2 w-2 rounded-full border transition ${on ? "border-accent bg-accent" : "border-line"}`} />
      {children}
    </button>
  );
}

function Summary({ total, results, empty, onDone }: { total: number; results: { pattern: string; ok: boolean; rating: Rating }[]; empty: boolean; onDone?: () => void }) {
  useEffect(() => {
    if (empty) onDone?.();
  }, [empty, onDone]);
  if (empty) return <p className="enter text-lg text-muted">No cards due. Nice.</p>;
  const missed = [...new Set(results.filter((r) => !r.ok).map((r) => r.pattern))];
  const again = results.filter((r) => r.rating === 0).length;
  return (
    <div className="enter-stagger max-w-3xl space-y-6">
      <p className="text-3xl font-light">
        {total} cards done<span className="text-accent">.</span>
      </p>
      {again > 0 && <p className="text-muted">{again} will come back tomorrow.</p>}
      {missed.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-muted">Patterns to work on</p>
          <ul className="space-y-1">
            {missed.map((m) => (
              <li key={m} className="text-accent">{m}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
