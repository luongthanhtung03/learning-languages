import fs from "node:fs";
import path from "node:path";
import { createRecording, getSession } from "@/lib/speaking/store";
import { RECORDINGS_DIR, startTranscription } from "@/lib/speaking/transcribe";

/** Upload one round's audio (multipart: sessionId, round, duration, audio). Transcription starts right away. */
export async function POST(request: Request) {
  const form = await request.formData();
  const sessionId = Number(form.get("sessionId"));
  const round = Number(form.get("round"));
  const duration = Number(form.get("duration")) || 0;
  const audio = form.get("audio");
  if (!getSession(sessionId) || !round || !(audio instanceof Blob) || audio.size === 0)
    return Response.json({ error: "Bad upload" }, { status: 400 });

  fs.mkdirSync(RECORDINGS_DIR, { recursive: true });
  const ext = audio.type.includes("mp4") ? "m4a" : audio.type.includes("ogg") ? "ogg" : "webm";
  const file = `s${sessionId}-r${round}-${Date.now()}.${ext}`;
  fs.writeFileSync(path.join(RECORDINGS_DIR, file), Buffer.from(await audio.arrayBuffer()));

  const rec = createRecording(sessionId, round, duration, file);
  startTranscription(rec.id);
  return Response.json(rec);
}
