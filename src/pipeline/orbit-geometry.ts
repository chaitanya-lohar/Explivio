/*
 * Orbit diagram geometry, kept pure for tests. Angles are mathematical (radians, counterclockwise, 0 = right),
 * so increasing angle = counterclockwise on screen, the direction the Moon and planets orbit seen from the north.
 */

const TAU = Math.PI * 2;

/**
 * Angle of marker i of n. With a light source (drawn on the left) markers start on the side facing it, so for the
 * Moon's phases "New moon" sits between Earth and the Sun and "Full moon" opposite. Without one they start at the top.
 */
export function markerAngle(i: number, n: number, lit: boolean): number {
  const start = lit ? Math.PI : Math.PI / 2;
  return start + (TAU * i) / Math.max(1, n);
}

/** Point on an ellipse for a math angle, in screen coordinates (y grows downward). */
export function orbitPoint(angle: number, cx: number, cy: number, rx: number, ry: number): {x: number; y: number} {
  return {x: cx + rx * Math.cos(angle), y: cy - ry * Math.sin(angle)};
}

/** The smallest angle ≥ `from` that points the same way as `target`: moves only counterclockwise, never backwards. */
export function forwardTo(from: number, target: number): number {
  let t = target;
  while (t < from) t += TAU;
  while (t - from >= TAU) t -= TAU;
  return t;
}

const ease = (p: number) => (p <= 0 ? 0 : p >= 1 ? 1 : p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2);

/**
 * Orbiter angle at a frame. It circles steadily (one turn per `turnFrames`) from `startFrame`; when marker k is
 * mentioned (markerFrames[k]) it glides forward to that marker over `glideFrames` and waits there; after the last
 * marker it resumes circling. Without markers it just circles. Deterministic: depends only on the frame.
 */
export function orbiterAngle(frame: number, opts: {startFrame: number; startAngle: number; turnFrames: number; markerFrames: readonly number[]; markerAngles: readonly number[]; glideFrames?: number; holdFrames?: number}): number {
  const {startFrame, startAngle, turnFrames, markerFrames, markerAngles} = opts;
  const glide = opts.glideFrames ?? 20;
  const hold = opts.holdFrames ?? 45;
  const speed = TAU / turnFrames;
  let angle = startAngle;
  let t = startFrame;
  if (frame <= t) return angle;
  for (let k = 0; k < markerFrames.length; k++) {
    const at = Math.max(markerFrames[k], t);
    // Free circling until this marker is mentioned.
    if (frame <= at) return angle + speed * (frame - t);
    angle += speed * (at - t);
    const target = forwardTo(angle, markerAngles[k]);
    if (frame <= at + glide) return angle + (target - angle) * ease((frame - at) / glide);
    angle = target;
    t = at + glide;
    // Wait at the marker until the next one (or `hold` frames after the last).
    const next = k + 1 < markerFrames.length ? Math.max(markerFrames[k + 1], t) : t + hold;
    if (frame <= next) return angle;
    t = next;
  }
  return angle + speed * (frame - t);
}

/** Visual style for a body from its label (colour only; the template never decides which body is central). */
export function bodyKind(label: string): 'star' | 'earth' | 'moon' | 'planet' | 'other' {
  const l = label.toLowerCase();
  if (/\bsun\b|\bstar\b/.test(l)) return 'star';
  if (/\bearth\b/.test(l)) return 'earth';
  if (/\bmoon\b/.test(l)) return 'moon';
  if (/mercury|venus|mars|jupiter|saturn|uranus|neptune|planet/.test(l)) return 'planet';
  return 'other';
}
