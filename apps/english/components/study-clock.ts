"use client";

import { useEffect, useRef } from "react";
import type { Skill } from "@/lib/study-time";
import { useFocus } from "./focus-context";

const IDLE_MS = 120_000;
const FLUSH_S = 30;

// Recorders register here so a long take with no mouse/keys still counts as study time
const recorders = new Set<MediaRecorder>();
export function trackRecorder(rec: MediaRecorder) {
  recorders.add(rec);
  rec.addEventListener("stop", () => recorders.delete(rec));
}

function busy() {
  if ([...recorders].some((r) => r.state === "recording")) return true;
  return [...document.querySelectorAll("audio")].some((a) => !a.paused && !a.ended);
}

function send(skill: Skill, seconds: number, beacon: boolean) {
  if (!seconds) return;
  const body = JSON.stringify({ skill, seconds });
  if (beacon && navigator.sendBeacon?.("/api/time", body)) return;
  void fetch("/api/time", { method: "POST", body, keepalive: true }).catch(() => {});
}

/** Counts active seconds on a study screen: tab visible, focus not paused, and recent input, audio or recording. */
export function useStudyClock(skill: Skill) {
  const { paused } = useFocus();
  const pausedRef = useRef(paused);
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    let lastInput = Date.now();
    let pending = 0;
    const onInput = () => (lastInput = Date.now());
    const flush = (beacon: boolean) => {
      send(skill, pending, beacon);
      pending = 0;
    };
    const onHide = () => document.visibilityState === "hidden" && flush(true);
    const onPageHide = () => flush(true);

    const timer = setInterval(() => {
      if (document.visibilityState !== "visible" || pausedRef.current) return;
      if (Date.now() - lastInput > IDLE_MS && !busy()) return;
      if (++pending >= FLUSH_S) flush(false);
    }, 1000);

    const events = ["pointerdown", "pointermove", "keydown", "wheel", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, onInput, { passive: true }));
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      clearInterval(timer);
      events.forEach((e) => window.removeEventListener(e, onInput));
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
      flush(true);
    };
  }, [skill]);
}
