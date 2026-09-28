"""Transcribe a speaking recording with word timestamps, keeping filler words.

Usage: python transcribe.py <audio> <out.json>
Output: {"text", "duration", "words": [{"w", "start", "end", "p"}]}

Env: WHISPER_MODEL (default small.en), WHISPER_DEVICE (cpu), WHISPER_COMPUTE (int8)
"""

import json
import os
import sys

# Whisper normally drops hesitations. Priming it with a disfluent prompt makes it
# transcribe "um", "uh" and repeated words, which is exactly what we want to count.
FILLER_PROMPT = "Umm, let me think, uh... so, I I think, hmm, it's, it's like, er, you know, well..."


def emit(obj):
    print(json.dumps(obj), flush=True)


def main():
    audio, out_path = sys.argv[1:3]
    from faster_whisper import WhisperModel

    model_name = os.environ.get("WHISPER_MODEL", "small.en")
    emit({"stage": "loading model"})
    model = WhisperModel(
        model_name,
        device=os.environ.get("WHISPER_DEVICE", "cpu"),
        compute_type=os.environ.get("WHISPER_COMPUTE", "int8"),
    )
    segments, info = model.transcribe(
        audio,
        language="en",
        word_timestamps=True,
        initial_prompt=FILLER_PROMPT,
        condition_on_previous_text=False,
        vad_filter=False,
    )
    duration = float(info.duration)
    emit({"stage": "transcribing", "duration": duration})

    words, parts = [], []
    for seg in segments:
        parts.append(seg.text.strip())
        for w in seg.words or []:
            text = w.word.strip()
            if text:
                words.append({"w": text, "start": round(w.start, 2), "end": round(w.end, 2), "p": round(w.probability, 2)})
        emit({"progress": round(min(seg.end / max(duration, 0.1), 1.0), 3)})

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump({"text": " ".join(parts).strip(), "duration": round(duration, 2), "words": words, "model": model_name}, f)
    emit({"done": True})


if __name__ == "__main__":
    main()
