import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { DATA_DIR, getAlignment, saveAlignment } from "./db";
import { getEpisode } from "./episodes";
import type { Alignment } from "./types";

export type AlignJob = {
  state: "running" | "error";
  stage: string;
  progress: number;
  error?: string;
};

const globalJobs = globalThis as unknown as { __alignJobs?: Map<string, AlignJob>; __alignQueue?: Promise<void> };
const jobs = (globalJobs.__alignJobs ??= new Map());

export function alignState(id: string): { alignment: Alignment | null; job: AlignJob | null } {
  return { alignment: getAlignment(id), job: jobs.get(id) ?? null };
}

function pythonBin() {
  if (process.env.PYTHON) return process.env.PYTHON;
  const win = path.join(process.cwd(), ".venv", "Scripts", "python.exe");
  const unix = path.join(process.cwd(), ".venv", "bin", "python");
  if (fs.existsSync(win)) return win;
  if (fs.existsSync(unix)) return unix;
  return process.platform === "win32" ? "python" : "python3";
}

async function download(url: string, file: string) {
  if (fs.existsSync(file) && fs.statSync(file).size > 0) return;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Audio download failed (${res.status})`);
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
}

export function startAlignment(id: string) {
  const existing = jobs.get(id);
  if (existing?.state === "running") return existing;
  const job: AlignJob = { state: "running", stage: "queued", progress: 0 };
  jobs.set(id, job);
  // Whisper is CPU-heavy: run one job at a time
  globalJobs.__alignQueue = (globalJobs.__alignQueue ?? Promise.resolve()).then(() =>
    run(id, job).catch((e: Error) => {
      job.state = "error";
      job.error = e.message;
    }),
  );
  return job;
}

async function run(id: string, job: AlignJob) {
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
  await new Promise<void>((resolve, reject) => {
    const proc = spawn(/*turbopackIgnore: true*/ pythonBin(), [path.join(process.cwd(), "scripts", "align.py"), audio, sentencesFile, out], {
      env: { ...process.env, PYTHONIOENCODING: "utf-8" },
    });
    let stderr = "";
    let buffer = "";
    proc.stdout.on("data", (chunk: Buffer) => {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        try {
          const msg = JSON.parse(line);
          if (msg.stage) job.stage = msg.stage;
          if (typeof msg.progress === "number") {
            job.stage = "transcribing";
            job.progress = msg.progress;
          }
        } catch {
          // not a progress line
        }
      }
    });
    proc.stderr.on("data", (c: Buffer) => (stderr = (stderr + c.toString()).slice(-4000)));
    proc.on("error", (e) => reject(new Error(`Could not start Python (${e.message}). See README to set up .venv`)));
    proc.on("close", (code) => {
      if (code === 0 && fs.existsSync(out)) resolve();
      else reject(new Error(stderr.trim().split("\n").slice(-3).join("\n") || `align.py exited with ${code}`));
    });
  });

  saveAlignment(id, JSON.parse(fs.readFileSync(out, "utf-8")) as Alignment);
  jobs.delete(id);
}
