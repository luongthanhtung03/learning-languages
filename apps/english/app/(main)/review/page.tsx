import { Deck } from "@/components/flashcards/Deck";
import { Review } from "@/components/flashcards/Review";

export default async function ReviewPage({ searchParams }: { searchParams: Promise<{ session?: string }> }) {
  const { session } = await searchParams;
  return (
    <main className="mx-auto w-full max-w-4xl space-y-20 px-6 py-12">
      <Review session={session === "2" ? 2 : 1} />
      <Deck />
    </main>
  );
}
