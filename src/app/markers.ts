// The rings and tips on the table that show where a choice can be made (spaces, cars,
// targets), and why a car cannot be shot.

import * as THREE from 'three';
import { ROWS, COLS, TILE_COLS, type Blocked, type Decision, type Pos } from '../game/trv/engine';
import { spaceGeometry, spaceRimGeometry, GRID } from '../view/board3d';
import { HAZ_SIZE, carObjs, carRingGeo, markerGroup, ringGeo } from './board';
import { decision, g } from './game';
import { upgradeName } from './info';
import { planDecision, planning } from './waypoints';
import { commandLastChance } from './dock';
import { stepAfter } from './pathsim';
import { BOARD_X0, KX, PITCH_W, TILE_H, TILE_T, TILE_W, camera, world } from './stage';
import { S } from './state';
import { $, esc } from './util';

/** Why an ability keeps a car from being shot, said over the car during the shoot step. */
export const BLOCK_WHY: Record<string, string> = {
  stealth_technology: 'non puoi sparare a questa auto finché c’è un altro bersaglio!',
  smoke_screen: 'non puoi sparare a questa auto dalla casella dietro di lei!',
};
/** What a target's card does to a shot at it, recalled while aiming. */
export const TARGET_WARN: Record<string, string> = {
  armor_plating: 'il risultato “qualsiasi” del dado sparo contro di lei manca.',
};
export let blockTips: { el: HTMLElement; at: THREE.Vector3 }[] = [];
/** Keeps the "you cannot shoot" bubbles over their cars as the view moves. */
export function placeBlockTips(): void {
  for (const t of blockTips) {
    const p = t.at.clone().setY(TILE_T + 0.6).project(camera);
    t.el.style.left = `${(p.x + 1) / 2 * innerWidth}px`;
    t.el.style.top = `${(1 - p.y) / 2 * innerHeight}px`;
  }
}

/** Marks a car an ability keeps from being shot: red glow, red rim on its space, a bubble saying why. */
export function markBlocked(b: Blocked): void {
  const obj = carObjs.get(b.carId);
  if (obj) obj.userData.glow = { color: '#ff3b30', strength: 0.85 };
  const slot = Math.floor(b.pos.c / TILE_COLS), rc = b.pos.c - slot * TILE_COLS;
  const rim = new THREE.Mesh(spaceRimGeometry(b.pos.r, rc, TILE_W, TILE_H, 0.97, 0.8),
    new THREE.MeshBasicMaterial({ color: 0xff3b30, transparent: true, opacity: 1, depthWrite: false, toneMapped: false }));
  rim.rotation.x = -Math.PI / 2;
  rim.position.set(BOARD_X0 + slot * PITCH_W + (GRID.frameW / 2) * KX, TILE_T + HAZ_SIZE.thickness + 0.02, 0);
  rim.renderOrder = 10;
  markerGroup.add(rim);
  const el = document.createElement('div');
  el.className = 'blocktip';
  el.innerHTML = `<b>${esc(upgradeName(b.because))}</b>${esc(BLOCK_WHY[b.because] ?? 'non puoi sparare a questa auto')}`;
  $('fx').append(el);
  blockTips.push({ el, at: world(b.pos) });
}

/**
 * Shows where a slam's current result would send a car (asked by the user, 2026-11-17): a copy of
 * the car at its destination, as if of glass in its player's colour, and an arrow from the car to it.
 * Neither is a pick target.
 */
/** Where a slam preview is drawn (the car's space and its destination): the floating question keeps clear of them. */
export const previewSpots: THREE.Vector3[] = [];
export function markPreview(carId: string, to: Pos): void {
  const obj = carObjs.get(carId);
  const v = g?.vehicles.find(x => x.id === carId);
  if (!obj || !v) return;
  const color = new THREE.Color(v.owner !== null ? g!.players[v.owner].color : '#c9c8c2');
  // From the car's space in the rules (the car on the table may still be driving there).
  const from = (v.pos ? world(v.pos) : obj.position.clone()).setY(obj.position.y), dest = world(to).setY(from.y);
  // The glass car: the car's own meshes, in a see-through colour, placed as the car is.
  const glass = new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.6, roughness: 0.1, metalness: 0.2, emissive: color, emissiveIntensity: 0.5, depthWrite: false });
  const ghost = new THREE.Group();
  obj.updateMatrixWorld(true);
  const inv = obj.matrixWorld.clone().invert();
  obj.traverse(m => {
    if (!(m instanceof THREE.Mesh) || !m.visible) return;
    const copy = new THREE.Mesh(m.geometry, glass);
    copy.matrixAutoUpdate = false;
    copy.matrix.multiplyMatrices(inv, m.matrixWorld);
    copy.renderOrder = 11;
    ghost.add(copy);
  });
  previewSpots.push(from.clone(), dest.clone());
  ghost.position.copy(dest);
  ghost.quaternion.copy(obj.quaternion);
  ghost.scale.copy(obj.scale);
  markerGroup.add(ghost);
  // The arrow, flat on the table, from the car to its copy (stopping short of both).
  const space = TILE_W / 8;
  const along = dest.clone().sub(from).setY(0);
  const len = along.length();
  if (len < 1e-3) return;
  const start = space * 0.28, end = len - space * 0.3, w = space * 0.07, head = space * 0.22;
  // The arrow in the player's colour on a dark one a little bigger: it reads on every terrain.
  const arrowShape = (k: number, s0: number, s1: number): THREE.Shape => {
    const a = new THREE.Shape();
    a.moveTo(s0, -w * k); a.lineTo(s1 - head, -w * k); a.lineTo(s1 - head, -w * 2.6 * k); a.lineTo(s1, 0);
    a.lineTo(s1 - head, w * 2.6 * k); a.lineTo(s1 - head, w * k); a.lineTo(s0, w * k); a.closePath();
    return a;
  };
  const pad = space * 0.025;
  for (const [shape, c, order] of [[arrowShape(1.8, start - pad, end + pad * 2), new THREE.Color('#15110d'), 12], [arrowShape(1, start, end), color, 13]] as const) {
    const arrow = new THREE.Mesh(new THREE.ShapeGeometry(shape),
      new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.95, depthTest: false, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
    arrow.rotation.order = 'YXZ';
    arrow.rotation.set(-Math.PI / 2, Math.atan2(-along.z, along.x), 0);
    arrow.position.set(from.x, TILE_T + HAZ_SIZE.thickness + 0.04, from.z);
    arrow.renderOrder = order;
    markerGroup.add(arrow);
  }
}

export function drawMarkers(): void {
  markerGroup.clear();
  S.markers = [];
  previewSpots.length = 0;
  for (const t of blockTips) t.el.remove();
  blockTips = [];
  // (The car that is moving glows anyway: see applyGlow.)
  for (const o of carObjs.values()) o.userData.glow = null;
  if (!g || !decision || S.playing) return;
  // Planning a path: the spaces the path can go on to from its last point (waypoints.ts).
  // While "a command?" is asked, the spaces of the move after "no command" (see aheadDecision).
  const ahead = aheadDecision();
  const d = planning() ? planDecision() : ahead ?? decision;
  if (!d) return;
  // A slam reroll: where the current result would move which car, as a glass car and an arrow.
  if (d.preview) markPreview(d.preview.carId, d.preview.to);
  // Assigning: the cars that can still take a die glow in the player's colour; with a die in
  // hand, only those that accept it, and they can be dropped on.
  if (d.kind === 'assign') {
    const p = g.players[d.player];
    const free = new Set(p.dice.filter((_, i) => !p.used[i]));
    const v = S.selDie === null ? null : p.dice[S.selDie];
    const done = new Set<string>();
    d.options.forEach((o, i) => {
      if (!o.carId || done.has(o.carId)) return;
      if (v === null ? !free.has(o.dieValue!) : o.dieValue !== v) return;
      done.add(o.carId);
      const obj = carObjs.get(o.carId);
      if (!obj) return;
      // Lower than before the vivid crew colours (2026-11-20: 0.35 and 0.75 painted wheels and guns too).
      obj.userData.glow = { color: p.color, strength: v === null ? 0.16 : 0.42 };
      if (v === null) return;
      // An invisible marker: it only makes the car a drop target.
      const at = (obj.userData.target as THREE.Vector3).clone();
      const mesh = new THREE.Mesh(carRingGeo, new THREE.MeshBasicMaterial({ visible: false }));
      markerGroup.add(mesh);
      S.markers.push({ mesh, option: i, at });
    });
    return;
  }
  // Shooting: a car an ability keeps from being a target glows red and says why (Stealth
  // Technology, Smoke Screen), so the player sees the other car's power at work.
  for (const b of d.blocked ?? []) markBlocked(b);
  // A target that can be shot but defends itself: a reminder, in amber, of what its card does.
  if (d.kind === 'shoot') {
    for (const o of d.options) {
      const v = o.carId ? g.vehicles.find(x => x.id === o.carId) : undefined;
      if (!v?.upgrade || v.status !== 'ok' || !TARGET_WARN[v.upgrade] || !v.pos) continue;
      const el = document.createElement('div');
      el.className = 'blocktip warn';
      el.innerHTML = `<b>${esc(upgradeName(v.upgrade))}</b>${esc(TARGET_WARN[v.upgrade])}`;
      $('fx').append(el);
      blockTips.push({ el, at: world(v.pos) });
    }
  }
  // The Big Rig's Cow Catcher (asked by the user, 2026-11-18): the two spaces the vehicle can be
  // sent to, lit on the table, each with the glass copy of the vehicle and its arrow, as in a bump.
  if (d.kind === 'cowCatcher') for (const o of d.options) if (o.carId && o.pos) markPreview(o.carId, o.pos);
  if (!['step', 'airstrike', 'shoot', 'peek', 'peekResult', 'plow', 'rollCage', 'dispense', 'radar', 'cowCatcher', 'dodge', 'space', 'pickVehicle'].includes(d.kind)) return;
  const MARK_COLOR: Partial<Record<Decision['kind'], number>> = {
    step: 0x4cff7a, shoot: 0xff2d2d, airstrike: 0x7fd4ff,
    dispense: 0x2f7bff, plow: 0x2f7bff, rollCage: 0x2f7bff, radar: 0x2f7bff, peek: 0x2f7bff, peekResult: 0x2f7bff, cowCatcher: 0x2f7bff, dodge: 0x2f7bff,
    // The mini expansions' spaces and vehicles (Guardrails, Blockaded, Nav System, Slow and Steady, the chopper's cards).
    space: 0x2f7bff, pickVehicle: 0x2f7bff,
  };
  d.options.forEach((o, i) => {
    if (!o.pos) return;
    const at = world(o.pos);
    if (S.markers.some(m => m.at.distanceTo(at) < 0.05)) return;
    // What the space is for, by colour (asked by the user, 2026-11-17): green a move, red a shot,
    // blue a card's or a power's ability (oil, mine, Snowplow, Roll Cage, radar, Third Eye);
    // the chopper's landing keeps its sky blue, a step that eliminates the car its warning red.
    const color = o.danger || (d.kind === 'cowCatcher' && /eliminat/.test(o.label)) ? 0xff3b30 : MARK_COLOR[d.kind] ?? 0x4cff7a;
    const onTable = o.pos.r >= 0 && o.pos.r < ROWS && o.pos.c >= 0 && o.pos.c < COLS;
    let mesh: THREE.Mesh;
    if (onTable) {
      // A coloured border around the space, the terrain left visible inside (asked by the user,
      // 2026-11-16). The space itself is an invisible pick target. Not tone mapped, so the
      // colour stays vivid under the table's lighting.
      const slot = Math.floor(o.pos.c / TILE_COLS);
      const rc = o.pos.c - slot * TILE_COLS;
      const glow = (opacity: number, additive: boolean): THREE.MeshBasicMaterial => new THREE.MeshBasicMaterial({
        color, transparent: true, opacity, depthWrite: false, toneMapped: false, ...(additive ? { blending: THREE.AdditiveBlending } : {}),
      });
      mesh = new THREE.Mesh(spaceGeometry(o.pos.r, rc, TILE_W, TILE_H, 1.0), new THREE.MeshBasicMaterial({ visible: false }));
      const rim = new THREE.Mesh(spaceRimGeometry(o.pos.r, rc, TILE_W, TILE_H, 0.97, 0.8), glow(1, false));
      rim.position.z = 0.002;
      const halo = new THREE.Mesh(spaceRimGeometry(o.pos.r, rc, TILE_W, TILE_H, 1.08, 0.97), glow(0.35, true));
      mesh.add(rim, halo);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(BOARD_X0 + slot * PITCH_W + (GRID.frameW / 2) * KX, TILE_T + HAZ_SIZE.thickness + 0.02, 0);
    } else {
      mesh = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthTest: false }));
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.copy(at).setY(TILE_T + 0.1);
    }
    mesh.renderOrder = 10;
    markerGroup.add(mesh);
    S.markers.push({ mesh, option: i, at, ...(ahead ? { ahead: true as const } : {}) });
  });
}

let aheadMemo: { key: string; d: Decision | null } = { key: '', d: null };
/**
 * While a person is asked "a command?" and may also not use one, the step decision that "no
 * command" leads to (asked by the user, 2026-11-22: moving the car is "no command", one click
 * fewer). Null otherwise. Worked out once per question.
 */
export function aheadDecision(): Decision | null {
  const d = decision;
  if (!g || !d || S.playing || d.kind !== 'command' || !S.saved || g.players[d.player].bot || commandLastChance(d)) return null;
  const key = `${S.saved.setup.seed}:${S.saved.choices.length}`;
  if (aheadMemo.key !== key) aheadMemo = { key, d: stepAfter(S.saved.setup, S.saved.choices, 0) };
  return aheadMemo.d;
}
