import { today } from "@/lib/plan";
import { sessionDetail } from "@/lib/speaking/detail";
import { findOrCreateSession, type SessionKind } from "@/lib/speaking/store";
import { findTopic, loadTopics } from "@/lib/speaking/topics";

/** Start (or resume) today's session for a topic. */
export async function POST(request: Request) {
  const { topicNo, kind = "new", date } = (await request.json()) as { topicNo: number; kind?: SessionKind; date?: string };
  if (!findTopic(loadTopics(), topicNo)) return Response.json({ error: "Unknown topic" }, { status: 404 });
  if (!["new", "revisit", "monthly"].includes(kind)) return Response.json({ error: "Unknown kind" }, { status: 400 });
  const session = findOrCreateSession(topicNo, kind, date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : today());
  return Response.json(sessionDetail(session.id));
}
