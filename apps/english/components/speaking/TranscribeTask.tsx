"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client";
import type { RecordingRow, SpeakingError } from "@/lib/speaking/store";
import { StatsTable } from "./bits";
import { TranscriptTagger } from "./TranscriptTagger";

type Rec = RecordingRow & { errors: SpeakingError[] };

/** Day 6 of the rhythm: turn Whisper's draft into a word-for-word transcript and mark your own errors. */
export function TranscribeTask({ recordingId, topicText, onDone }: { recordingId: number; topicText: string; onDone?: () => void }) {
  const [rec, setRec] = useState<Rec | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const apply = useCallback((r: Rec) => {
    setRec(r);
    setText((t) => t ?? r.edited_text ?? r.text ?? "");
    setSaved(!!r.edited_text);
  }, []);
  const load = useCallback(() => api<Rec>(`/api/speaking/recordings/${recordingId}`).then(apply), [recordingId, apply]);

  useEffect(() => {
    api<Rec>(`/api/speaking/recordings/${recordingId}`).then(apply);
  }, [recordingId, apply]);

  if (!rec) return <p className="text-muted">Loading recording…</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Transcribe day · Round {rec.round} recording</p>
        <h2 className="text-2xl font-semibold text-balance">{topicText}</h2>
        <p className="text-sm text-muted">
          Write it out word for word, including your mistakes. Then mark the errors yourself. This is where accuracy comes from.
        </p>
      </div>
      <section className="card space-y-3 p-5">
        <h3 className="font-semibold">1 · Correct Whisper&apos;s draft so it matches exactly what you said</h3>
        <audio src={`/api/speaking/recordings/${rec.id}/audio`} controls preload="metadata" className="h-9 w-full" />
        <textarea className="input min-h-48 leading-relaxed" value={text ?? ""} onChange={(e) => (setText(e.target.value), setSaved(false))} />
        <div className="flex items-center gap-3">
          <button
            className="btn-primary"
            disabled={!text?.trim()}
            onClick={async () => {
              await api(`/api/speaking/recordings/${rec.id}`, { method: "PATCH", json: { editedText: text } });
              setSaved(true);
              onDone?.();
            }}
          >
            Save word-for-word transcript
          </button>
          {saved && <span className="text-sm text-ok">✓ Saved</span>}
        </div>
      </section>
      <section className="card space-y-3 p-5">
        <h3 className="font-semibold">2 · Mark your errors</h3>
        <TranscriptTagger rec={rec} onChanged={() => void load()} />
      </section>
      {rec.stats && (
        <section className="card p-5">
          <StatsTable columns={[{ label: `Round ${rec.round}`, stats: rec.stats }]} />
        </section>
      )}
    </div>
  );
}
