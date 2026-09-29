import { evaluate } from "@/lib/flashcards/evaluate";
import type { Rating } from "@/lib/flashcards/schedule";
import { getCard, getReview, rateReview, saveReviewResult, type Review } from "@/lib/flashcards/store";
import { cardReviewJob } from "@/lib/flashcards/transcribe";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Ctx) {
  const id = Number((await params).id);
  const review = getReview(id);
  if (!review) return Response.json({ error: "Review not found" }, { status: 404 });
  return Response.json({ review, job: cardReviewJob(id) });
}

/** Correct the transcript to what you actually said, then re-run the checks. */
export async function PATCH(request: Request, { params }: Ctx) {
  const id = Number((await params).id);
  const review = getReview(id);
  const card = review && getCard(review.card_id);
  if (!review || !card) return Response.json({ error: "Review not found" }, { status: 404 });
  const { transcript } = (await request.json()) as { transcript: string };
  const checks = await evaluate(transcript, card.term, review.pattern_id);
  return Response.json({ review: saveReviewResult(id, { transcript, edited: true, checks, status: "done" }) });
}

/** Final rating: schedules the card's next review. */
export async function POST(request: Request, { params }: Ctx) {
  const id = Number((await params).id);
  const { rating, self } = (await request.json()) as { rating: Rating; self?: Review["self"] };
  if (![0, 1, 2, 3].includes(rating)) return Response.json({ error: "Bad rating" }, { status: 400 });
  const result = rateReview(id, rating, self ?? null);
  if (!result) return Response.json({ error: "Review not found" }, { status: 404 });
  return Response.json(result);
}
