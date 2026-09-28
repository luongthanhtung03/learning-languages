import { getRecording, recordingErrors, saveEditedText } from "@/lib/speaking/store";
import { startTranscription, transcriptionJob } from "@/lib/speaking/transcribe";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Ctx) {
  const id = Number((await params).id);
  const rec = getRecording(id);
  if (!rec) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ ...rec, errors: recordingErrors(id), job: rec.status === "pending" ? transcriptionJob(id) : null });
}

/** Save the word-for-word transcript (transcribe day). */
export async function PATCH(request: Request, { params }: Ctx) {
  const id = Number((await params).id);
  const { editedText } = (await request.json()) as { editedText: string };
  if (!getRecording(id)) return Response.json({ error: "Not found" }, { status: 404 });
  saveEditedText(id, editedText);
  return Response.json({ ok: true });
}

/** Retry a failed transcription. */
export async function POST(_: Request, { params }: Ctx) {
  const id = Number((await params).id);
  if (!getRecording(id)) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ job: startTranscription(id) });
}
