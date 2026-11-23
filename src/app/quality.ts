// Graphics quality: fixed levels or automatic, dropped when the frame rate stays low.
// Fixed levels or `auto`: the frame rate is measured all the time and, under `auto`, a level is
// dropped when the game runs below FPS_LOW for a while (slow computers: 10-15 fps reported by
// the user). It never climbs back by itself, to avoid flicker; the menu can set it again.

import * as THREE from 'three';
import { hudRenderer } from './hudDice';
import { fit } from './mapView';
import { syncOptions } from './menus';
import { LEVELS, Level, settings } from './settings';
import { lamp, renderer } from './stage';
import { patchForStyle, retroRatio, styleCaps } from './retro';
import { setReliefDetail } from '../view/board3d';
import { S } from './state';
import { $ } from './util';

export const FPS_LOW = 32, FPS_WINDOW = 2;
export const ORDER: Level[] = ['high', 'medium', 'low'];
/** Model textures, with their full-size image, so a level can shrink them and a higher one restore them. */
export const modelTextures = new Map<THREE.Texture, CanvasImageSource & { width: number; height: number }>();
export function registerTextures(m: THREE.Object3D): void {
  m.traverse(o => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (const mat of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      for (const v of Object.values(mat)) {
        const t = v as THREE.Texture;
        if (t?.isTexture && t.image && !modelTextures.has(t)) { modelTextures.set(t, t.image as CanvasImageSource & { width: number; height: number }); fitTexture(t, Math.min(LEVELS[S.level].texture, styleCaps().texture)); }
      }
    }
  });
}
export function fitTexture(t: THREE.Texture, max: number): void {
  const full = modelTextures.get(t);
  if (!full) return;
  const k = Math.min(1, max / Math.max(full.width, full.height));
  if (k >= 1) { if (t.image !== full) { t.image = full; t.needsUpdate = true; } return; }
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(full.width * k));
  c.height = Math.max(1, Math.round(full.height * k));
  c.getContext('2d')!.drawImage(full, 0, 0, c.width, c.height);
  t.image = c;
  t.needsUpdate = true;
}
/** Puts a quality level into effect: resolution of both renderers, the shadow, model textures (within what the graphics style allows, retro.ts). */
export function applyLevel(l: Level): void {
  S.level = l;
  const L = LEVELS[l], C = styleCaps();
  renderer.setPixelRatio(Math.min(devicePixelRatio, L.pixelRatio));
  hudRenderer.setPixelRatio(retroRatio() ?? Math.min(devicePixelRatio, l === 'high' ? 2 : 1));
  hudRenderer.domElement.classList.toggle('retro', settings.style !== 'modern');
  lamp.castShadow = L.shadow > 0 && C.shadow;
  if (L.shadow > 0 && lamp.shadow.mapSize.x !== L.shadow) {
    lamp.shadow.mapSize.set(L.shadow, L.shadow / 2);
    lamp.shadow.map?.dispose();
    lamp.shadow.map = null;
  }
  for (const t of modelTextures.keys()) fitTexture(t, Math.min(L.texture, C.texture));
  setReliefDetail(L.relief);
  // "low": no blur behind the panels and no shadow filters, recomputed at every frame over the table.
  document.body.classList.toggle('lite', l === 'low');
  fit();
  patchForStyle(true);
  syncOptions();
}
export let fpsAcc = 0;
export let fpsFrames = 0;
export let fpsNow = 0;
/** Called every frame with its length: keeps the frame rate and, under `auto`, steps the level down. */
export function frameTimes(dt: number): void {
  fpsAcc += dt;
  fpsFrames++;
  if (fpsAcc < FPS_WINDOW) return;
  fpsNow = fpsFrames / fpsAcc;
  fpsAcc = 0;
  fpsFrames = 0;
  if (document.hidden) return;
  S.fpsSlow = fpsNow < FPS_LOW ? S.fpsSlow + 1 : 0;
  if (settings.quality === 'auto' && S.fpsSlow >= 2 && S.level !== 'low') {
    S.fpsSlow = 0;
    applyLevel(ORDER[ORDER.indexOf(S.level) + 1]);
  }
  if ($('menupop').classList.contains('show')) syncOptions();
}
