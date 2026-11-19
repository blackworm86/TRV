// Waypoint movement (asked by the user, 2026-11-19; mock-up in design/ux/movimento-waypoint/): in
// "Percorso" mode the player taps the spaces the car will go through, one after the other, and the
// car runs the whole path with Vai! in one fluid move. Points can be taken back or the path cut
// before that. A point where the movement stops (a car, a face-down hazard, a ramp, anything that
// turns up something not known in advance) asks for confirmation and ends the path there: the player
// may run it, and plans the rest from there if the car can still move. "Un passo alla volta" stays the default.

import * as THREE from 'three';
import { type Decision } from '../game/trv/engine';
import { HAZ_SIZE, carObjs } from './board';
import { choosePath, decision, g } from './game';
import { movesLeft, simulatePath, type SimStep } from './pathsim';
import { render } from './pieces';
import { saveSettings, settings, type MoveMode } from './settings';
import { TILE_W, camera, scene, world } from './stage';
import { S } from './state';
import { typing } from './keys';
import { $, esc, menuOpen } from './util';

/** The path being planned: for which decision (`key`), the steps simulated, and the stop the player confirmed (`ok`, a step index). */
let plan: { key: string; steps: SimStep[]; ok: number } = { key: '', steps: [], ok: -1 };
/**
 * A path sent to the host (online guest): no planning until the host has played it, up to choice
 * `until` of the game with seed `seed`. Another game is not held back by it (bug of 2026-11-19: the
 * mark outlived its game, and Percorso stayed off in the next one until the page was loaded again).
 */
let sent = { seed: '', until: -1 };

/** The decision being planned: the game (its seed), how many choices made, and what is asked. */
const keyNow = (): string => (decision && S.saved ? `${S.saved.setup.seed}:${S.saved.choices.length}:${decision.prompt}` : '');

/** Switches between one step per click and the waypoint path, from the Options, the pill or P. */
export function setMoveMode(m: MoveMode): void {
  settings.move = m;
  saveSettings();
  plan = { key: '', steps: [], ok: -1 };
  // While beats play the table stays as they show it (beats.ts playBeats); it is drawn when they end.
  if (!S.playing) render();
}

/** True while this screen's player plans a car's path (Percorso mode, a step decision of theirs). */
export function planning(): boolean {
  if (settings.move !== 'path' || !decision || decision.kind !== 'step' || S.playing || !S.saved || !g) return false;
  if (sent.seed === S.saved.setup.seed && S.saved.choices.length < sent.until) return false;
  const k = keyNow();
  if (plan.key !== k) plan = { key: k, steps: [], ok: -1 };
  return true;
}

const last = (): SimStep | undefined => plan.steps[plan.steps.length - 1];
/** The decision point `k` answered (the one asked for the first, the one the path reached for the others). */
const askedAt = (k: number): Decision | null => (k === 0 ? decision : plan.steps[k - 1].next);
/** The decision the next point answers; null when the path is over. */
function current(): Decision | null {
  const l = last();
  if (!l) return decision;
  return l.kind === 'go' || l.kind === 'road' ? l.next : null;
}
/** While planning, the step decision whose spaces are lit on the table (null: none, the path is complete). */
export function planDecision(): Decision | null {
  const d = planning() ? current() : null;
  return d?.kind === 'step' ? d : null;
}

/** All the moves of the path: the die's, and the road die's when it is taken. */
function total(): number {
  let t = movesLeft(decision) ?? 0;
  plan.steps.forEach((s, k) => { if (askedAt(k)?.kind === 'roadDie' && s.choice === 1) t += askedAt(k)!.options[1].dieValue ?? 0; });
  return t;
}
/** Moves the points use (a mud space costs two, as its option says). */
function used(): number {
  let n = 0;
  plan.steps.forEach((s, k) => { if (askedAt(k)?.kind === 'step' && s.at) n += /costa 2/.test(s.label) ? 2 : 1; });
  return Math.min(n, total());
}

/** Adds the point answering option `c` of the decision the path has reached. */
export function addPoint(c: number): void {
  if (!planning() || !S.saved) return;
  const path = [...plan.steps.map(s => s.choice), c];
  const { steps } = simulatePath(S.saved.setup, S.saved.choices, path);
  if (steps.length !== path.length) return;
  plan.steps = steps;
  render();
}
/** Takes the last point back (with the road die answer before it, if any). */
export function dropLast(): void {
  let k = plan.steps.length - 1;
  if (k > 0 && askedAt(k)?.kind === 'step' && askedAt(k - 1)?.kind === 'roadDie') k--;
  cutAt(k);
}
/** Cuts the path before point `k` (0-based): the points from it on are taken back. */
export function cutAt(k: number): void {
  if (!planning() || k < 0) return;
  plan.steps.splice(k);
  if (plan.ok >= k) plan.ok = -1;
  render();
}
/** Takes every point back. */
export function restart(): void { cutAt(0); }

/** Runs the path planned: every point is chosen in turn (online, a guest sends the whole path to the host). */
export function go(extra: number[] = []): void {
  if (!planning() || !S.saved || asking()) return;
  const path = [...plan.steps.map(s => s.choice), ...extra];
  if (!path.length) return;
  if (S.net && !S.net.host) sent = { seed: S.saved.setup.seed, until: S.saved.choices.length + path.length };
  plan = { key: '', steps: [], ok: -1 };
  choosePath(path);
}

/** The last point is on a space where the car stops or is eliminated, and the player has not said Entra yet. */
function asking(): boolean {
  const l = last();
  return !!l && l.kind === 'stop' && plan.ok !== plan.steps.length - 1;
}
/** Entra: the player confirms the space the last point asks about. */
export function confirmStop(): void {
  if (!planning() || !asking()) return;
  plan.ok = plan.steps.length - 1;
  render();
}

/** The pill under the table while planning (hud.ts puts it in #actions): the count and the switch to single steps. */
export function pathPill(actions: HTMLElement): void {
  const q = last() ? `${used()} di ${total()}` : `${total()} movimenti`;
  actions.insertAdjacentHTML('beforeend', `<span class="q">Percorso <em>${esc(q)}</em></span><span class="sep"></span>`);
  const b = document.createElement('button');
  b.className = 'quiet mode';
  b.textContent = '⇥';
  b.title = 'Passa ai passi singoli (P)';
  b.onclick = () => setMoveMode('step');
  actions.appendChild(b);
}

/** In single steps, the round button at the end of the pill that switches to the path. */
export function pathToggle(actions: HTMLElement): void {
  actions.insertAdjacentHTML('beforeend', '<span class="sep"></span>');
  const b = document.createElement('button');
  b.className = 'quiet mode';
  b.textContent = '⤳';
  b.title = 'Traccia un percorso a waypoint (P)';
  b.onclick = () => setMoveMode('path');
  actions.appendChild(b);
}

// ---------------------------------------------------------------- on the table
// The path is one 3D arrow in the player's colour, lying on the table along the curve the car will
// drive (route.ts makes the same one), with a raised dark edge, small studs where it goes through a
// space (a tap cuts the path there) and a wedge head on the last space; the road die's stretch has a
// light blue stripe on its back. The commands are in a small window at the head (mock-up v2).

/** Sizes of the arrow, in road spaces: width, thickness, head width and length, stud radius. */
const ARROW = { width: 0.26, thick: 0.05, headW: 0.6, headL: 0.45, stud: 0.1 };
const STOP_RED = new THREE.Color(0xff3b30), ROAD_BLUE = new THREE.Color(0x9fd3ff), EDGE = new THREE.Color(0x16100b);
/** Samples of the curve per space. */
const PER_SPACE = 16;

const arrowGroup = new THREE.Group();
let arrowOnStage = false;
/** The window and the studs' hit areas on screen, with the points they stand on. */
let layer: { win: HTMLElement | null; tip: THREE.Vector3; studs: { b: HTMLElement; at: THREE.Vector3 }[] } | null = null;

/** Triangles with one colour each, as a geometry with vertex colours. */
class Mesher {
  pos: number[] = [];
  col: number[] = [];
  tri(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, k: THREE.Color): void {
    for (const v of [a, b, c]) { this.pos.push(v.x, v.y, v.z); this.col.push(k.r, k.g, k.b); }
  }
  quad(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, k: THREE.Color): void { this.tri(a, b, c, k); this.tri(b, d, c, k); }
  geometry(): THREE.BufferGeometry {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    geo.computeVertexNormals();
    return geo;
  }
}

/** A flat band along `pts` (top and both sides), its top in `top`, its sides in `side`. */
function band(pts: THREE.Vector3[], width: number, h: number, top: THREE.Color, side: THREE.Color): THREE.BufferGeometry {
  const m = new Mesher(), L: THREE.Vector3[] = [], R: THREE.Vector3[] = [], up = new THREE.Vector3(0, h, 0);
  pts.forEach((p, i) => {
    const t = pts[Math.min(pts.length - 1, i + 1)].clone().sub(pts[Math.max(0, i - 1)]).setY(0).normalize();
    const n = new THREE.Vector3(-t.z, 0, t.x).multiplyScalar(width / 2);
    L.push(p.clone().add(n)); R.push(p.clone().sub(n));
  });
  for (let i = 0; i < pts.length - 1; i++) {
    m.quad(L[i].clone().add(up), R[i].clone().add(up), L[i + 1].clone().add(up), R[i + 1].clone().add(up), top);
    m.quad(L[i], L[i].clone().add(up), L[i + 1], L[i + 1].clone().add(up), side);
    m.quad(R[i].clone().add(up), R[i], R[i + 1].clone().add(up), R[i + 1], side);
  }
  return m.geometry();
}

/** The arrow's wedge head: from `base`, pointing along `dir`. */
function head(base: THREE.Vector3, dir: THREE.Vector3, w: number, len: number, h: number, top: THREE.Color, side: THREE.Color): THREE.BufferGeometry {
  const d = dir.clone().setY(0).normalize(), n = new THREE.Vector3(-d.z, 0, d.x).multiplyScalar(w / 2);
  const tip = base.clone().addScaledVector(d, len), l = base.clone().add(n), r = base.clone().sub(n);
  const up = new THREE.Vector3(0, h, 0), m = new Mesher();
  m.tri(l.clone().add(up), r.clone().add(up), tip.clone().add(up), top);
  for (const [a, b] of [[l, tip], [tip, r], [r, l]] as [THREE.Vector3, THREE.Vector3][]) m.quad(a, a.clone().add(up), b, b.clone().add(up), side);
  return m.geometry();
}

/** Empties the arrow and its window. */
function clearArrow(): void {
  for (const o of [...arrowGroup.children]) {
    arrowGroup.remove(o);
    const mesh = o as THREE.Mesh;
    mesh.geometry?.dispose();
    (mesh.material as THREE.Material | undefined)?.dispose();
  }
  layer?.win?.remove();
  for (const s of layer?.studs ?? []) s.b.remove();
  layer = null;
}

/** A button of the window. */
function winButton(row: HTMLElement, label: string, cls: string, on: () => void, key?: string, title?: string): void {
  const b = document.createElement('button');
  b.innerHTML = esc(label) + (key ? `<kbd>${key === 'Enter' ? '↵' : key === 'Backspace' ? '⌫' : 'Esc'}</kbd>` : '');
  b.className = cls;
  if (key) b.dataset.key = key;
  if (title) b.title = title;
  b.onclick = on;
  row.append(b);
}

/** The window at the arrow's head: what the path has come to and what can be done there. */
function buildWindow(color: string): HTMLElement {
  const l = last()!, cur = current();
  const win = document.createElement('div');
  win.id = 'wpwin';
  win.style.setProperty('--c', color);
  const title = (big: string, small: string): void => { win.insertAdjacentHTML('beforeend', `<h4>${esc(big)}<small>${small}</small></h4>`); };
  const row = (): HTMLElement => { const r = document.createElement('div'); r.className = 'row'; win.append(r); return r; };
  const what = l.label.replace(/^[^:]+: /, '');
  const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
  if (asking()) {
    win.classList.add('danger');
    const r = (): HTMLElement => row();
    if (/eliminata/.test(what)) {
      title(cap(what.replace(/\s*\(eliminata\)/, '')), 'l’auto viene eliminata');
      const x = r();
      winButton(x, 'Annulla', 'quiet', dropLast, 'Escape');
      winButton(x, 'Elimina e vai', 'bad', () => { plan.ok = plan.steps.length - 1; go(); });
    } else {
      title(cap(what), /pericolo coperto/.test(what) ? 'entrando si gira: l’auto si ferma qui<br>e la mossa non si potrà annullare' : 'l’auto si ferma qui');
      const x = r();
      winButton(x, 'Annulla', 'quiet', dropLast, 'Escape');
      winButton(x, 'Entra', 'bad', confirmStop, 'Enter');
    }
    return win;
  }
  if (cur?.kind === 'roadDie') {
    title('Tutto su strada!', 'usi il dado strada?');
    winButton(row(), `+${cur.options[1].dieValue ?? g?.roadDie ?? 0} dado strada`, 'road', () => addPoint(1), undefined, 'Altri spazi da tracciare, e vanno usati tutti');
    const x = row();
    winButton(x, '↶ Togli', 'quiet', dropLast, 'Backspace');
    winButton(x, 'VAI!', 'go', () => go([0]), 'Enter', 'Senza dado strada');
    return win;
  }
  if (l.kind === 'stop') title('Si ferma qui', `${used()} di ${total()} movimenti`);
  else if (cur?.kind === 'step') title(`restano ${total() - used()}`, `di ${total()} movimenti`);
  else title('Pronto', `${used()} di ${total()} movimenti`);
  // Skull Shift Knob's "Fermati qui", and any other step choice that is not a space.
  if (cur?.kind === 'step') cur.options.forEach((o, i) => { if (!o.pos) winButton(row(), o.label, 'quiet', () => addPoint(i)); });
  const x = row();
  winButton(x, '↶ Togli', 'quiet', dropLast, 'Backspace');
  winButton(x, l.kind === 'stop' ? 'VAI FIN QUI' : 'VAI!', 'go', () => go(), 'Enter', cur ? 'I movimenti non usati vanno persi' : undefined);
  return win;
}

/** Builds the arrow of the path planned and its window (or takes them away). Called by drawHud. */
export function drawPath(): void {
  clearArrow();
  if (!planning() || !g || !last()) return;
  if (!arrowOnStage) { scene.add(arrowGroup); arrowOnStage = true; }
  const car = g.activeCar ? carObjs.get(g.activeCar) : undefined;
  if (!car) return;
  const space = TILE_W / 8, lift = HAZ_SIZE.thickness + 0.03;
  // From the car through each space entered; where the road die's stretch begins.
  const pts: THREE.Vector3[] = [car.position.clone()];
  const studAt: { k: number; at: THREE.Vector3 }[] = [];
  let roadFrom = -1, afterRoad = false;
  plan.steps.forEach((s, k) => {
    if (askedAt(k)?.kind === 'roadDie') { afterRoad = s.choice === 1; return; }
    if (!s.at) return;
    if (afterRoad && roadFrom < 0) roadFrom = pts.length - 1;
    const p = world(s.at);
    p.y += lift;
    pts.push(p);
    studAt.push({ k, at: p });
  });
  if (pts.length < 2) return;
  pts[0].y = pts[1].y;
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const n = (pts.length - 1) * PER_SPACE;
  const samples = Array.from({ length: n + 1 }, (_, i) => curve.getPoint(i / n));
  const cum = [0];
  for (let i = 1; i < samples.length; i++) cum.push(cum[i - 1] + samples[i].distanceTo(samples[i - 1]));
  // The band stops where the head begins, so the head's tip lies a little past the last space's centre.
  const headL = ARROW.headL * space, endAt = cum[cum.length - 1] - headL * 0.6;
  let cut = samples.length - 1;
  while (cut > 1 && cum[cut] > endAt) cut--;
  const color = new THREE.Color(g.players[decision!.player]?.color ?? '#f6c46a');
  const mat = (): THREE.MeshStandardMaterial => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.05, side: THREE.DoubleSide });
  const body = new THREE.Mesh(band(samples.slice(0, cut + 1), ARROW.width * space, ARROW.thick * space, color, color.clone().lerp(EDGE, 0.7)), mat());
  const tipColor = last()!.kind === 'stop' ? STOP_RED : color;
  const dir = samples[samples.length - 1].clone().sub(samples[cut]);
  const tip = new THREE.Mesh(head(samples[cut], dir, ARROW.headW * space, headL, ARROW.thick * space * 1.2, tipColor, tipColor.clone().lerp(EDGE, 0.7)), mat());
  body.castShadow = tip.castShadow = true;
  arrowGroup.add(body, tip);
  // The road die's stretch: a light blue stripe on the arrow's back.
  if (roadFrom >= 0) {
    const stripe = samples.slice(Math.min(cut, roadFrom * PER_SPACE), cut + 1).map(p => p.clone().setY(p.y + ARROW.thick * space + 0.002));
    if (stripe.length > 1) arrowGroup.add(new THREE.Mesh(band(stripe, ARROW.width * space * 0.38, 0.001, ROAD_BLUE, ROAD_BLUE), new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })));
  }
  // Studs where the arrow goes through a space (not the last one): a tap cuts the path there.
  const studs: { b: HTMLElement; at: THREE.Vector3 }[] = [];
  for (const { k, at } of studAt.slice(0, -1)) {
    const r = ARROW.stud * space, h = ARROW.thick * space;
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h * 1.6, 20), new THREE.MeshStandardMaterial({ color: EDGE, roughness: 0.6 }));
    disc.position.copy(at).setY(at.y + h * 0.8);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(r * 0.85, r * 0.18, 8, 24), new THREE.MeshStandardMaterial({ color, roughness: 0.4 }));
    rim.rotation.x = Math.PI / 2;
    rim.position.copy(at).setY(at.y + h * 1.65);
    arrowGroup.add(disc, rim);
    const b = document.createElement('button');
    b.className = 'wpstud';
    b.title = 'Taglia il percorso da qui';
    b.onclick = () => cutAt(k + 1);
    $('fx').append(b);
    studs.push({ b, at: at.clone().setY(at.y + h) });
  }
  const win = buildWindow(`#${color.getHexString()}`);
  $('fx').append(win);
  const end = samples[samples.length - 1];
  layer = { win, tip: end.clone().setY(end.y + 0.15), studs };
  placePath();
}

/** Where a point of the table is on the screen (null behind the camera). */
function onScreen(v: THREE.Vector3): { x: number; y: number } | null {
  const p = v.clone().project(camera);
  return p.z < 1 ? { x: (p.x + 1) / 2 * innerWidth, y: (1 - p.y) / 2 * innerHeight } : null;
}

/** Keeps the window at the arrow's head and the studs' hit areas on their studs as the view moves (every frame). */
export function placePath(): void {
  if (!layer) return;
  for (const { b, at } of layer.studs) {
    const p = onScreen(at);
    b.style.display = p ? '' : 'none';
    if (p) { b.style.left = `${p.x.toFixed(1)}px`; b.style.top = `${p.y.toFixed(1)}px`; }
  }
  const w = layer.win, p = onScreen(layer.tip);
  if (!w) return;
  w.style.display = p ? '' : 'none';
  if (!p) return;
  // Near the top of the view the window opens under the head, its pointer upward.
  w.classList.toggle('below', p.y - w.offsetHeight - 30 < 70);
  w.style.left = `${p.x.toFixed(1)}px`;
  w.style.top = `${p.y.toFixed(1)}px`;
}

// The window's keys: Enter for its main button, Esc to take back a space asked about, Backspace the last point.
addEventListener('keydown', e => {
  if (!layer?.win || S.playing || menuOpen() || typing(e) || e.ctrlKey || e.metaKey || e.altKey) return;
  const b = layer.win.querySelector<HTMLButtonElement>(`button[data-key="${e.key}"]`);
  if (b) { e.preventDefault(); e.stopImmediatePropagation(); b.click(); }
});
