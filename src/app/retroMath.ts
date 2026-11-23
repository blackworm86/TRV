// The arithmetic of the retro styles (retro.ts), apart from three.js and the page so it can be tested.

/**
 * The pixel ratio that draws each pixel `pixel` CSS pixels wide: the browser then enlarges the
 * canvas to the screen with hard edges. The same size on every screen, so the table reads the same
 * on a tablet and on a large monitor (the user found a fixed count of rows too coarse, 2026-11-23).
 * Never above the screen's own ratio.
 */
export function renderRatio(pixel: number, dpr: number): number {
  if (pixel <= 0) return dpr;
  return Math.min(dpr, 1 / pixel);
}

/**
 * The grid the vertices are snapped to, in half-sizes of normalised device coordinates (the
 * shader multiplies -1..1 by it): one cell every `snapPx` drawn pixels. 0 when there is no snap.
 */
export function snapGrid(bufferW: number, bufferH: number, snapPx: number): [number, number] {
  if (snapPx <= 0 || bufferW <= 0 || bufferH <= 0) return [0, 0];
  return [bufferW / 2 / snapPx, bufferH / 2 / snapPx];
}
