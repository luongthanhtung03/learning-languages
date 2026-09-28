# English listening: BBC 6 Minute English practice

A local web app for practising with [BBC Learning English: 6 Minute English](https://www.bbc.co.uk/learningenglish/english/features/6-minute-english).
It loads the episode list, audio, transcript and vocabulary straight from the BBC and adds:

- **A custom player**: ±5s / ±10s, speed 0.5–1.5×, A–B loop, replay current sentence, keyboard shortcuts
- **A first-listen quiz**: the BBC's weekly question, listen-and-fill-the-gap on the vocabulary, and vocabulary matching. Your first attempt is saved as your first-listen score.
- **Dictation**: sentence by sentence with a word-level diff and accuracy, or write the whole script and compare
- **Shadowing**: plays each sentence, pauses for you to repeat (adjustable), repeats N times, with optional voice recording to compare
- **An interactive transcript**: click a sentence to play from there, follows the audio, highlights vocabulary
- **Progress tracking**: daily targets (1 deep + 1 light episode), streak, 30-day plan (60 episodes), and a level-up check

Sentence timings come from [faster-whisper](https://github.com/SYSTRAN/faster-whisper), which runs locally. The first time you open an episode, it transcribes the MP3 (about 1–3 min on CPU) and aligns the words to the BBC transcript sentences.

## Setup

Requires **Node 22.5+** (uses the built-in `node:sqlite`) and **Python 3.9+**.

```bash
cd apps/english-listening
npm install

# Python env for Whisper (the first run downloads the ~480 MB small.en model)
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt   # Windows
# .venv/bin/python -m pip install -r requirements.txt     # macOS / Linux

npm run dev
```

Open http://localhost:3000.

### Options (environment variables)

| Variable | Default | Notes |
|---|---|---|
| `WHISPER_MODEL` | `small.en` | `base.en` is faster, `medium.en` is more accurate |
| `WHISPER_DEVICE` | `cpu` | `cuda` if you have the CUDA 12 + cuDNN libraries installed |
| `WHISPER_COMPUTE` | `int8` | e.g. `float16` on GPU |
| `PYTHON` | `.venv` python | path to another Python interpreter |

## Keyboard shortcuts

| Key | Action |
|---|---|
| `Space` | play / pause |
| `←` `→` | back / forward 5s (`Shift` for 10s) |
| `[` `]` | slower / faster |
| `R` | replay the current sentence |
| `L` | set loop start, then loop end · `Esc` clears |
| In a text box: `Ctrl+Space` | replay sentence (dictation) or play/pause (whole script) |
| In a text box: `Ctrl+[` `Ctrl+]` | back / forward 5s |
| Dictation: `Enter` | check, then next sentence |

## How the level-up check works

It looks at your last 10 finished episodes. When both of these hold, the dashboard says you're ready for harder material (e.g. *Learning English from the News*, *The English We Speak*, then native podcasts):

- average **first-listen quiz** score ≥ 80%
- average **first-try dictation** accuracy ≥ 90% (at 1× speed or faster)

## Data

Everything is stored locally in `data/` (git-ignored):

- `data/app.db`: SQLite with the episode cache, sentence timings and your progress
- `data/audio/`: MP3s downloaded for alignment
- `data/align/`: Whisper alignment output

Audio, transcripts and vocabulary belong to the BBC. This app is for personal study only.

## Code map

- `lib/bbc.ts`: scrapes the episode list and episode pages (MP3, transcript, vocab, weekly question)
- `lib/sentences.ts`: splits transcript turns into sentences
- `scripts/align.py`: Whisper word timestamps → sentence start/end times
- `lib/db.ts`: SQLite schema, progress and dashboard queries
- `components/player.tsx`: shared audio player context and shortcuts
- `components/*Panel.tsx`: Listen, Quiz, Dictation, Shadowing and Transcript tabs
