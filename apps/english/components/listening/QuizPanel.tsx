"use client";

import { useMemo, useState } from "react";
import { normWord } from "@/lib/listening/diff";
import { pct, type EpisodeProgress } from "@/lib/client";
import type { EpisodeDetail } from "@/lib/types";
import { buildGaps, detectAnswer } from "@/lib/listening/vocab";
import { QuestionOptions } from "./ListenPanel";
import { usePlayer } from "../player";

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
  const gist = useMemo(() => ep.gist ?? [], [ep]);

  const [revealed, setRevealed] = useState(false);
  const [selfMark, setSelfMark] = useState<boolean | null>(null);
  const [gapAnswers, setGapAnswers] = useState<string[]>(() => gaps.map(() => ""));
  const [matches, setMatches] = useState<string[]>(() => ep.vocab.map(() => ""));
  const [gistAnswers, setGistAnswers] = useState<(number | null)[]>(() => gist.map(() => null));
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
    const gistScore = gist.filter((g, i) => gistAnswers[i] === g.answer).length;
    const score = gistScore + gapScore + vocabScore + qScore;
    const total = gist.length + gaps.length + ep.vocab.length + (hasQuestion ? 1 : 0);
    setSubmitted({ score, total, first: firstAttempt });
    setRevealed(true);
    await post({
      type: "quiz",
      score,
      total,
      details: { gist: gistScore, gistTotal: gist.length, question: qScore, gaps: gapScore, gapsTotal: gaps.length, vocab: vocabScore, vocabTotal: ep.vocab.length },
    });
  };

  const reset = () => {
    setSubmitted(null);
    setRevealed(false);
    setSelfMark(null);
    setGapAnswers(gaps.map(() => ""));
    setMatches(ep.vocab.map(() => ""));
    setGistAnswers(gist.map(() => null));
  };

  return (
    <div className="max-w-3xl space-y-12">
      {progress?.quizzes.length ? (
        <p className="text-sm text-muted">
          First-listen score: <strong className="text-foreground">{pct(progress.status?.first_listen_score)}</strong> ·
          attempts: {progress.quizzes.length} · last: {progress.quizzes.at(-1)!.score}/{progress.quizzes.at(-1)!.total}
        </p>
      ) : (
        <p className="text-sm text-muted">Your first submission counts as your first-listen score. Answer from memory, no transcript.</p>
      )}

      {gist.length > 0 && (
        <section className="space-y-10">
          <h2 className="text-lg">Understanding</h2>
          <ol className="space-y-10">
            {gist.map((g, i) => {
              const picked = gistAnswers[i];
              return (
                <li key={i} className="space-y-3">
                  <p className="text-foreground/90">
                    <span className="mr-3 font-mono text-xs tabular-nums text-muted">{i + 1}</span>
                    {g.q}
                  </p>
                  <div className="space-y-1">
                    {g.options.map((o, j) => {
                      const state = !submitted ? (picked === j ? "picked" : "") : j === g.answer ? "right" : picked === j ? "wrong" : "";
                      return (
                        <button
                          key={j}
                          disabled={!!submitted}
                          onClick={() => setGistAnswers((a) => a.map((x, k) => (k === i ? j : x)))}
                          className={`-mx-3 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition ${
                            state === "picked" ? "bg-surface text-foreground" : state === "right" ? "text-ok" : state === "wrong" ? "text-bad line-through" : "text-foreground/75 hover:bg-surface"
                          }`}
                        >
                          <span
                            className={`h-2 w-2 shrink-0 rounded-full border transition ${
                              state === "picked" ? "border-accent bg-accent" : state === "right" ? "border-ok bg-ok" : state === "wrong" ? "border-bad bg-bad" : "border-line"
                            }`}
                          />
                          {o}
                        </button>
                      );
                    })}
                  </div>
                  {submitted && g.why && picked !== g.answer && <p className="fade text-sm text-muted">{g.why}</p>}
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {hasQuestion && (
        <section>
          <h2 className="mb-6 text-lg">BBC question</h2>
          
          <QuestionOptions ep={ep} guess={guess} setGuess={setGuess} disabled={!!submitted} />
          {!revealed ? (
            <button className="link mt-4" disabled={!guess} onClick={() => setRevealed(true)}>
              reveal the answer
            </button>
          ) : (
            <div className="enter mt-6 space-y-4 border-l border-accent/50 pl-5 text-sm">
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
                <button className="link" onClick={() => p.playRange(answerRange.start, answerRange.end)}>
                  ▶ play this part
                </button>
              )}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {detected && guess && selfMark === null && (
                  <span className={guess === detected ? "text-ok" : "text-bad"}>
                    {guess === detected ? "✓ Correct" : `✗ The answer is ${detected})`}
                  </span>
                )}
                <span className="text-muted">{detected ? "Not right?" : "Were you right?"}</span>
                <button className={`link ${selfMark === true ? "text-ok" : ""}`} onClick={() => setSelfMark(true)}>right</button>
                <button className={`link ${selfMark === false ? "text-bad" : ""}`} onClick={() => setSelfMark(false)}>wrong</button>
              </div>
            </div>
          )}
        </section>
      )}

      {gaps.length > 0 && (
        <section >
          <h2 className="text-lg">Fill the gap</h2>
          <p className="mt-1 text-sm text-muted">
            {p.timings ? "Play each sentence and type the missing word or phrase." : "Fill in from memory. Play buttons appear once sentence timings are ready."}
          </p>
          <ol className="mt-4 space-y-3">
            {gaps.map((g, i) => {
              const ok = submitted ? sameAnswer(gapAnswers[i], g.answer) : null;
              return (
                <li key={g.sentence.idx} className="flex items-start gap-3">
                  <button
                    className="btn h-8 w-8 shrink-0 px-0"
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
                      className={`mx-1 inline-block w-40 border-b bg-transparent px-1 outline-none transition-colors ${
                        ok === null ? "border-line focus:border-accent" : ok ? "border-ok text-ok" : "border-bad text-bad"
                      }`}
                      value={gapAnswers[i]}
                      disabled={!!submitted}
                      onChange={(e) => setGapAnswers((a) => a.map((x, j) => (j === i ? e.target.value : x)))}
                    />
                    {submitted && !ok && <span className="text-ok">[{g.answer}]</span>}
                    {g.after}
                  </p>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {ep.vocab.length > 0 && (
        <section >
          <h2 className="text-lg">Match the words</h2>
          <ul className="mt-4 space-y-3">
            {ep.vocab.map((v, i) => {
              const ok = submitted ? matches[i] === v.term : null;
              return (
                <li key={v.term} className="grid gap-2 sm:grid-cols-[1fr_220px] sm:items-center">
                  <span className="text-sm text-foreground/80">{v.definition}</span>
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

      <div className="flex flex-wrap items-center gap-5">
        {!submitted ? (
          <button className="btn-primary" onClick={submit}>Check answers</button>
        ) : (
          <>
            <p className="pop text-3xl font-light tabular-nums">
              {submitted.score}/{submitted.total} <span className="text-base text-muted">{pct(submitted.score / submitted.total)}</span>
            </p>
            {submitted.first && <span className="text-sm text-muted">first-listen score saved</span>}
            <button className="link" onClick={reset}>try again</button>
          </>
        )}
      </div>
    </div>
  );
}
