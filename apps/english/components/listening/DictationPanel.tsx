"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { compare, type DiffPart } from "@/lib/listening/diff";
import { pct, type EpisodeProgress } from "@/lib/client";
import type { EpisodeDetail } from "@/lib/types";
import { NeedsTimings } from "./EpisodeClient";
import { usePlayer } from "../player";

export function DiffView({ parts }: { parts: DiffPart[] }) {
  return (
    <p className="leading-8">
      {parts.map((part, i) => (
        <span
          key={i}
          className={
            part.kind === "ok"
              ? "text-ok"
              : part.kind === "missing"
                ? "rounded bg-bad-soft px-0.5 font-medium text-bad underline decoration-dotted"
                : "text-muted line-through"
          }
        >
          {part.text}{" "}
        </span>
      ))}
    </p>
  );
}

function Legend() {
  return (
    <p className="flex flex-wrap gap-3 text-xs text-muted">
      <span><span className="text-ok">green</span> = heard correctly</span>
      <span><span className="rounded bg-bad-soft px-0.5 text-bad underline decoration-dotted">red</span> = missed / wrong (correct word shown)</span>
      <span><span className="line-through">struck</span> = you typed, not in transcript</span>
    </p>
  );
}

const hintOf = (text: string) => text.replace(/\b([A-Za-z])([A-Za-z']*)/g, (_, a: string, rest: string) => a + rest.replace(/[A-Za-z]/g, "_"));

export function DictationPanel({
  ep,
  progress,
  post,
}: {
  ep: EpisodeDetail;
  progress: EpisodeProgress | null;
  post: (body: object) => Promise<void>;
}) {
  const p = usePlayer();
  const [mode, setMode] = useState<"sentence" | "full">("sentence");
  if (!p.timings) return <NeedsTimings />;
  return (
    <div className="max-w-3xl space-y-8">
      <div className="flex gap-5 text-sm" role="tablist">
        {(["sentence", "full"] as const).map((m) => (
          <button
            key={m}
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={`transition ${mode === m ? "text-foreground" : "text-muted hover:text-foreground"}`}
          >
            {m === "sentence" ? "By sentence" : "Whole script"}
          </button>
        ))}
      </div>
      {mode === "sentence" ? <SentenceDictation ep={ep} progress={progress} post={post} /> : <FullDictation ep={ep} post={post} />}
    </div>
  );
}

function SentenceDictation({
  ep,
  progress,
  post,
}: {
  ep: EpisodeDetail;
  progress: EpisodeProgress | null;
  post: (body: object) => Promise<void>;
}) {
  const p = usePlayer();
  const best = useMemo(() => new Map(progress?.dictation.map((d) => [d.sentence_idx, d.best]) ?? []), [progress]);
  const [idx, setIdx] = useState(() => {
    const firstUndone = ep.sentences.find((s) => !best.has(s.idx));
    return firstUndone?.idx ?? 0;
  });
  const [text, setText] = useState("");
  const [result, setResult] = useState<ReturnType<typeof compare> | null>(null);
  const [hint, setHint] = useState(false);
  const [loop, setLoop] = useState(false);
  const [autoPlay, setAutoPlay] = useState(true);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const sentence = ep.sentences[idx];

  const { playSentence, setReplayHandler } = p;
  const playCurrent = useCallback(() => void playSentence(idx, { loop }), [playSentence, idx, loop]);

  useEffect(() => {
    setReplayHandler(playCurrent);
    return () => setReplayHandler(null);
  }, [setReplayHandler, playCurrent]);

  const go = (n: number) => {
    const next = Math.max(0, Math.min(ep.sentences.length - 1, n));
    setIdx(next);
    setText("");
    setResult(null);
    setHint(false);
    p.stopRange();
    if (autoPlay) setTimeout(() => void p.playSentence(next, { loop }), 50);
    inputRef.current?.focus();
  };

  const check = async () => {
    if (!text.trim()) return;
    const r = compare(sentence.text, text);
    setResult(r);
    p.stopRange();
    await post({ type: "dictation", sentenceIdx: idx, accuracy: r.accuracy, text, speed: p.rate });
  };

  const done = ep.sentences.filter((s) => best.has(s.idx)).length;
  const avgBest = done ? [...best.entries()].filter(([k]) => k >= 0).reduce((a, [, v]) => a + v, 0) / done : null;

  return (
    <div className="space-y-10">
      <section>
        <p className="text-sm text-muted">
          <span className="text-foreground tabular-nums">{idx + 1}</span> / {ep.sentences.length} · {sentence.speaker}
          {best.has(idx) && <> · best {pct(best.get(idx))}</>}
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2">
          <button className="btn-primary" onClick={playCurrent}>▶ Play</button>
          <Toggle on={p.rate === 0.75} onClick={() => p.setRate(p.rate === 0.75 ? 1 : 0.75)}>slow</Toggle>
          <Toggle on={loop} onClick={() => setLoop((l) => !l)}>loop</Toggle>
          <Toggle on={autoPlay} onClick={() => setAutoPlay((a) => !a)}>auto-play</Toggle>
          <Toggle on={hint} onClick={() => setHint((h) => !h)}>hint</Toggle>
        </div>
        {hint && <p className="fade mt-4 font-mono text-sm tracking-wide text-muted">{hintOf(sentence.text)}</p>}

        <textarea
          ref={inputRef}
          className="input mt-6 min-h-24 resize-y"
          placeholder="Type what you hear…"
          value={text}
          autoFocus
          spellCheck={false}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (result) go(idx + 1);
              else void check();
            }
          }}
        />
        <p className="mt-2 text-xs text-muted/70">Ctrl+Space replay · Enter check, then next</p>

        {result && (
          <div className="enter mt-6 space-y-3">
            <p className="text-2xl font-light tabular-nums">
              {Math.round(result.accuracy * 100)}% · {result.correct}/{result.total} words
            </p>
            <DiffView parts={result.parts} />
            <Legend />
          </div>
        )}

        <div className="mt-6 flex items-center gap-5">
          {!result ? (
            <button className="btn-primary" onClick={check} disabled={!text.trim()}>Check</button>
          ) : (
            <>
              <button className="btn-primary" onClick={() => go(idx + 1)} disabled={idx === ep.sentences.length - 1}>Next sentence</button>
              <button className="link" onClick={() => { setResult(null); setText(""); inputRef.current?.focus(); }}>try again</button>
            </>
          )}
        </div>
      </section>

      <details>
        <summary>
          all sentences · {done}/{ep.sentences.length} done · average {pct(avgBest)}
        </summary>
        <div className="mt-4 flex flex-wrap gap-1">
          {ep.sentences.map((s) => {
            const b = best.get(s.idx);
            const color = b === undefined ? "bg-surface text-muted" : b >= 0.9 ? "bg-ok-soft text-ok" : b >= 0.6 ? "bg-warn-soft text-warn" : "bg-bad-soft text-bad";
            return (
              <button
                key={s.idx}
                onClick={() => go(s.idx)}
                title={b === undefined ? "Not attempted" : `Best ${pct(b)}`}
                className={`h-7 w-8 rounded-md text-xs tabular-nums transition hover:brightness-125 ${color} ${s.idx === idx ? "ring-1 ring-accent" : ""}`}
              >
                {s.idx + 1}
              </button>
            );
          })}
        </div>
      </details>
    </div>
  );
}

function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button className={`text-sm transition ${on ? "text-accent" : "text-muted hover:text-foreground"}`} onClick={onClick} aria-pressed={on}>
      {children}
    </button>
  );
}

function FullDictation({ ep, post }: { ep: EpisodeDetail; post: (body: object) => Promise<void> }) {
  const p = usePlayer();
  const key = `full-dictation-${ep.id}`;
  const [text, setText] = useState(() => {
    try {
      return localStorage.getItem(key) ?? "";
    } catch {
      return "";
    }
  });
  const [result, setResult] = useState<ReturnType<typeof compare> | null>(null);

  const { toggle, setReplayHandler } = p;
  useEffect(() => {
    // Ctrl+Space in the text box = play/pause the whole programme
    setReplayHandler(toggle);
    return () => setReplayHandler(null);
  }, [toggle, setReplayHandler]);

  const save = (v: string) => {
    setText(v);
    try {
      localStorage.setItem(key, v);
    } catch {
      // storage unavailable
    }
  };

  const reference = ep.sentences.map((s) => s.text).join(" ");

  return (
    <section className="space-y-3">
      <p className="text-sm text-muted">Play the programme below and write everything you hear. Ctrl+Space play/pause · Ctrl+[ back 5s</p>
      <textarea
        className="input mt-4 min-h-80 resize-y font-[inherit] leading-relaxed"
        value={text}
        spellCheck={false}
        onChange={(e) => save(e.target.value)}
        placeholder="Start typing…"
      />
      <div className="flex flex-wrap items-center gap-5">
        <button
          className="btn-primary"
          disabled={!text.trim()}
          onClick={async () => {
            const r = compare(reference, text);
            setResult(r);
            await post({ type: "dictation", sentenceIdx: -1, accuracy: r.accuracy, text, speed: p.rate });
          }}
        >
          Compare
        </button>
        <button className="link" onClick={() => confirm("Clear your draft?") && (save(""), setResult(null))}>clear</button>
        <span className="text-xs text-muted">{text.split(/\s+/).filter(Boolean).length} words</span>
      </div>
      {result && (
        <div className="enter space-y-3">
          <p className="text-2xl font-light tabular-nums">
            {Math.round(result.accuracy * 100)}% of the transcript captured · {result.correct}/{result.total} words
          </p>
          <p className="text-xs text-muted">The BBC transcript is not word-for-word, so 100% isn&apos;t always possible.</p>
          <Legend />
          <DiffView parts={result.parts} />
        </div>
      )}
    </section>
  );
}
