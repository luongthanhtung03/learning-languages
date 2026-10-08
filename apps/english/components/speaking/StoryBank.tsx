"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client";
import type { Story, StoryInput } from "@/lib/speaking/stories";

type Listed = Story & { uses: number };

const STAR = [
  { key: "situation", label: "Situation", hint: "Where, when, who. One or two sentences." },
  { key: "task", label: "Task", hint: "What you had to achieve, and why it was hard." },
  { key: "action", label: "Action", hint: "What you did — say “I”, not “we”. The longest part." },
  { key: "result", label: "Result", hint: "What changed. A number if you have one." },
  { key: "lesson", label: "Lesson", hint: "What you learned or would do differently." },
] as const;

export function useStories() {
  const [stories, setStories] = useState<Listed[] | null>(null);
  const reload = useCallback(() => api<Listed[]>("/api/speaking/stories").then(setStories), []);
  useEffect(() => {
    api<Listed[]>("/api/speaking/stories").then(setStories);
  }, []);
  return { stories, reload };
}

export function StoryBank() {
  const { stories, reload } = useStories();
  const [editing, setEditing] = useState<number | "new" | null>(null);

  if (!stories) return <main className="mx-auto w-full max-w-4xl px-6 py-12 text-muted">Loading…</main>;

  return (
    <main className="enter-stagger mx-auto w-full max-w-4xl space-y-12 px-6 py-12">
      <header>
        <Link href="/speaking" className="link">← Speaking</Link>
        <h1 className="mt-6 text-4xl font-semibold tracking-tight">Story bank</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Six to eight real stories answer almost every behavioural question. Write each one once in STAR form, then reuse it: the same
          internship story can be about conflict, a deadline, or learning fast, depending on which part you stress.
        </p>
      </header>

      {editing === "new" ? (
        <StoryForm
          onSaved={async () => {
            await reload();
            setEditing(null);
          }}
          onCancel={() => setEditing(null)}
        />
      ) : (
        <button className="btn-primary" onClick={() => setEditing("new")}>+ New story</button>
      )}

      {stories.length === 0 && editing !== "new" && (
        <p className="text-sm text-muted">
          No stories yet. Ideas: your capstone project, an internship task, a bug you fixed under pressure, a disagreement in a team project, a
          time you taught yourself a new tool, a user you helped.
        </p>
      )}

      <ul className="space-y-8">
        {stories.map((s) =>
          editing === s.id ? (
            <li key={s.id}>
              <StoryForm
                story={s}
                onSaved={async () => {
                  await reload();
                  setEditing(null);
                }}
                onCancel={() => setEditing(null)}
              />
            </li>
          ) : (
            <li key={s.id} className="space-y-3 border-b border-line/60 pb-8">
              <div className="flex items-baseline gap-4">
                <h2 className="flex-1 text-xl">{s.title}</h2>
                {s.uses > 0 && <span className="text-xs text-muted">used {s.uses}×</span>}
                <button className="link" onClick={() => setEditing(s.id)}>edit</button>
              </div>
              <StoryView story={s} />
            </li>
          ),
        )}
      </ul>
    </main>
  );
}

export function StoryView({ story, compact }: { story: Story; compact?: boolean }) {
  return (
    <dl className={compact ? "space-y-1 text-sm" : "space-y-2 text-sm"}>
      {STAR.map((f) =>
        story[f.key] ? (
          <div key={f.key} className="flex gap-4">
            <dt className="w-20 shrink-0 text-muted">{f.label}</dt>
            <dd className="whitespace-pre-line text-foreground/85">{story[f.key]}</dd>
          </div>
        ) : null,
      )}
    </dl>
  );
}

export function StoryForm({ story, onSaved, onCancel }: { story?: Story; onSaved: (s: Story) => void; onCancel?: () => void }) {
  const [draft, setDraft] = useState<StoryInput>(story ?? {});
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof StoryInput, v: string) => setDraft((d) => ({ ...d, [k]: v }));

  const save = async () => {
    try {
      onSaved(await api<Story>("/api/speaking/stories", { method: "POST", json: { ...draft, id: story?.id } }));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="space-y-4 rounded-2xl bg-surface p-5">
      <input className="input" placeholder="Short title, e.g. “Internship: the slow report page”" value={draft.title ?? ""} onChange={(e) => set("title", e.target.value)} />
      {STAR.map((f) => (
        <label key={f.key} className="block space-y-1">
          <span className="text-sm text-muted">
            {f.label} <span className="text-xs">· {f.hint}</span>
          </span>
          <textarea className="input min-h-16 text-sm" value={draft[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)} />
        </label>
      ))}
      {error && <p className="text-sm text-bad">{error}</p>}
      <div className="flex items-center gap-4">
        <button className="btn-primary" onClick={save}>Save story</button>
        {onCancel && <button className="link" onClick={onCancel}>cancel</button>}
        {story && (
          <button
            className="link ml-auto text-bad"
            onClick={async () => {
              await api("/api/speaking/stories", { method: "POST", json: { id: story.id, delete: true } });
              onSaved(story);
            }}
          >
            delete
          </button>
        )}
      </div>
    </div>
  );
}
