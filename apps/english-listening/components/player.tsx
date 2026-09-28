"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Timing } from "@/lib/types";

type Range = { start: number; end: number; loop: boolean; onEnd?: () => void };

type Player = {
  time: number;
  duration: number;
  playing: boolean;
  rate: number;
  abLoop: { a: number; b: number | null } | null;
  timings: Timing[] | null;
  currentIdx: number; // sentence under the playhead (-1 if unknown)
  rangeActive: boolean;
  toggle: () => void;
  play: () => void;
  pause: () => void;
  seek: (t: number) => void;
  skip: (delta: number) => void;
  setRate: (r: number) => void;
  /** Play [start, end) then pause (or loop). Resolves when the range finishes or is interrupted. */
  playRange: (start: number, end: number, opts?: { loop?: boolean }) => Promise<boolean>;
  playSentence: (idx: number, opts?: { loop?: boolean }) => Promise<boolean>;
  stopRange: () => void;
  markLoop: () => void;
  clearLoop: () => void;
  /** Let the active panel decide what "replay" (R / Ctrl+Space in inputs) does. */
  setReplayHandler: (fn: (() => void) | null) => void;
};

const Ctx = createContext<Player | null>(null);

export function usePlayer() {
  const p = useContext(Ctx);
  if (!p) throw new Error("usePlayer outside PlayerProvider");
  return p;
}

const RATES = [0.5, 0.6, 0.7, 0.75, 0.8, 0.9, 1, 1.1, 1.2, 1.25, 1.5];

export function PlayerProvider({
  src,
  timings,
  children,
}: {
  src: string;
  timings: Timing[] | null;
  children: React.ReactNode;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rangeRef = useRef<(Range & { resolve: (finished: boolean) => void }) | null>(null);
  const abRef = useRef<{ a: number; b: number | null } | null>(null);
  const replayRef = useRef<(() => void) | null>(null);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  // Only mounted in the browser (after the episode loads), so reading storage here is safe
  const [rate, setRateState] = useState(() => {
    try {
      const saved = Number(localStorage.getItem("player-rate"));
      return saved && RATES.includes(saved) ? saved : 1;
    } catch {
      return 1;
    }
  });
  const [abLoop, setAbLoop] = useState<{ a: number; b: number | null } | null>(null);
  const [rangeActive, setRangeActive] = useState(false);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = rate;
  }, [rate]);

  const finishRange = useCallback((finished: boolean) => {
    const r = rangeRef.current;
    rangeRef.current = null;
    setRangeActive(false);
    r?.resolve(finished);
  }, []);

  // High-frequency playhead check so sentence ranges stop precisely
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = -1;
    const tick = () => {
      const a = audioRef.current;
      if (a) {
        const t = a.currentTime;
        const r = rangeRef.current;
        if (r && t >= r.end) {
          if (r.loop) a.currentTime = r.start;
          else {
            a.pause();
            finishRange(true);
          }
        }
        const ab = abRef.current;
        if (!r && ab && ab.b !== null && t >= ab.b) a.currentTime = ab.a;
        if (Math.abs(t - last) >= 0.1) {
          last = t;
          setTime(t);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, finishRange]);

  const play = useCallback(() => void audioRef.current?.play().catch(() => {}), []);
  const pause = useCallback(() => audioRef.current?.pause(), []);
  const toggle = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) void a.play().catch(() => {});
    else a.pause();
  }, []);
  const seek = useCallback((t: number) => {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = Math.max(0, Math.min(t, a.duration || t));
    setTime(a.currentTime);
  }, []);
  const skip = useCallback(
    (d: number) => {
      if (rangeRef.current) finishRange(false);
      seek((audioRef.current?.currentTime ?? 0) + d);
    },
    [seek, finishRange],
  );
  const setRate = useCallback((r: number) => {
    setRateState(r);
    try {
      localStorage.setItem("player-rate", String(r));
    } catch {
      // storage unavailable
    }
  }, []);

  const playRange = useCallback(
    (start: number, end: number, opts?: { loop?: boolean }) => {
      if (rangeRef.current) finishRange(false);
      return new Promise<boolean>((resolve) => {
        rangeRef.current = { start, end, loop: !!opts?.loop, resolve };
        setRangeActive(true);
        seek(start);
        play();
      });
    },
    [finishRange, seek, play],
  );

  const playSentence = useCallback(
    (idx: number, opts?: { loop?: boolean }) => {
      const t = timings?.[idx];
      if (!t) return Promise.resolve(false);
      return playRange(t.start, t.end, opts);
    },
    [timings, playRange],
  );

  const stopRange = useCallback(() => {
    if (rangeRef.current) {
      audioRef.current?.pause();
      finishRange(false);
    }
  }, [finishRange]);

  const markLoop = useCallback(() => {
    const t = audioRef.current?.currentTime ?? 0;
    const cur = abRef.current;
    const next = !cur || cur.b !== null ? { a: t, b: null } : t > cur.a ? { a: cur.a, b: t } : { a: t, b: null };
    abRef.current = next;
    setAbLoop(next);
  }, []);
  const clearLoop = useCallback(() => {
    abRef.current = null;
    setAbLoop(null);
  }, []);

  const currentIdx = useMemo(() => {
    if (!timings) return -1;
    let lo = 0;
    let hi = timings.length - 1;
    let ans = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (timings[mid].start <= time + 0.05) {
        ans = mid;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    return ans;
  }, [timings, time]);

  const replayCurrent = useCallback(() => {
    if (replayRef.current) return replayRef.current();
    if (currentIdx >= 0) void playSentence(currentIdx);
  }, [currentIdx, playSentence]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing = !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
      if (typing) {
        // inside text boxes only Ctrl-combos control the audio
        if (!e.ctrlKey) return;
        if (e.code === "Space") {
          e.preventDefault();
          replayCurrent();
        } else if (e.key === "[" || e.code === "BracketLeft") {
          e.preventDefault();
          skip(-5);
        } else if (e.key === "]" || e.code === "BracketRight") {
          e.preventDefault();
          skip(5);
        } else if (e.key === "p") {
          e.preventDefault();
          toggle();
        }
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const idx = RATES.indexOf(rate);
      switch (e.key) {
        case " ":
          e.preventDefault();
          if (rangeRef.current) stopRange();
          else toggle();
          break;
        case "ArrowLeft":
          e.preventDefault();
          skip(e.shiftKey ? -10 : -5);
          break;
        case "ArrowRight":
          e.preventDefault();
          skip(e.shiftKey ? 10 : 5);
          break;
        case "[":
          setRate(RATES[Math.max(0, (idx < 0 ? 6 : idx) - 1)]);
          break;
        case "]":
          setRate(RATES[Math.min(RATES.length - 1, (idx < 0 ? 6 : idx) + 1)]);
          break;
        case "r":
        case "R":
          replayCurrent();
          break;
        case "l":
        case "L":
          markLoop();
          break;
        case "Escape":
          clearLoop();
          stopRange();
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rate, replayCurrent, skip, toggle, setRate, markLoop, clearLoop, stopRange]);

  const value: Player = {
    time, duration, playing, rate, abLoop, timings, currentIdx, rangeActive,
    toggle, play, pause, seek, skip, setRate, playRange, playSentence, stopRange, markLoop, clearLoop,
    setReplayHandler: useCallback((fn) => void (replayRef.current = fn), []),
  };

  return (
    <Ctx.Provider value={value}>
      <audio
        ref={audioRef}
        src={src}
        preload="auto"
        onLoadedMetadata={(e) => {
          setDuration(e.currentTarget.duration);
          e.currentTarget.playbackRate = rate;
        }}
        onPlay={() => setPlaying(true)}
        onPause={() => {
          setPlaying(false);
          setTime(audioRef.current?.currentTime ?? 0);
        }}
        onSeeked={(e) => setTime(e.currentTarget.currentTime)}
        onEnded={() => {
          setPlaying(false);
          if (rangeRef.current) finishRange(true);
        }}
      />
      {children}
    </Ctx.Provider>
  );
}

export function fmt(t: number) {
  if (!Number.isFinite(t)) return "0:00";
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function PlayerBar() {
  const p = usePlayer();
  const [showKeys, setShowKeys] = useState(false);
  return (
    <div className="sticky bottom-0 z-20 border-t border-line bg-surface/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="w-10 text-right font-mono text-xs tabular-nums text-muted">{fmt(p.time)}</span>
          <div className="relative flex-1">
            {p.abLoop && p.duration > 0 && (
              <div
                className="pointer-events-none absolute top-1/2 h-2 -translate-y-1/2 rounded bg-accent/25"
                style={{
                  left: `${(p.abLoop.a / p.duration) * 100}%`,
                  width: `${(((p.abLoop.b ?? p.time) - p.abLoop.a) / p.duration) * 100}%`,
                }}
              />
            )}
            <input
              type="range"
              aria-label="Seek"
              min={0}
              max={p.duration || 0}
              step={0.1}
              value={p.time}
              onChange={(e) => p.seek(Number(e.target.value))}
              className="w-full accent-[var(--accent)]"
            />
          </div>
          <span className="w-10 font-mono text-xs tabular-nums text-muted">{fmt(p.duration)}</span>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          <button className="btn" onClick={() => p.skip(-10)} title="Back 10s (Shift+←)">−10</button>
          <button className="btn" onClick={() => p.skip(-5)} title="Back 5s (←)">−5</button>
          <button
            className="btn-primary min-w-20"
            onClick={() => (p.rangeActive ? p.stopRange() : p.toggle())}
            title="Play / pause (Space)"
          >
            {p.playing ? "Pause" : "Play"}
          </button>
          <button className="btn" onClick={() => p.skip(5)} title="Forward 5s (→)">+5</button>
          <button className="btn" onClick={() => p.skip(10)} title="Forward 10s (Shift+→)">+10</button>
          <span className="mx-1 h-5 w-px bg-line" />
          <select
            aria-label="Speed"
            className="btn pr-2"
            value={p.rate}
            onChange={(e) => p.setRate(Number(e.target.value))}
            title="Speed ([ and ])"
          >
            {RATES.map((r) => (
              <option key={r} value={r}>
                {r}×
              </option>
            ))}
          </select>
          <button
            className={`btn ${p.abLoop ? "border-accent text-accent" : ""}`}
            onClick={p.markLoop}
            title="Set loop start, then loop end (L)"
          >
            {!p.abLoop ? "Loop A" : p.abLoop.b === null ? "Loop B" : `A–B ${fmt(p.abLoop.a)}–${fmt(p.abLoop.b)}`}
          </button>
          {p.abLoop && (
            <button className="btn" onClick={p.clearLoop} title="Clear loop (Esc)">✕</button>
          )}
          {p.timings && (
            <button className="btn" onClick={() => p.currentIdx >= 0 && p.playSentence(p.currentIdx)} title="Replay sentence (R)">
              ↺ Sentence
            </button>
          )}
          <button className="btn" onClick={() => setShowKeys((s) => !s)} aria-expanded={showKeys}>
            ⌨
          </button>
        </div>
        {showKeys && (
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted">
            <span><kbd className="kbd">Space</kbd> play/pause</span>
            <span><kbd className="kbd">←</kbd>/<kbd className="kbd">→</kbd> ±5s (Shift ±10s)</span>
            <span><kbd className="kbd">[</kbd>/<kbd className="kbd">]</kbd> speed</span>
            <span><kbd className="kbd">R</kbd> replay sentence</span>
            <span><kbd className="kbd">L</kbd> loop A→B</span>
            <span><kbd className="kbd">Esc</kbd> clear loop</span>
            <span>In a text box: <kbd className="kbd">Ctrl+Space</kbd> replay, <kbd className="kbd">Ctrl+[</kbd>/<kbd className="kbd">]</kbd> ±5s, <kbd className="kbd">Ctrl+P</kbd> play/pause</span>
          </div>
        )}
      </div>
    </div>
  );
}
