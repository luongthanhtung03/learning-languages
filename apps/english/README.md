# English practice: listening and speaking

A local web app with one daily plan and a fullscreen focus mode for two kinds of practice.

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
| Listening | 1 **deep** episode (listen → quiz → dictation → shadowing) + 1 **light** episode (listen + quiz) |
| Speaking | Follows the 7-day rhythm from the topics file (below) |

Press **Start focus session** to go fullscreen with only today's plan. If you leave fullscreen (Esc, Alt+Tab), a *Focus paused* screen covers everything, and timers, recording and audio freeze until you click *Return to focus*. You can leave once everything is done, or by holding *End early* for 5 seconds.

> Browsers never let a page trap you in fullscreen (Esc always works, for security), so focus mode pauses instead of blocking.

### Speaking rhythm

- **Days 1–5:** new topics from the current block, in order (1 a day by default; change it in Settings). The block advances when all 10 are done.
- **Day 6, transcribe day:** correct Whisper's draft of one of this week's recordings into a word-for-word transcript and tag your errors.
- **Day 7, spaced revisit:** 2 topics from the previous block, one 60s round each.
- **Every 4 weeks:** a Topic 11 re-record is added. `/speaking/progress` charts words per minute, long pauses and repetitions over time.

### One speaking topic

1. **Reveal:** the topic, the block's language target, your secondary target (from the error log) and the filler lifeline.
2. **Prep** 30s → **Round 1 (cold)** 90s for P2 / 60s for P3 and TQ. Recording starts automatically. There's **no pause and no restart**.
3. **Review:** the Whisper transcript with pauses ≥2s, fillers and repeated words marked, plus stats.
4. **Research** (5 min): fill a notes card with phrases, one sentence using the target, and one new idea.
5. **Prep → Round 2 (target):** you must use the block's language target. Notes are hidden while recording.
6. **Prep → Round 3 (compress):** 60s / 45s.
7. **Compare:** R1 → R3 stats, then listen back to Round 3 and tag errors.

Click any word in a transcript to log an error (article, plural -s, past -ed, he go, …). A pattern logged **3+ times in 14 days** becomes your secondary target. See `/speaking/errors`.

## Listening tools

- **Custom player:** ±5s / ±10s, speed 0.5–1.5×, A–B loop, replay the current sentence
- **Quiz:** the BBC weekly question, listen-and-fill-the-gap, vocabulary matching. Your first attempt is saved as your first-listen score.
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

## Data

All of it lives in `data/` (git-ignored): `app.db` (SQLite: progress, plans, transcripts, error log), `audio/` and `align/` (BBC episodes and timings), and `recordings/` (your speaking recordings).
BBC audio, transcripts and vocabulary belong to the BBC. This app is for personal study only.

## Code map

- `lib/listening/`: BBC scraping, sentence splitting, alignment job, dictation diff, quiz helpers
- `lib/speaking/`: topics-file parser, sessions / recordings / error-log store, speech stats, transcription job
- `lib/plan.ts`: the daily plan and 7-day rhythm
- `lib/whisper.ts`: shared Whisper job queue; `scripts/align.py`, `scripts/transcribe.py`
- `components/listening/`, `components/speaking/`, `components/FocusRoom.tsx`, `components/Today.tsx`
