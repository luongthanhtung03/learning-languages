import fs from "node:fs";
import path from "node:path";
import { DATA_DIR } from "../db";
import { enqueue, getJob, runPython } from "../whisper";
import { evaluate } from "./evaluate";
import { getCard, getReview, saveReviewResult } from "./store";

export const CARD_AUDIO_DIR = path.join(DATA_DIR, "recordings", "cards");

const key = (id: number) => `card:${id}`;

export function cardReviewJob(id: number) {
  return getJob(key(id));
}

/** Transcribe one flashcard sentence, then run the word / pattern / grammar checks. */
export function startCardTranscription(id: number) {
  return enqueue(
    key(id),
    async (job) => {
      const review = getReview(id);
      const card = review && getCard(review.card_id);
      if (!review || !card || !review.audio_file) throw new Error("Review not found");
      const audio = path.join(CARD_AUDIO_DIR, review.audio_file);
      const out = path.join(CARD_AUDIO_DIR, `${id}.transcript.json`);
      try {
        await runPython("transcribe.py", [audio, out], job);
        const { text } = JSON.parse(fs.readFileSync(out, "utf-8")) as { text: string };
        job.stage = "checking grammar";
        const checks = await evaluate(text, card.term, review.pattern_id);
        saveReviewResult(id, { transcript: text.trim(), checks, status: "done" });
      } catch (e) {
        saveReviewResult(id, { status: "error", error: (e as Error).message });
        throw e;
      }
    },
    { immediate: true },
  );
}
