// The dice of the interface drawn in 3D over the page (a transparent WebGL layer).
// A transparent WebGL layer over the interface: every element marked data-die3d="kind|value|color"
// (my dice, opponents', the road die, dice placed on boards, the dragged die) gets a 3D die drawn
// exactly over it. The element stays in the page, invisible, for layout and clicks.

import * as THREE from 'three';
import { makeDie, withOwnMaterials, type Die3D } from '../view/dice3d';
import { AWAY, FORWARD } from './board';
import { FACES } from './util';

export const hudRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
hudRenderer.setPixelRatio(Math.min(devicePixelRatio, 2));

hudRenderer.toneMapping = THREE.NoToneMapping;
Object.assign(hudRenderer.domElement.style, { position: 'fixed', left: '0', top: '0', pointerEvents: 'none', zIndex: '7' });
document.body.appendChild(hudRenderer.domElement);
export const hudScene = new THREE.Scene();
hudScene.add(new THREE.AmbientLight(0xffffff, 1.5));
export const hudLamp = new THREE.DirectionalLight(0xffffff, 1.9);
hudLamp.position.set(-0.4, 0.8, 1);
hudScene.add(hudLamp);
export const hudCam = new THREE.OrthographicCamera(0, 1, 0, -1, -500, 500);
export interface HudDie { d: Die3D; key: string; seen: boolean }
export const hudDice = new Map<Element, HudDie>();
export const TO_SCREEN = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
export const TILT = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.32, -0.4, 0));

export function fitHud(): void {
  hudRenderer.setSize(innerWidth, innerHeight);
  Object.assign(hudCam, { left: 0, right: innerWidth, top: 0, bottom: -innerHeight });
  hudCam.updateProjectionMatrix();
}
addEventListener('resize', fitHud);
fitHud();

export function syncHudDice(now: number): void {
  for (const h of hudDice.values()) h.seen = false;
  for (const el of document.querySelectorAll('[data-die3d]')) {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || el.closest('[style*="display: none"]') || el.closest('#roundbox:not(.show)') || el.closest('#rolls:not(.show)')) continue;
    const key = el.getAttribute('data-die3d')!;
    let h = hudDice.get(el);
    if (h && h.key !== key) { hudScene.remove(h.d.mesh); h = undefined; }
    if (!h) {
      const [kind, , color] = key.split('|');
      h = { d: withOwnMaterials(makeDie(FACES, kind, 1, color || undefined)), key, seen: true };
      hudScene.add(h.d.mesh);
      hudDice.set(el, h);
    }
    h.seen = true;
    const [kind, value] = key.split('|');
    const size = Math.min(r.width, r.height) * 0.8;
    h.d.mesh.scale.setScalar(size);
    h.d.mesh.position.set(r.left + r.width / 2, -(r.top + r.height / 2), 0);
    const face = Math.max(0, h.d.faceOf(kind === 'movement' ? Number(value) : value));
    const fwd = kind === 'direction' ? FORWARD : AWAY;
    const q = h.d.orientation(face, fwd).premultiply(TO_SCREEN).premultiply(TILT);
    if (el.classList.contains('sel')) q.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.sin(now * 3) * 0.35));
    // A die being rolled tumbles, then settles on its face.
    const rollAt = Number(el.getAttribute('data-roll') ?? 0);
    if (rollAt) {
      const u = THREE.MathUtils.clamp((now * 1000 - rollAt) / 900, 0, 1);
      if (u < 1) {
        const spin = (1 - u) ** 2 * 14;
        q.premultiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(spin * 1.3, spin, spin * 0.7)));
        h.d.mesh.position.y += Math.abs(Math.sin(u * Math.PI * 2.5)) * (1 - u) * size * 0.9;
      }
    }
    h.d.mesh.quaternion.copy(q);
    const faded = el.classList.contains('used');
    for (const m of h.d.mesh.material as THREE.MeshStandardMaterial[]) { m.transparent = faded; m.opacity = faded ? 0.22 : 1; }
  }
  for (const [el, h] of hudDice) if (!h.seen) {
    hudScene.remove(h.d.mesh);
    for (const m of h.d.mesh.material as THREE.Material[]) m.dispose();
    hudDice.delete(el);
  }
}
