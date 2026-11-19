// Waypoint movement (asked by the user, 2026-11-19; mock-up in design/ux/movimento-waypoint/): in
// "Percorso" mode the player taps the spaces the car will go through, one after the other, and the
// car runs the whole path with Vai! in one fluid move. Points can be taken back or the path cut
// before that. A point where the movement stops (a car, a face-down hazard, a ramp, anything that
// turns up something not known in advance) ends the path with a warning: the player may run it,
// and plans the rest from there if the car can still move. "Un passo alla volta" stays the default.

import * as THREE from 'three';
import { type Decision } from '../game/trv/engine';
import { carObjs } from './board';
import { choosePath, decision, g } from './game';
import { movesLeft, simulatePath, type SimStep } from './pathsim';
import { render } from './pieces';
import { saveSettings, settings, type MoveMode } from './settings';
import { camera, world } from './stage';
import { S } from './state';
import { $, esc } from './util';

/** The path being planned: for which decision (`key`) and the steps simulated. */
let plan: { key: string; steps: SimStep[] } = { key: '', steps: [] };
/** A path sent to the host (online guest): no planning until the host has played it. */
let sentUntil = -1;

const keyNow = (): string => (decision && S.saved ? `${S.saved.choices.length}:${decision.prompt}` : '');

/** Switches between one step per click and the waypoint path, from the Options, the pill or P. */
export function setMoveMode(m: MoveMode): void {
  settings.move = m;
  saveSettings();
  plan = { key: '', steps: [] };
  render();
}

/** True while this screen's player plans a car's path (Percorso mode, a step decision of theirs). */
export function planning(): boolean {
  if (settings.move !== 'path' || !decision || decision.kind !== 'step' || S.playing || !S.saved || !g) return false;
  if (S.saved.choices.length < sentUntil) return false;
  const k = keyNow();
  if (plan.key !== k) plan = { key: k, steps: [] };
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
  render();
}
/** Takes every point back. */
export function restart(): void { cutAt(0); }

/** Runs the path planned: every point is chosen in turn (online, a guest sends the whole path to the host). */
export function go(extra: number[] = []): void {
  if (!planning() || !S.saved) return;
  const path = [...plan.steps.map(s => s.choice), ...extra];
  if (!path.length) return;
  if (S.net && !S.net.host) sentUntil = S.saved.choices.length + path.length;
  plan = { key: '', steps: [] };
  choosePath(path);
}

/**
 * The pill's question and buttons while planning (hud.ts puts them in #actions): the count, the
 * road die when the moves are over, the way to take points back, Vai! and the switch to single steps.
 */
export function pathPill(actions: HTMLElement): void {
  const l = last(), cur = current();
  const q = !l ? `${total()} movimenti` : cur?.kind === 'roadDie' ? `${used()} di ${total()} · dado strada?` : l.kind === 'stop' ? `${used()} di ${total()} · fermata` : `${used()} di ${total()}`;
  actions.insertAdjacentHTML('beforeend', `<span class="q">Percorso <em>${esc(q)}</em></span>`);
  const btn = (label: string, cls: string, on: () => void, key?: string, title?: string): void => {
    const b = document.createElement('button');
    b.innerHTML = esc(label) + (key ? `<kbd>${key === 'Enter' ? '↵' : key === 'Backspace' ? '⌫' : esc(key)}</kbd>` : '');
    b.className = cls;
    if (key) b.dataset.key = key;
    if (title) b.title = title;
    b.onclick = on;
    actions.appendChild(b);
  };
  // Skull Shift Knob's "Fermati qui", and any other step choice that is not a space.
  if (cur?.kind === 'step') cur.options.forEach((o, i) => { if (!o.pos) btn(o.label, 'quiet', () => addPoint(i)); });
  if (l) btn('↶ Togli l’ultimo', 'quiet', dropLast, 'Backspace');
  if (plan.steps.length > 1 && cur?.kind === 'step') btn('Ricomincia', 'quiet', restart);
  if (cur?.kind === 'roadDie') {
    btn(`+${cur.options[1].dieValue ?? g?.roadDie ?? 0} movimenti`, 'road', () => addPoint(1), undefined, 'Usa il dado strada: altri punti da piazzare, e vanno usati tutti');
    btn('VAI!', 'go', () => go([0]), 'Enter', 'Senza dado strada');
  } else if (l) btn(l.kind === 'stop' ? 'VAI FIN QUI' : 'VAI!', 'go', () => go(), 'Enter', cur ? 'I movimenti non usati vanno persi' : undefined);
  actions.insertAdjacentHTML('beforeend', '<span class="sep"></span>');
  btn('⇥', 'quiet mode', () => setMoveMode('step'), undefined, 'Passa ai passi singoli (P)');
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

/** The overlay: the line, the numbered points, the tag over the last one, the stop warning. */
let layer: { el: HTMLElement; svg: SVGSVGElement; dots: { b: HTMLElement; i: number }[]; tag: HTMLElement | null; warn: HTMLElement | null;
  at: THREE.Vector3[]; road: boolean[]; stop: boolean } | null = null;

/** Builds the overlay of the path planned (or takes it away when there is none). Called by drawHud. */
export function drawPath(): void {
  layer?.el.remove();
  layer = null;
  if (!planning() || !g) return;
  const car = g.activeCar ? carObjs.get(g.activeCar) : undefined;
  const el = document.createElement('div');
  el.id = 'wppath';
  el.style.setProperty('--c', g.players[decision!.player]?.color ?? '#f6c46a');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  el.append(svg);
  // From the car, through each space entered; the spaces after the road die is taken in its blue.
  const at: THREE.Vector3[] = [], road: boolean[] = [], dots: { b: HTMLElement; i: number }[] = [];
  if (car) { at.push(car.position.clone()); road.push(false); }
  let afterRoad = false, n = 0;
  plan.steps.forEach((s, k) => {
    if (askedAt(k)?.kind === 'roadDie') { afterRoad = s.choice === 1; return; }
    if (!s.at) return;
    at.push(world(s.at));
    road.push(afterRoad);
    const b = document.createElement('button');
    b.className = `wpdot${afterRoad ? ' road' : ''}${s.kind === 'stop' ? ' stop' : ''}`;
    b.textContent = s.kind === 'stop' ? '!' : String(++n);
    b.title = k === plan.steps.length - 1 ? 'Togli questo punto' : 'Taglia il percorso da qui';
    b.onclick = () => cutAt(k);
    el.append(b);
    dots.push({ b, i: at.length - 1 });
  });
  const l = last(), cur = current();
  let tag: HTMLElement | null = null, warn: HTMLElement | null = null;
  if (l && l.kind !== 'stop') { // a stop has its warning instead
    tag = document.createElement('div');
    tag.className = 'wptag';
    if (cur?.kind === 'step') tag.innerHTML = `restano ${total() - used()} <small>di ${total()}</small>`;
    else { tag.classList.add('go'); tag.innerHTML = 'Vai! <small>Invio</small>'; }
    el.append(tag);
  }
  if (l?.kind === 'stop') {
    warn = document.createElement('div');
    warn.className = 'wpwarn';
    const what = l.label.replace(/^[^:]+: /, '');
    warn.innerHTML = /eliminata/.test(what)
      ? `<p>L’auto viene eliminata</p><small>${esc(what.charAt(0).toUpperCase() + what.slice(1))}.</small>`
      : `<p>L’auto si ferma qui</p><small>${esc(what.charAt(0).toUpperCase() + what.slice(1))}: quel che succede da qui non si può prevedere. Se l’auto potrà ancora muovere, il percorso riparte da qui.</small>`;
    el.append(warn);
  }
  $('fx').append(el);
  layer = { el, svg, dots, tag, warn, at, road, stop: l?.kind === 'stop' };
  placePath();
}

/** Where a point of the table is on the screen (null behind the camera). */
function onScreen(v: THREE.Vector3): { x: number; y: number } | null {
  const p = v.clone().project(camera);
  return p.z < 1 ? { x: (p.x + 1) / 2 * innerWidth, y: (1 - p.y) / 2 * innerHeight } : null;
}

/** Keeps the overlay on the spaces as the view moves (every frame, from loop.ts). */
export function placePath(): void {
  if (!layer) return;
  const pts = layer.at.map(onScreen);
  // The line: the player's colour, the road die's points dashed blue, the last leg red when it stops.
  const legs: string[] = [];
  for (let k = 1; k < pts.length; k++) {
    const a = pts[k - 1], b = pts[k];
    if (!a || !b) continue;
    const cls = layer.stop && k === pts.length - 1 ? 'red' : layer.road[k] ? 'blue' : 'own';
    const d = `M${a.x.toFixed(1)} ${a.y.toFixed(1)}L${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
    legs.push(`<path d="${d}" class="under"/><path d="${d}" class="${cls}"/>`);
  }
  layer.svg.innerHTML = legs.join('');
  for (const { b, i } of layer.dots) {
    const p = pts[i];
    b.style.display = p ? '' : 'none';
    if (p) { b.style.left = `${p.x.toFixed(1)}px`; b.style.top = `${p.y.toFixed(1)}px`; }
  }
  const end = pts[pts.length - 1];
  for (const [e, dy] of [[layer.tag, 0], [layer.warn, 30]] as [HTMLElement | null, number][]) {
    if (!e) continue;
    e.style.display = end ? '' : 'none';
    if (end) { e.style.left = `${end.x.toFixed(1)}px`; e.style.top = `${(end.y + dy).toFixed(1)}px`; }
  }
}
