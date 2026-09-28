import Link from "next/link";
import { SpeakingSession } from "@/components/speaking/SpeakingSession";
import type { SessionKind } from "@/lib/speaking/store";

export default async function PracticePage({ params, searchParams }: PageProps<"/speaking/practice/[topic]">) {
  const { topic } = await params;
  const { kind } = await searchParams;
  const k: SessionKind = kind === "revisit" || kind === "monthly" ? kind : "new";
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6">
      <Link href="/speaking" className="text-sm text-muted hover:underline">← Speaking</Link>
      <div className="mt-4">
        <SpeakingSession topicNo={Number(topic)} kind={k} />
      </div>
    </main>
  );
}
