// Thumbnails of the cars for the players' bubbles: the real 3D model of each car, in its crew's
// colour, seen from three quarters (asked by the user, 2026-11-18: "miniature dei pezzi"). Drawn
// once per car in a small renderer of their own, as soon as the car's model has arrived.

import * as THREE from 'three';
import { carObjs } from './board';

const W = 150, H = 70;
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
  const m = Math.max(size.x, size.z) * 0.56;
  const cam = new THREE.OrthographicCamera(-m, m, m * H / W, -m * H / W, 0.01, 100);
  cam.position.set(-m * 0.25, m * 1.1, m * 1.5);
  cam.lookAt(0, 0, 0);
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
    if (!retry) retry = window.setTimeout(() => { retry = 0; redraw(); }, 700);
    return null;
  }
  const url = draw(model);
  cache.set(key, url);
  return url;
}
