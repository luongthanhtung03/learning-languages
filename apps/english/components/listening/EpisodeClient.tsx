"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, type EpisodeProgress } from "@/lib/client";
import type { Alignment, EpisodeDetail, StudyMode } from "@/lib/types";
import type { WhisperJob as AlignJob } from "@/lib/whisper";
import { PlayerBar, PlayerProvider } from "../player";
import { ListenPanel } from "./ListenPanel";
import { QuizPanel } from "./QuizPanel";
import { DictationPanel } from "./DictationPanel";
import { ShadowPanel } from "./ShadowPanel";
import { TranscriptPanel } from "./TranscriptPanel";

const TABS = ["Listen", "Quiz", "Dictation", "Shadowing", "Transcript"] as const;
type Tab = (typeof TABS)[number];

const FLOW: Record<StudyMode, string> = {
  deep: "Listen → Quiz → Dictation → Shadowing → Transcript review",
  light: "Listen → Quiz → Transcript review",
};

export function EpisodeClient({
  id,
  focus = false,
  initialMode = "deep",
  onStatusChange,
}: {
  id: string;
  focus?: boolean; // inside the focus room: no navigation links
  initialMode?: StudyMode;
  onStatusChange?: () => void;
}) {
  const [ep, setEp] = useState<EpisodeDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [alignment, setAlignment] = useState<Alignment | null>(null);
  const [job, setJob] = useState<AlignJob | null>(null);
  const [progress, setProgress] = useState<EpisodeProgress | null>(null);
  const [tab, setTab] = useState<Tab>("Listen");
  const [mode, setMode] = useState<StudyMode>(initialMode);
  const [guess, setGuess] = useState<string | null>(null);

  useEffect(() => {
    api<EpisodeDetail>(`/api/episodes/${id}`).then(setEp, (e: Error) => setError(e.message));
    api<EpisodeProgress>(`/api/episodes/${id}/progress`).then((p) => {
      setProgress(p);
      if (p.status?.mode) setMode(p.status.mode);
    });
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
  const back = focus ? null : <Link href="/listening" className="text-sm text-muted hover:underline">← All episodes</Link>;

  if (error)
    return (
      <main className="mx-auto max-w-3xl p-6">
        {back}
        <p className="mt-6 rounded-lg bg-bad-soft p-4 text-bad">Could not load this episode: {error}</p>
      </main>
    );
  if (!ep) return <main className="mx-auto max-w-3xl p-6 text-muted">Loading episode…</main>;
  if (!ep.mp3)
    return (
      <main className="mx-auto max-w-3xl p-6">
        {back}
        <p className="mt-6">This episode has no downloadable audio on the BBC page.</p>
      </main>
    );

  const done = progress?.status?.status === "done";
  const timings = alignment?.sentences ?? null;

  return (
    <PlayerProvider src={ep.mp3} timings={timings}>
      <div className={`flex flex-col ${focus ? "min-h-[calc(100vh-57px)]" : "min-h-screen"}`}>
        <header className="border-b border-line bg-surface">
          <div className="mx-auto max-w-5xl px-4 pt-4">
            {back}
            <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-wide text-muted">
                  6 Minute English · {new Date(ep.date).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                </p>
                <h1 className="text-2xl font-semibold text-balance">{ep.title}</h1>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-muted" htmlFor="mode">Session</label>
                <select
                  id="mode"
                  className="btn"
                  value={mode}
                  onChange={(e) => setMode(e.target.value as StudyMode)}
                  disabled={done}
                >
                  <option value="deep">Deep (all steps)</option>
                  <option value="light">Light (listen + quiz)</option>
                </select>
                {done ? (
                  <button className="btn" onClick={() => post({ type: "status", status: "in-progress" })}>
                    ✓ Done · undo
                  </button>
                ) : (
                  <button className="btn-primary" onClick={() => post({ type: "status", status: "done", mode })}>
                    Mark as done
                  </button>
                )}
              </div>
            </div>
            <p className="mt-1 text-xs text-muted">Suggested flow: {FLOW[mode]}</p>
            <AlignBanner alignment={alignment} job={job} onRetry={retryAlign} />
            <nav className="-mb-px mt-3 flex gap-1 overflow-x-auto" role="tablist">
              {TABS.map((t) => (
                <button
                  key={t}
                  role="tab"
                  aria-selected={tab === t}
                  onClick={() => setTab(t)}
                  className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition ${
                    tab === t ? "border-accent text-foreground" : "border-transparent text-muted hover:text-foreground"
                  }`}
                >
                  {t}
                </button>
              ))}
            </nav>
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
          {tab === "Listen" && <ListenPanel ep={ep} guess={guess} setGuess={setGuess} onNext={() => setTab("Quiz")} />}
          {tab === "Quiz" && <QuizPanel ep={ep} guess={guess} setGuess={setGuess} progress={progress} post={post} />}
          {tab === "Dictation" && <DictationPanel ep={ep} progress={progress} post={post} />}
          {tab === "Shadowing" && <ShadowPanel ep={ep} />}
          {tab === "Transcript" && <TranscriptPanel ep={ep} alignment={alignment} onSaved={setAlignment} onRealign={retryAlign} />}
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
      <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">
        <span className="min-w-0 flex-1 break-words">Sentence timing failed: {job.error}</span>
        <button className="btn" onClick={onRetry}>Retry</button>
      </div>
    );
  return (
    <div className="mt-3 rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">
      <div className="flex items-center justify-between gap-3">
        <span>
          Preparing sentence timings with Whisper ({job?.stage ?? "starting"}). Dictation and shadowing unlock when
          it&apos;s done, usually in 1–3 min. Start your first listen now.
        </span>
        <span className="font-mono tabular-nums">{Math.round((job?.progress ?? 0) * 100)}%</span>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded bg-warn/20">
        <div className="h-full bg-warn transition-all" style={{ width: `${(job?.progress ?? 0) * 100}%` }} />
      </div>
    </div>
  );
}

export function NeedsTimings() {
  return (
    <div className="card p-6 text-center text-muted">
      This step needs sentence timings. They&apos;re being prepared. See the banner above.
    </div>
  );
}
