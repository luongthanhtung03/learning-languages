import { getSettings, saveSettings, type Settings } from "@/lib/speaking/store";

export async function GET() {
  return Response.json(getSettings());
}

export async function PATCH(request: Request) {
  const patch = (await request.json()) as Partial<Settings>;
  const clamp = (v: unknown, lo: number, hi: number) => (typeof v === "number" ? Math.min(hi, Math.max(lo, Math.round(v))) : undefined);
  return Response.json(
    saveSettings({
      prep_seconds: clamp(patch.prep_seconds, 5, 120),
      research_minutes: clamp(patch.research_minutes, 1, 20),
      review_cap: clamp(patch.review_cap, 5, 40),
      goal_listening_hours: clamp(patch.goal_listening_hours, 10, 2000),
      goal_speaking_hours: clamp(patch.goal_speaking_hours, 10, 2000),
    }),
  );
}
