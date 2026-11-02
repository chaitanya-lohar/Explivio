import type { VideoProject, VideoStatus } from "@/types/video";

/*
 * My Videos search, status filter and sort. Pure functions over the already-loaded list, so typing in the search box
 * never calls the server. State lives in the URL (?q=&status=&sort=&view=) so it survives opening a video and coming back.
 */

export type StatusFilter = "all" | VideoStatus;
export type SortOrder = "newest" | "oldest" | "title-asc" | "title-desc";
export type LibraryView = "grid" | "list";

export interface LibraryQuery {
  q: string;
  status: StatusFilter;
  sort: SortOrder;
  view: LibraryView;
}

export const DEFAULT_QUERY: LibraryQuery = { q: "", status: "all", sort: "newest", view: "grid" };

/** Filter chips, in lifecycle order. Labels match the status badges. */
export const STATUS_FILTERS: readonly { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "ready", label: "Ready" },
  { value: "generating", label: "Generating" },
  { value: "failed", label: "Failed" },
  { value: "expired", label: "Expired" },
  { value: "draft", label: "Draft" },
];

/** Shown even when empty: the statuses the real pipeline produces. Others appear only if some video has them. */
const ALWAYS_SHOWN: readonly StatusFilter[] = ["all", "ready", "generating", "failed"];

export const SORT_OPTIONS: readonly { value: SortOrder; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "title-asc", label: "Title A–Z" },
  { value: "title-desc", label: "Title Z–A" },
];

const pick = <T extends string>(value: string | null | undefined, allowed: readonly T[], fallback: T): T => (allowed.includes(value as T) ? (value as T) : fallback);

/** Reads the query from URL parameters; unknown values fall back to the defaults. */
export function parseLibraryQuery(params: { get(name: string): string | null }): LibraryQuery {
  return {
    q: (params.get("q") ?? "").slice(0, 200),
    status: pick(params.get("status"), STATUS_FILTERS.map((s) => s.value), DEFAULT_QUERY.status),
    sort: pick(params.get("sort"), SORT_OPTIONS.map((s) => s.value), DEFAULT_QUERY.sort),
    view: pick(params.get("view"), ["grid", "list"] as const, DEFAULT_QUERY.view),
  };
}

/** URL search string for a query, leaving out defaults so plain /videos stays clean. */
export function serializeLibraryQuery(query: LibraryQuery): string {
  const params = new URLSearchParams();
  if (query.q.trim()) params.set("q", query.q.trim());
  for (const key of ["status", "sort", "view"] as const) if (query[key] !== DEFAULT_QUERY[key]) params.set(key, query[key]);
  const text = params.toString();
  return text ? `?${text}` : "";
}

const normalize = (text: string) => text.toLocaleLowerCase("en-US").normalize("NFKD").replace(/[̀-ͯ]/g, "");

/** Case-insensitive: every word of the search must appear in the title or the original prompt. */
export function matchesSearch(video: Pick<VideoProject, "title" | "prompt">, q: string): boolean {
  const words = normalize(q).split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const haystack = normalize(`${video.title}\n${video.prompt}`);
  return words.every((word) => haystack.includes(word));
}

const byTitle = (a: VideoProject, b: VideoProject) => a.title.localeCompare(b.title, "en", { sensitivity: "base", numeric: true });
const byCreated = (a: VideoProject, b: VideoProject) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);

const SORTERS: Record<SortOrder, (a: VideoProject, b: VideoProject) => number> = {
  newest: (a, b) => byCreated(b, a),
  oldest: byCreated,
  "title-asc": (a, b) => byTitle(a, b) || byCreated(b, a),
  "title-desc": (a, b) => byTitle(b, a) || byCreated(b, a),
};

/** Search, then status filter, then sort. Never mutates the input. */
export function applyLibraryQuery<T extends VideoProject>(videos: readonly T[], query: Pick<LibraryQuery, "q" | "status" | "sort">): T[] {
  return videos.filter((video) => (query.status === "all" || video.status === query.status) && matchesSearch(video, query.q)).sort(SORTERS[query.sort]);
}

/** How many videos have each status (and "all"), counted after the search so chip counts match what a click would show. */
export function statusCounts(videos: readonly VideoProject[], q: string): Record<StatusFilter, number> {
  const counts = Object.fromEntries(STATUS_FILTERS.map((s) => [s.value, 0])) as Record<StatusFilter, number>;
  for (const video of videos) {
    if (!matchesSearch(video, q)) continue;
    counts.all += 1;
    counts[video.status] += 1;
  }
  return counts;
}

/** Filter chips to show: the pipeline's statuses always, others only when a video has them (or one is selected). */
export function visibleStatusFilters(videos: readonly VideoProject[], selected: StatusFilter) {
  return STATUS_FILTERS.filter((s) => ALWAYS_SHOWN.includes(s.value) || s.value === selected || videos.some((v) => v.status === s.value));
}

export const isFiltered = (query: LibraryQuery) => query.q.trim() !== "" || query.status !== "all";
