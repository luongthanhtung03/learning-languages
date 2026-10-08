"use client";

import type { TopicPack } from "@/lib/speaking/pack";
import type { TopicType } from "@/lib/speaking/topics";

const EXPLAIN_LABEL: Record<TopicType, string> = {
  EX: "The concept",
  BQ: "What they are really asking",
  WS: "What the other person needs",
};

const POINTS_LABEL: Record<TopicType, string> = {
  EX: "Key points",
  BQ: "A good answer shows",
  WS: "A good reply does",
};

/** Read before Round 1: what the topic is about, and the shape a good answer takes. */
export function LearnStep({ header, type, pack, onNext }: { header: React.ReactNode; type: TopicType; pack: TopicPack; onNext: () => void }) {
  const l = pack.learn;
  return (
    <div className="enter-stagger max-w-3xl space-y-10">
      {header}
      {l && (
        <section className="space-y-8">
          <div className="space-y-2">
            <p className="text-sm text-muted">{EXPLAIN_LABEL[type]}</p>
            <p className="leading-relaxed text-foreground/90">{l.explain}</p>
          </div>
          {l.analogy && (
            <div className="space-y-2">
              <p className="text-sm text-muted">Analogy</p>
              <p className="border-l border-accent/50 pl-5 leading-relaxed text-foreground/85">{l.analogy}</p>
            </div>
          )}
          {!!l.points.length && (
            <div className="space-y-2">
              <p className="text-sm text-muted">{POINTS_LABEL[type]}</p>
              <ul className="list-disc space-y-1.5 pl-5 text-foreground/85">
                {l.points.map((p) => <li key={p}>{p}</li>)}
              </ul>
            </div>
          )}
          {!!l.glossary.length && (
            <div className="space-y-2">
              <p className="text-sm text-muted">Words you’ll hear</p>
              <dl className="space-y-1.5 text-sm">
                {l.glossary.map((g) => (
                  <div key={g.term} className="flex gap-4">
                    <dt className="w-40 shrink-0 text-foreground">{g.term}</dt>
                    <dd className="text-foreground/75">{g.meaning}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
          {!!l.mistakes.length && (
            <div className="space-y-2">
              <p className="text-sm text-muted">Common mistakes</p>
              <ul className="space-y-1.5 text-sm text-foreground/80">
                {l.mistakes.map((m) => <li key={m}><span className="text-bad">✗</span> {m}</li>)}
              </ul>
            </div>
          )}
        </section>
      )}
      <Framework pack={pack} />
      <button className="btn-primary px-8 py-3 text-base" onClick={onNext}>Got it · start</button>
    </div>
  );
}

/** The answer pattern: one sentence starter per step. */
export function Framework({ pack, compact }: { pack: TopicPack; compact?: boolean }) {
  if (!pack.framework.length) return null;
  return (
    <div className="space-y-2">
      {!compact && <p className="text-sm text-muted">Answer pattern</p>}
      <ol className={`space-y-1.5 ${compact ? "text-sm" : ""}`}>
        {pack.framework.map((f, i) => (
          <li key={f.step} className="flex gap-4">
            <span className="w-5 shrink-0 text-right font-mono text-xs leading-6 text-muted">{i + 1}</span>
            <span className="w-32 shrink-0 text-accent">{f.step}</span>
            <span className="italic text-foreground/80">“{f.starter}”</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
