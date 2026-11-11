import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PALETTES, THEME_NAMES, chooseTheme, isThemeName, tint} from '../src/video/theme';
import {paletteFor} from '../src/video/editorial';

/* Video themes (2026-11-10): chosen automatically from the topic; one palette per video. */

test('theme is chosen from the topic', () => {
  assert.equal(chooseTheme('How the Internet Works'), 'midnight');
  assert.equal(chooseTheme('Black holes explained'), 'midnight');
  assert.equal(chooseTheme('What is middleware'), 'vibrant', 'no topic word matched → vibrant');
  assert.equal(chooseTheme('The fall of the Roman Empire'), 'paper');
  assert.equal(chooseTheme('Why inflation happens'), 'paper');
  assert.equal(chooseTheme('How vaccines train the immune system'), 'clean');
  assert.equal(chooseTheme('Photosynthesis in 60 seconds'), 'clean');
  assert.equal(chooseTheme(undefined, 'Learn how cells divide'), 'clean', 'the learning objective counts too');
  assert.equal(chooseTheme('How to make friends'), 'vibrant');
  assert.equal(chooseTheme('How Water and Weather Shape Our Planet'), 'clean', 'most topic words win (2 science vs 1 space)');
  assert.equal(chooseTheme('How the Internet Works'), 'midnight');
  assert.equal(chooseTheme('Planets and stars in space'), 'midnight');
  // Regression (2026-11-10): the objective mentioned clouds, which matched the tech theme before the title was considered.
  assert.equal(chooseTheme('How the Water Cycle Works', 'Understand how water evaporates, forms clouds and falls as rain'), 'clean');
  assert.equal(chooseTheme('What is cloud computing'), 'midnight');
  assert.equal(chooseTheme('Understanding Middleware', 'Learn how software layers connect apps'), 'midnight', 'title has no match → objective decides');
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

test('requested theme wins; unknown values fall back to the topic; photo demos stay dark', () => {
  const storyboard = {title: 'How the Internet Works', target_audience: 'x', learning_objective: '', scenes: []} as never;
  assert.equal(paletteFor(storyboard, 'paper', false).name, 'paper');
  assert.equal(paletteFor(storyboard, 'neon', false).name, 'midnight');
  assert.equal(paletteFor(storyboard, undefined, false).name, 'midnight');
  assert.equal(paletteFor(storyboard, 'clean', true).name, 'midnight');
  assert.equal(isThemeName('clean'), true);
  assert.equal(isThemeName('auto'), false);
});

test('tint turns a hex colour into rgba and leaves other colours alone', () => {
  assert.equal(tint('#8b7cff', 0.22), 'rgba(139,124,255,0.22)');
  assert.equal(tint('rgba(1,2,3,.5)', 0.1), 'rgba(1,2,3,.5)');
});
