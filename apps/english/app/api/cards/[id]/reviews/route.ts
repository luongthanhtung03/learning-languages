import fs from "node:fs";
import path from "node:path";
import { patternById } from "@/lib/flashcards/patterns";
import { createReview, getCard } from "@/lib/flashcards/store";
import { CARD_AUDIO_DIR, startCardTranscription } from "@/lib/flashcards/transcribe";

/** Upload the sentence you said for a card (multipart: patternId, audio). Transcription and checks start right away. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const cardId = Number((await params).id);
  const form = await request.formData();
  const patternId = String(form.get("patternId") ?? "");
  const audio = form.get("audio");
  if (!getCard(cardId) || !patternById(patternId) || !(audio instanceof Blob) || audio.size === 0)
    return Response.json({ error: "Bad upload" }, { status: 400 });

  fs.mkdirSync(CARD_AUDIO_DIR, { recursive: true });
  const ext = audio.type.includes("mp4") ? "m4a" : audio.type.includes("ogg") ? "ogg" : "webm";
  const file = `c${cardId}-${Date.now()}.${ext}`;
  fs.writeFileSync(path.join(CARD_AUDIO_DIR, file), Buffer.from(await audio.arrayBuffer()));

  const review = createReview(cardId, patternId, file);
  startCardTranscription(review.id);
  return Response.json(review);
}
