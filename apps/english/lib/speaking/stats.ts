export type Word = { w: string; start: number; end: number; p?: number };

export type SpeechStats = {
  words: number; // spoken words, fillers excluded
  wpm: number;
  pauses: number; // silences of 2s or more
  longestPause: number;
  fillers: number;
  repetitions: number; // "I I", "it's it's", "I think I think": a rough proxy for false starts
  speakingTime: number; // seconds from first to last word
};

export const PAUSE_SECONDS = 2;
const FILLERS = new Set(["um", "umm", "uh", "uhh", "uhm", "er", "erm", "ah", "hmm", "hm", "mm", "mmm"]);

export const normWord = (w: string) => w.toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z0-9']/g, "");

export const isFiller = (w: string) => FILLERS.has(normWord(w));

export function computeStats(words: Word[]): SpeechStats {
  const spoken = words.filter((w) => normWord(w.w));
  const real = spoken.filter((w) => !isFiller(w.w));
  const speakingTime = spoken.length ? spoken[spoken.length - 1].end - spoken[0].start : 0;

  let pauses = spoken.length && spoken[0].start >= PAUSE_SECONDS ? 1 : 0;
  let longestPause = spoken.length ? spoken[0].start : 0;
  for (let i = 1; i < spoken.length; i++) {
    const gap = spoken[i].start - spoken[i - 1].end;
    if (gap >= PAUSE_SECONDS) pauses++;
    longestPause = Math.max(longestPause, gap);
  }

  const keys = real.map((w) => normWord(w.w));
  let repetitions = 0;
  for (let i = 0; i < keys.length - 1; i++) {
    if (keys[i] === keys[i + 1]) repetitions++;
    else if (i + 3 < keys.length && keys[i] === keys[i + 2] && keys[i + 1] === keys[i + 3]) {
      repetitions++;
      i += 1;
    }
  }

  return {
    words: real.length,
    wpm: speakingTime > 1 ? Math.round((real.length / speakingTime) * 60) : 0,
    pauses,
    longestPause: Math.round(longestPause * 10) / 10,
    fillers: spoken.length - real.length,
    repetitions,
    speakingTime: Math.round(speakingTime * 10) / 10,
  };
}
