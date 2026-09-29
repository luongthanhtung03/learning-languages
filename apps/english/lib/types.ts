export type EpisodeSummary = {
  id: string; // e.g. "260924" (YYMMDD)
  path: string; // BBC path, e.g. /learningenglish/english/features/6-minute-english_2026/ep-260924
  title: string;
  date: string; // ISO yyyy-mm-dd
  description: string;
  image: string;
};

export type QuestionOption = { letter: string; text: string };

export type Turn = { speaker: string; text: string };

/** Multiple-choice comprehension question about the conversation (content/gist/<id>.json). */
export type GistQuestion = { q: string; options: string[]; answer: number; why?: string };

export type Sentence = {
  idx: number;
  turn: number;
  speaker: string;
  text: string;
};

export type EpisodeDetail = EpisodeSummary & {
  intro: string;
  question: { text: string; options: QuestionOption[] } | null;
  vocab: { term: string; definition: string }[];
  turns: Turn[];
  sentences: Sentence[];
  answerTurns: number[]; // indices into turns where the quiz answer is revealed
  mp3: string | null;
  transcriptPdf: string | null;
  worksheetPdf: string | null;
  gist?: GistQuestion[] | null; // attached at request time, never cached
};

export type Timing = { idx: number; start: number; end: number; matched: number };

export type Alignment = {
  model: string;
  duration: number;
  sentences: Timing[];
  edited?: boolean;
};

export type EpisodeStatus = "new" | "in-progress" | "done";
export type StudyMode = "deep" | "light";
