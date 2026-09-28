import { alignState, startAlignment } from "@/lib/listening/align";
import { getAlignment, saveAlignment } from "@/lib/db";
import type { Timing } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Ctx) {
  const { id } = await params;
  return Response.json(alignState(id));
}

/** Start (or restart) the whisper alignment job. */
export async function POST(_: Request, { params }: Ctx) {
  const { id } = await params;
  return Response.json({ alignment: null, job: startAlignment(id) });
}

/** Save hand-adjusted timings. */
export async function PATCH(request: Request, { params }: Ctx) {
  const { id } = await params;
  const current = getAlignment(id);
  if (!current) return Response.json({ error: "Not aligned yet" }, { status: 404 });
  const { sentences } = (await request.json()) as { sentences: Timing[] };
  saveAlignment(id, { ...current, sentences, edited: true });
  return Response.json({ ok: true });
}
