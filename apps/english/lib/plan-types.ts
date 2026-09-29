// Shapes shared by the plan API and the Today / Focus pages (client-safe).

export type PlanItem =
  | { kind: "listening"; mode: "deep"; episodeId: string; title: string; done: boolean }
  | { kind: "speaking"; sessionKind: "new" | "revisit" | "monthly"; topicNo: number; title: string; type: string; done: boolean }
  | { kind: "transcribe"; recordingId: number; topicNo: number; title: string; done: boolean };

export type DayType = "new" | "transcribe" | "revisit";

export type TodayPlan = {
  date: string;
  cycleDay: number; // 1..7
  dayType: DayType;
  block: { no: number; name: string; target: string } | null;
  items: PlanItem[];
};

export const DAY_LABEL: Record<DayType, string> = {
  new: "New topics",
  transcribe: "Transcribe day",
  revisit: "Spaced revisit",
};

export const itemKey = (i: PlanItem) =>
  i.kind === "listening" ? `l:${i.mode}` : i.kind === "speaking" ? `s:${i.sessionKind}:${i.topicNo}` : `t:${i.recordingId}`;
