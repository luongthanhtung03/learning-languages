import Link from "next/link";
import { SpeakingSession } from "@/components/speaking/SpeakingSession";
import type { SessionKind } from "@/lib/speaking/store";

export default async function PracticePage({ params, searchParams }: PageProps<"/speaking/practice/[topic]">) {
  const { topic } = await params;
  const { kind } = await searchParams;
  const k: SessionKind = kind === "revisit" || kind === "monthly" ? kind : "new";
  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10">
      <Link href="/speaking" className="link">← Speaking</Link>
      <div className="mt-10">
        <SpeakingSession topicNo={Number(topic)} kind={k} />
      </div>
    </main>
  );
}
