import { addRound, addTopic, getPlan, skipItem, today } from "@/lib/plan";

const dateParam = (request: Request) => {
  const d = new URL(request.url).searchParams.get("date"); // debug override: ?date=YYYY-MM-DD
  return d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : today();
};

export async function GET(request: Request) {
  try {
    return Response.json(getPlan(dateParam(request)));
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const body = (await request.json()) as { action: "skip"; key: string } | { action: "more" } | { action: "topic" };
  if (body.action === "more") return Response.json(addRound(dateParam(request)));
  if (body.action === "topic") return Response.json(addTopic(dateParam(request)));
  if (body.action !== "skip") return Response.json({ error: "Unknown action" }, { status: 400 });
  return Response.json(skipItem(dateParam(request), body.key));
}
