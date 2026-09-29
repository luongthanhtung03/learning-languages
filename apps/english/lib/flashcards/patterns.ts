// Grammar patterns for flashcard sentences, split out of the 12 block targets in 120-speaking-topics.md.
// `detect` is a loose check on the Whisper transcript; null means the pattern can only be self-checked.

export type Pattern = {
  id: string;
  block: number;
  label: string; // shown on the card front: "Use it with …"
  example: string; // a model of the pattern, not of the word
  detect: RegExp | null;
};

const PARTICIPLE = "(?:\\w+ed|\\w+en|made|built|done|given|taken|known|seen|found|told|sold|written|held|left|kept|paid|put|set|shown|thought|brought|bought|caught|taught|spent|sent|met|lost|won|read|heard|felt|had|got|gone|been)";

export const PATTERNS: Pattern[] = [
  { id: "rel-who", block: 1, label: "a relative clause with who", example: "She's the teacher who changed my mind about maths.", detect: /\bwho\b/i },
  { id: "rel-which", block: 1, label: "a relative clause with which / that", example: "It's a habit which I picked up at university.", detect: /\b(which|that)\s+\w+/i },
  { id: "rel-where", block: 1, label: "a relative clause with where", example: "That's the café where we first met.", detect: /\bwhere\b/i },
  { id: "pres-cont", block: 1, label: "the present continuous (is/are …ing)", example: "More people are working from home these days.", detect: /\b(am|is|are|'m|'re)\s+(\w+\s+)?\w+ing\b/i },

  { id: "there-is", block: 2, label: "there is / there are", example: "There are lots of small shops near my flat.", detect: /\bthere(\s+is|\s+are|'s|\s+was|\s+were)\b/i },
  { id: "prep-place", block: 2, label: "a preposition of place (next to, opposite, between…)", example: "The station is right opposite the park.", detect: /\b(next to|opposite|between|behind|in front of|near|beside|across from|on the corner of|at the end of)\b/i },
  { id: "comparative", block: 2, label: "a comparative (…er than / more … than)", example: "The city is much busier than it used to be.", detect: /\b(\w+er|more\s+\w+|less\s+\w+|better|worse)\s+than\b/i },
  { id: "superlative", block: 2, label: "a superlative (the …est / the most …)", example: "It's the most relaxing place I know.", detect: /\bthe\s+(most|least|best|worst|\w+est)\b/i },

  { id: "past-simple", block: 3, label: "the past simple", example: "Last year I bought my first bike.", detect: null },
  { id: "articles", block: 3, label: "careful articles (a / the / no article)", example: "I bought a laptop, but the battery was terrible.", detect: null },

  { id: "past-cont", block: 4, label: "the past continuous (was …ing when…)", example: "I was walking home when it started to rain.", detect: /\b(was|were)\s+(\w+\s+)?\w+ing\b/i },
  { id: "sequencing", block: 4, label: "sequencing words (first, then, after that, in the end)", example: "First we got lost, then we found a map, and in the end we loved it.", detect: /\b(first(ly)?|then|after that|afterwards|in the end|finally|eventually)\b/i },

  { id: "pres-perf", block: 5, label: "the present perfect (have + past participle)", example: "I've never had to give a speech in English.", detect: new RegExp(`\\b(have|has|'ve|haven't|hasn't)\\s+(never\\s+|ever\\s+|just\\s+|already\\s+|always\\s+|recently\\s+)?${PARTICIPLE}\\b`, "i") },
  { id: "pres-perf-cont", block: 5, label: "the present perfect continuous (have been …ing)", example: "I've been working on this project for months.", detect: /\b(have|has|'ve|'s)\s+been\s+\w+ing\b/i },

  { id: "used-to", block: 6, label: "used to for a past habit", example: "I used to take the bus to school every day.", detect: /\bused\s+to\b/i },
  { id: "would-habit", block: 6, label: "would for a past habit", example: "On Sundays my grandma would cook for the whole family.", detect: null },
  { id: "no-longer", block: 6, label: "no longer / not … anymore", example: "I no longer drink coffee after lunch.", detect: /\b(no longer|any ?more)\b/i },

  { id: "future", block: 7, label: "a future form (will / going to)", example: "I'm going to start a new course next month.", detect: /\b(will|'ll|won't|going to|gonna)\b/i },
  { id: "future-likely", block: 7, label: "a prediction (might / is likely to / by 2035…)", example: "Robots are likely to do most of the cleaning by 2035.", detect: /\b(might|may well|likely to|unlikely to|by 20\d\d|bound to)\b/i },

  { id: "hedge", block: 8, label: "hedging (tend to / arguably / I'd say / to some extent)", example: "People tend to trust the news less than before, I'd say.", detect: /\b(tend to|tends to|arguably|it seems to me|i'd say|i would say|to some extent|to a certain extent|more or less|generally speaking)\b/i },

  { id: "modal-advice", block: 9, label: "advice (should / ought to / had better)", example: "You'd better sleep early before a big exam.", detect: /\b(should|shouldn't|ought to|had better|'d better)\b/i },
  { id: "modal-obligation", block: 9, label: "obligation (have to / must / be supposed to)", example: "We're supposed to wear a helmet on these bikes.", detect: /\b(have to|has to|had to|must|mustn't|supposed to|need to|don't have to)\b/i },

  { id: "cond-1", block: 10, label: "a first conditional (If + present, … will)", example: "If they build a new park, more families will move here.", detect: /\bif\b[^.?!]*\b(will|'ll|won't|can|is going to)\b|\b(will|'ll|won't)\b[^.?!]*\bif\b/i },
  { id: "cond-2", block: 10, label: "a second conditional (If + past, … would)", example: "If I had more free time, I would learn to cook.", detect: /\bif\b[^.?!]*\b(would|'d|could|might)\b|\b(would|'d|could)\b[^.?!]*\bif\b/i },

  { id: "cause", block: 11, label: "cause and effect (leads to / due to / which means that)", example: "Cheap flights lead to more pollution, which means that…", detect: /\b(leads? to|led to|results? in|resulted in|due to|because of|which means( that)?|as a (consequence|result)|that's why)\b/i },

  { id: "concession", block: 12, label: "concession (although / despite / whereas)", example: "Although it's expensive, I think it's worth it.", detect: /\b(although|even though|though|despite|in spite of|whereas|while it's true)\b/i },
  { id: "passive", block: 12, label: "the passive voice (is made / was built)", example: "Most of these phones are made in Asia.", detect: new RegExp(`\\b(is|are|was|were|been|being|be|get|gets|got|'s|'re)\\s+(\\w+ly\\s+)?${PARTICIPLE}\\b`, "i") },
];

export const patternById = (id: string) => PATTERNS.find((p) => p.id === id) ?? null;

/** Error-log tags that map onto a pattern, so a recurring error makes that pattern come up more. */
export const TAG_PATTERN: Record<string, string> = { article: "articles", past: "past-simple" };
