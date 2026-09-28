import { EpisodeClient } from "@/components/listening/EpisodeClient";

export default async function EpisodePage({ params }: PageProps<"/listening/[id]">) {
  const { id } = await params;
  return <EpisodeClient id={id} />;
}
