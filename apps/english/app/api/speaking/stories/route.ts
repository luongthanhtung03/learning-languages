import { deleteStory, listStories, saveStory, type StoryInput } from "@/lib/speaking/stories";

export async function GET() {
  return Response.json(listStories());
}

/** Create ({ ...fields }), update ({ id, ...fields }) or delete ({ id, delete: true }). */
export async function POST(request: Request) {
  const b = (await request.json()) as StoryInput & { id?: number; delete?: boolean };
  if (b.delete && b.id) {
    deleteStory(b.id);
    return Response.json({ ok: true });
  }
  const story = saveStory(b, b.id);
  if (!story) return Response.json({ error: "A story needs a title" }, { status: 400 });
  return Response.json(story);
}
