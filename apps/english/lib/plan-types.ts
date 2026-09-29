// Shapes shared by the plan API and the Today / Focus pages (client-safe).

export type PlanItem =
  | { kind: "listening"; mode: "deep"; episodeId: string; title: string; done: boolean }
  | { kind: "speaking"; sessionKind: "new" | "revisit" | "monthly"; topicNo: number; title: string; type: string; done: boolean }
  | { kind: "transcribe"; recordingId: number; topicNo: number; title: string; done: boolean }
  | { kind: "review"; session: 1 | 2; title: string; left: number; done: boolean };

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
  i.kind === "listening"
    ? `l:${i.mode}:${i.episodeId}`
    : i.kind === "speaking"
      ? `s:${i.sessionKind}:${i.topicNo}`
      : i.kind === "review"
        ? `r:${i.session}`
        : `t:${i.recordingId}`;
