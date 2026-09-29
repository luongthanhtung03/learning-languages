import { getEpisode } from "@/lib/listening/episodes";
import { termRegex } from "@/lib/listening/vocab";
import { addCards, cardsFor, deckOverview } from "@/lib/flashcards/store";
import { getSession } from "@/lib/speaking/store";
import { findTopic, loadTopics } from "@/lib/speaking/topics";

export async function GET(request: Request) {
  const episode = new URL(request.url).searchParams.get("episode");
  if (episode) return Response.json({ terms: cardsFor("episode", episode) });
  return Response.json(deckOverview());
}

const DEFINITION = /\b(means?|meaning|(talk|talking|learning) about|is (an? )?(informal |formal )?way (to|of)|we use|describes?|refers to|if (something|someone|you|a person)|someone who is|is used to (say|describe))\b/i;

type Body ={ episodeId: string; terms: string[] } | { sessionId: number };

/** Create cards from a finished episode (the words you kept) or a finished topic (your research phrases). */
export async function POST(request: Request) {
  const body = (await request.json()) as Body;

  if ("episodeId" in body) {
    const ep = await getEpisode(body.episodeId);
    const keep = new Set(body.terms);
    addCards(
      ep.vocab
        .filter((v) => keep.has(v.term))
        .map((v) => {
          const re = termRegex(v.term);
          const hits = re ? ep.sentences.filter((s) => re.test(s.text)) : [];
          // prefer a real use of the word over the presenters explaining it
          const words = (t: string) => t.split(/\s+/).length;
          const usable = hits.filter((s) => words(s.text) >= 5 && words(s.text) <= 30);
          const example = usable.find((s) => !DEFINITION.test(s.text)) ?? usable[0] ?? hits.sort((a, b) => words(a.text) - words(b.text))[0];
          return {
            kind: "word" as const,
            term: v.term,
            definition: v.definition,
            example: example?.text ?? null,
            source: "episode" as const,
            source_id: ep.id,
            source_title: ep.title,
          };
        }),
    );
    return Response.json({ terms: cardsFor("episode", ep.id) });
  }

  const session = getSession(body.sessionId);
  if (!session) return Response.json({ error: "Session not found" }, { status: 404 });
  const topic = findTopic(loadTopics(), session.topic_no);
  const example = session.notes.targetSentence?.trim() || null;
  const phrases = (session.notes.phrases ?? "")
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-•*]|\d+[.)])\s*/, "").replace(/[…]+$|\.{3}$/, "").trim())
    .filter((l) => l.length >= 2)
    .slice(0, 5);
  addCards(
    phrases.map((p) => ({
      kind: "phrase" as const,
      term: p,
      definition: null,
      example: example && example.toLowerCase().includes(p.toLowerCase()) ? example : null,
      source: "topic" as const,
      source_id: String(session.id),
      source_title: topic?.text ?? `Topic ${session.topic_no}`,
    })),
  );
  return Response.json({ terms: cardsFor("topic", String(session.id)) });
}
