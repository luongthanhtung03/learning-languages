"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/client";
import type { RecordingWithErrors, SessionDetail } from "@/lib/speaking/detail";
import type { SessionKind, SessionNotes } from "@/lib/speaking/store";
import { useFocus } from "../focus-context";
import { CountdownRing, MicLevel, StatsTable, TYPE_LABEL } from "./bits";
import { fmtClock, useCountdown, useRecorder } from "./hooks";
import { TranscriptTagger } from "./TranscriptTagger";

type Step = "reveal" | "prep" | "record" | "uploading" | "review" | "research" | "compare";

type Props =
  | { sessionId: number; topicNo?: never; kind?: never; onDone?: () => void }
  | { sessionId?: never; topicNo: number; kind: SessionKind; onDone?: () => void };

export function SpeakingSession(props: Props) {
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(
    () =>
      props.sessionId !== undefined
        ? api<SessionDetail>(`/api/speaking/sessions/${props.sessionId}`)
        : api<SessionDetail>("/api/speaking/sessions", { method: "POST", json: { topicNo: props.topicNo, kind: props.kind } }),
    [props.sessionId, props.topicNo, props.kind],
  );
  const load = useCallback(async () => {
    const d = await fetchDetail();
    setDetail(d);
    return d;
  }, [fetchDetail]);

  useEffect(() => {
    fetchDetail().then(setDetail, (e: Error) => setError(e.message));
  }, [fetchDetail]);

  // keep polling while any transcript is still being made
  const pending = detail?.recordings.some((r) => r.status === "pending");
  useEffect(() => {
    if (!pending) return;
    const id = setInterval(() => void load(), 2000);
    return () => clearInterval(id);
  }, [pending, load]);

  if (error) return <p className="text-bad">{error}</p>;
  if (!detail) return <p className="text-muted">Loading topic…</p>;
  return <Session key={detail.session.id} detail={detail} reload={load} onDone={props.onDone} />;
}

function initialStep(d: SessionDetail): { step: Step; round: number } {
  const n = d.recordings.length;
  if (d.session.completed_at || n >= d.rounds.length) return { step: "compare", round: d.rounds.length - 1 };
  if (n === 0) return { step: "reveal", round: 0 };
  if (n === 1 && d.rounds.length > 1) return { step: "review", round: 1 };
  return { step: "reveal", round: n };
}

function Session({ detail, reload, onDone }: { detail: SessionDetail; reload: () => Promise<SessionDetail>; onDone?: () => void }) {
  const { paused } = useFocus();
  const mic = useRecorder();
  const { pause: pauseMic, resume: resumeMic } = mic;
  const init = initialStep(detail);
  const [step, setStep] = useState<Step>(init.step);
  const [round, setRound] = useState(init.round); // index into detail.rounds for the next/current recording
  const startedAt = useRef(0);
  const { topic, block, rounds, secondary, fillers, settings, session } = detail;
  const cur = rounds[Math.min(round, rounds.length - 1)];
  const multi = rounds.length > 1;

  // focus mode: freeze recording while paused
  useEffect(() => {
    if (step !== "record") return;
    if (paused) pauseMic();
    else resumeMic();
  }, [paused, step, pauseMic, resumeMic]);

  const beginRound = async () => {
    if (!(await mic.prepare())) return;
    setStep("prep");
  };

  const startRecording = useCallback(() => {
    mic.start();
    startedAt.current = performance.now();
    setStep("record");
  }, [mic]);

  const finishRecording = useCallback(async () => {
    setStep("uploading");
    const blob = await mic.stop();
    const seconds = Math.round((performance.now() - startedAt.current) / 100) / 10;
    if (blob) {
      const form = new FormData();
      form.set("sessionId", String(session.id));
      form.set("round", String(cur.round));
      form.set("duration", String(seconds));
      form.set("audio", blob, "round.webm");
      await fetch("/api/speaking/recordings", { method: "POST", body: form });
    }
    await reload();
    const next = round + 1;
    if (next >= rounds.length) {
      setStep("compare");
    } else {
      setRound(next);
      setStep(next === 1 ? "review" : "prep");
    }
  }, [mic, session.id, cur, reload, round, rounds.length]);

  const prepLeft = useCountdown(settings.prep_seconds, step === "prep" && !paused, startRecording, `prep-${round}`);
  const recLeft = useCountdown(cur.seconds, step === "record" && !paused, finishRecording, `rec-${round}`);

  const recFor = (r: number) => detail.recordings.find((x) => x.round === r) ?? null;

  const saveNotes = useCallback(
    (notes: SessionNotes) => api(`/api/speaking/sessions/${session.id}`, { method: "PATCH", json: { notes } }),
    [session.id],
  );

  const header = (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        {TYPE_LABEL[topic.type] ?? topic.type} · {block.name}
        {session.kind !== "new" && <span className="text-accent"> · {session.kind === "revisit" ? "revisit" : "monthly self-check"}</span>}
      </p>
      <h2 className="text-3xl font-semibold leading-snug tracking-tight text-balance">{topic.text}</h2>
    </div>
  );

  // ---------- steps ----------

  if (step === "reveal")
    return (
      <div key="reveal" className="enter-stagger max-w-3xl space-y-10">
        {header}
        <dl className="space-y-4">
          <div className="flex gap-6">
            <dt className="w-20 shrink-0 text-sm text-muted">Target</dt>
            <dd>{block.target}</dd>
          </div>
          {secondary && (
            <div className="flex gap-6">
              <dt className="w-20 shrink-0 text-sm text-muted">Also</dt>
              <dd>
                {secondary.target || secondary.label} <span className="text-sm text-muted">· {secondary.count}× in 14 days</span>
              </dd>
            </div>
          )}
          <div className="flex gap-6">
            <dt className="w-20 shrink-0 text-sm text-muted">If stuck</dt>
            <dd className="text-foreground/80">{fillers.map((f) => `“${f}”`).join(" · ")}</dd>
          </div>
        </dl>
        <p className="flex flex-wrap gap-x-4 text-sm text-muted">
          {rounds.map((r, i) => (
            <span key={r.round} className={i < round ? "line-through opacity-50" : i === round ? "text-foreground" : ""}>
              {r.label} {fmtClock(r.seconds)}
            </span>
          ))}
        </p>
        <p className="text-sm text-muted">Never restart a sentence. No pause, no redo.</p>
        {mic.error && <p className="text-sm text-bad">Microphone: {mic.error}. Allow mic access in the browser and try again.</p>}
        <button className="btn-primary px-8 py-3 text-base" onClick={beginRound}>
          {round === 0 ? "Start" : `Continue · ${cur.label}`}
        </button>
      </div>
    );

  if (step === "prep")
    return (
      <div key="prep" className="enter mx-auto max-w-3xl space-y-8 text-center">
        {header}
        <p className="text-sm text-muted">Prepare · {cur.label}</p>
        <CountdownRing left={prepLeft} total={settings.prep_seconds} label="think" />
        {cur.round === 2 && (
          <div className="mx-auto max-w-xl space-y-2 text-left text-sm">
            <p className="text-accent">Use: {block.target}</p>
            {session.notes.phrases && <p className="whitespace-pre-line text-foreground/80">{session.notes.phrases}</p>}
            {session.notes.targetSentence && <p className="italic text-foreground/80">“{session.notes.targetSentence}”</p>}
            <p className="text-xs text-muted">Notes disappear when recording starts.</p>
          </div>
        )}
        {cur.round === 3 && <p className="text-muted">Same content, {fmtClock(cur.seconds)} only. Faster, no fillers.</p>}
        <div className="flex justify-center">
          <MicLevel level={mic.level} />
        </div>
        <button className="link" onClick={startRecording}>skip · speak now</button>
      </div>
    );

  if (step === "record")
    return (
      <div key="record" className="enter mx-auto max-w-3xl space-y-8 text-center">
        {header}
        <p className="flex items-center justify-center gap-2 text-sm text-accent">
          <span className="h-2 w-2 animate-pulse rounded-full bg-accent" /> Recording · {cur.label}
        </p>
        <CountdownRing left={recLeft} total={cur.seconds} tone="rec" label="keep talking" />
        <div className="flex justify-center"><MicLevel level={mic.level} /></div>
        {cur.round === 2 && <p className="text-sm">Use: <span className="text-accent">{block.target}</span></p>}
        <p className="text-sm text-muted">Stuck? {fillers.map((f) => `“${f}”`).join(" · ")}</p>
        <button className="link" onClick={finishRecording}>finish early</button>
      </div>
    );

  if (step === "uploading")
    return <div key="uploading" className="fade mx-auto max-w-3xl space-y-8 text-center">{header}<p className="animate-pulse text-muted">Saving…</p></div>;

  if (step === "review") {
    const r1 = recFor(1);
    return (
      <div key="review" className="enter-stagger max-w-3xl space-y-10">
        {header}
        <section className="space-y-5">
          <p className="text-sm text-muted">
            Round 1 · check one thing: did you use <span className="text-accent">{block.target}</span>? Tag where you missed it.
          </p>
          <RecordingView rec={r1} reload={reload} />
          {r1?.stats && <StatsTable columns={[{ label: "Round 1", stats: r1.stats }]} />}
        </section>
        <button className="btn-primary" onClick={() => setStep("research")}>
          Research · {settings.research_minutes} min
        </button>
      </div>
    );
  }

  if (step === "research")
    return (
      <Research
        header={header}
        minutes={settings.research_minutes}
        target={block.target}
        notes={session.notes}
        paused={paused}
        save={saveNotes}
        onNext={async () => {
          await reload();
          setStep(mic.ready ? "prep" : "reveal"); // after a page reload the mic needs a click again
        }}
      />
    );

  // compare
  const done = !!session.completed_at;
  return (
    <div key="compare" className="enter-stagger max-w-3xl space-y-12">
      {header}
      <section className="space-y-4">
        <h3 className="text-sm text-muted">{multi ? "Round 1 → Round 3" : "Your stats"}</h3>
        <StatsTable columns={rounds.map((r) => ({ label: `R${r.round}`, stats: recFor(r.round)?.stats ?? null }))} />
        {detail.recordings.some((r) => r.status === "pending") && <p className="text-xs text-muted">Still transcribing some rounds…</p>}
        {multi && (
          <label className="flex items-center gap-2 text-sm text-muted">
            <input
              type="checkbox"
              className="accent-[var(--accent)]"
              checked={!!session.notes.targetUsed}
              onChange={async (e) => {
                await saveNotes({ targetUsed: e.target.checked });
                await reload();
              }}
            />
            I used {block.target} in Round 2
          </label>
        )}
      </section>
      <section className="space-y-4">
        <h3 className="text-sm text-muted">Listen back to {multi ? "Round 3" : "your recording"} once. Tag recurring errors.</h3>
        <RecordingView rec={recFor(rounds[rounds.length - 1].round)} reload={reload} />
      </section>
      {multi && (
        <details >
          <summary>rounds 1 and 2</summary>
          <div className="mt-4 space-y-6">
            {[1, 2].map((r) => (
              <div key={r}>
                <p className="mb-2 text-xs text-muted">Round {r}</p>
                <RecordingView rec={recFor(r)} reload={reload} />
              </div>
            ))}
          </div>
        </details>
      )}
      {!done ? (
        <button
          className="btn-primary px-5 py-2.5 text-base"
          onClick={async () => {
            await api(`/api/speaking/sessions/${session.id}`, { method: "PATCH", json: { completed: true } });
            await reload();
            onDone?.();
          }}
        >
          Finish topic
        </button>
      ) : (
        <p className="pop text-accent">✓ Topic finished</p>
      )}
    </div>
  );
}

function RecordingView({ rec, reload }: { rec: RecordingWithErrors | null; reload: () => Promise<unknown> }) {
  if (!rec) return <p className="text-sm text-muted">No recording.</p>;
  const src = `/api/speaking/recordings/${rec.id}/audio`;
  if (rec.status === "pending")
    return (
      <div className="space-y-2">
        <audio src={src} controls preload="metadata" className="h-9 w-full" />
        <p className="text-sm text-muted">
          <span className="animate-pulse">Transcribing</span> · {Math.round((rec.job?.progress ?? 0) * 100)}%
        </p>
      </div>
    );
  if (rec.status === "error")
    return (
      <div className="space-y-2">
        <audio src={src} controls preload="metadata" className="h-9 w-full" />
        <p className="text-sm text-bad">Transcription failed: {rec.error}</p>
        <button
          className="link"
          onClick={async () => {
            await api(`/api/speaking/recordings/${rec.id}`, { method: "POST" });
            await reload();
          }}
        >
          Retry
        </button>
      </div>
    );
  return <TranscriptTagger rec={rec} audioSrc={src} onChanged={() => void reload()} />;
}

function Research({
  header,
  minutes,
  target,
  notes,
  paused,
  save,
  onNext,
}: {
  header: React.ReactNode;
  minutes: number;
  target: string;
  notes: SessionNotes;
  paused: boolean;
  save: (n: SessionNotes) => Promise<unknown>;
  onNext: () => void;
}) {
  const [draft, setDraft] = useState<SessionNotes>(notes);
  const [over, setOver] = useState(false);
  const left = useCountdown(minutes * 60, !paused && !over, () => setOver(true), "research");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const change = (patch: SessionNotes) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(next), 600);
  };

  return (
    <div className="enter-stagger max-w-3xl space-y-10">
      {header}
      <section className="space-y-8">
        <div className="flex items-baseline justify-between gap-4">
          <p className="text-sm text-muted">Research · collect language, not facts.</p>
          <span className={`font-mono text-3xl font-light tabular-nums ${over ? "text-accent" : ""}`}>{over ? "time" : fmtClock(left)}</span>
        </div>
        <label className="block space-y-2">
          <span className="text-sm text-muted">3–5 phrases for this topic</span>
          <textarea
            className="input min-h-24 text-sm"
            placeholder={"e.g. someone I look up to\nhas a huge following\nshe comes across as…"}
            value={draft.phrases ?? ""}
            onChange={(e) => change({ phrases: e.target.value })}
          />
        </label>
        <label className="block space-y-2">
          <span className="text-sm text-muted">1 sentence using {target}</span>
          <input className="input text-sm" value={draft.targetSentence ?? ""} onChange={(e) => change({ targetSentence: e.target.value })} />
        </label>
        <label className="block space-y-2">
          <span className="text-sm text-muted">1 new idea you didn&apos;t use in Round 1</span>
          <input className="input text-sm" value={draft.idea ?? ""} onChange={(e) => change({ idea: e.target.value })} />
        </label>
      </section>
      <button
        className="btn-primary"
        onClick={async () => {
          clearTimeout(timer.current);
          await save(draft);
          onNext();
        }}
      >
        Round 2
      </button>
    </div>
  );
}
