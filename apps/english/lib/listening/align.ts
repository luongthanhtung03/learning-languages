import fs from "node:fs";
import path from "node:path";
import { DATA_DIR, getAlignment, saveAlignment } from "../db";
import type { Alignment } from "../types";
import { download, enqueue, getJob, runPython, type WhisperJob } from "../whisper";
import { getEpisode } from "./episodes";

const key = (id: string) => `align:${id}`;

export function alignState(id: string): { alignment: Alignment | null; job: WhisperJob | null } {
  return { alignment: getAlignment(id), job: getJob(key(id)) };
}

export function startAlignment(id: string) {
  return enqueue(key(id), async (job) => {
    job.stage = "downloading audio";
    const ep = await getEpisode(id);
    if (!ep.mp3) throw new Error("This episode has no downloadable audio");
    const audioDir = path.join(DATA_DIR, "audio");
    const alignDir = path.join(DATA_DIR, "align");
    fs.mkdirSync(audioDir, { recursive: true });
    fs.mkdirSync(alignDir, { recursive: true });
    const audio = path.join(audioDir, `${id}.mp3`);
    const sentencesFile = path.join(alignDir, `${id}.sentences.json`);
    const out = path.join(alignDir, `${id}.json`);
    await download(ep.mp3, audio);
    fs.writeFileSync(sentencesFile, JSON.stringify(ep.sentences.map((s) => s.text)));

    job.stage = "starting whisper";
    await runPython("align.py", [audio, sentencesFile, out], job);
    saveAlignment(id, JSON.parse(fs.readFileSync(out, "utf-8")) as Alignment);
  });
}
