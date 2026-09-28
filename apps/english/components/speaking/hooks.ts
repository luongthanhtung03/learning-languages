"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Countdown that can be paused (focus mode) without drifting.
 * Returns seconds remaining; calls onDone once when it reaches 0.
 */
export function useCountdown(seconds: number, running: boolean, onDone: () => void, resetKey: unknown) {
  const [left, setLeft] = useState(seconds);
  const elapsedRef = useRef(0);
  const doneRef = useRef(onDone);
  const firedRef = useRef(false);
  useEffect(() => {
    doneRef.current = onDone;
  }, [onDone]);

  // restart whenever the step changes
  useEffect(() => {
    elapsedRef.current = 0;
    firedRef.current = false;
    setLeft(seconds); // eslint-disable-line react-hooks/set-state-in-effect -- resetting timer for a new step
  }, [resetKey, seconds]);

  useEffect(() => {
    if (!running) return;
    let last = performance.now();
    const id = setInterval(() => {
      const t = performance.now();
      elapsedRef.current += (t - last) / 1000;
      last = t;
      const remaining = Math.max(0, seconds - elapsedRef.current);
      setLeft(remaining);
      if (remaining <= 0 && !firedRef.current) {
        firedRef.current = true;
        doneRef.current();
      }
    }, 100);
    return () => clearInterval(id);
  }, [running, seconds, resetKey]);

  return left;
}

/** Microphone stream + MediaRecorder with pause/resume and a live input level. */
export function useRecorder() {
  const streamRef = useRef<MediaStream | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState(0);

  const prepare = useCallback(async () => {
    if (streamRef.current) return true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;
      setReady(true);
      setError(null);
      return true;
    } catch (e) {
      setError((e as Error).message || "Microphone blocked");
      return false;
    }
  }, []);

  // live level meter so you can see the mic is working
  useEffect(() => {
    if (!ready || !streamRef.current) return;
    const ctx = new AudioContext();
    const src = ctx.createMediaStreamSource(streamRef.current);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    src.connect(analyser);
    const buf = new Uint8Array(analyser.fftSize);
    let raf = 0;
    let lastSet = 0;
    const tick = (t: number) => {
      analyser.getByteTimeDomainData(buf);
      let sum = 0;
      for (const v of buf) sum += ((v - 128) / 128) ** 2;
      if (t - lastSet > 80) {
        lastSet = t;
        setLevel(Math.min(1, Math.sqrt(sum / buf.length) * 4));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      void ctx.close();
    };
  }, [ready]);

  useEffect(
    () => () => {
      if (recRef.current?.state !== "inactive") recRef.current?.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  const start = useCallback(() => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    const rec = new MediaRecorder(streamRef.current);
    rec.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
    rec.start(1000);
    recRef.current = rec;
  }, []);

  const pause = useCallback(() => {
    if (recRef.current?.state === "recording") recRef.current.pause();
  }, []);
  const resume = useCallback(() => {
    if (recRef.current?.state === "paused") recRef.current.resume();
  }, []);

  const stop = useCallback(
    () =>
      new Promise<Blob | null>((resolve) => {
        const rec = recRef.current;
        if (!rec || rec.state === "inactive") return resolve(null);
        rec.onstop = () => resolve(new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" }));
        rec.stop();
      }),
    [],
  );

  return { prepare, ready, error, level, start, pause, resume, stop };
}

export function fmtClock(s: number) {
  const v = Math.ceil(s);
  return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, "0")}`;
}
