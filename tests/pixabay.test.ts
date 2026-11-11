import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, existsSync, readFileSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fetchSceneImages, queryFrom, relevant} from '../src/providers/pixabay';

/* Scene photos (2026-11-11): relevance check, fallbacks and failure handling. No network: fetch is replaced. */

test('a photo must really show the searched thing (its tags contain the query words)', () => {
  assert.equal(relevant('storm clouds weather', 'lightning, thunderstorm, weather, night, storm, clouds, rain'), true);
  assert.equal(relevant('earth orbit sun space', 'solar system, sun, earth, mars, planets'), true, '"sun" and "earth" are enough for 4 words');
  assert.equal(relevant('rivers carry land away', 'puppies, dogs, bag, pets, animals'), false, 'the puppies case');
  assert.equal(relevant('river valley', 'river, mountains, sunset, dusk'), true, 'half of 2 words');
  assert.equal(relevant('clouds', 'cloud, sky'), true, 'plural matches singular');
  assert.equal(relevant('server room', undefined), false);
});

test('queries from headings drop filler words', () => {
  assert.equal(queryFrom('How the Water Cycle Works'), 'water cycle');
  assert.equal(queryFrom('Condensation Makes Clouds!'), 'condensation clouds');
});

test('one photo per scene, no repeats, irrelevant results skipped, failures never escape', async () => {
  const outDir = mkdtempSync(path.join(os.tmpdir(), 'explivio-img-'));
  const cacheDir = mkdtempSync(path.join(os.tmpdir(), 'explivio-imgcache-'));
  const realFetch = globalThis.fetch;
  const hit = (id: number, tags: string) => ({id, tags, imageWidth: 1280, imageHeight: 853, largeImageURL: `https://pixabay.com/get/${id}.jpg`, pageURL: `https://pixabay.com/photos/x-${id}/`, user: 'someone'});
  globalThis.fetch = (async (input: string | URL) => {
    const url = new URL(String(input));
    if (url.pathname.startsWith('/get/')) return new Response(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), {headers: {'content-type': 'image/jpeg'}});
    const q = url.searchParams.get('q');
    if (q === 'boom') throw new Error(`network down for key ${url.searchParams.get('key')}`);
    if (q === 'storm clouds') return Response.json({hits: [hit(1, 'storm, clouds, sky'), hit(2, 'storm, clouds, rain')]});
    if (q === 'puppy topic') return Response.json({hits: [hit(3, 'buildings, city')]});
    return Response.json({hits: []});
  }) as typeof fetch;
  try {
    const result = await fetchSceneImages({scenes: [{on_screen_text: 'A', image_query: 'storm clouds'}, {on_screen_text: 'B', image_query: 'storm clouds'}, {on_screen_text: 'C', image_query: 'puppy topic'}, {on_screen_text: 'D', image_query: 'boom'}], title: 'x', apiKey: 'SECRETKEY', outDir, urlPrefix: 'runs/t', cacheDir});
    assert.deepEqual(result.images.map((i) => i?.id ?? null), [1, 2, null, null], 'no repeats; irrelevant and failed scenes get no photo');
    assert.equal(result.images[0]?.file, 'runs/t/image-1.jpg');
    assert.ok(existsSync(path.join(outDir, 'image-1.jpg')));
    assert.ok(result.errors.some((e) => e.includes('[key]')) && !result.errors.join(' ').includes('SECRETKEY'), 'the key never appears in errors');
    assert.ok(readFileSync(path.join(outDir, 'image-2.jpg')).length > 0);
  } finally {
    globalThis.fetch = realFetch;
  }
  const none = await fetchSceneImages({scenes: [{on_screen_text: 'A'}], title: 'x', apiKey: '', outDir, urlPrefix: 'runs/t', cacheDir});
  assert.deepEqual(none.images, [null], 'no key → no photos, no error thrown');
});

test('a rate-limited image download (429) is retried after a wait', async () => {
  const outDir = mkdtempSync(path.join(os.tmpdir(), 'explivio-img-'));
  const cacheDir = mkdtempSync(path.join(os.tmpdir(), 'explivio-imgcache-'));
  const realFetch = globalThis.fetch;
  let downloads = 0;
  const waits: number[] = [];
  globalThis.fetch = (async (input: string | URL) => {
    const url = new URL(String(input));
    if (url.pathname.startsWith('/get/')) return ++downloads === 1 ? new Response('Too many requests', {status: 429, headers: {'retry-after': '3'}}) : new Response(new Uint8Array([0xff, 0xd8]), {headers: {'content-type': 'image/jpeg'}});
    return Response.json({hits: [{id: 9, tags: 'river, valley', imageWidth: 1280, imageHeight: 800, largeImageURL: 'https://pixabay.com/get/9.jpg', pageURL: 'p', user: 'u'}]});
  }) as typeof fetch;
  try {
    const result = await fetchSceneImages({scenes: [{on_screen_text: 'x', image_query: 'river valley'}], title: 'x', apiKey: 'k', outDir, urlPrefix: 'runs/t', cacheDir, wait: async (ms) => { waits.push(ms); }});
    assert.equal(result.images[0]?.id, 9);
    assert.equal(downloads, 2);
    assert.deepEqual(waits, [3000], 'waited for Retry-After');
  } finally {
    globalThis.fetch = realFetch;
  }
});
