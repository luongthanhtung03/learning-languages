import Link from "next/link";
import { notFound } from "next/navigation";
import { TranscribeTask } from "@/components/speaking/TranscribeTask";
import { getRecording, getSession } from "@/lib/speaking/store";
import { findTopic, loadTopics } from "@/lib/speaking/topics";

export default async function TranscribePage({ params }: PageProps<"/speaking/transcribe/[id]">) {
  const id = Number((await params).id);
  const rec = getRecording(id);
  const session = rec && getSession(rec.session_id);
  if (!rec || !session) notFound();
  const topic = findTopic(loadTopics(), session.topic_no);
  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10">
      <Link href="/" className="link">← Today</Link>
      <div className="mt-10">
        <TranscribeTask recordingId={id} topicText={topic?.text ?? `Topic ${session.topic_no}`} />
      </div>
    </main>
  );
}
