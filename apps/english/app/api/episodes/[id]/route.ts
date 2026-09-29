import { getEpisode } from "@/lib/listening/episodes";
import { markStarted } from "@/lib/db";
import { loadGist } from "@/lib/listening/gist";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const refresh = new URL(request.url).searchParams.has("refresh");
  try {
    const episode = await getEpisode(id, refresh);
    markStarted(id);
    return Response.json({ ...episode, gist: loadGist(id) });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 502 });
  }
}
