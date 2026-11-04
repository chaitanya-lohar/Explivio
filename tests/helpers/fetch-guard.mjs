// Test preload: records every outgoing fetch URL to $FETCH_LOG and blocks the paid narration provider outright.
import {appendFileSync} from 'node:fs';

const original = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input?.url ?? String(input);
  if (process.env.FETCH_LOG) appendFileSync(process.env.FETCH_LOG, `${url}\n`);
  if (/elevenlabs\.io/i.test(url)) throw new Error(`blocked by test: ${url}`);
  return original(input, init);
};
