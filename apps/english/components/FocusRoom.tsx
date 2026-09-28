"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { api } from "@/lib/client";
import { DAY_LABEL, itemKey, type PlanItem, type TodayPlan } from "@/lib/plan-types";
import { FocusContext } from "./focus-context";
import { EpisodeClient } from "./listening/EpisodeClient";
import { SpeakingSession } from "./speaking/SpeakingSession";
import { TranscribeTask } from "./speaking/TranscribeTask";
import { itemLabel } from "./Today";

const HOLD_MS = 5000;

// Fullscreen may already be on when this page mounts (started from Today), so remember it outside React
let enteredOnce = false;
const getEntered = () => (enteredOnce ||= !!document.fullscreenElement);

function subscribeFullscreen(cb: () => void) {
  document.addEventListener("fullscreenchange", cb);
  return () => document.removeEventListener("fullscreenchange", cb);
}

/**
 * Fullscreen room with only today's plan. Browsers always let Esc leave fullscreen,
 * so leaving pauses everything behind a "return to focus" screen instead.
 */
export function FocusRoom() {
  const router = useRouter();
  const [plan, setPlan] = useState<TodayPlan | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const isFull = useSyncExternalStore(subscribeFullscreen, () => !!document.fullscreenElement, () => false);
  const entered = useSyncExternalStore(subscribeFullscreen, getEntered, () => false);

  const refresh = useCallback(() => api<TodayPlan>("/api/plan").then(setPlan), []);

  useEffect(() => {
    api<TodayPlan>("/api/plan").then((p) => {
      setPlan(p);
      setActive((a) => a ?? itemKey(p.items.find((i) => !i.done) ?? p.items[0]));
    });
  }, []);

  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement) document.querySelectorAll("audio").forEach((a) => a.pause());
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const allDone = !!plan?.items.length && plan.items.every((i) => i.done);

  // warn before closing the tab mid-session
  useEffect(() => {
    if (!entered || allDone) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [entered, allDone]);

  const enter = () => void document.documentElement.requestFullscreen().catch(() => {});
  const leave = async () => {
    enteredOnce = false;
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
    router.push("/");
  };

  const paused = entered && !isFull;
  const current = plan?.items.find((i) => itemKey(i) === active) ?? null;

  if (!entered)
    return (
      <Gate title="Focus session" button="Enter focus (fullscreen)" onClick={enter}>
        Only today&apos;s plan will be on screen. If you leave fullscreen, everything pauses until you return.
      </Gate>
    );

  return (
    <FocusContext.Provider value={{ inFocus: true, paused }}>
      <div className="flex min-h-screen flex-col bg-background">
        <header className="sticky top-0 z-30 border-b border-line bg-surface">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-2">
            <span className="mr-2 text-sm font-semibold">
              Focus · {plan ? DAY_LABEL[plan.dayType] : ""}
            </span>
            <div className="flex flex-1 flex-wrap gap-1.5">
              {plan?.items.map((i) => (
                <button
                  key={itemKey(i)}
                  onClick={() => setActive(itemKey(i))}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition ${
                    itemKey(i) === active ? "border-foreground bg-foreground text-background" : "border-line hover:bg-surface-2"
                  }`}
                >
                  <span>{i.done ? "✓" : "○"}</span>
                  {itemLabel(i)}
                </button>
              ))}
            </div>
            {allDone ? (
              <button className="btn-primary" onClick={leave}>Leave focus ✓</button>
            ) : (
              <HoldButton onDone={leave} />
            )}
          </div>
        </header>

        <div className={paused ? "pointer-events-none select-none blur-sm" : ""} aria-hidden={paused}>
          {current ? (
            <FocusItem key={itemKey(current)} item={current} onChange={refresh} />
          ) : (
            <p className="p-8 text-center text-muted">Nothing planned today.</p>
          )}
          {allDone && (
            <div className="mx-auto max-w-3xl px-4 pb-10 text-center">
              <p className="rounded-xl bg-ok-soft p-6 text-lg font-medium text-ok">Everything for today is done. Great work.</p>
            </div>
          )}
        </div>

        {paused && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 p-6">
            <div className="max-w-md space-y-4 text-center">
              <p className="text-4xl">⏸</p>
              <h2 className="text-2xl font-semibold">Focus paused</h2>
              <p className="text-muted">Timers, recording and audio are frozen. Come back to finish today&apos;s session.</p>
              <button className="btn-primary px-6 py-3 text-base" onClick={enter} autoFocus>Return to focus</button>
            </div>
          </div>
        )}
      </div>
    </FocusContext.Provider>
  );
}

function FocusItem({ item, onChange }: { item: PlanItem; onChange: () => void }) {
  if (item.kind === "listening")
    return <EpisodeClient id={item.episodeId} focus initialMode={item.mode} onStatusChange={onChange} />;
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      {item.kind === "speaking" ? (
        <SpeakingSession topicNo={item.topicNo} kind={item.sessionKind} onDone={onChange} />
      ) : (
        <TranscribeTask recordingId={item.recordingId} topicText={item.title} onDone={onChange} />
      )}
    </main>
  );
}

/** Escape hatch: hold for 5 seconds to end the session early. */
function HoldButton({ onDone }: { onDone: () => void }) {
  const [progress, setProgress] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval>>(undefined);
  const start = () => {
    const t0 = Date.now();
    clearInterval(timer.current);
    timer.current = setInterval(() => {
      const p = (Date.now() - t0) / HOLD_MS;
      setProgress(Math.min(p, 1));
      if (p >= 1) {
        clearInterval(timer.current);
        onDone();
      }
    }, 50);
  };
  const cancel = () => {
    clearInterval(timer.current);
    setProgress(0);
  };
  return (
    <button
      className="relative overflow-hidden rounded-lg border border-line px-3 py-1.5 text-xs text-muted"
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      title="Hold for 5 seconds to end the session early"
    >
      <span className="absolute inset-y-0 left-0 bg-bad-soft" style={{ width: `${progress * 100}%` }} />
      <span className="relative">{progress > 0 ? "Keep holding…" : "Hold to end early"}</span>
    </button>
  );
}

function Gate({ title, button, onClick, children }: { title: string; button: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="max-w-md space-y-4 text-center">
        <h1 className="text-3xl font-semibold">{title}</h1>
        <p className="text-muted">{children}</p>
        <button className="btn-primary px-6 py-3 text-base" onClick={onClick}>{button}</button>
      </div>
    </div>
  );
}
