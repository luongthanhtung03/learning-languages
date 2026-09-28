"use client";

import { useMemo, useState } from "react";
import { normWord } from "@/lib/diff";
import { pct, type EpisodeProgress } from "@/lib/client";
import type { EpisodeDetail } from "@/lib/types";
import { buildGaps, detectAnswer } from "@/lib/vocab";
import { QuestionOptions } from "./ListenPanel";
import { usePlayer } from "./player";

function shuffle<T>(xs: T[], seed: number) {
  const a = [...xs];
  let s = seed || 1;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const sameAnswer = (a: string, b: string) =>
  a.split(/\s+/).map(normWord).filter(Boolean).join(" ") === b.split(/\s+/).map(normWord).filter(Boolean).join(" ");

export function QuizPanel({
  ep,
  guess,
  setGuess,
  progress,
  post,
}: {
  ep: EpisodeDetail;
  guess: string | null;
  setGuess: (g: string) => void;
  progress: EpisodeProgress | null;
  post: (body: object) => Promise<void>;
}) {
  const p = usePlayer();
  const gaps = useMemo(() => buildGaps(ep), [ep]);
  const detected = useMemo(() => detectAnswer(ep), [ep]);
  const terms = useMemo(() => shuffle(ep.vocab.map((v) => v.term), Number(ep.id)), [ep]);

  const [revealed, setRevealed] = useState(false);
  const [selfMark, setSelfMark] = useState<boolean | null>(null);
  const [gapAnswers, setGapAnswers] = useState<string[]>(() => gaps.map(() => ""));
  const [matches, setMatches] = useState<string[]>(() => ep.vocab.map(() => ""));
  const [submitted, setSubmitted] = useState<{ score: number; total: number; first: boolean } | null>(null);

  const questionRight = selfMark ?? (detected && guess ? guess === detected : null);
  const hasQuestion = !!ep.question?.options.length;

  const answerRange = useMemo(() => {
    const ss = ep.sentences.filter((s) => ep.answerTurns.includes(s.turn));
    const t = p.timings;
    if (!ss.length || !t) return null;
    return { start: t[ss[0].idx]?.start ?? 0, end: t[ss[ss.length - 1].idx]?.end ?? 0 };
  }, [ep, p.timings]);

  const firstAttempt = !progress?.quizzes.length;

  const submit = async () => {
    const gapScore = gaps.filter((g, i) => sameAnswer(gapAnswers[i], g.answer)).length;
    const vocabScore = ep.vocab.filter((v, i) => matches[i] === v.term).length;
    const qScore = hasQuestion && questionRight ? 1 : 0;
    const score = gapScore + vocabScore + qScore;
    const total = gaps.length + ep.vocab.length + (hasQuestion ? 1 : 0);
    setSubmitted({ score, total, first: firstAttempt });
    setRevealed(true);
    await post({
      type: "quiz",
      score,
      total,
      details: { question: qScore, gaps: gapScore, gapsTotal: gaps.length, vocab: vocabScore, vocabTotal: ep.vocab.length },
    });
  };

  const reset = () => {
    setSubmitted(null);
    setRevealed(false);
    setSelfMark(null);
    setGapAnswers(gaps.map(() => ""));
    setMatches(ep.vocab.map(() => ""));
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {progress?.quizzes.length ? (
        <p className="text-sm text-muted">
          First-listen score: <strong className="text-foreground">{pct(progress.status?.first_listen_score)}</strong> ·
          attempts: {progress.quizzes.length} · last: {progress.quizzes.at(-1)!.score}/{progress.quizzes.at(-1)!.total}
        </p>
      ) : (
        <p className="text-sm text-muted">Your first submission counts as your first-listen score. Answer from memory, no transcript.</p>
      )}

      {hasQuestion && (
        <section className="card p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">1 · This week&apos;s question</h2>
          <QuestionOptions ep={ep} guess={guess} setGuess={setGuess} disabled={!!submitted} />
          {!revealed ? (
            <button className="btn mt-4" disabled={!guess} onClick={() => setRevealed(true)}>
              Reveal the answer
            </button>
          ) : (
            <div className="mt-4 space-y-3 rounded-lg bg-surface-2 p-4 text-sm">
              {ep.answerTurns.length ? (
                <div className="space-y-1.5">
                  {ep.answerTurns.map((i) => (
                    <p key={i}>
                      <span className="font-semibold">{ep.turns[i].speaker}: </span>
                      {ep.turns[i].text}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="text-muted">Couldn&apos;t find the answer automatically. Check the end of the transcript.</p>
              )}
              {answerRange && (
                <button className="btn" onClick={() => p.playRange(answerRange.start, answerRange.end)}>
                  ▶ Play this part
                </button>
              )}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {detected && guess && selfMark === null && (
                  <span className={guess === detected ? "font-medium text-ok" : "font-medium text-bad"}>
                    {guess === detected ? "✓ Correct" : `✗ The answer is ${detected})`}
                  </span>
                )}
                <span className="text-muted">{detected ? "Not right?" : "Were you right?"}</span>
                <button className={`btn ${selfMark === true ? "border-ok text-ok" : ""}`} onClick={() => setSelfMark(true)}>I was right</button>
                <button className={`btn ${selfMark === false ? "border-bad text-bad" : ""}`} onClick={() => setSelfMark(false)}>I was wrong</button>
              </div>
            </div>
          )}
        </section>
      )}

      {gaps.length > 0 && (
        <section className="card p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">2 · Listen and fill the gap</h2>
          <p className="mt-1 text-sm text-muted">
            {p.timings ? "Play each sentence and type the missing word or phrase." : "Fill in from memory. Play buttons appear once sentence timings are ready."}
          </p>
          <ol className="mt-4 space-y-3">
            {gaps.map((g, i) => {
              const ok = submitted ? sameAnswer(gapAnswers[i], g.answer) : null;
              return (
                <li key={g.sentence.idx} className="flex items-start gap-3">
                  <button
                    className="btn shrink-0"
                    disabled={!p.timings}
                    onClick={() => p.playSentence(g.sentence.idx)}
                    aria-label={`Play sentence ${i + 1}`}
                  >
                    ▶
                  </button>
                  <p className="leading-8">
                    {g.before}
                    <input
                      aria-label={`Gap ${i + 1}`}
                      className={`mx-1 inline-block w-40 rounded border-b-2 bg-transparent px-1 outline-none ${
                        ok === null ? "border-line focus:border-foreground" : ok ? "border-ok text-ok" : "border-bad text-bad"
                      }`}
                      value={gapAnswers[i]}
                      disabled={!!submitted}
                      onChange={(e) => setGapAnswers((a) => a.map((x, j) => (j === i ? e.target.value : x)))}
                    />
                    {submitted && !ok && <span className="font-medium text-ok">[{g.answer}]</span>}
                    {g.after}
                  </p>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {ep.vocab.length > 0 && (
        <section className="card p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">3 · Match the vocabulary</h2>
          <ul className="mt-4 space-y-3">
            {ep.vocab.map((v, i) => {
              const ok = submitted ? matches[i] === v.term : null;
              return (
                <li key={v.term} className="grid gap-2 sm:grid-cols-[1fr_220px] sm:items-center">
                  <span className="text-sm">{v.definition}</span>
                  <div>
                    <select
                      aria-label={`Term for: ${v.definition}`}
                      className={`input py-1.5 text-sm ${ok === null ? "" : ok ? "border-ok text-ok" : "border-bad text-bad"}`}
                      value={matches[i]}
                      disabled={!!submitted}
                      onChange={(e) => setMatches((m) => m.map((x, j) => (j === i ? e.target.value : x)))}
                    >
                      <option value="">Choose…</option>
                      {terms.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                    {submitted && !ok && <p className="mt-1 text-xs text-ok">{v.term}</p>}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {!submitted ? (
          <button className="btn-primary" onClick={submit}>Check my answers</button>
        ) : (
          <>
            <p className="text-lg font-semibold">
              {submitted.score} / {submitted.total} ({pct(submitted.score / submitted.total)})
            </p>
            {submitted.first && <span className="text-sm text-muted">Saved as your first-listen score</span>}
            <button className="btn" onClick={reset}>Try again</button>
          </>
        )}
      </div>
    </div>
  );
}
