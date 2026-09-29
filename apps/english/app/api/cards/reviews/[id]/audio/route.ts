import fs from "node:fs";
import path from "node:path";
import { getReview } from "@/lib/flashcards/store";
import { CARD_AUDIO_DIR } from "@/lib/flashcards/transcribe";

const TYPES: Record<string, string> = { webm: "audio/webm", ogg: "audio/ogg", m4a: "audio/mp4" };

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const review = getReview(Number((await params).id));
  const file = review?.audio_file && path.join(CARD_AUDIO_DIR, path.basename(review.audio_file));
  if (!file || !fs.existsSync(file)) return new Response("Not found", { status: 404 });
  const ext = path.extname(file).slice(1);
  return new Response(fs.readFileSync(file), {
    headers: { "Content-Type": TYPES[ext] ?? "application/octet-stream", "Cache-Control": "private, max-age=3600" },
  });
}
