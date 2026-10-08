// Language patterns for flashcard sentences, one set per block target in fde-speaking-topics.md.
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
  { id: "analogy", block: 1, label: "an analogy (think of it like… / it's a bit like…)", example: "Think of an API like a waiter: you order, it brings back what you asked for.", detect: /\b(think of it (like|as)|it's (a bit |kind of )?like|imagine|similar to|the same way)\b/i },
  { id: "so-what", block: 1, label: "the so-what (what this means for you is…)", example: "What this means for you is that pages load in under a second.", detect: /\b(what (this|that) means( for you)? is|which means( that)?|so for you|in practice)\b/i },
  { id: "articles", block: 1, label: "careful articles (a / the / no article)", example: "We added a cache, and the cache cut the load time in half.", detect: null },
  { id: "past-simple", block: 1, label: "the past simple", example: "Last month we moved the database to the cloud.", detect: null },

  { id: "trade-off", block: 2, label: "a trade-off (the trade-off is… / on the other hand)", example: "The trade-off is that bigger models are slower and cost more.", detect: /\b(trade-?off|on the other hand|the downside|the catch is|at the cost of|in exchange)\b/i },
  { id: "hedge", block: 2, label: "hedging (it depends / in most cases / tends to)", example: "In most cases, a good prompt gets you ninety percent of the way.", detect: /\b(it depends|depends on|in most cases|tends? to|usually|generally|to some extent|i'd say|i would say|more or less)\b/i },
  { id: "cond-1", block: 2, label: "a first conditional (If + present, … will)", example: "If we add more documents, the answers will get more accurate.", detect: /\bif\b[^.?!]*\b(will|'ll|won't|can|is going to)\b|\b(will|'ll|won't)\b[^.?!]*\bif\b/i },

  { id: "star", block: 3, label: "a STAR transition (the situation was / what I did was / as a result)", example: "What I did was split the task into three smaller releases.", detect: /\b(the situation was|my (task|job|role) was|what i did was|i decided to|as a result|in the end|the result was)\b/i },
  { id: "pres-perf", block: 3, label: "the present perfect (have + past participle)", example: "I've worked with Python for three years.", detect: new RegExp(`\b(have|has|'ve|haven't|hasn't)\s+(never\s+|ever\s+|just\s+|already\s+|always\s+|recently\s+)?${PARTICIPLE}\b`, "i") },
  { id: "sequencing", block: 3, label: "sequencing words (first, then, after that, in the end)", example: "First I reproduced the bug, then I wrote a test for it.", detect: /\b(first(ly)?|then|after that|afterwards|in the end|finally|eventually)\b/i },

  { id: "reflection", block: 4, label: "reflection (looking back / what I learned was)", example: "Looking back, I should have asked for help earlier.", detect: /\b(looking back|in hindsight|what i learned|i learned that|next time|if i did it again)\b/i },
  { id: "should-have", block: 4, label: "should have / would have + past participle", example: "I would have tested it on real data first.", detect: new RegExp(`\b(should|would|could)(n't)?\s+have\s+${PARTICIPLE}\b|\b(should|would|could)'ve\b`, "i") },
  { id: "concession", block: 4, label: "concession (although / even though / despite)", example: "Although I disagreed, I tried his approach first.", detect: /\b(although|even though|though|despite|in spite of|whereas)\b/i },

  { id: "diplomatic", block: 5, label: "diplomatic language (I completely understand / what I'd suggest is)", example: "I completely understand. What I'd suggest is a smaller first release.", detect: /\b(i (completely |totally |fully )?understand|what i'd suggest|i'd suggest|i'd recommend|would it be possible|i'm afraid|unfortunately)\b/i },
  { id: "clarify", block: 5, label: "a clarifying question (just to make sure… / do you mean…?)", example: "Just to make sure I've got this right — you need it by Friday?", detect: /\b(just to (make sure|confirm|check)|do you mean|if i understand (you |this )?correctly|let me make sure|so what you're saying)\b/i },
  { id: "passive", block: 5, label: "the passive voice (is being fixed / was caused by)", example: "The outage was caused by an expired certificate.", detect: new RegExp(`\b(is|are|was|were|been|being|be|get|gets|got|'s|'re)\s+(\w+ly\s+)?${PARTICIPLE}\b`, "i") },

  { id: "signpost", block: 6, label: "signposting (there are three things / first… second…)", example: "There are two things I want to cover: the design and the risks.", detect: /\b(there are (two|three|a few) (things|points|parts)|first(ly)?,|second(ly)?|the (first|second|last) (thing|point)|to sum up|in short)\b/i },
  { id: "check", block: 6, label: "checking understanding (does that make sense? / any questions so far?)", example: "Does that make sense so far?", detect: /\b(does (that|this) make sense|any questions|so far|is that clear|are you with me)\b/i },
  { id: "future", block: 6, label: "a future plan (I'll / I'm going to / by Friday)", example: "I'm going to finish the tests today and open the PR tomorrow.", detect: /\b(will|'ll|won't|going to|gonna|by (monday|tuesday|wednesday|thursday|friday|tomorrow|end of))\b/i },
];

export const patternById = (id: string) => PATTERNS.find((p) => p.id === id) ?? null;

/** Error-log tags that map onto a pattern, so a recurring error makes that pattern come up more. */
export const TAG_PATTERN: Record<string, string> = { article: "articles", past: "past-simple" };
