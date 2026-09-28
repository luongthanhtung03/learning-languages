import { listEpisodes } from "@/lib/episodes";

export async function GET(request: Request) {
  const refresh = new URL(request.url).searchParams.has("refresh");
  try {
    return Response.json(await listEpisodes(refresh));
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 502 });
  }
}
