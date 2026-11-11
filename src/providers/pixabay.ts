import {createHash} from 'node:crypto';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';

/*
 * Scene photos from Pixabay (2026-11-11). One landscape photo per scene, found with the scene's `image_query` (written
 * by Gemini) or, for older storyboards, its on-screen text; then the video title as a fallback search.
 *
 * Pixabay API rules followed (pixabay.com/api/docs, terms of 20 Oct 2026):
 *  - images are DOWNLOADED and rendered into the video, never hot-linked;
 *  - search responses are cached for 24 h (runs/.pixabay-cache; a fresh cloud sandbox starts empty);
 *  - at most a few requests per video (limit: 100 per minute per key); no bulk downloading;
 *  - the video credits "Images: Pixabay" (credit isn't required for use, but the API asks apps to show the source).
 * Everything is best effort: no key, a failed request or no match leaves that scene without a photo (the themed
 * background is used) and never fails the video.
 */

export type SceneImage = {file: string; id: number; query: string; pageURL: string; user: string};
type Hit = {id: number; largeImageURL: string; imageWidth: number; imageHeight: number; pageURL: string; user: string; tags?: string};

const API = 'https://pixabay.com/api/';
const CACHE_MS = 24 * 60 * 60 * 1000;
const TIMEOUT_MS = 10_000;
const MAX_BYTES = 6_000_000;
const STOP = new Set(['the', 'a', 'an', 'of', 'and', 'or', 'to', 'in', 'on', 'for', 'is', 'are', 'how', 'why', 'what', 'your', 'our', 'its', 'it', 'with', 'by', 'from', 'vs', 'versus', 'at', 'as', 'this', 'that', 'makes', 'works', 'work']);

/**
 * Whether a photo really shows the searched thing: Pixabay's search is loose ("rivers carry land away" returned
 * puppies), so the photo's own tags must contain enough of the query's words (compared by their first 5 letters, so
 * "clouds" matches "cloud"). One-word queries need that word; longer ones need at least half of their words.
 */
export function relevant(query: string, tags: string | undefined): boolean {
  const words = queryFrom(query).split(' ').filter(Boolean);
  if (!words.length || !tags) return false;
  const tagStems = tags.toLowerCase().split(/[\s,]+/).filter(Boolean).map((t) => t.slice(0, 5));
  const matched = words.filter((w) => tagStems.includes(w.slice(0, 5))).length;
  return matched >= Math.max(1, Math.ceil(words.length / 2));
}

/** Two to four plain search words from a heading ("Condensation Makes Clouds" → "condensation clouds"). */
export function queryFrom(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)).slice(0, 4).join(' ');
}

async function search(query: string, apiKey: string, cacheDir: string): Promise<Hit[]> {
  const cacheFile = path.join(cacheDir, `${createHash('sha256').update(query).digest('hex').slice(0, 24)}.json`);
  try {
    const cached = JSON.parse(await readFile(cacheFile, 'utf8')) as {at: number; hits: Hit[]};
    if (Date.now() - cached.at < CACHE_MS) return cached.hits;
  } catch { /* not cached */ }
  const url = new URL(API);
  url.search = new URLSearchParams({key: apiKey, q: query.slice(0, 100), image_type: 'photo', orientation: 'horizontal', safesearch: 'true', order: 'popular', per_page: '10', min_width: '1000'}).toString();
  const response = await fetch(url, {signal: AbortSignal.timeout(TIMEOUT_MS)});
  if (!response.ok) throw new Error(`Pixabay search failed (HTTP ${response.status})`);
  const hits = ((await response.json()) as {hits?: Hit[]}).hits ?? [];
  await mkdir(cacheDir, {recursive: true});
  await writeFile(cacheFile, JSON.stringify({at: Date.now(), hits})).catch(() => {});
  return hits;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Downloads one image. Pixabay's image server answers 429 when downloads come in a burst: wait (its Retry-After,
 * capped) and try again, at most 3 times. Returns null on success, otherwise a short reason.
 */
async function download(url: string, file: string, wait: (ms: number) => Promise<unknown> = sleep): Promise<string | null> {
  if (!/^https:\/\/(cdn\.)?pixabay\.com\//.test(url)) return 'unexpected image host';
  for (let attempt = 1; ; attempt++) {
    const response = await fetch(url, {signal: AbortSignal.timeout(TIMEOUT_MS)});
    if (response.status === 429 && attempt < 3) {
      await response.body?.cancel().catch(() => {});
      await wait(Math.min(8000, (Number(response.headers.get('retry-after')) || attempt * 2) * 1000));
      continue;
    }
    const type = response.headers.get('content-type') ?? '';
    if (!response.ok) return `image download HTTP ${response.status}`;
    if (!/^image\/(jpeg|png|webp)/.test(type)) return 'not an image';
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length === 0 || bytes.length > MAX_BYTES) return 'image too large or empty';
    await writeFile(file, bytes);
    return null;
  }
}

/**
 * Finds and downloads one photo per scene into `outDir` (served to Remotion as `${urlPrefix}/image-<n>.jpg`). Returns
 * an entry per scene (null = no photo). No photo is used twice in a video. Errors never escape.
 */
export async function fetchSceneImages(o: {scenes: {on_screen_text: string; image_query?: string}[]; title: string; apiKey?: string; outDir: string; urlPrefix: string; cacheDir: string; /** Tests: replace the wait before a retry. */ wait?: (ms: number) => Promise<unknown>}): Promise<{images: (SceneImage | null)[]; errors: string[]}> {
  const errors: string[] = [];
  const apiKey = o.apiKey?.trim();
  if (!apiKey) return {images: o.scenes.map(() => null), errors: ['PIXABAY_API_KEY is not set']};
  await mkdir(o.outDir, {recursive: true});
  const used = new Set<number>();
  const images: (SceneImage | null)[] = [];
  // Sequential on purpose: a handful of requests per video, and "no repeats" needs the earlier picks.
  for (const [i, scene] of o.scenes.entries()) {
    const queries = [scene.image_query?.trim(), queryFrom(scene.on_screen_text), queryFrom(o.title)].filter((q): q is string => Boolean(q && q.length >= 3));
    let picked: SceneImage | null = null;
    for (const query of [...new Set(queries)]) {
      try {
        // Up to 3 relevant candidates: if one can't be downloaded, the next one is tried.
        const candidates = (await search(query, apiKey, o.cacheDir)).filter((h) => !used.has(h.id) && h.imageWidth >= h.imageHeight && relevant(query, h.tags)).slice(0, 3);
        const name = `image-${i + 1}.jpg`;
        for (const hit of candidates) {
          const problem = await download(hit.largeImageURL, path.join(o.outDir, name), o.wait);
          if (problem) { errors.push(`scene ${i + 1}: ${problem}`); continue; }
          used.add(hit.id);
          picked = {file: `${o.urlPrefix}/${name}`, id: hit.id, query, pageURL: hit.pageURL, user: hit.user};
          break;
        }
        if (picked) break;
      } catch (error) {
        errors.push(`scene ${i + 1}: ${error instanceof Error ? error.message.replace(apiKey, '[key]') : 'error'}`.slice(0, 160));
      }
    }
    images.push(picked);
  }
  return {images, errors};
}
