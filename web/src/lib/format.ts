const dateFormatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

/** Fixed, locale-stable date (e.g. "Oct 29, 2026"); avoids relative times that would change between prerender and request. */
export function formatDate(iso: string): string {
  return dateFormatter.format(new Date(iso));
}
