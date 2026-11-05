/*
 * Parses a single HTTP Range header against a known size ("bytes=start-end", "bytes=start-" or the suffix form
 * "bytes=-length"). Shared by local and cloud playback so both answer seeks the same way.
 */

export type RangeResult = { kind: "full" } | { kind: "partial"; start: number; end: number } | { kind: "unsatisfiable" };

export function parseRange(header: string | null, size: number): RangeResult {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header?.trim() ?? "");
  if (!match || (!match[1] && !match[2])) return { kind: "full" };
  if (size <= 0) return { kind: "unsatisfiable" };
  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  const end = match[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  if (!match[1] && Number(match[2]) === 0) return { kind: "unsatisfiable" };
  if (start >= size || start > end) return { kind: "unsatisfiable" };
  return { kind: "partial", start, end };
}
