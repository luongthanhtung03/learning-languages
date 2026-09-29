"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { DAY_LABEL, itemKey, type PlanItem, type TodayPlan } from "@/lib/plan-types";

export function itemHref(i: PlanItem) {
  if (i.kind === "listening") return `/listening/${i.episodeId}`;
  if (i.kind === "speaking") return `/speaking/practice/${i.topicNo}?kind=${i.sessionKind}`;
  if (i.kind === "review") return `/review?session=${i.session}`;
  return `/speaking/transcribe/${i.recordingId}`;
}

export function itemLabel(i: PlanItem) {
  if (i.kind === "listening") return "Listen";
  if (i.kind === "review") return i.session === 2 ? "Review 2" : "Review";
  if (i.kind === "speaking") return i.sessionKind === "new" ? "Speak" : i.sessionKind === "revisit" ? "Revisit" : "Self-check";
  return "Transcribe";
}

export function Today() {
  const router = useRouter();
  const [plan, setPlan] = useState<TodayPlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<TodayPlan>("/api/plan").then(setPlan, (e: Error) => setError(e.message));
  }, []);

  const startFocus = async () => {
    try {
      await document.documentElement.requestFullscreen();
    } catch {
      // the focus room shows its own "enter fullscreen" gate
    }
    router.push("/focus");
  };

  const skip = async (i: PlanItem) => setPlan(await api<TodayPlan>("/api/plan", { method: "POST", json: { action: "skip", key: itemKey(i) } }));

  const allDone = !!plan?.items.length && plan.items.every((i) => i.done);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center px-6 py-16">
      {error && <p className="text-bad">{error}</p>}
      {plan && (
        <div className="enter-stagger space-y-10">
          <header>
            <p className="text-sm text-muted">
              {new Date(`${plan.date}T00:00:00`).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
              {plan.dayType !== "new" && ` · ${DAY_LABEL[plan.dayType]}`}
            </p>
            <h1 className="mt-2 text-5xl font-semibold tracking-tight">{allDone ? "Done for today." : "Today"}</h1>
          </header>

          <ul className="space-y-1">
            {plan.items.map((i) => (
              <li key={itemKey(i)} className="group relative">
                <Link href={itemHref(i)} className="-mx-4 flex items-baseline gap-4 rounded-xl px-4 py-3 pr-16 transition hover:bg-surface">
                  <span className="w-20 shrink-0 text-sm text-muted">{itemLabel(i)}</span>
                  <span className={`min-w-0 flex-1 text-lg leading-snug transition ${i.done ? "text-muted line-through decoration-muted/50" : ""}`}>{i.title}</span>
                  {i.done && <span className="pop text-accent">✓</span>}
                </Link>
                {!i.done && i.kind !== "review" && (
                  <button
                    className="link absolute right-0 top-1/2 -translate-y-1/2 opacity-0 transition group-hover:opacity-100"
                    onClick={() => skip(i)}
                    title="Swap for another"
                  >
                    swap
                  </button>
                )}
              </li>
            ))}
            {!plan.items.length && <li className="text-muted">Nothing planned today.</li>}
          </ul>

          {plan.items.length > 0 && !allDone && (
            <div>
              <button className="btn-primary px-8 py-3 text-base" onClick={startFocus}>Begin</button>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
