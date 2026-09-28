import fs from "node:fs";
import path from "node:path";
import { getRecording } from "@/lib/speaking/store";
import { RECORDINGS_DIR } from "@/lib/speaking/transcribe";

const TYPES: Record<string, string> = { webm: "audio/webm", ogg: "audio/ogg", m4a: "audio/mp4" };

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const rec = getRecording(Number((await params).id));
  const file = rec && path.join(RECORDINGS_DIR, path.basename(rec.file));
  if (!file || !fs.existsSync(file)) return new Response("Not found", { status: 404 });
  const ext = path.extname(file).slice(1);
  return new Response(fs.readFileSync(file), {
    headers: { "Content-Type": TYPES[ext] ?? "application/octet-stream", "Cache-Control": "private, max-age=3600" },
  });
}
