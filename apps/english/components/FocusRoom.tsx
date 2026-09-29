"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { api } from "@/lib/client";
import { itemKey, type PlanItem, type TodayPlan } from "@/lib/plan-types";
import { FocusContext } from "./focus-context";
import { Review } from "./flashcards/Review";
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
      <Gate title="Focus" button="Enter" onClick={enter}>
        Fullscreen, only today&apos;s plan. Leaving fullscreen pauses everything.
      </Gate>
    );

  return (
    <FocusContext.Provider value={{ inFocus: true, paused }}>
      <div className="flex min-h-screen flex-col bg-background">
        <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md">
          <div className="mx-auto flex h-14 max-w-4xl items-center gap-6 px-6">
            <div className="flex flex-1 gap-6">
              {plan?.items.map((i) => (
                <button
                  key={itemKey(i)}
                  onClick={() => setActive(itemKey(i))}
                  className={`relative flex items-center gap-2 py-1 text-sm transition ${itemKey(i) === active ? "text-foreground" : "text-muted hover:text-foreground"}`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full transition-colors duration-500 ${i.done ? "bg-accent" : itemKey(i) === active ? "bg-foreground" : "bg-line"}`}
                  />
                  {itemLabel(i)}
                </button>
              ))}
            </div>
            {allDone ? (
              <button className="btn-primary" onClick={leave}>Leave</button>
            ) : (
              <HoldButton onDone={leave} />
            )}
          </div>
        </header>

        <div className={`transition duration-500 ${paused ? "pointer-events-none select-none blur-md" : ""}`} aria-hidden={paused}>
          {allDone && (
            <div className="enter mx-auto max-w-4xl px-6 pt-10">
              <p className="text-2xl font-light">Done for today<span className="text-accent">.</span></p>
            </div>
          )}
          {current ? (
            <FocusItem key={itemKey(current)} item={current} onChange={refresh} />
          ) : (
            <p className="p-8 text-center text-muted">Nothing planned today.</p>
          )}
        </div>

        {paused && (
          <div className="fade fixed inset-0 z-50 flex items-center justify-center bg-background/85 p-6 backdrop-blur-sm">
            <div className="enter-stagger max-w-md space-y-5 text-center">
              <h2 className="text-4xl font-semibold tracking-tight">Paused</h2>
              <p className="text-muted">Timers, recording and audio are frozen.</p>
              <button className="btn-primary px-8 py-3 text-base" onClick={enter} autoFocus>Return</button>
            </div>
          </div>
        )}
      </div>
    </FocusContext.Provider>
  );
}

function FocusItem({ item, onChange }: { item: PlanItem; onChange: () => void }) {
  if (item.kind === "listening")
    return <EpisodeClient id={item.episodeId} focus onStatusChange={onChange} />;
  return (
    <main className="enter mx-auto w-full max-w-4xl px-6 py-12">
      {item.kind === "review" ? (
        <Review session={item.session} onDone={onChange} />
      ) : item.kind === "speaking" ? (
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
      className="relative select-none py-1 text-xs text-muted transition hover:text-foreground"
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      title="Hold for 5 seconds to end the session early"
    >
      {progress > 0 ? "keep holding…" : "hold to leave"}
      <span className="absolute inset-x-0 bottom-0 h-px origin-left bg-accent" style={{ transform: `scaleX(${progress})` }} />
    </button>
  );
}

function Gate({ title, button, onClick, children }: { title: string; button: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="enter-stagger max-w-md space-y-5 text-center">
        <h1 className="text-5xl font-semibold tracking-tight">{title}</h1>
        <p className="text-muted">{children}</p>
        <button className="btn-primary px-8 py-3 text-base" onClick={onClick}>{button}</button>
      </div>
    </div>
  );
}
