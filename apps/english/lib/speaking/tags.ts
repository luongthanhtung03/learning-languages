// Error categories for the speaking error log (from the typical Vietnamese-L1 patterns in 120-speaking-topics.md)
export const ERROR_TAGS = [
  { id: "article", label: "Missing / wrong article", target: "articles (a / the / zero)" },
  { id: "plural", label: "Missing plural -s", target: "plural -s" },
  { id: "past", label: "Missing past -ed / wrong past", target: "past tense endings" },
  { id: "agreement", label: "Subject–verb (he go / she have)", target: "3rd person -s agreement" },
  { id: "subject", label: "Missing subject", target: "always saying the subject" },
  { id: "tense", label: "Wrong tense", target: "tense choice" },
  { id: "word", label: "Word choice / collocation", target: "collocations" },
  { id: "preposition", label: "Preposition", target: "prepositions" },
  { id: "pronunciation", label: "Pronunciation / final consonant", target: "final consonants" },
  { id: "other", label: "Other", target: "" },
] as const;

export type ErrorTag = (typeof ERROR_TAGS)[number]["id"];
