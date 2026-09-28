import type { EpisodeStatus, StudyMode } from "./types";

export type EpisodeProgress = {
  status: { status: EpisodeStatus; mode: StudyMode | null; first_listen_score: number | null; completed_at: string | null } | null;
  dictation: { sentence_idx: number; best: number; first: number | null; attempts: number }[];
  quizzes: { score: number; total: number; at: string }[];
};

export async function api<T>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: init?.json !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? `Request failed (${res.status})`);
  return data as T;
}

export const pct = (x: number | null | undefined) => (x === null || x === undefined ? "—" : `${Math.round(x * 100)}%`);
