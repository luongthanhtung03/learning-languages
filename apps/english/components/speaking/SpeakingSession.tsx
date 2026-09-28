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

  if (error) return <p className="rounded-lg bg-bad-soft p-4 text-bad">{error}</p>;
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
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full bg-surface-2 px-2 py-0.5 font-medium">#{topic.no} · {TYPE_LABEL[topic.type] ?? topic.type}</span>
        <span className="text-muted">Block {block.no} · {block.name}</span>
        {session.kind !== "new" && (
          <span className="rounded-full bg-warn-soft px-2 py-0.5 font-medium text-warn">{session.kind === "revisit" ? "Spaced revisit" : "Monthly self-check"}</span>
        )}
      </div>
      <h2 className="text-2xl font-semibold leading-snug text-balance sm:text-3xl">{topic.text}</h2>
    </div>
  );

  // ---------- steps ----------

  if (step === "reveal")
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        {header}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Language target</p>
            <p className="mt-1">{block.target}</p>
          </div>
          {secondary ? (
            <div className="card border-warn/40 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-warn">Secondary target (from your error log)</p>
              <p className="mt-1">
                {secondary.target || secondary.label} <span className="text-sm text-muted">· {secondary.count} errors in 14 days</span>
              </p>
            </div>
          ) : (
            <div className="card p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">If you get stuck</p>
              <p className="mt-1">{fillers.map((f) => `“${f}”`).join(" · ")}</p>
            </div>
          )}
        </div>
        <ol className="card divide-y divide-line text-sm">
          {rounds.map((r, i) => (
            <li key={r.round} className={`flex justify-between px-4 py-2 ${i < round ? "text-muted line-through" : ""}`}>
              <span>{r.label}</span>
              <span className="tabular-nums text-muted">{settings.prep_seconds}s prep · {fmtClock(r.seconds)} speak</span>
            </li>
          ))}
        </ol>
        <div className="rounded-lg bg-surface-2 p-4 text-sm">
          <strong>Rule:</strong> never restart a sentence. There&apos;s no pause and no redo. If you get stuck, use a filler phrase and keep going.
        </div>
        {mic.error && <p className="rounded-lg bg-bad-soft p-3 text-sm text-bad">Microphone: {mic.error}. Allow mic access in the browser and try again.</p>}
        <button className="btn-primary px-5 py-2.5 text-base" onClick={beginRound}>
          {round === 0 ? "I'm ready: start preparing" : `Continue: ${cur.label}`}
        </button>
      </div>
    );

  if (step === "prep")
    return (
      <div className="mx-auto max-w-3xl space-y-6 text-center">
        {header}
        <p className="text-sm font-medium uppercase tracking-wide text-muted">Prepare · {cur.label}</p>
        <CountdownRing left={prepLeft} total={settings.prep_seconds} label="to think" />
        {cur.round === 2 && (
          <div className="mx-auto max-w-xl rounded-lg bg-accent-soft p-4 text-left text-sm">
            <p className="font-semibold text-accent">This round you must use: {block.target}</p>
            {session.notes.phrases && <p className="mt-2 whitespace-pre-line">{session.notes.phrases}</p>}
            {session.notes.targetSentence && <p className="mt-2 italic">“{session.notes.targetSentence}”</p>}
            <p className="mt-2 text-xs text-muted">Notes disappear when recording starts.</p>
          </div>
        )}
        {cur.round === 3 && <p className="text-muted">Same content, {fmtClock(cur.seconds)} only. Faster, no fillers.</p>}
        <div className="flex justify-center gap-3">
          <MicLevel level={mic.level} />
        </div>
        <button className="btn" onClick={startRecording}>Skip prep: start speaking now</button>
      </div>
    );

  if (step === "record")
    return (
      <div className="mx-auto max-w-3xl space-y-6 text-center">
        {header}
        <p className="flex items-center justify-center gap-2 text-sm font-semibold uppercase tracking-wide text-accent">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-accent" /> Recording · {cur.label}
        </p>
        <CountdownRing left={recLeft} total={cur.seconds} tone="rec" label="keep talking" />
        <div className="flex justify-center"><MicLevel level={mic.level} /></div>
        {cur.round === 2 && <p className="text-sm">Use: <strong>{block.target}</strong></p>}
        <p className="text-sm text-muted">Stuck? {fillers.map((f) => `“${f}”`).join(" · ")}</p>
        <button className="btn" onClick={finishRecording}>Finish early</button>
      </div>
    );

  if (step === "uploading")
    return <div className="mx-auto max-w-3xl space-y-6 text-center">{header}<p className="text-muted">Saving your recording…</p></div>;

  if (step === "review") {
    const r1 = recFor(1);
    return (
      <div className="mx-auto max-w-3xl space-y-5">
        {header}
        <section className="card space-y-3 p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Round 1: quick review</h3>
            <span className="text-xs text-muted">Don&apos;t over-listen. Check one thing, then research.</span>
          </div>
          <p className="rounded-lg bg-surface-2 p-3 text-sm">
            Check one thing: did you use <strong>{block.target}</strong>? Tag the places where you missed it.
          </p>
          <RecordingView rec={r1} reload={reload} />
          {r1?.stats && <StatsTable columns={[{ label: "Round 1", stats: r1.stats }]} />}
        </section>
        <button className="btn-primary px-5 py-2.5 text-base" onClick={() => setStep("research")}>
          Start research ({settings.research_minutes} min) →
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
    <div className="mx-auto max-w-3xl space-y-5">
      {header}
      <section className="card space-y-3 p-5">
        <h3 className="font-semibold">{multi ? "Round 1 vs Round 3" : "Your stats"}</h3>
        <StatsTable columns={rounds.map((r) => ({ label: `R${r.round}`, stats: recFor(r.round)?.stats ?? null }))} />
        {detail.recordings.some((r) => r.status === "pending") && <p className="text-xs text-muted">Still transcribing some rounds…</p>}
        {multi && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="accent-[var(--accent)]"
              checked={!!session.notes.targetUsed}
              onChange={async (e) => {
                await saveNotes({ targetUsed: e.target.checked });
                await reload();
              }}
            />
            I used the language target ({block.target}) in Round 2
          </label>
        )}
      </section>
      <section className="card space-y-3 p-5">
        <h3 className="font-semibold">Listen back to {multi ? "Round 3" : "your recording"}</h3>
        <p className="text-xs text-muted">Listen once, all the way through. Tag recurring errors: 3 of the same kind becomes your next secondary target.</p>
        <RecordingView rec={recFor(rounds[rounds.length - 1].round)} reload={reload} />
      </section>
      {multi && (
        <details className="card p-5">
          <summary className="cursor-pointer font-semibold">Rounds 1 and 2 transcripts</summary>
          <div className="mt-4 space-y-6">
            {[1, 2].map((r) => (
              <div key={r}>
                <p className="mb-2 text-sm font-medium text-muted">Round {r}</p>
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
          Finish topic ✓
        </button>
      ) : (
        <p className="font-medium text-ok">✓ Topic finished</p>
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
          Transcribing with Whisper ({rec.job?.stage ?? "queued"} {Math.round((rec.job?.progress ?? 0) * 100)}%)…
        </p>
      </div>
    );
  if (rec.status === "error")
    return (
      <div className="space-y-2">
        <audio src={src} controls preload="metadata" className="h-9 w-full" />
        <p className="rounded-lg bg-bad-soft p-3 text-sm text-bad">Transcription failed: {rec.error}</p>
        <button
          className="btn"
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
    <div className="mx-auto max-w-3xl space-y-5">
      {header}
      <section className="card space-y-4 p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Research: collect language, not facts</h3>
            <p className="text-xs text-muted">Search the topic, a sample answer, or a dictionary. Fill the card, then speak again.</p>
          </div>
          <span className={`font-mono text-2xl tabular-nums ${over ? "text-bad" : ""}`}>{over ? "Time's up" : fmtClock(left)}</span>
        </div>
        <label className="block space-y-1">
          <span className="text-sm font-medium">3–5 phrases / collocations for this topic</span>
          <textarea
            className="input min-h-24 text-sm"
            placeholder={"e.g. someone I look up to\nhas a huge following\nshe comes across as…"}
            value={draft.phrases ?? ""}
            onChange={(e) => change({ phrases: e.target.value })}
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">1 sentence using the target: {target}</span>
          <input className="input text-sm" value={draft.targetSentence ?? ""} onChange={(e) => change({ targetSentence: e.target.value })} />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">1 new idea or example you didn&apos;t use in Round 1</span>
          <input className="input text-sm" value={draft.idea ?? ""} onChange={(e) => change({ idea: e.target.value })} />
        </label>
      </section>
      <button
        className="btn-primary px-5 py-2.5 text-base"
        onClick={async () => {
          clearTimeout(timer.current);
          await save(draft);
          onNext();
        }}
      >
        Ready: Round 2 →
      </button>
    </div>
  );
}
