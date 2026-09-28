import { EpisodeClient } from "@/components/EpisodeClient";

export default async function EpisodePage({ params }: PageProps<"/episode/[id]">) {
  const { id } = await params;
  return <EpisodeClient id={id} />;
}
