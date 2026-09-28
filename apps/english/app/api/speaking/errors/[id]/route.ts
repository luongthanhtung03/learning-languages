import { deleteError } from "@/lib/speaking/store";

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  deleteError(Number((await params).id));
  return Response.json({ ok: true });
}
