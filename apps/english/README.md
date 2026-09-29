# English practice: listening and speaking

A local, dark, minimal web app: each day is one deep listening episode and one speaking topic, done in a fullscreen focus mode.

- **Listening:** [BBC Learning English: 6 Minute English](https://www.bbc.co.uk/learningenglish/english/features/6-minute-english) with a custom player, a first-listen quiz, dictation and shadowing
- **Speaking:** the 12-block rotation from [`120-speaking-topics.md`](../../120-speaking-topics.md), three timed rounds per topic, recorded and transcribed

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
- **Day 7, spaced revisit:** 2 topics from the previous block, one 60s round each.
- **Every 4 weeks:** a Topic 11 re-record is added. `/speaking/progress` charts words per minute, long pauses and repetitions over time.

### One speaking topic

1. **Reveal:** the topic, the block's language target, your secondary target (from the error log) and the filler lifeline.
2. **Prep** 30s (with 2–3 idea angles) → **Round 1 (cold)** 2:00 for P2 / 1:30 for P3 and TQ. Recording starts automatically. There's **no pause and no restart**.
3. **Review:** the Whisper transcript with pauses ≥2s, fillers and repeated words marked, plus stats.
4. **Research** (5 min): read the **model answer** (▶ listen reads it aloud), tap 3–5 of its phrases into your notes, and write one sentence using the target.
5. **Prep → Round 2 (target):** you must use the block's language target and your phrases. Notes are hidden while recording.
6. **Prep → Round 3 (polish):** same length, same content, no restarts.
7. **Compare:** R1 → R3 stats, which of your phrases made it into Rounds 2 and 3, then listen back to Round 3 and tag errors. Your phrases become flashcards.

Click any word in a transcript to log an error (article, plural -s, past -ed, he go, …). A pattern logged **3+ times in 14 days** becomes your secondary target. See `/speaking/errors`.

## Flashcards

Cards come only from what you studied:
- **Episode words:** when you finish an episode, you pick which of its 6 words to keep. 3–4 is best.
- **Topic phrases:** when you finish a speaking topic, your research phrases become cards.

**One card:**
1. You see the word and a grammar pattern from the blocks you've reached (e.g. *a relative clause with who*).
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
| `TOPICS_FILE` | `../../120-speaking-topics.md` | where the speaking topics come from |
| `APP_DATA_DIR` | `./data` | database and media folder (useful for testing) |
| `LANGUAGETOOL_URL` | public API | grammar check endpoint for flashcard sentences |

## Data

All of it lives in `data/` (git-ignored): `app.db` (SQLite: progress, plans, transcripts, error log), `audio/` and `align/` (BBC episodes and timings), and `recordings/` (your speaking and flashcard recordings).
BBC audio, transcripts and vocabulary belong to the BBC. This app is for personal study only.

## Research packs

Every topic has an offline pack in `content/topics/<topic no>.json`, so research works in fullscreen without the internet:

```json
{ "ideas": ["…"], "phrases": [{ "phrase": "someone I look up to", "meaning": "a person I admire" }], "model": "…" }
```

It has 2–3 idea angles (shown before Round 1), 8 phrases, and a band-7 model answer that uses the block's target (shown only after Round 1). Check them with `node scripts/check-topics.mjs`.

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
