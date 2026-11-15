// Vector art as three.js textures. An SVG data URL uploaded straight to WebGL can arrive empty
// (an SVG with only a viewBox has no intrinsic size), so every drawing is first rasterised on a
// canvas at a known resolution and the canvas becomes the texture.

import * as THREE from 'three';
import { dataUrl } from './vector/art';

const cache = new Map<string, THREE.CanvasTexture>();
const pending = new Set<Promise<void>>();

/** Resolves when every texture made so far has its image drawn. */
export function texturesReady(): Promise<void> {
  return Promise.all([...pending]).then(() => undefined);
}

/** Counts `p` (an image that is still loading) in {@link texturesReady}. */
export function trackTexture(p: Promise<unknown>): void {
  const done = p.then(() => undefined, () => undefined);
  pending.add(done);
  void done.then(() => pending.delete(done));
}

/**
 * Texture of an SVG drawing, `px` pixels on its longer side. Returned at once (blank) and
 * filled in when the image decodes. Cached by drawing and size.
 * Example: `mat.map = svgTexture(dieSvg({ kind: 'road', value: 2 }), 256)`.
 */
export function svgTexture(svgText: string, px = 256): THREE.CanvasTexture {
  const key = `${px}|${svgText}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const vb = /viewBox="([\d.\s-]+)"/.exec(svgText)?.[1].trim().split(/\s+/).map(Number) ?? [0, 0, 1, 1];
  const ratio = vb[2] / vb[3];
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(ratio >= 1 ? px : px * ratio);
  canvas.height = Math.round(ratio >= 1 ? px / ratio : px);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const img = new Image(canvas.width, canvas.height);
  const done = new Promise<void>(resolve => {
    img.onload = () => {
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      tex.needsUpdate = true;
      resolve();
    };
    img.onerror = () => resolve();
  });
  pending.add(done);
  void done.then(() => pending.delete(done));
  // Explicit size on the root, so the browser rasterises at the canvas resolution.
  img.src = dataUrl(svgText.replace('<svg ', `<svg width="${canvas.width}" height="${canvas.height}" `));
  cache.set(key, tex);
  return tex;
}
