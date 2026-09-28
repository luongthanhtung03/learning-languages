import { getSettings, getSession, recordingErrors, roundPlan, secondaryTarget, sessionRecordings } from "./store";
import { findTopic, loadTopics } from "./topics";
import { transcriptionJob } from "./transcribe";

/** Everything the session screen needs in one payload. */
export function sessionDetail(id: number) {
  const session = getSession(id);
  if (!session) return null;
  const book = loadTopics();
  const topic = findTopic(book, session.topic_no);
  if (!topic) return null;
  const block = book.blocks.find((b) => b.no === topic.block)!;
  const settings = getSettings();
  return {
    session,
    topic,
    block: { no: block.no, name: block.name, target: block.target },
    rounds: roundPlan(topic.type, session.kind),
    recordings: sessionRecordings(id).map((r) => ({
      ...r,
      errors: recordingErrors(r.id),
      job: r.status === "pending" ? transcriptionJob(r.id) : null,
    })),
    secondary: secondaryTarget(),
    fillers: book.fillers,
    settings: { prep_seconds: settings.prep_seconds, research_minutes: settings.research_minutes },
  };
}

export type SessionDetail = NonNullable<ReturnType<typeof sessionDetail>>;
export type RecordingWithErrors = SessionDetail["recordings"][number];
