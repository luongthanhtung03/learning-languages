"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, type EpisodeProgress } from "@/lib/client";
import type { Alignment, EpisodeDetail } from "@/lib/types";
import type { WhisperJob as AlignJob } from "@/lib/whisper";
import { PlayerBar, PlayerProvider } from "../player";
import { KeepWords } from "../flashcards/KeepWords";
import { ListenPanel } from "./ListenPanel";
import { QuizPanel } from "./QuizPanel";
import { DictationPanel } from "./DictationPanel";
import { ShadowPanel } from "./ShadowPanel";
import { TranscriptPanel } from "./TranscriptPanel";

const STEPS = ["Listen", "Quiz", "Dictation", "Shadow", "Review"] as const;
type Step = (typeof STEPS)[number];

export function EpisodeClient({
  id,
  focus = false,
  onStatusChange,
}: {
  id: string;
  focus?: boolean; // inside the focus room: no navigation links
  onStatusChange?: () => void;
}) {
  const [ep, setEp] = useState<EpisodeDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [alignment, setAlignment] = useState<Alignment | null>(null);
  const [job, setJob] = useState<AlignJob | null>(null);
  const [progress, setProgress] = useState<EpisodeProgress | null>(null);
  const [step, setStep] = useState<Step>("Listen");
  const [guess, setGuess] = useState<string | null>(null);

  useEffect(() => {
    api<EpisodeDetail>(`/api/episodes/${id}`).then(setEp, (e: Error) => setError(e.message));
    api<EpisodeProgress>(`/api/episodes/${id}/progress`).then(setProgress);
  }, [id]);

  // Alignment: load, auto-start if missing, poll while running
  useEffect(() => {
    if (!ep) return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async (start: boolean) => {
      try {
        const s = await api<{ alignment: Alignment | null; job: AlignJob | null }>(`/api/episodes/${id}/align`, {
          method: start ? "POST" : "GET",
        });
        if (stop) return;
        setJob(s.job);
        if (s.alignment) return setAlignment(s.alignment);
        if (!s.job && !start) return poll(true);
        if (s.job?.state === "running") timer = setTimeout(() => poll(false), 2000);
      } catch (e) {
        if (!stop) setJob({ state: "error", stage: "", progress: 0, error: (e as Error).message });
      }
    };
    poll(false);
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [ep, id]);

  const retryAlign = useCallback(async () => {
    setAlignment(null);
    const s = await api<{ job: AlignJob }>(`/api/episodes/${id}/align`, { method: "POST" });
    setJob(s.job);
    const tick = async () => {
      const r = await api<{ alignment: Alignment | null; job: AlignJob | null }>(`/api/episodes/${id}/align`);
      setJob(r.job);
      if (r.alignment) setAlignment(r.alignment);
      else if (r.job?.state === "running") setTimeout(tick, 2000);
    };
    setTimeout(tick, 1500);
  }, [id]);

  const post = useCallback(
    async (body: object) => {
      setProgress(await api<EpisodeProgress>(`/api/episodes/${id}/progress`, { method: "POST", json: body }));
      if ((body as { type?: string }).type === "status") onStatusChange?.();
    },
    [id, onStatusChange],
  );
  const back = focus ? null : <Link href="/listening" className="link">← Listening</Link>;

  if (error)
    return (
      <main className="mx-auto w-full max-w-3xl px-6 py-12">
        {back}
        <p className="mt-6 text-bad">Could not load this episode: {error}</p>
      </main>
    );
  if (!ep) return <main className="fade mx-auto w-full max-w-3xl px-6 py-12 text-muted">Loading…</main>;
  if (!ep.mp3)
    return (
      <main className="mx-auto w-full max-w-3xl px-6 py-12">
        {back}
        <p className="mt-6">This episode has no downloadable audio on the BBC page.</p>
      </main>
    );

  const done = progress?.status?.status === "done";
  const timings = alignment?.sentences ?? null;
  const stepIdx = STEPS.indexOf(step);
  const last = stepIdx === STEPS.length - 1;
  const go = (i: number) => {
    setStep(STEPS[i]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <PlayerProvider src={ep.mp3} timings={timings}>
      <div className={`flex flex-col ${focus ? "min-h-[calc(100vh-57px)]" : "flex-1"}`}>
        <header className="mx-auto w-full max-w-4xl px-6 pt-10">
          {back}
          <p className={`text-sm text-muted ${back ? "mt-6" : ""}`}>
            {new Date(ep.date).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
            {done && <span className="text-accent"> · done</span>}
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-balance">{ep.title}</h1>
          <nav className="mt-8 flex gap-6 overflow-x-auto text-sm" role="tablist">
            {STEPS.map((t, i) => (
              <button
                key={t}
                role="tab"
                aria-selected={step === t}
                onClick={() => go(i)}
                className={`relative whitespace-nowrap pb-2 transition ${
                  step === t ? "text-foreground" : i < stepIdx ? "text-muted/70 hover:text-foreground" : "text-muted hover:text-foreground"
                }`}
              >
                {t}
                <span
                  className={`absolute inset-x-0 bottom-0 h-px origin-left bg-accent transition-transform duration-500 ${step === t ? "scale-x-100" : "scale-x-0"}`}
                />
              </button>
            ))}
          </nav>
          <AlignBanner alignment={alignment} job={job} onRetry={retryAlign} />
        </header>

        <main key={step} className="enter mx-auto w-full max-w-4xl flex-1 px-6 py-10">
          {step === "Listen" && <ListenPanel ep={ep} guess={guess} setGuess={setGuess} />}
          {step === "Quiz" && <QuizPanel ep={ep} guess={guess} setGuess={setGuess} progress={progress} post={post} />}
          {step === "Dictation" && <DictationPanel ep={ep} progress={progress} post={post} />}
          {step === "Shadow" && <ShadowPanel ep={ep} />}
          {step === "Review" && <TranscriptPanel ep={ep} alignment={alignment} onSaved={setAlignment} onRealign={retryAlign} />}

          <div className="mt-14 flex items-center gap-6">
            {!last ? (
              <button className="btn-primary" onClick={() => go(stepIdx + 1)}>{STEPS[stepIdx + 1]} →</button>
            ) : done ? (
              <>
                <span className="pop text-accent">✓ Episode finished</span>
                <button className="link" onClick={() => post({ type: "status", status: "in-progress" })}>undo</button>
              </>
            ) : (
              <KeepWords ep={ep} onFinish={() => post({ type: "status", status: "done", mode: "deep" })} />
            )}
          </div>
        </main>

        <PlayerBar />
      </div>
    </PlayerProvider>
  );
}

function AlignBanner({ alignment, job, onRetry }: { alignment: Alignment | null; job: AlignJob | null; onRetry: () => void }) {
  if (alignment) return null;
  if (job?.state === "error")
    return (
      <p className="fade mt-3 flex flex-wrap items-center gap-3 text-xs text-bad">
        <span className="min-w-0 flex-1 break-words">Sentence timing failed: {job.error}</span>
        <button className="link" onClick={onRetry}>retry</button>
      </p>
    );
  const p = job?.progress ?? 0;
  return (
    <div className="fade -mt-px">
      <div className="h-px overflow-hidden bg-line">
        <div className="h-full bg-accent transition-[width] duration-700" style={{ width: `${Math.max(p, 0.03) * 100}%` }} />
      </div>
      <p className="mt-2 text-xs text-muted">
        Preparing sentence timings · {Math.round(p * 100)}%. Dictation and shadowing unlock when ready. Start listening now.
      </p>
    </div>
  );
}

export function NeedsTimings() {
  return (
    <p className="py-10 text-center text-muted">This step unlocks once the sentence timings are ready.</p>
  );
}
