"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api, pct } from "@/lib/client";
import type { Dashboard, EpisodeRow } from "@/lib/db";
import { ListeningStats } from "./ListeningStats";

const PAGE = 30;
const STATUSES = [
  { id: "all", label: "All" },
  { id: "new", label: "New" },
  { id: "in-progress", label: "Started" },
  { id: "done", label: "Done" },
];

export function Library() {
  const [episodes, setEpisodes] = useState<EpisodeRow[] | null>(null);
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [limit, setLimit] = useState(PAGE);
  const [refreshing, setRefreshing] = useState(false);

  const load = (refresh = false) =>
    api<{ episodes: EpisodeRow[] }>(`/api/episodes${refresh ? "?refresh=1" : ""}`).then(
      (r) => {
        setEpisodes(r.episodes);
        setError(null);
      },
      (e: Error) => setError(e.message),
    );

  useEffect(() => {
    api<{ episodes: EpisodeRow[] }>("/api/episodes").then(
      (r) => setEpisodes(r.episodes),
      (e: Error) => setError(e.message),
    );
    api<Dashboard>("/api/progress").then(setDash);
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (episodes ?? []).filter(
      (e) =>
        (status === "all" || e.status === status) &&
        (!needle || e.title.toLowerCase().includes(needle) || e.description.toLowerCase().includes(needle) || e.date.startsWith(needle)),
    );
  }, [episodes, q, status]);

  return (
    <main className="enter-stagger mx-auto w-full max-w-4xl space-y-14 px-6 py-12">
      <header className="space-y-8">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight">Listening</h1>
          <p className="mt-2 text-sm text-muted">BBC 6 Minute English · one deep episode a day</p>
        </div>
        {dash && <ListeningStats dash={dash} />}
      </header>

      <section className="space-y-6">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <input
            className="input max-w-56 py-1.5 text-sm"
            placeholder="Search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setLimit(PAGE);
            }}
          />
          <div className="flex gap-4 text-sm">
            {STATUSES.map((s) => (
              <button
                key={s.id}
                className={`transition ${status === s.id ? "text-foreground" : "text-muted hover:text-foreground"}`}
                onClick={() => (setStatus(s.id), setLimit(PAGE))}
              >
                {s.label}
              </button>
            ))}
          </div>
          <button
            className="link ml-auto"
            disabled={refreshing}
            onClick={async () => {
              setRefreshing(true);
              await load(true);
              setRefreshing(false);
            }}
          >
            {refreshing ? "checking…" : "check for new"}
          </button>
        </div>
        {error && <p className="text-sm text-bad">Couldn&apos;t load episodes from the BBC: {error}</p>}
        {!episodes && !error && <p className="text-muted">Loading episodes…</p>}
        <ul>
          {filtered.slice(0, limit).map((e) => (
            <li key={e.id}>
              <Link href={`/listening/${e.id}`} className="group -mx-3 flex items-center gap-4 rounded-xl px-3 py-3 transition hover:bg-surface">
                {e.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={e.image} alt="" loading="lazy" className="h-10 w-14 shrink-0 rounded-md object-cover opacity-60 grayscale transition group-hover:opacity-100 group-hover:grayscale-0" />
                )}
                <div className="min-w-0 flex-1">
                  <p className={`truncate transition ${e.status === "done" ? "text-muted" : "text-foreground/90 group-hover:text-foreground"}`}>{e.title}</p>
                  <p className="text-xs text-muted">
                    {new Date(e.date).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
                <StatusMark e={e} />
              </Link>
            </li>
          ))}
        </ul>
        {filtered.length > limit && (
          <button className="link" onClick={() => setLimit((l) => l + PAGE)}>more</button>
        )}
      </section>
    </main>
  );
}

function StatusMark({ e }: { e: EpisodeRow }) {
  if (e.status === "done")
    return <span className="shrink-0 text-xs tabular-nums text-accent">✓{e.first_listen_score !== null && ` ${pct(e.first_listen_score)}`}</span>;
  if (e.status === "in-progress") return <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" title="In progress" />;
  return null;
}
