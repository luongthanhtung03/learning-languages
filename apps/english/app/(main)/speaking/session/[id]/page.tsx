import Link from "next/link";
import { SpeakingSession } from "@/components/speaking/SpeakingSession";

export default async function SessionPage({ params }: PageProps<"/speaking/session/[id]">) {
  const { id } = await params;
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6">
      <Link href="/speaking" className="text-sm text-muted hover:underline">← Speaking</Link>
      <div className="mt-4">
        <SpeakingSession sessionId={Number(id)} />
      </div>
    </main>
  );
}
