"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { EpisodeDetail } from "@/lib/types";
import { NeedsTimings } from "./EpisodeClient";
import { usePlayer } from "./player";

type Phase = "idle" | "listen" | "speak";

export function ShadowPanel({ ep }: { ep: EpisodeDetail }) {
  const p = usePlayer();
  const { playSentence, stopRange, setReplayHandler, timings, rate } = p;
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [rep, setRep] = useState(0);
  const [repeats, setRepeats] = useState(2);
  const [gap, setGap] = useState(1.2);
  const [showText, setShowText] = useState(true);
  const [autoRecord, setAutoRecord] = useState(false);
  const [recordings, setRecordings] = useState<Record<number, string>>({});
  const [recording, setRecording] = useState(false);
  const runRef = useRef(0);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${idx}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [idx]);

  useEffect(() => {
    setReplayHandler(() => void playSentence(idx));
    return () => setReplayHandler(null);
  }, [setReplayHandler, playSentence, idx]);

  // stop everything when leaving the tab
  useEffect(
    () => () => {
      runRef.current++;
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  const getStream = async () => {
    if (!streamRef.current) streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
    return streamRef.current;
  };

  const startRecording = useCallback(async (i: number) => {
    const stream = await getStream();
    const rec = new MediaRecorder(stream);
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => chunks.push(e.data);
    rec.onstop = () => {
      const url = URL.createObjectURL(new Blob(chunks, { type: rec.mimeType }));
      setRecordings((r) => {
        if (r[i]) URL.revokeObjectURL(r[i]);
        return { ...r, [i]: url };
      });
      setRecording(false);
    };
    recorderRef.current = rec;
    rec.start();
    setRecording(true);
  }, []);

  const stopRecording = useCallback(() => {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }, []);

  const wait = (ms: number, run: number) =>
    new Promise<boolean>((resolve) => {
      const started = Date.now();
      const tick = () => {
        if (runRef.current !== run) return resolve(false);
        if (Date.now() - started >= ms) return resolve(true);
        setTimeout(tick, 50);
      };
      tick();
    });

  const start = async (from: number) => {
    if (!timings) return;
    const run = ++runRef.current;
    for (let i = from; i < ep.sentences.length; i++) {
      setIdx(i);
      const t = timings[i];
      const len = ((t.end - t.start) / rate) * 1000;
      for (let r = 0; r < repeats; r++) {
        setRep(r + 1);
        setPhase("listen");
        const finished = await playSentence(i);
        if (!finished || runRef.current !== run) return setPhase("idle");
        setPhase("speak");
        if (autoRecord) await startRecording(i).catch(() => setAutoRecord(false));
        const ok = await wait(len * gap + 400, run);
        if (autoRecord) stopRecording();
        if (!ok) return setPhase("idle");
      }
    }
    setPhase("idle");
  };

  const stop = () => {
    runRef.current++;
    stopRange();
    stopRecording();
    setPhase("idle");
  };

  if (!timings) return <NeedsTimings />;

  const playMine = (i: number) => {
    const url = recordings[i];
    if (url) void new Audio(url).play();
  };
  const compareBoth = async (i: number) => {
    await playSentence(i);
    playMine(i);
  };

  const current = ep.sentences[idx];

  return (
    <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <section className="card p-6">
          <div className="flex items-center justify-between text-sm text-muted">
            <span>
              Sentence {idx + 1} / {ep.sentences.length} · {current.speaker}
            </span>
            {phase !== "idle" && (
              <span>
                Repeat {rep}/{repeats}
              </span>
            )}
          </div>
          <p
            className={`mt-4 min-h-24 text-2xl leading-snug text-balance transition ${showText ? "" : "blur-md select-none"}`}
            onClick={() => setShowText(true)}
          >
            {current.text}
          </p>
          <div
            className={`mt-4 rounded-lg px-4 py-3 text-center text-sm font-medium ${
              phase === "listen" ? "bg-surface-2" : phase === "speak" ? "bg-accent-soft text-accent" : "bg-surface-2 text-muted"
            }`}
            aria-live="polite"
          >
            {phase === "listen" ? "🎧 Listen…" : phase === "speak" ? `🗣 Your turn. Say it out loud${recording ? " (recording)" : ""}` : "Ready"}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {phase === "idle" ? (
              <button className="btn-primary" onClick={() => start(idx)}>▶ Start shadowing from here</button>
            ) : (
              <button className="btn-primary" onClick={stop}>■ Stop</button>
            )}
            <button className="btn" onClick={() => playSentence(idx)} disabled={phase !== "idle"}>Play once</button>
            <button className="btn" onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={phase !== "idle" || idx === 0}>← Prev</button>
            <button className="btn" onClick={() => setIdx((i) => Math.min(ep.sentences.length - 1, i + 1))} disabled={phase !== "idle"}>Next →</button>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
            {!recording ? (
              <button className="btn" onClick={() => startRecording(idx).catch((e) => alert(`Microphone unavailable: ${e.message}`))} disabled={phase !== "idle"}>
                ● Record myself
              </button>
            ) : (
              <button className="btn border-accent text-accent" onClick={stopRecording}>■ Stop recording</button>
            )}
            <button className="btn" onClick={() => playMine(idx)} disabled={!recordings[idx]}>▶ My voice</button>
            <button className="btn" onClick={() => compareBoth(idx)} disabled={!recordings[idx] || phase !== "idle"}>Original → mine</button>
          </div>
        </section>

        <section className="card grid gap-4 p-5 text-sm sm:grid-cols-2">
          <label className="space-y-1">
            <span className="block font-medium">Repeats per sentence: {repeats}</span>
            <input type="range" min={1} max={5} value={repeats} onChange={(e) => setRepeats(Number(e.target.value))} className="w-full accent-[var(--accent)]" />
          </label>
          <label className="space-y-1">
            <span className="block font-medium">Pause for you: {gap.toFixed(1)}× sentence length</span>
            <input type="range" min={0.8} max={2.5} step={0.1} value={gap} onChange={(e) => setGap(Number(e.target.value))} className="w-full accent-[var(--accent)]" />
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={showText} onChange={(e) => setShowText(e.target.checked)} className="accent-[var(--accent)]" />
            Show text (turn off for blind shadowing)
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={autoRecord} onChange={(e) => setAutoRecord(e.target.checked)} className="accent-[var(--accent)]" />
            Auto-record my turn
          </label>
          <p className="text-xs text-muted sm:col-span-2">
            Tip: start with text on at 0.8–0.9×, then shadow blind at 1×. Recordings stay in this tab only and aren&apos;t saved.
          </p>
        </section>
      </div>

      <aside className="card max-h-[70vh] overflow-y-auto p-2">
        <ol ref={listRef} className="space-y-0.5">
          {ep.sentences.map((s) => (
            <li key={s.idx} data-idx={s.idx}>
              <button
                onClick={() => phase === "idle" && setIdx(s.idx)}
                className={`w-full rounded-md px-2 py-1.5 text-left text-sm ${
                  s.idx === idx ? "bg-surface-2 font-medium" : "text-muted hover:bg-surface-2"
                }`}
              >
                <span className="mr-2 font-mono text-xs tabular-nums">{s.idx + 1}</span>
                {s.text}
                {recordings[s.idx] && <span className="ml-1 text-accent">●</span>}
              </button>
            </li>
          ))}
        </ol>
      </aside>
    </div>
  );
}
