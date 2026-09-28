import { fetchEpisodeDetail, fetchEpisodeList } from "./bbc";
import { getCachedDetail, getEpisodeRows, getEpisodeSummary, listFetchedAt, saveDetail, saveEpisodeList } from "./db";
import type { EpisodeDetail } from "./types";

const LIST_TTL_MS = 12 * 60 * 60 * 1000; // new episodes come out weekly; refresh twice a day

export async function listEpisodes(refresh = false) {
  const fetchedAt = listFetchedAt();
  const stale = !fetchedAt || Date.now() - Date.parse(fetchedAt) > LIST_TTL_MS;
  if (refresh || stale) {
    try {
      saveEpisodeList(await fetchEpisodeList());
    } catch (e) {
      if (!fetchedAt) throw e; // offline but we have a cached list: keep going
    }
  }
  return { episodes: getEpisodeRows(), fetchedAt: listFetchedAt() };
}

export async function getEpisode(id: string, refresh = false): Promise<EpisodeDetail> {
  if (!refresh) {
    const cached = getCachedDetail(id);
    if (cached) return cached;
  }
  let summary = getEpisodeSummary(id);
  if (!summary) {
    await listEpisodes(true);
    summary = getEpisodeSummary(id);
  }
  if (!summary) throw new Error(`Episode ${id} not found`);
  const detail = await fetchEpisodeDetail(summary);
  saveDetail(detail);
  return detail;
}
