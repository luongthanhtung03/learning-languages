import fs from "node:fs";
import path from "node:path";
import { DATA_DIR } from "../db";
import { enqueue, getJob, runPython } from "../whisper";
import { computeStats, type Word } from "./stats";
import { failRecording, getRecording, saveTranscript } from "./store";

export const RECORDINGS_DIR = path.join(DATA_DIR, "recordings");

const key = (id: number) => `transcribe:${id}`;

export function transcriptionJob(id: number) {
  return getJob(key(id));
}

export function startTranscription(id: number) {
  return enqueue(
    key(id),
    async (job) => {
      const rec = getRecording(id);
      if (!rec) throw new Error("Recording not found");
      const audio = path.join(RECORDINGS_DIR, rec.file);
      const out = path.join(RECORDINGS_DIR, `${id}.transcript.json`);
      try {
        await runPython("transcribe.py", [audio, out], job);
        const t = JSON.parse(fs.readFileSync(out, "utf-8")) as { words: Word[]; text: string };
        saveTranscript(id, t.words, t.text, computeStats(t.words));
      } catch (e) {
        failRecording(id, (e as Error).message);
        throw e;
      }
    },
    { immediate: true },
  );
}
