import { addError, allErrors, getRecording, secondaryTarget, type ErrorTag } from "@/lib/speaking/store";
import { ERROR_TAGS } from "@/lib/speaking/tags";

export async function GET() {
  const errors = allErrors();
  const counts = ERROR_TAGS.map((t) => ({ ...t, count: errors.filter((e) => e.tag === t.id).length }));
  return Response.json({ errors, counts, secondary: secondaryTarget() });
}

export async function POST(request: Request) {
  const b = (await request.json()) as {
    recordingId: number; wordStart: number; wordEnd: number; tag: ErrorTag; wrong?: string; correct?: string;
  };
  if (!getRecording(b.recordingId) || !ERROR_TAGS.some((t) => t.id === b.tag))
    return Response.json({ error: "Bad request" }, { status: 400 });
  const id = addError({
    recording_id: b.recordingId,
    word_start: b.wordStart,
    word_end: Math.max(b.wordStart, b.wordEnd),
    tag: b.tag,
    wrong: b.wrong?.trim() || null,
    correct: b.correct?.trim() || null,
  });
  return Response.json({ id, secondary: secondaryTarget() });
}
