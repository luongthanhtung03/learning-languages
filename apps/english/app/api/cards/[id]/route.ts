import { getCard, setSuspended } from "@/lib/flashcards/store";

/** Remove a card from reviews (or bring it back). */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const { suspended } = (await request.json()) as { suspended: boolean };
  if (!getCard(id)) return Response.json({ error: "Card not found" }, { status: 404 });
  setSuspended(id, suspended);
  return Response.json(getCard(id));
}
