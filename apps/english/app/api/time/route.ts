import { addStudyTime, getStudyTime, SKILLS, type Skill } from "@/lib/study-time";

export async function GET() {
  return Response.json(getStudyTime());
}

// text() rather than json(): navigator.sendBeacon posts without a JSON content type
export async function POST(request: Request) {
  try {
    const { skill, seconds } = JSON.parse(await request.text()) as { skill: Skill; seconds: number };
    if (!SKILLS.includes(skill) || typeof seconds !== "number") return Response.json({ error: "Bad beat" }, { status: 400 });
    addStudyTime(skill, seconds);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Bad beat" }, { status: 400 });
  }
}
