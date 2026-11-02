const dateFormatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

/** Fixed, locale-stable date (e.g. "Oct 29, 2026"); avoids relative times that would change between prerender and request. */
export function formatDate(iso: string): string {
  return dateFormatter.format(new Date(iso));
}

/** Seconds as m:ss, e.g. 57 -> "0:57". */
export function formatLength(seconds: number): string {
  const total = Math.round(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/** Length to show for a video: the measured length (m:ss) when known, otherwise the requested target. */
export function formatVideoLength(video: { actualDurationSeconds?: number; durationSeconds: number }): { short: string; long: string } {
  return video.actualDurationSeconds
    ? { short: formatLength(video.actualDurationSeconds), long: formatLength(video.actualDurationSeconds) }
    : { short: `${video.durationSeconds}s`, long: `${video.durationSeconds}s target` };
}
