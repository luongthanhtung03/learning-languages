import { addDictationAttempt, addQuizAttempt, getEpisodeProgress, setStatus } from "@/lib/db";
import type { EpisodeStatus, StudyMode } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Ctx) {
  const { id } = await params;
  return Response.json(getEpisodeProgress(id));
}

type Body =
  | { type: "quiz"; score: number; total: number; details?: unknown }
  | { type: "dictation"; sentenceIdx: number; accuracy: number; text: string; speed: number }
  | { type: "status"; status: EpisodeStatus; mode?: StudyMode };

export async function POST(request: Request, { params }: Ctx) {
  const { id } = await params;
  const body = (await request.json()) as Body;
  if (body.type === "quiz") addQuizAttempt(id, body.score, body.total, body.details ?? null);
  else if (body.type === "dictation") addDictationAttempt(id, body.sentenceIdx, body.accuracy, body.text, body.speed);
  else if (body.type === "status") setStatus(id, body.status, body.mode ?? null);
  else return Response.json({ error: "Unknown type" }, { status: 400 });
  return Response.json(getEpisodeProgress(id));
}
