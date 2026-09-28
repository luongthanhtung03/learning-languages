import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import type { EpisodeDetail, EpisodeSummary, QuestionOption, Turn } from "../types";
import { splitSentences } from "./sentences";

const BASE = "https://www.bbc.co.uk";
export const INDEX_URL = `${BASE}/learningenglish/english/features/6-minute-english`;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";

async function fetchHtml(url: string) {
  const res = await fetch(url, { headers: { "User-Agent": UA }, cache: "no-store" });
  if (!res.ok) throw new Error(`BBC returned ${res.status} for ${url}`);
  return res.text();
}

const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

/** "24 Sep 2026" -> "2026-09-24"; falls back to the YYMMDD episode id. */
function parseDate(label: string, id: string) {
  const m = label.match(/(\d{1,2})\s+([A-Za-z]{3})[a-z]*\s+(\d{4})/);
  if (m) return `${m[3]}-${MONTHS[m[2].toLowerCase()] ?? "01"}-${m[1].padStart(2, "0")}`;
  return `20${id.slice(0, 2)}-${id.slice(2, 4)}-${id.slice(4, 6)}`;
}

const clean = (s: string) => s.replace(/ /g, " ").replace(/\s+/g, " ").trim();
const https = (u: string | undefined | null) => (u ? u.replace(/^http:\/\//, "https://") : null);

export async function fetchEpisodeList(): Promise<EpisodeSummary[]> {
  const $ = cheerio.load(await fetchHtml(INDEX_URL));
  const byId = new Map<string, EpisodeSummary>();
  $(".widget-bbcle-coursecontentlist").find(".text h2 a").each((_, a) => {
    const href = $(a).attr("href") ?? "";
    const m = href.match(/ep-(\d{6})/);
    if (!m || byId.has(m[1])) return;
    const item = $(a).closest("li, .widget-bbcle-coursecontentlist-featured");
    const details = $(a).closest(".text").find(".details");
    byId.set(m[1], {
      id: m[1],
      path: href.startsWith("http") ? new URL(href).pathname : href,
      title: clean($(a).text()),
      date: parseDate(clean(details.find("h3").text()), m[1]),
      description: clean(details.find("p").first().text()),
      image: item.find(".img img").first().attr("src") ?? "",
    });
  });
  return [...byId.values()].sort((a, b) => b.date.localeCompare(a.date));
}

type Line = { text: string; bold: boolean; root: number };

/**
 * Flatten rich-text HTML into visual lines. A line is "bold" when all of its text is inside
 * <strong>/<b> — that's how BBC marks speaker names and vocabulary terms.
 */
function toLines($: cheerio.CheerioAPI, roots: AnyNode[]): Line[] {
  const lines: Line[] = [];
  let parts: { text: string; bold: boolean }[] = [];
  let root = 0;
  const flush = () => {
    const text = clean(parts.map((p) => p.text).join(""));
    if (text) {
      const visible = parts.filter((p) => clean(p.text));
      lines.push({ text, bold: visible.every((p) => p.bold) && /[A-Za-z]/.test(text), root });
    }
    parts = [];
  };
  const walk = (node: AnyNode, bold: number) => {
    if (node.type === "text") {
      parts.push({ text: (node as unknown as { data: string }).data, bold: bold > 0 });
      return;
    }
    if (node.type !== "tag") return;
    const el = node as unknown as { name: string; children: AnyNode[] };
    const name = el.name.toLowerCase();
    if (name === "br") return flush();
    if (name === "script" || name === "style" || name === "img") return;
    const block = ["p", "h1", "h2", "h3", "h4", "div", "li", "ul", "ol", "table", "tr"].includes(name);
    if (block) flush();
    const b = name === "strong" || name === "b" ? 1 : 0;
    for (const child of el.children) walk(child, bold + b);
    if (block) flush();
  };
  roots.forEach((r, i) => {
    root = i;
    walk(r, 0);
    flush();
  });
  return lines;
}

const OPTION_RE = /^([a-d])\)\s*(.+)$/i;

export async function fetchEpisodeDetail(summary: Pick<EpisodeSummary, "id" | "path">): Promise<EpisodeDetail> {
  const html = await fetchHtml(`${BASE}${summary.path}`);
  const $ = cheerio.load(html);

  const title =
    clean($(".widget-heading h3").eq(1).text()) ||
    clean($("title").text().replace(/BBC Learning English.*$/i, "").replace(/\s*\/.*$/, ""));
  const subheader = clean($(".widget-bbcle-featuresubheader h3").text());

  const links = $("a")
    .map((_, a) => $(a).attr("href") ?? "")
    .get();
  const all = [...links, ...(html.match(/https?:\/\/downloads\.bbc\.co\.uk[^"'\s<>]+/g) ?? [])];
  const mp3 = https(all.find((u) => /\.mp3$/i.test(u)));
  const pdfs = all.filter((u) => /\.pdf$/i.test(u));
  const worksheetPdf = https(pdfs.find((u) => /worksheet/i.test(u)));
  const transcriptPdf = https(pdfs.find((u) => /transcript/i.test(u)) ?? pdfs.find((u) => !/worksheet/i.test(u)));

  const roots = $(".widget-richtext .text").toArray() as AnyNode[];
  const lines = toLines($, roots);

  const findLine = (re: RegExp, from = 0) => {
    for (let i = from; i < lines.length; i++) if (re.test(lines[i].text)) return i;
    return -1;
  };
  const qIdx = findLine(/^this week'?s question/i);
  const vIdx = findLine(/^vocabulary:?$/i, Math.max(qIdx, 0));
  const tIdx = findLine(/^transcript:?$/i, Math.max(vIdx, 0));

  // Intro: text after an "Introduction" heading, else the paragraph right before the question
  let intro = "";
  const introIdx = findLine(/^introduction:?$/i);
  if (introIdx >= 0 && introIdx + 1 < lines.length) intro = lines[introIdx + 1].text;
  else if (qIdx > 0) intro = lines[qIdx - 1].text;

  let question: EpisodeDetail["question"] = null;
  if (qIdx >= 0) {
    const end = vIdx > qIdx ? vIdx : tIdx > qIdx ? tIdx : qIdx + 6;
    const block = lines.slice(qIdx + 1, end).map((l) => l.text);
    const options: QuestionOption[] = [];
    const text: string[] = [];
    for (const l of block) {
      const m = l.match(OPTION_RE);
      if (m) options.push({ letter: m[1].toLowerCase(), text: m[2].replace(/[,.;]\s*(or)?$/i, "").trim() });
      else if (!/^listen to the programme/i.test(l) && options.length === 0) text.push(l);
    }
    if (text.length) question = { text: text.join(" "), options };
  }

  const vocab: EpisodeDetail["vocab"] = [];
  if (vIdx >= 0) {
    const end = tIdx > vIdx ? tIdx : lines.length;
    for (let i = vIdx + 1; i < end; i++) {
      const l = lines[i];
      if (l.bold) vocab.push({ term: l.text, definition: "" });
      else if (vocab.length) {
        const v = vocab[vocab.length - 1];
        v.definition = clean(`${v.definition} ${l.text}`);
      }
    }
  }

  const turns: Turn[] = [];
  if (tIdx >= 0) {
    for (let i = tIdx + 1; i < lines.length; i++) {
      const l = lines[i];
      if (l.root !== lines[tIdx].root) break; // transcript lives in one rich-text widget
      if (/^note:.*transcript/i.test(l.text)) continue;
      if (l.bold && l.text.length <= 80 && !/[.?!]$/.test(l.text)) {
        if (/^insert$/i.test(l.text)) continue;
        // speaker lines like "Dr Lynne Barker, Cognitive Neuroscientist, ..." -> "Dr Lynne Barker"
        turns.push({ speaker: l.text.split(",")[0].trim(), text: "" });
      } else if (turns.length) {
        const t = turns[turns.length - 1];
        t.text = clean(`${t.text} ${l.text}`);
      }
    }
  }
  const nonEmpty = trimTrailer(turns.filter((t) => t.text));

  return {
    id: summary.id,
    path: summary.path,
    title,
    date: parseDate(subheader, summary.id),
    description: intro,
    image: $(".widget-video img, .widget-audio img").first().attr("src") ?? "",
    intro,
    question,
    vocab: vocab.filter((v) => v.definition),
    turns: nonEmpty,
    sentences: splitSentences(nonEmpty),
    answerTurns: findAnswerTurns(nonEmpty),
    mp3,
    transcriptPdf,
    worksheetPdf,
  };
}

/** Drop anything after the programme's sign-off (page footers, promos). */
function trimTrailer(turns: Turn[]) {
  const last = turns.findLastIndex((t) => /\b(bye|goodbye)\b/i.test(t.text));
  if (last < 0) return turns;
  const out = turns.slice(0, last + 1);
  const m = out[last].text.match(/^.*?\b(?:good)?bye\b[^.!?]*[.!?]*/i);
  if (m) out[last] = { ...out[last], text: m[0].trim() };
  return out;
}

/** Heuristic: the answer is revealed near the end where the host mentions the answer/question. */
function findAnswerTurns(turns: Turn[]): number[] {
  const from = Math.floor(turns.length * 0.5);
  const recap = turns.findIndex((t, i) => i >= from && /\b(review|recap)\b/i.test(t.text));
  const stop = recap >= 0 ? recap : turns.length;
  const cues: [RegExp, number][] = [
    [/\b(answer|quiz|question)\b/i, 0],
    [/\b(I said|you said|you were right|in fact)\b/i, 2], // start a little earlier for context
  ];
  for (const [cue, back] of cues) {
    for (let i = stop - 1; i >= from; i--) {
      if (cue.test(turns[i].text)) {
        const out: number[] = [];
        for (let j = Math.max(from, i - back); j < Math.min(i + 6, stop); j++) out.push(j);
        return out;
      }
    }
  }
  // fallback: the few turns right before the vocabulary recap
  return recap > 0 ? [recap - 3, recap - 2, recap - 1].filter((j) => j >= 0) : [];
}
