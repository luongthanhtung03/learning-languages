import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/** A background Whisper job (listening alignment or speaking transcription). */
export type WhisperJob = {
  state: "running" | "error";
  stage: string;
  progress: number;
  error?: string;
};

const g = globalThis as unknown as { __whisperJobs?: Map<string, WhisperJob>; __whisperQueue?: Promise<void> };
const jobs = (g.__whisperJobs ??= new Map());

export function getJob(key: string): WhisperJob | null {
  return jobs.get(key) ?? null;
}

/**
 * Queue a job under `key`. Whisper is CPU-heavy, so jobs run one at a time.
 * Returns the existing job if one with this key is still running.
 */
export function enqueue(key: string, work: (job: WhisperJob) => Promise<void>, options?: { immediate?: boolean }): WhisperJob {
  const existing = jobs.get(key);
  if (existing?.state === "running") return existing;
  const job: WhisperJob = { state: "running", stage: "queued", progress: 0 };
  jobs.set(key, job);
  const task = () =>
    work(job).then(
      () => void jobs.delete(key),
      (e: Error) => {
        job.state = "error";
        job.error = e.message;
      },
    );
  // Short speaking clips start immediately instead of waiting behind a long alignment job
  if (options?.immediate) void task();
  else g.__whisperQueue = (g.__whisperQueue ?? Promise.resolve()).then(task);
  return job;
}

function pythonBin() {
  if (process.env.PYTHON) return process.env.PYTHON;
  const win = path.join(process.cwd(), ".venv", "Scripts", "python.exe");
  const unix = path.join(process.cwd(), ".venv", "bin", "python");
  if (fs.existsSync(win)) return win;
  if (fs.existsSync(unix)) return unix;
  return process.platform === "win32" ? "python" : "python3";
}

/** Run a script in scripts/, feeding its JSON progress lines ({stage}, {progress}) into the job. */
export function runPython(script: string, args: string[], job: WhisperJob) {
  return new Promise<void>((resolve, reject) => {
    const proc = spawn(/*turbopackIgnore: true*/ pythonBin(), [path.join(process.cwd(), "scripts", script), ...args], {
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
      if (code === 0) resolve();
      else reject(new Error(stderr.trim().split("\n").slice(-3).join("\n") || `${script} exited with ${code}`));
    });
  });
}

export async function download(url: string, file: string) {
  if (fs.existsSync(file) && fs.statSync(file).size > 0) return;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Audio download failed (${res.status})`);
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
}
