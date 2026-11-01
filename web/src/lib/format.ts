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
