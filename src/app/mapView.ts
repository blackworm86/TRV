// The map view: framing the whole road (angled or from above, V), the tilt when zooming in,
// the swap between the two views, and the reset (Home).

import { retroRatio } from './retro';
import * as THREE from 'three';
import { STRIP_ASPECT, STRIP_ASPECT_LEADER } from '../view/vector/art';
import { DIE_W, TRAY_SCALE, TRAY_Z } from './board';
import { chase, setChase } from './chase';
import { liftView } from './director';
import { drawHud } from './hud';
import { syncOptions } from './menus';
import { P } from './presentation';
import { camBefore } from './replay';
import { saveSettings, settings } from './settings';
import { BOARD_X0, PITCH_W, TILE_H, TILE_W, camera, controls, renderer } from './stage';
import { S } from './state';
import { $, cssPx } from './util';

/** Distance of the framed view: zooming in from it tilts the view toward the horizon. */
export let fitDist = 40;
/**
 * The map's framing: `side` is how far toward the window's sides it reaches (1 = the edge, in NDC),
 * `high` the height of the tallest pieces on the table (world units), kept in the picture too,
 * `gap` the pixels left free under the players' bubbles.
 */
export const FIT = P.mapView.fit;
/**
 * Lays out the screen: the bar and the players at the top, the player's strip at the bottom with
 * nothing around it (no background), the table framed in the free space between them. The strip is
 * as large as the window allows and keeps its size for the whole game.
 */
export function fit(): void {
  const W = innerWidth, H = innerHeight;
  const tall = document.body.classList.contains('tall');
  const aspect = tall ? STRIP_ASPECT_LEADER : STRIP_ASPECT;
  // As wide as the window, as long as it leaves the table more than half of the height.
  const stripW = Math.min(W - 24, H * 0.38 * aspect);
  const stripH = stripW / aspect + 8;
  const root = document.documentElement.style;
  root.setProperty('--stripw', `${Math.round(stripW)}px`);
  root.setProperty('--bottom', `${Math.round(stripH)}px`);
  // The players' bubbles may hang below the top bar: the road starts under the lowest one.
  const bubbles = document.getElementById('players')?.getBoundingClientRect();
  const top = Math.max(cssPx('--top'), bubbles && bubbles.height > 0 ? bubbles.bottom + FIT.gap : 0), h = H;
  // The panel of the damage and the dice lies over the player's strip, off the scene: as large as the strip allows, a little over it at most.
  root.setProperty('--rollk', Math.max(0.55, Math.min(1, (stripH + 80) / 430, (W - 24) / 940)).toFixed(3));
  const botLim = -1 + 2 * (stripH + 6) / h;
  // The player bubbles float over the top of the map: keep the road below them.
  const topLim = 1 - 2 * top / h;
  // A retro style draws few rows of pixels, enlarged with hard edges (retro.ts).
  const rr = retroRatio();
  if (rr) renderer.setPixelRatio(rr);
  renderer.setSize(W, h);
  camera.aspect = W / h;
  camera.updateProjectionMatrix();
  // Frame what is on the table (asked by the user: always centred, as large as it can be): the
  // road, the start area with its cars and parked choppers, the row of dice under the road. Points
  // are taken at the table and at the height of the pieces, so tall things stay in the picture too.
  const x0 = BOARD_X0 - 3.2, x1 = BOARD_X0 + 2 * PITCH_W + TILE_W; // start area: cars and parked choppers
  const zTop = -TILE_H / 2, zBot = TRAY_Z + DIE_W * TRAY_SCALE * 0.9; // the road and the row of dice under it
  const points: THREE.Vector3[] = [];
  for (const x of [x0, x1]) for (const z of [zTop, zBot]) for (const y of [0, FIT.high]) points.push(new THREE.Vector3(x, y, z));
  const dir = new THREE.Vector3(0, Math.sin(viewElev()), Math.cos(viewElev()));
  const target = new THREE.Vector3((x0 + x1) / 2, 0, (zTop + zBot) / 2);
  const side = FIT.side;
  /** The screen box (NDC) of the points with the camera `dist` from the target. */
  const box = (dist: number): THREE.Box2 => {
    camera.position.copy(target).addScaledVector(dir, dist);
    camera.lookAt(target);
    camera.updateMatrixWorld();
    const out = new THREE.Box2();
    for (const c of points) { const q = c.clone().project(camera); out.expandByPoint(new THREE.Vector2(q.x, q.y)); }
    return out;
  };
  /** How far off the middle of the free band the box is (NDC), horizontally and vertically. */
  const off = (bx: THREE.Box2): THREE.Vector2 => new THREE.Vector2((bx.min.x + bx.max.x) / 2, (bx.min.y + bx.max.y) / 2 - (topLim + botLim) / 2);
  let dist = 40;
  for (let pass = 0; pass < 6; pass++) {
    // As close as it can be while it fits the width and the free band's height.
    let lo = 2, hi = 200;
    for (let i = 0; i < 30; i++) {
      const mid = (lo + hi) / 2, bx = box(mid);
      if (bx.max.x - bx.min.x > 2 * side || bx.max.y - bx.min.y > topLim - botLim) lo = mid; else hi = mid;
    }
    dist = hi;
    // Then centred: the target moves on the table by what the box is off (a step measured on the spot).
    const o0 = off(box(dist)), eps = 0.05;
    target.x += eps; const ox = off(box(dist)).x - o0.x; target.x -= eps;
    target.z += eps; const oz = off(box(dist)).y - o0.y; target.z -= eps;
    if (Math.abs(ox) > 1e-6) target.x -= o0.x * eps / ox;
    if (Math.abs(oz) > 1e-6) target.z -= o0.y * eps / oz;
  }
  box(dist);
  controls.target.copy(target);
  fitDist = camera.position.distanceTo(target);
  controls.maxDistance = fitDist * 1.8;
  controls.update();
}

/**
 * Far from the table the angled map view looks down as framed; near the ground it tilts toward the
 * horizon. The zenithal map view (V, asked by the user) looks straight down at any distance (a hair
 * off the vertical, so the screen's top stays down the table as in the angled view).
 */
export const ELEV_FAR = Math.atan2(1, 0.55), ELEV_NEAR = P.mapView.elevNear, ELEV_ZENITH = Math.PI / 2 - 0.002;
/** Seconds the camera takes to move between the angled and the zenithal map view. */
export const VIEW_SWAP = P.mapView.swap;
/** 0 = angled map view, 1 = zenithal; in between while the camera moves from one to the other. */
export let zenithK = settings.zenith ? 1 : 0;
export let viewSwap: { t0: number; from: { target: THREE.Vector3; dist: number; k: number }; to: { target: THREE.Vector3; dist: number } } | null = null;
/** The map view's elevation (radians above the table) as it is framed, for the view in use. */
export function viewElev(): number { return settings.zenith ? ELEV_ZENITH : ELEV_FAR; }
/** The elevation the map camera has at distance `d` from what it looks at. */
export function elevAt(d: number): number {
  const k = THREE.MathUtils.clamp((fitDist - d) / Math.max(1, fitDist - controls.minDistance), 0, 1);
  const e = THREE.MathUtils.lerp(ELEV_FAR, ELEV_NEAR, k * k * (3 - 2 * k));
  return THREE.MathUtils.lerp(e, ELEV_ZENITH, zenithK);
}
/** V in the map: from the angled view to the zenithal one and back, with the camera moving between them. */
export function toggleZenith(): void {
  const from = { target: controls.target.clone(), dist: camera.position.distanceTo(controls.target), k: zenithK };
  settings.zenith = !settings.zenith;
  saveSettings();
  S.focusGoal = null;
  S.focusDist = null;
  fit();
  viewSwap = { t0: performance.now() / 1000, from, to: { target: controls.target.clone(), dist: fitDist } };
  drawHud();
}
export function tiltView(): void {
  if (camBefore) return; // the instant replay frames its own shots
  const t = controls.target;
  let d = camera.position.distanceTo(t);
  if (viewSwap) {
    const x = Math.min(1, (performance.now() / 1000 - viewSwap.t0) / VIEW_SWAP), u = x * x * (3 - 2 * x);
    t.lerpVectors(viewSwap.from.target, viewSwap.to.target, u);
    d = THREE.MathUtils.lerp(viewSwap.from.dist, viewSwap.to.dist, u);
    zenithK = THREE.MathUtils.lerp(viewSwap.from.k, settings.zenith ? 1 : 0, u);
    if (x >= 1) viewSwap = null;
  } else zenithK = settings.zenith ? 1 : 0;
  const e = elevAt(d);
  camera.position.set(t.x, t.y + d * Math.sin(e), t.z + d * Math.cos(e));
  camera.lookAt(t);
}
addEventListener('resize', fit);
fit();
// The bubbles change height when a game starts or ends: frame the map again for the new free band.
{
  let lastBottom = -1;
  const players = document.getElementById('players');
  if (players) new ResizeObserver(() => {
    const b = Math.round(players.getBoundingClientRect().bottom);
    if (b === lastBottom) return;
    lastBottom = b;
    if (!chase && !S.shot && !S.shotBack) fit();
  }).observe(players);
}

/** Back to the view of the whole map, as at the start. */
export function homeView(): void { viewSwap = null; S.shot = null; S.shotBack = null; S.camHome = null; controls.enabled = !chase; liftView(false); if (chase) { setChase(null); return; } S.focusGoal = null; S.focusDist = null; fit(); }
$('home').addEventListener('click', homeView);

/** The lines of the spaces over the terrain, on or off (button and key G). */
export function toggleGrid(): void {
  settings.grid = !settings.grid;
  saveSettings();
  syncOptions();
}
