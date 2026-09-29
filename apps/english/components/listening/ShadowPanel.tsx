"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { EpisodeDetail } from "@/lib/types";
import { NeedsTimings } from "./EpisodeClient";
import { usePlayer } from "../player";

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
    <div className="grid gap-10 md:grid-cols-[1fr_300px]">
      <div className="space-y-10">
        <section>
          <p className="flex items-center justify-between text-sm text-muted">
            <span>
              <span className="text-foreground tabular-nums">{idx + 1}</span> / {ep.sentences.length} · {current.speaker}
            </span>
            {phase !== "idle" && <span className="tabular-nums">{rep}/{repeats}</span>}
          </p>
          <p
            key={idx}
            className={`fade mt-6 min-h-24 text-3xl font-light leading-snug text-balance transition duration-500 ${showText ? "" : "cursor-pointer blur-md select-none"}`}
            onClick={() => setShowText(true)}
          >
            {current.text}
          </p>
          <p
            className={`mt-6 flex items-center gap-2 text-sm transition-colors duration-300 ${phase === "speak" ? "text-accent" : "text-muted"}`}
            aria-live="polite"
          >
            <span
              className={`h-2 w-2 rounded-full transition-colors duration-300 ${
                phase === "speak" ? "animate-pulse bg-accent" : phase === "listen" ? "bg-foreground" : "bg-line"
              }`}
            />
            {phase === "listen" ? "Listen" : phase === "speak" ? `Your turn${recording ? " · recording" : ""}` : "Ready"}
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
            {phase === "idle" ? (
              <button className="btn-primary" onClick={() => start(idx)}>▶ Start shadowing</button>
            ) : (
              <button className="btn-primary" onClick={stop}>■ Stop</button>
            )}
            {!recording ? (
              <button className="btn" onClick={() => startRecording(idx).catch((e) => alert(`Microphone unavailable: ${e.message}`))} disabled={phase !== "idle"}>
                ● Record
              </button>
            ) : (
              <button className="btn text-accent" onClick={stopRecording}>■ Stop recording</button>
            )}
            <button className="btn" onClick={() => playMine(idx)} disabled={!recordings[idx]}>▶ Mine</button>
            <button className="link" onClick={() => playSentence(idx)} disabled={phase !== "idle"}>play once</button>
            <button className="link" onClick={() => compareBoth(idx)} disabled={!recordings[idx] || phase !== "idle"}>original → mine</button>
          </div>
        </section>

        <details>
          <summary>settings</summary>
          <div className="mt-5 grid gap-5 text-sm sm:grid-cols-2">
            <label className="space-y-2">
              <span className="block text-muted">Repeats · {repeats}</span>
              <input type="range" min={1} max={5} value={repeats} onChange={(e) => setRepeats(Number(e.target.value))} className="scrub" style={{ "--pct": `${((repeats - 1) / 4) * 100}%` } as React.CSSProperties} />
            </label>
            <label className="space-y-2">
              <span className="block text-muted">Your pause · {gap.toFixed(1)}× sentence</span>
              <input type="range" min={0.8} max={2.5} step={0.1} value={gap} onChange={(e) => setGap(Number(e.target.value))} className="scrub" style={{ "--pct": `${((gap - 0.8) / 1.7) * 100}%` } as React.CSSProperties} />
            </label>
            <label className="flex items-center gap-2 text-muted">
              <input type="checkbox" checked={showText} onChange={(e) => setShowText(e.target.checked)} className="accent-[var(--accent)]" />
              Show text
            </label>
            <label className="flex items-center gap-2 text-muted">
              <input type="checkbox" checked={autoRecord} onChange={(e) => setAutoRecord(e.target.checked)} className="accent-[var(--accent)]" />
              Auto-record my turn
            </label>
            <p className="text-xs text-muted/70 sm:col-span-2">Start with text on at 0.8–0.9×, then shadow blind at 1×. Recordings stay in this tab only.</p>
          </div>
        </details>
      </div>

      <aside className="max-h-[70vh] overflow-y-auto">
        <ol ref={listRef} className="space-y-0.5">
          {ep.sentences.map((s) => (
            <li key={s.idx} data-idx={s.idx}>
              <button
                onClick={() => phase === "idle" && setIdx(s.idx)}
                className={`w-full rounded-lg px-3 py-1.5 text-left text-sm transition ${
                  s.idx === idx ? "bg-surface text-foreground" : "text-muted hover:text-foreground"
                }`}
              >
                <span className="mr-2 font-mono text-[10px] tabular-nums text-muted">{s.idx + 1}</span>
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
