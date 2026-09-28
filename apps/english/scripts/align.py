"""Align BBC transcript sentences to the audio using faster-whisper word timestamps.

Usage: python align.py <audio.mp3> <sentences.json> <out.json>
  sentences.json: ["sentence one", "sentence two", ...]
Prints progress lines as JSON ({"progress": 0.42}) to stdout.

Env: WHISPER_MODEL (default small.en), WHISPER_DEVICE (default cpu), WHISPER_COMPUTE (default int8)
"""

import difflib
import json
import os
import re
import sys

NUMBERS = {
    "zero": "0", "one": "1", "two": "2", "three": "3", "four": "4", "five": "5", "six": "6",
    "seven": "7", "eight": "8", "nine": "9", "ten": "10", "eleven": "11", "twelve": "12",
    "twenty": "20", "thirty": "30", "forty": "40", "fifty": "50", "hundred": "100",
}


def norm(word: str) -> str:
    w = word.lower().replace("’", "'").replace("‘", "'")
    w = re.sub(r"[^a-z0-9']", "", w).strip("'")
    return NUMBERS.get(w, w)


def tokens(text: str):
    return [t for t in (norm(w) for w in re.split(r"[\s–—-]+", text)) if t]


def emit(obj):
    print(json.dumps(obj), flush=True)


def main():
    audio, sentences_path, out_path = sys.argv[1:4]
    with open(sentences_path, encoding="utf-8") as f:
        sentences = json.load(f)

    from faster_whisper import WhisperModel

    model_name = os.environ.get("WHISPER_MODEL", "small.en")
    emit({"stage": "loading model", "model": model_name})
    model = WhisperModel(
        model_name,
        device=os.environ.get("WHISPER_DEVICE", "cpu"),
        compute_type=os.environ.get("WHISPER_COMPUTE", "int8"),
    )
    segments, info = model.transcribe(
        audio,
        language="en",
        word_timestamps=True,
        vad_filter=False,
        condition_on_previous_text=False,
        initial_prompt=" ".join(sentences[:3]),
    )
    duration = float(info.duration)
    emit({"stage": "transcribing", "duration": duration})

    words = []  # (token, start, end)
    for seg in segments:
        for w in seg.words or []:
            t = norm(w.word)
            if t:
                words.append((t, float(w.start), float(w.end)))
        emit({"progress": round(min(seg.end / duration, 1.0), 3)})

    # Flatten sentence tokens, remembering which sentence each token belongs to
    ref, owner = [], []
    for i, s in enumerate(sentences):
        for t in tokens(s):
            ref.append(t)
            owner.append(i)

    hyp = [w[0] for w in words]
    ref_to_hyp = {}
    matcher = difflib.SequenceMatcher(None, ref, hyp, autojunk=False)
    for block in matcher.get_matching_blocks():
        for k in range(block.size):
            ref_to_hyp[block.a + k] = block.b + k

    n = len(sentences)
    starts, ends, ratio = [None] * n, [None] * n, [0.0] * n
    counts = [0] * n
    matched = [0] * n
    for r, i in enumerate(owner):
        counts[i] += 1
        h = ref_to_hyp.get(r)
        if h is None:
            continue
        matched[i] += 1
        _, ws, we = words[h]
        starts[i] = ws if starts[i] is None else min(starts[i], ws)
        ends[i] = we if ends[i] is None else max(ends[i], we)
    for i in range(n):
        ratio[i] = matched[i] / counts[i] if counts[i] else 0.0
        # a single stray matched word is not trustworthy
        if matched[i] < 2 and counts[i] > 2:
            starts[i] = ends[i] = None

    # Fill gaps by interpolating between known neighbours (proportional to token count)
    i = 0
    while i < n:
        if starts[i] is not None:
            i += 1
            continue
        j = i
        while j < n and starts[j] is None:
            j += 1
        left = ends[i - 1] if i > 0 else 0.0
        right = starts[j] if j < n else duration
        span = max(right - left, 0.1)
        total = sum(max(counts[k], 1) for k in range(i, j))
        t = left
        for k in range(i, j):
            d = span * max(counts[k], 1) / total
            starts[k], ends[k] = t, t + d
            t += d
        i = j

    # Make the timeline monotonic, add a little padding, and close small gaps
    result = []
    for i in range(n):
        s, e = starts[i], ends[i]
        if i > 0:
            s = max(s, result[-1]["start"] + 0.05)
        e = max(e, s + 0.4)
        result.append({"idx": i, "start": s, "end": e, "matched": round(ratio[i], 2)})
    for i in range(n):
        cur = result[i]
        prev_end = result[i - 1]["end"] if i > 0 else 0.0
        nxt_start = result[i + 1]["start"] if i + 1 < n else duration
        cur["start"] = round(max(prev_end, cur["start"] - 0.15, 0.0), 2)
        cur["end"] = round(min(max(cur["end"] + 0.25, cur["start"] + 0.4), max(nxt_start, cur["end"]), duration), 2)

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump({"model": model_name, "duration": round(duration, 2), "sentences": result}, f)
    emit({"done": True, "matched": round(sum(ratio) / max(n, 1), 3)})


if __name__ == "__main__":
    main()
