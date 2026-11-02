import { test } from "node:test";
import assert from "node:assert/strict";
import { appConfig } from "../src/config/app.ts";
import { chosenOr, DEFAULT_PREFERENCES, isDefaultPreferences, parsePreferences, PREFERENCES_VERSION, serializePreferences } from "../src/lib/preferences.ts";

test("defaults match the product configuration (60s, female voice, captions on, music off)", () => {
  assert.deepEqual(DEFAULT_PREFERENCES, { durationSeconds: appConfig.video.defaultDuration, voice: appConfig.video.defaultVoice, captions: appConfig.video.captionsEnabled, music: appConfig.video.musicEnabled });
  assert.deepEqual(DEFAULT_PREFERENCES, { durationSeconds: 60, voice: "female", captions: true, music: false });
});

test("only options the pipeline supports can be saved", () => {
  assert.deepEqual(appConfig.video.durations.map((d) => d.value), [30, 60, 90]);
  assert.deepEqual(appConfig.video.voices.map((v) => v.value), ["female", "male"]);
});

test("saved preferences round-trip", () => {
  const prefs = { durationSeconds: 30, voice: "male", captions: false, music: true } as const;
  const raw = serializePreferences(prefs);
  assert.equal(JSON.parse(raw).version, PREFERENCES_VERSION);
  assert.deepEqual(parsePreferences(raw), prefs);
});

test("nothing saved, or unreadable data, gives the defaults", () => {
  for (const raw of [null, undefined, "", "not json", "{", "null", "42", '"text"', "[1,2]", "true"]) assert.deepEqual(parsePreferences(raw), DEFAULT_PREFERENCES, String(raw));
});

test("invalid fields fall back one by one; valid ones are kept", () => {
  assert.deepEqual(parsePreferences(JSON.stringify({ durationSeconds: 45, voice: "male", captions: "yes", music: true })), { durationSeconds: 60, voice: "male", captions: true, music: true });
  assert.deepEqual(parsePreferences(JSON.stringify({ durationSeconds: "30", voice: "robot" })), DEFAULT_PREFERENCES, "strings and unknown voices are rejected");
  assert.deepEqual(parsePreferences(JSON.stringify({ durationSeconds: 90 })), { ...DEFAULT_PREFERENCES, durationSeconds: 90 });
});

test("outdated or future versions keep whatever is still valid; unknown keys are dropped", () => {
  const old = parsePreferences(JSON.stringify({ version: 0, durationSeconds: 30, voiceGender: "male", theme: "dark" }));
  assert.deepEqual(old, { ...DEFAULT_PREFERENCES, durationSeconds: 30 });
  assert.equal("theme" in old, false);
  assert.deepEqual(parsePreferences(JSON.stringify({ version: 99, durationSeconds: 90, voice: "male", captions: false, music: false })), { durationSeconds: 90, voice: "male", captions: false, music: false });
});

test("an explicit choice for one video overrides the saved default", () => {
  assert.equal(chosenOr(null, 30), 30, "no choice: saved default");
  assert.equal(chosenOr(60, 30), 60, "explicit 60 beats saved 30");
  assert.equal(chosenOr(false, true), false, "explicit 'off' is a choice, not missing");
});

test("isDefaultPreferences", () => {
  assert.equal(isDefaultPreferences({ ...DEFAULT_PREFERENCES }), true);
  assert.equal(isDefaultPreferences({ ...DEFAULT_PREFERENCES, music: true }), false);
});
