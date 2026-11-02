import { test } from "node:test";
import assert from "node:assert/strict";
import type { VideoProject, VideoStatus } from "../src/types/video.ts";
import { applyLibraryQuery, isFiltered, matchesSearch, parseLibraryQuery, serializeLibraryQuery, statusCounts, visibleStatusFilters } from "../src/features/video-library/library-query.ts";

// Small fixed library; dates are ISO strings like the real run records.
const video = (id: string, title: string, prompt: string, status: VideoStatus, createdAt: string): VideoProject => ({
  id,
  title,
  prompt,
  status,
  createdAt,
  durationSeconds: 60,
  request: { prompt, durationSeconds: 60, voice: "female", captions: true, music: false },
});
const library = [
  video("a", "How APIs Work", "Explain APIs with a restaurant analogy", "ready", "2026-10-29T15:45:52.735Z"),
  video("b", "Why the Moon Has Phases", "Why does the moon have phases?", "ready", "2026-11-01T16:40:04.249Z"),
  video("c", "Photosynthesis Basics", "How do plants make food from sunlight", "failed", "2026-11-01T15:47:03.750Z"),
  video("d", "Black Holes", "What is a black hole", "generating", "2026-11-02T09:00:00.000Z"),
  video("e", "árbol Growth", "Trees and sunlight", "ready", "2026-10-26T17:33:36.608Z"),
];
const ids = (list: VideoProject[]) => list.map((v) => v.id);
const query = (q = "", status: "all" | VideoStatus = "all", sort: "newest" | "oldest" | "title-asc" | "title-desc" = "newest") => ({ q, status, sort });

test("search by title is case-insensitive", () => {
  assert.deepEqual(ids(applyLibraryQuery(library, query("moon PHASES"))), ["b"]);
  assert.deepEqual(ids(applyLibraryQuery(library, query("black holes"))), ["d"]);
});

test("search by the original prompt", () => {
  assert.deepEqual(ids(applyLibraryQuery(library, query("restaurant"))), ["a"]);
  assert.deepEqual(ids(applyLibraryQuery(library, query("sunlight"))), ["c", "e"], "matches prompts only, newest first");
});

test("every search word must match; accents and extra spaces are ignored", () => {
  assert.equal(matchesSearch(library[0], "apis analogy"), true);
  assert.equal(matchesSearch(library[0], "apis moon"), false);
  assert.deepEqual(ids(applyLibraryQuery(library, query("  arbol  "))), ["e"]);
  assert.equal(applyLibraryQuery(library, query("   ")).length, library.length, "blank search shows everything");
});

test("status filters use the real statuses", () => {
  assert.deepEqual(ids(applyLibraryQuery(library, query("", "ready"))), ["b", "a", "e"]);
  assert.deepEqual(ids(applyLibraryQuery(library, query("", "failed"))), ["c"]);
  assert.deepEqual(ids(applyLibraryQuery(library, query("", "generating"))), ["d"]);
  assert.deepEqual(ids(applyLibraryQuery(library, query("", "expired"))), []);
});

test("sorting: newest (default), oldest, title A–Z and Z–A", () => {
  assert.deepEqual(ids(applyLibraryQuery(library, query())), ["d", "b", "c", "a", "e"]);
  assert.deepEqual(ids(applyLibraryQuery(library, query("", "all", "oldest"))), ["e", "a", "c", "b", "d"]);
  assert.deepEqual(ids(applyLibraryQuery(library, query("", "all", "title-asc"))), ["e", "d", "a", "c", "b"]);
  assert.deepEqual(ids(applyLibraryQuery(library, query("", "all", "title-desc"))), ["b", "c", "a", "d", "e"]);
});

test("search, filter and sort combine", () => {
  assert.deepEqual(ids(applyLibraryQuery(library, query("sunlight", "ready", "title-asc"))), ["e"]);
  assert.deepEqual(ids(applyLibraryQuery(library, query("how", "ready", "oldest"))), ["a"], "'how' is in a ready title and a failed prompt");
  assert.deepEqual(ids(applyLibraryQuery(library, query("moon", "failed"))), []);
});

test("the input list is not mutated", () => {
  const before = ids(library);
  applyLibraryQuery(library, query("", "all", "title-desc"));
  assert.deepEqual(ids(library), before);
});

test("status counts follow the search; extra chips only when used", () => {
  const counts = statusCounts(library, "sunlight");
  assert.equal(counts.all, 2);
  assert.equal(counts.ready, 1);
  assert.equal(counts.failed, 1);
  assert.deepEqual(visibleStatusFilters(library, "all").map((s) => s.value), ["all", "ready", "generating", "failed"]);
  assert.deepEqual(visibleStatusFilters([...library, video("x", "Old", "old", "expired", "2026-01-01T00:00:00.000Z")], "all").map((s) => s.value), ["all", "ready", "generating", "failed", "expired"]);
});

test("URL state: parsed safely and written without defaults", () => {
  const parsed = parseLibraryQuery(new URLSearchParams("q=moon&status=failed&sort=title-asc&view=list"));
  assert.deepEqual(parsed, { q: "moon", status: "failed", sort: "title-asc", view: "list" });
  assert.deepEqual(parseLibraryQuery(new URLSearchParams("status=done&sort=random&view=table")), { q: "", status: "all", sort: "newest", view: "grid" });
  assert.equal(serializeLibraryQuery(parsed), "?q=moon&status=failed&sort=title-asc&view=list");
  assert.equal(serializeLibraryQuery({ q: " ", status: "all", sort: "newest", view: "grid" }), "");
  assert.equal(isFiltered({ q: "", status: "all", sort: "oldest", view: "list" }), false, "sort and view are not filters");
});
