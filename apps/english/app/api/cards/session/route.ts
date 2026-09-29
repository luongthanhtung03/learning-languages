import { sessionCards, sessionStatus } from "@/lib/flashcards/store";

/** Cards for today's review session (1 = daily capped session, 2 = the weekly catch-up). */
export async function GET(request: Request) {
  const session = new URL(request.url).searchParams.get("n") === "2" ? 2 : 1;
  return Response.json({ session, status: sessionStatus(session), items: sessionCards(session) });
}
