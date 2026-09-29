import Link from "next/link";
import { SpeakingSession } from "@/components/speaking/SpeakingSession";

export default async function SessionPage({ params }: PageProps<"/speaking/session/[id]">) {
  const { id } = await params;
  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10">
      <Link href="/speaking" className="link">← Speaking</Link>
      <div className="mt-10">
        <SpeakingSession sessionId={Number(id)} />
      </div>
    </main>
  );
}
