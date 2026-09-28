import { sessionDetail } from "@/lib/speaking/detail";
import { updateSession, type SessionNotes } from "@/lib/speaking/store";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Ctx) {
  const detail = sessionDetail(Number((await params).id));
  return detail ? Response.json(detail) : Response.json({ error: "Not found" }, { status: 404 });
}

export async function PATCH(request: Request, { params }: Ctx) {
  const id = Number((await params).id);
  const body = (await request.json()) as { notes?: SessionNotes; completed?: boolean };
  if (!updateSession(id, body)) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(sessionDetail(id));
}
