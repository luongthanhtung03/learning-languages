# English practice: listening and speaking

A local, dark, minimal web app: each day is one deep listening episode and one speaking topic, done in a fullscreen focus mode.

- **Listening:** [BBC Learning English: 6 Minute English](https://www.bbc.co.uk/learningenglish/english/features/6-minute-english) with a custom player, a first-listen quiz, dictation and shadowing
- **Speaking:** 60 topics for a Forward Deployed Engineer from [`fde-speaking-topics.md`](../../fde-speaking-topics.md): explain technical concepts to non-technical people, behavioural interview questions, and work situations. Each topic teaches first, then three shrinking rounds, recorded and transcribed. (The old IELTS list is in `archive/`.)

Everything runs on your PC. Whisper ([faster-whisper](https://github.com/SYSTRAN/faster-whisper)) handles both sentence timings for listening and transcripts of your own speaking.

## Setup

Requires **Node 22.5+** (uses the built-in `node:sqlite`) and **Python 3.9+**.

```bash
cd apps/english
npm install

python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt   # Windows
# .venv/bin/python -m pip install -r requirements.txt     # macOS / Linux

npm run dev
```

Open http://localhost:3000. The first Whisper run downloads the ~480 MB `small.en` model.

## Daily flow

**Today** (`/`) builds the day's plan:

| Part | What |
|---|---|
| Review | Flashcards first: up to 15 due cards (change it on `/speaking`). On day 7 a second, uncapped catch-up session is added |
| Listening | 1 **deep** episode: listen → quiz → dictation → shadow → review |
| Speaking | Follows the 7-day rhythm from the topics file (below) |

Press **Begin** to go fullscreen with only today's plan. If you leave fullscreen (Esc, Alt+Tab), a *Focus paused* screen covers everything, and timers, recording and audio freeze until you click *Return to focus*. You can leave once everything is done, or by holding *End early* for 5 seconds.

> Browsers never let a page trap you in fullscreen (Esc always works, for security), so focus mode pauses instead of blocking.

### Speaking rhythm

- **Days 1–5:** 1 new topic a day from the current block, in order. The block advances when all 10 are done.
- **Day 6, transcribe day:** correct Whisper's draft of one of this week's recordings into a word-for-word transcript and tag your errors.
- **Day 7, spaced revisit:** 2 topics from the previous block, one 90s round each.
- **Every 4 weeks:** a re-record of Topic 221 (Tell me about yourself) is added. `/speaking/progress` charts words per minute, long pauses and repetitions over time.

### One speaking topic

Three topic types: **EX** explain a concept, **BQ** behavioural interview question, **WS** work situation.

1. **Learn:** what the concept is (or what the interviewer is really testing), key points, an analogy, words you'll hear, common mistakes, and the answer pattern with sentence starters.
2. **Reveal:** the topic, the block's language target, the rounds and who each one is for, your secondary target (from the error log) and the filler lifeline.
3. **Prep** 30s → **Round 1** 2:00 (EX: to an engineer · BQ/WS: cold). Recording starts automatically. There's **no pause and no restart**.
4. **Review:** the Whisper transcript with pauses ≥2s, fillers and repeated words marked, plus stats.
5. **Study** (5 min): the model answers (EX: engineer / manager / executive versions; ▶ listen reads them aloud), **better ways to say it** (weak → strong, each can become a card), 3–5 phrases for your notes, and for BQ the story from your **story bank** (`/speaking/stories`).
6. **Round 2** 1:30 (EX: to a non-technical manager, with an analogy · BQ: STAR with your story · WS: the answer pattern). The pattern starters show during prep and hide while recording.
7. **Round 3** 1:00 (EX: an executive in 45s · BQ/WS: the tight version), then answer a **follow-up question** in the same recording.
8. **Compare:** R1 → R3 stats, which phrases made it in, how much jargon slipped into the non-technical rounds, the follow-up's model answer, and a self-check list. Your phrases become flashcards.

Click any word in a transcript to log an error (article, plural -s, past -ed, he go, …). A pattern logged **3+ times in 14 days** becomes your secondary target. See `/speaking/errors`.

## Flashcards

Cards come only from what you studied:
- **Episode words:** when you finish an episode, you pick which of its 6 words to keep. 3–4 is best.
- **Topic phrases:** when you finish a speaking topic, your study phrases become cards, plus any “better way to say it” you tap.

**One card:**
1. You see the word and a language pattern from the blocks you've reached (e.g. *an analogy: think of it like…*).
2. Record one sentence using both (max 30s).
3. Listen back, then flip. The back shows the BBC definition and the sentence from the episode where you heard it.

**Checks:**
- Whisper transcribes you. Edit the transcript if it tidied up your mistakes.
- The app checks the word is there (any form) and the pattern is there. The pattern check is loose; some patterns, like articles, are self-checked only.
- [LanguageTool](https://languagetool.org)'s free public API checks grammar. The transcript text is sent to it; set `LANGUAGETOOL_URL` to use your own server instead.

**Rating:** the app suggests Again / Hard / Good / Easy from the checks and your ticks (meaning was wrong / not fluent / felt easy). You can override it.

**Scheduling (SM-2, like Anki):**
- The first review is 1–4 days out; after that the interval multiplies by the card's ease (starting at 2.5).
- Again resets the interval to 1 day. Late reviews count part of the delay.
- Patterns aren't scheduled; they're weighted. Ones you fail often, haven't used in a week, belong to your current block, or match your error-log target come up more.

At 4 new words a day, expect roughly 16 due cards a day in month 1 and 35 by month 8. The cap keeps each day at about 15 minutes, and the day-7 catch-up clears the rest.

## Listening tools

- **Player:** play/pause, seek, speed (click cycles 0.75 / 1 / 1.25×). Skipping, A–B loop and sentence replay are on the keyboard (below)
- **Quiz:** first about 8 **understanding** questions on the conversation (main idea, details, who thinks what), then the BBC weekly question, listen-and-fill-the-gap, and vocabulary matching last. Everything counts towards your first-listen score, which is saved from your first attempt.
- **Dictation:** sentence by sentence with a word diff, or write the whole script
- **Shadowing:** auto-pause after each sentence, repeat N times, record yourself
- **Level-up check:** over your last 10 episodes, first-listen quiz ≥ 80% and first-try dictation ≥ 90%

### Keyboard shortcuts (listening)

| Key | Action |
|---|---|
| `Space` | play / pause |
| `←` `→` | back / forward 5s (`Shift` for 10s) |
| `[` `]` | slower / faster |
| `R` | replay the current sentence |
| `L` | set loop start, then loop end · `Esc` clears |
| In a text box: `Ctrl+Space` | replay sentence (dictation) or play/pause (whole script) |
| In a text box: `Ctrl+[` `Ctrl+]` | back / forward 5s |

## Options (environment variables)

| Variable | Default | Notes |
|---|---|---|
| `WHISPER_MODEL` | `small.en` | `base.en` is faster, `medium.en` is more accurate |
| `WHISPER_DEVICE` | `cpu` | `cuda` if CUDA 12 + cuDNN are installed |
| `WHISPER_COMPUTE` | `int8` | e.g. `float16` on GPU |
| `PYTHON` | `.venv` python | another interpreter |
| `TOPICS_FILE` | `../../fde-speaking-topics.md` | where the speaking topics come from |
| `APP_DATA_DIR` | `./data` | database and media folder (useful for testing) |
| `LANGUAGETOOL_URL` | public API | grammar check endpoint for flashcard sentences |

## Data

All of it lives in `data/` (git-ignored): `app.db` (SQLite: progress, plans, transcripts, error log), `audio/` and `align/` (BBC episodes and timings), and `recordings/` (your speaking and flashcard recordings).
BBC audio, transcripts and vocabulary belong to the BBC. This app is for personal study only.

## Topic packs

Every topic has an offline pack in `content/topics/<topic no>.json`, so nothing needs searching while you practise:

```json
{
  "ideas": ["…"],
  "phrases": [{ "phrase": "think of it like", "meaning": "introduces an analogy" }],
  "learn": { "explain": "…", "points": ["…"], "analogy": "…", "glossary": [{ "term": "…", "meaning": "…" }], "mistakes": ["…"] },
  "framework": [{ "step": "Define", "starter": "In simple terms, an API is…" }],
  "betterWays": [{ "weak": "…", "strong": "…", "why": "…" }],
  "model": "…", "short": "…", "audience": { "engineer": "…" },
  "followUps": [{ "q": "…", "answer": "…" }],
  "jargon": ["…"],
  "selfCheck": ["…"]
}
```

`model` is the manager version for EX, the STAR answer for BQ and the spoken reply for WS; `short` is the executive / tight version. `audience`, `analogy`, `glossary` and `jargon` are for EX topics. Check the packs with `node scripts/check-topics.mjs`.

## Understanding questions

They live in `content/gist/<episode id>.json` and are committed, so a fresh clone has them for every episode:

```json
{ "questions": [{ "q": "What is the programme mainly about?", "options": ["…", "…", "…", "…"], "answer": 1, "why": "…" }] }
```

`answer` is the 0-based index of the correct option; `why` is shown when you get it wrong. Check the files with `node scripts/check-gist.mjs`, and add `--missing` to list new BBC episodes that don't have questions yet (for example, ask Claude Code to write them). An episode without a file just skips the section.

## Code map

- `lib/listening/`: BBC scraping, sentence splitting, alignment job, dictation diff, quiz helpers
- `lib/speaking/`: topics-file parser, sessions / recordings / error-log store, speech stats, transcription job
- `lib/plan.ts`: the daily plan and 7-day rhythm
- `lib/whisper.ts`: shared Whisper job queue; `scripts/align.py`, `scripts/transcribe.py`
- `components/listening/`, `components/speaking/`, `components/FocusRoom.tsx`, `components/Today.tsx`
