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
    <div className="enter-stagger max-w-3xl space-y-12">
      <div className="space-y-3">
        <p className="text-sm text-muted">Transcribe · Round {rec.round}</p>
        <h2 className="text-3xl font-semibold tracking-tight text-balance">{topicText}</h2>
      </div>
      <section className="space-y-4">
        <h3 className="text-sm text-muted">Correct the draft word for word, mistakes included.</h3>
        <audio src={`/api/speaking/recordings/${rec.id}/audio`} controls preload="metadata" className="h-9 w-full" />
        <textarea className="input min-h-48 leading-relaxed" value={text ?? ""} onChange={(e) => (setText(e.target.value), setSaved(false))} />
        <div className="flex items-center gap-5">
          <button
            className="btn-primary"
            disabled={!text?.trim()}
            onClick={async () => {
              await api(`/api/speaking/recordings/${rec.id}`, { method: "PATCH", json: { editedText: text } });
              setSaved(true);
              onDone?.();
            }}
          >
            Save
          </button>
          {saved && <span className="pop text-sm text-accent">✓ saved</span>}
        </div>
      </section>
      <section className="space-y-4">
        <h3 className="text-sm text-muted">Mark your errors</h3>
        <TranscriptTagger rec={rec} onChanged={() => void load()} />
      </section>
      {rec.stats && (
        <section >
          <StatsTable columns={[{ label: `Round ${rec.round}`, stats: rec.stats }]} />
        </section>
      )}
    </div>
  );
}
