import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_THEME, PALETTES, THEME_NAMES, isThemeName, tint} from '../src/video/theme';
import {paletteFor} from '../src/video/editorial';

/* Video themes (2026-11-10): chosen automatically from the topic; one palette per video. */

test('every video uses the clean (light) theme unless a test forces another', () => {
  assert.equal(DEFAULT_THEME, 'clean');
  assert.equal(paletteFor(undefined, false).name, 'clean');
  assert.equal(paletteFor('neon', false).name, 'clean', 'unknown value → default');
  assert.equal(paletteFor('paper', false).name, 'paper', '--theme for testing');
});

test('every theme has a complete palette', () => {
  for (const name of THEME_NAMES) {
    const p = PALETTES[name];
    assert.equal(p.name, name);
    for (const [key, value] of Object.entries(p)) assert.ok(typeof value === 'string' && value.length > 0, `${name}.${key}`);
    assert.match(p.primary, /^#[0-9a-f]{6}$/i, `${name}.primary must be hex (used with tint and layer mixing)`);
    assert.match(p.secondary, /^#[0-9a-f]{6}$/i);
    assert.match(p.text, /^#[0-9a-f]{6}$/i);
  }
});

test('tint turns a hex colour into rgba and leaves other colours alone', () => {
  assert.equal(tint('#8b7cff', 0.22), 'rgba(139,124,255,0.22)');
  assert.equal(tint('rgba(1,2,3,.5)', 0.1), 'rgba(1,2,3,.5)');
});
