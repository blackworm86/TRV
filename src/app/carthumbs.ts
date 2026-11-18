// Thumbnails of the cars for the players' bubbles: the real 3D model of each car, in its crew's
// colour, seen from three quarters (asked by the user, 2026-11-18: "miniature dei pezzi"). Drawn
// once per car in a small renderer of their own, as soon as the car's model has arrived.

import * as THREE from 'three';
import { carObjs } from './board';

const W = 150, H = 84;
/**
 * How long a piece shows nothing while its 3D model loads (milliseconds): past it a stand-in is
 * drawn instead, on the table (pieces.ts) and in the bubbles (bubbles.ts).
 */
export const STAND_IN_AFTER_MS = 6000;
/** When each car's thumbnail was first asked for and not ready. */
const asked = new Map<string, number>();
/** Whether car `id`'s thumbnail has been waited for longer than STAND_IN_AFTER_MS. */
export function thumbLate(id: string): boolean {
  return performance.now() - (asked.get(id) ?? performance.now()) > STAND_IN_AFTER_MS;
}
const cache = new Map<string, string>();
let renderer: THREE.WebGLRenderer | null = null;
let retry = 0;

/** Draws the model `model` alone, as a PNG data URL. */
function draw(model: THREE.Object3D): string {
  renderer ??= new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(2);
  renderer.setSize(W, H);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const c = model.clone(true);
  c.position.set(0, 0, 0);
  c.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(c), size = box.getSize(new THREE.Vector3());
  c.position.sub(box.getCenter(new THREE.Vector3()));
  const scene = new THREE.Scene();
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(2, 6, 4);
  scene.add(c, new THREE.HemisphereLight(0xffffff, 0x3a2a1a, 2.4), sun);
  // Seen from three quarters; the frame is fitted to the whole model as the camera sees it (the
  // eight corners of its box), with a margin, so nothing is cut (asked by the user, 2026-11-18).
  const m = Math.max(size.x, size.y, size.z);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, m * 20);
  cam.position.set(-m * 0.9, m * 0.85, m * 3);
  cam.lookAt(0, 0, 0);
  cam.updateMatrixWorld(true);
  const half = size.clone().multiplyScalar(0.5), view = cam.matrixWorldInverse;
  let hx = 0, hy = 0;
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    const q = new THREE.Vector3(sx * half.x, sy * half.y, sz * half.z).applyMatrix4(view);
    hx = Math.max(hx, Math.abs(q.x)); hy = Math.max(hy, Math.abs(q.y));
  }
  const fit = Math.max(hx, hy * W / H) * 1.04;
  cam.left = -fit; cam.right = fit; cam.top = fit * H / W; cam.bottom = -fit * H / W;
  cam.updateProjectionMatrix();
  renderer.render(scene, cam);
  return renderer.domElement.toDataURL('image/png');
}

/**
 * The thumbnail of car `id` in colour `color`, or null while its model is still loading: then
 * `redraw` is called a little later, to try again.
 */
export function carThumb(id: string, color: string, redraw: () => void): string | null {
  const key = `${id}|${color}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const model = carObjs.get(id)?.userData.model as THREE.Object3D | undefined;
  if (!model) {
    if (!asked.has(id)) asked.set(id, performance.now());
    if (!retry) retry = window.setTimeout(() => { retry = 0; redraw(); }, 700);
    return null;
  }
  const url = draw(model);
  cache.set(key, url);
  return url;
}
