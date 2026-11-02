import type {WordTime} from './scene-timing';

const STOPWORDS = new Set(['the', 'and', 'with', 'from', 'that', 'this', 'into', 'your', 'their', 'what', 'when', 'have', 'will', 'about', 'over', 'under', 'than', 'then', 'they', 'them', 'for', 'are', 'its', 'our', 'how', 'why', 'not', 'all', 'can', 'one', 'two']);

/**
 * Crude stem so "orbits" / "orbiting" / "orbit" and "rests" / "rest" match: lower-case, letters/digits only,
 * a plural or verb ending dropped (when enough remains), then the first 5 characters.
 */
export function stem(word: string): string {
  const w = word.toLowerCase().replace(/[^a-z0-9]/g, '');
  const base = w.length > 4 && w.endsWith('ies') ? `${w.slice(0, -3)}y` : w.replace(/(sh|ch|ss|x|z)es$/, '$1').replace(/(?<=\w{3})(?:ing|ed|s)$/, '');
  return base.slice(0, 5);
}

/** Meaningful words of a label (3+ characters, not stopwords), stemmed. */
export function keywords(text: string): string[] {
  return text.split(/[^A-Za-z0-9]+/).filter((w) => w.length >= 3 && !STOPWORDS.has(w.toLowerCase())).map(stem);
}

/**
 * When each label should appear (seconds, absolute): the first time one of its keywords is spoken inside the
 * scene. Labels never mentioned are spaced evenly. For ordered templates the times never go backwards, so items
 * still reveal in sequence even if a later item happens to be mentioned first.
 */
/** A label counts as said together when its keywords fall within this many consecutive words. */
const MENTION_WINDOW = 4;

export function mentionTimes(labels: readonly string[], words: readonly WordTime[], start: number, end: number, ordered = true): number[] {
  const duration = Math.max(0.1, end - start);
  const sceneWords = words.filter((w) => w.start >= start - 0.05 && w.start < end).map((w) => ({stem: stem(w.text), start: w.start}));
  const even = (i: number) => start + duration * (0.08 + (0.8 * i) / Math.max(1, labels.length));
  const times = labels.map((text, i) => {
    const wanted = new Set(keywords(text));
    // Where most of the label is said together ("pushes water" beats a lone "push"); earliest wins a tie.
    let best: {start: number; score: number} | null = null;
    sceneWords.forEach((w, j) => {
      if (w.stem.length < 3 || !wanted.has(w.stem)) return;
      const score = new Set(sceneWords.slice(j, j + MENTION_WINDOW).map((x) => x.stem).filter((s) => wanted.has(s))).size;
      if (!best || score > best.score) best = {start: w.start, score};
    });
    return best ? (best as {start: number}).start : even(i);
  });
  if (ordered) for (let i = 1; i < times.length; i++) times[i] = Math.max(times[i], times[i - 1]);
  return times.map((t) => Math.min(Math.max(t, start), end));
}
