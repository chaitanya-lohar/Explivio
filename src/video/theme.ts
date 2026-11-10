/*
 * Visual themes for generated videos (2026-11-10). Each video gets ONE palette, chosen automatically from its topic
 * (chooseTheme), so videos no longer all share the app's dark look. Colours only: no images, no extra render work.
 *
 * Remotion renders one video (one theme) per bundle instance, so the active palette is a render-scoped value set
 * once by the root composition before any scene renders (setActivePalette); the templates read it through the live
 * bindings in templates/shared.tsx.
 */

export type ThemeName = 'midnight' | 'clean' | 'vibrant' | 'paper';
export const THEME_NAMES: readonly ThemeName[] = ['midnight', 'clean', 'vibrant', 'paper'];

export type Palette = {
  name: ThemeName;
  /** Base background under the animated blobs. */
  base: string;
  /** Two soft blobs that drift slowly behind everything. */
  blobA: string;
  blobB: string;
  /** Small floating particles. */
  particle: string;
  text: string;
  muted: string;
  card: string;
  border: string;
  /** Text drawn ON the primary / secondary colours. */
  ink: string;
  primary: string;
  secondary: string;
  warm: string;
  /** Outline of the item being explained. */
  hilite: string;
  /** Card shadow (light themes need a visible one; dark themes use glow instead). */
  shadow: string;
  captionBg: string;
  captionText: string;
  /** The word being spoken in a caption. */
  captionActive: string;
  headingFont: string;
  bodyFont: string;
};

// DejaVu Sans covers the symbols the templates draw (✓ ↻ ≈ ↔ subscripts); it is installed in the cloud renderer.
const SANS = '"Segoe UI", "Helvetica Neue", Arial, "DejaVu Sans", sans-serif';

export const PALETTES: Record<ThemeName, Palette> = {
  // The original look: deep navy, violet and teal.
  midnight: {name: 'midnight', base: 'linear-gradient(180deg, #121527 0%, #0b0f1c 100%)', blobA: 'rgba(139,124,255,.32)', blobB: 'rgba(77,214,200,.20)', particle: 'rgba(244,245,250,.35)', text: '#f4f5fa', muted: 'rgba(244,245,250,.64)', card: 'rgba(29,33,48,.86)', border: 'rgba(244,245,250,.16)', ink: '#10121a', primary: '#8b7cff', secondary: '#4dd6c8', warm: '#f5c77a', hilite: '#ffffff', shadow: '0 18px 50px rgba(0,0,0,.35)', captionBg: 'rgba(8,10,20,.82)', captionText: '#f4f5fa', captionActive: '#f5c77a', headingFont: SANS, bodyFont: SANS},
  // Bright and airy: white cards on a soft blue-white, strong indigo and teal.
  clean: {name: 'clean', base: 'linear-gradient(180deg, #f8faff 0%, #eaf0fb 100%)', blobA: 'rgba(91,76,240,.16)', blobB: 'rgba(14,165,164,.16)', particle: 'rgba(91,76,240,.22)', text: '#141833', muted: 'rgba(20,24,51,.62)', card: '#ffffff', border: 'rgba(20,24,51,.12)', ink: '#ffffff', primary: '#5b4cf0', secondary: '#0e9f9e', warm: '#f59e0b', hilite: '#141833', shadow: '0 14px 40px rgba(37,44,97,.14)', captionBg: '#141833', captionText: '#ffffff', captionActive: '#ffd34d', headingFont: SANS, bodyFont: SANS},
  // Social-media gradient: magenta to violet to blue, glassy cards, yellow accents.
  vibrant: {name: 'vibrant', base: 'linear-gradient(160deg, #ff5f8f 0%, #8a4dff 52%, #2f8cff 100%)', blobA: 'rgba(255,214,102,.30)', blobB: 'rgba(56,239,200,.26)', particle: 'rgba(255,255,255,.45)', text: '#ffffff', muted: 'rgba(255,255,255,.80)', card: 'rgba(255,255,255,.16)', border: 'rgba(255,255,255,.38)', ink: '#2a1259', primary: '#ffe066', secondary: '#7cf7d4', warm: '#ffb36b', hilite: '#ffffff', shadow: '0 18px 46px rgba(42,18,89,.30)', captionBg: 'rgba(255,255,255,.96)', captionText: '#2a1259', captionActive: '#d6247a', headingFont: SANS, bodyFont: SANS},
  // Warm editorial: cream paper, ink text, terracotta and deep teal, serif headings.
  paper: {name: 'paper', base: 'linear-gradient(180deg, #faf4e6 0%, #f1e6cf 100%)', blobA: 'rgba(194,65,12,.12)', blobB: 'rgba(47,111,106,.13)', particle: 'rgba(120,84,40,.22)', text: '#2b2118', muted: 'rgba(43,33,24,.64)', card: '#fffaf0', border: 'rgba(43,33,24,.18)', ink: '#fffaf0', primary: '#c2410c', secondary: '#2f6f6a', warm: '#b7791f', hilite: '#2b2118', shadow: '0 12px 34px rgba(91,63,25,.16)', captionBg: '#2b2118', captionText: '#fffaf0', captionActive: '#f6c26b', headingFont: 'Georgia, "Times New Roman", serif', bodyFont: SANS},
};

// Topic words → theme. Checked in this order; the first theme with a match wins.
const RULES: [ThemeName, RegExp][] = [
  ['midnight', /\b(space|planet|star|galax|universe|black hole|orbit|moon|astronom|comput|software|program|code|coding|algorithm|internet|network|server|database|api|cloud computing|cyber|security|hack|encrypt|blockchain|crypto|ai\b|artificial intelligence|machine learning|neural|robot|quantum|chip|processor|gpu)\w*/i],
  ['paper', /\b(history|histor|ancient|empire|war\b|revolution|civili[sz]ation|king|queen|dynasty|philosoph|ethic|literature|poem|poetry|novel|language|grammar|religio|myth|culture|art\b|painting|music theory|economy|economic|inflation|money|market|finance|politic|democra|law\b|constitution|psycholog|habit|productiv)\w*/i],
  ['clean', /\b(biolog|cell|dna|gene|protein|body|heart|brain|blood|health|disease|virus|bacteria|immune|vaccine|medic|nutrition|vitamin|plant|photosynth|ecosystem|animal|evolution|chemi|atom|molecule|reaction|physics|gravity|energy|electric|magnet|light|sound|wave|climate|weather|rain|water|ocean|earth|volcano|earthquake|math|geometry|fraction|equation|engineer)\w*/i],
];

/**
 * Picks the theme for a video. The texts are tried in order (title first, then e.g. the learning objective): the
 * first text with any match decides, so a word in a longer description (a water cycle's "clouds") can't outweigh the
 * title. Topics with no match get "vibrant".
 */
export function chooseTheme(...texts: (string | undefined)[]): ThemeName {
  for (const text of texts) {
    if (!text) continue;
    for (const [theme, pattern] of RULES) if (pattern.test(text)) return theme;
  }
  return 'vibrant';
}

export const isThemeName = (value: unknown): value is ThemeName => typeof value === 'string' && (THEME_NAMES as readonly string[]).includes(value);

/** `#rrggbb` → `rgba(r,g,b,a)`; other colour strings are returned unchanged. */
export function tint(color: string, alpha: number): string {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color);
  return m ? `rgba(${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)},${alpha})` : color;
}
