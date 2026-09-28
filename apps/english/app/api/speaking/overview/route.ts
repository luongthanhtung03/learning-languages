import { monthlySeries, speakingOverview } from "@/lib/speaking/overview";

export async function GET(request: Request) {
  try {
    if (new URL(request.url).searchParams.has("monthly")) return Response.json(monthlySeries());
    return Response.json(speakingOverview());
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
