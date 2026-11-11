import {test} from 'node:test';
import assert from 'node:assert/strict';
import {icons} from 'lucide-react';
import {emojiFor, iconFor, isEmoji} from '../src/video/concepts';

/* Icons for diagram items and the scene illustration emoji (2026-11-11). */

test('diagram labels get a matching icon, or none when nothing fits', () => {
  assert.equal(iconFor('Falls as rain'), icons.CloudRain);
  assert.equal(iconFor('Condenses into clouds'), icons.Cloud);
  assert.equal(iconFor('Server room'), icons.Server);
  assert.equal(iconFor('Roman Empire'), icons.Landmark);
  assert.equal(iconFor('Layered inside'), null, 'no forced match');
  assert.equal(iconFor('Stars'), icons.Orbit, 'start of word: "star" matches');

});

test('the scene illustration: Gemini\'s emoji if valid, else from the texts, else 💡', () => {
  assert.equal(emojiFor('🌋', 'Anything'), '🌋');
  assert.equal(emojiFor('not an emoji', 'Heavy rain falls'), '🌧️');
  assert.equal(emojiFor(undefined, 'Untitled', 'How memory works in the brain'), '🧠', 'later texts are tried');
  assert.equal(emojiFor(undefined, 'Nothing matches here'), '💡');
  assert.equal(isEmoji('👍🏽'), true, 'skin-tone modifier');
  assert.equal(isEmoji('🧑‍🔬'), true, 'joined sequence');
  assert.equal(isEmoji('ab'), false);
  assert.equal(isEmoji('🌧️🌧️🌧️🌧️🌧️🌧️'), false, 'too long');
});

test('short words only match whole words or their real variants (no false icons)', () => {
  const none = ['Start here', 'Carbon dioxide', 'General', 'Ready to go', 'Article', 'Lawn care', 'Hotel stay', 'Cellar door', 'Restart'];
  for (const label of none) assert.equal(iconFor(label), null, label);
  assert.equal(iconFor('Flowers bloom'), icons.Leaf, '"flower" is a plant, not a river');
  assert.equal(iconFor('Five stars'), icons.Orbit);
  assert.equal(iconFor('Blood cells'), icons.Microscope, 'first concept in the list wins (cells)');
});
