import { getSettings, saveSettings, type Settings } from "@/lib/speaking/store";

export async function GET() {
  return Response.json(getSettings());
}

export async function PATCH(request: Request) {
  const patch = (await request.json()) as Partial<Settings>;
  const clamp = (v: unknown, lo: number, hi: number) => (typeof v === "number" ? Math.min(hi, Math.max(lo, Math.round(v))) : undefined);
  return Response.json(
    saveSettings({
      topics_per_day: clamp(patch.topics_per_day, 1, 3),
      prep_seconds: clamp(patch.prep_seconds, 5, 120),
      research_minutes: clamp(patch.research_minutes, 1, 20),
    }),
  );
}
