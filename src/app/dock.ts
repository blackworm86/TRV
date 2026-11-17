// The command dock (the question and its buttons) and the action buttons by the dice.

import * as THREE from 'three';
import { commandName, type Decision, type Player } from '../game/trv/engine';
import { dieSvg } from '../view/vector/art';
import { DRAWER } from '../view/vector/boards';
import { skipBeats } from './beats';
import { carObjs } from './board';
import { choose, decision, dieUsable, g } from './game';
import { camera, renderer } from './stage';
import { S } from './state';
import { fxDiceRect, tableDiceRect } from './tableDice';
import { previewSpots } from './markers';
import { $, cssPx, menuOpen } from './util';

/**
 * Keeps the floating choices where the player is looking (`data-anchor`): under the car they are
 * about (above it only when there is no room below), on the command board for "no command",
 * otherwise just above the bar. Never under the strip, never off the screen.
 */
/**
 * The command board's tab: the command and token choices (asked by the user to sit on the board,
 * not float over the table) and Undo. Shown in hot seat always (for Undo), online only to ask.
 */
/**
 * Whether skipping the command now loses a die for good (rulebook p8, p11): the command is once per
 * round and never on a coasting turn, so once every operable car has its move die, a die still unused
 * can no longer go anywhere. Example: three operable cars, the third die placed, one die left.
 */
export function commandLastChance(d: Decision): boolean {
  const p = g!.players[d.player];
  const fresh = g!.vehicles.filter(v => v.owner === p.id && v.status === 'ok' && !v.placed.some(x => !x.coast)).length;
  return !p.commandUsed && fresh === 0 && p.used.some(u => !u);
}
/** The command drawer is asking "are you sure?" before skipping the command. */
export let skipConfirm = false;

/** The arguments of the last drawDock, to draw it again when the drawer is opened or closed by hand. */
let last: [Decision | null, boolean, Player | undefined] = [null, false, undefined];
$('cmdhandle').addEventListener('click', () => {
  S.drawerPin = { d: decision, open: !$('cmddock').classList.contains('ask') };
  drawDock(...last);
});

/**
 * The drawer behind the command board (the owner's strip drawing, 2026-11-17): the player's dice in
 * 3D, to drag onto a board or a car, and the command questions. It comes out when there are dice to
 * play or a command to choose; its handle opens or closes it by hand until the next decision.
 */
export function drawDock(d: Decision | null, mine: boolean, me?: Player): void {
  last = [d, mine, me];
  const dock = $('cmddock'), q = $('cmdq'), row = $('cmdbtns');
  // The player's dice: the SVG keeps the place and takes the drag, the HUD layer draws the 3D die (hudDice.ts).
  $('cmddice').innerHTML = me ? me.dice.map((v, i) => {
    const used = !!me.used[i], can = mine && !used && dieUsable(i), sel = S.selDie === i && !used;
    const die = dieSvg({ kind: 'movement', value: v, color: me.color, forward: 'right' }, `class="${used ? 'used' : ''} ${sel ? 'sel' : ''}" data-die3d="movement|${v}|${me.color}"`);
    return `<span class="mydie${used ? ' used' : ''}${can ? ' can' : ''}${sel ? ' sel' : ''}" data-mydie="${i}">${die}</span>`;
  }).join('') : '';
  row.innerHTML = '';
  q.textContent = '';
  const asking = !!d && mine && (d.kind === 'command' || d.kind === 'token');
  if (asking) {
    const add = (i: number, label: string, cls = ''): void => {
      const b = document.createElement('button');
      b.textContent = label;
      b.title = d!.options[i].label;
      if (cls) b.className = cls;
      b.onclick = () => choose(i);
      row.append(b);
    };
    if (d!.kind === 'command' && skipConfirm) {
      q.textContent = 'Sei sicuro? Perderai il dado inutilizzato';
      add(0, 'Sì, nessun comando', 'danger');
      const back = document.createElement('button');
      back.textContent = 'Annulla';
      back.className = 'quiet';
      back.onclick = () => { skipConfirm = false; drawDock(d, mine); };
      row.append(back);
    } else if (d!.kind === 'command') {
      q.textContent = 'Metti un dado su un comando';
      if (commandLastChance(d!)) {
        const b = document.createElement('button');
        b.textContent = 'Nessun comando';
        b.className = 'quiet';
        b.onclick = () => { skipConfirm = true; drawDock(d, mine); };
        row.append(b);
      } else add(0, 'Nessun comando', 'quiet');
    } else {
      const p = g!.players[d!.player];
      q.textContent = `Segnalino comando? (${p.tokens} ${p.tokens === 1 ? 'rimasto' : 'rimasti'})`;
      d!.options.slice(1).forEach((o, i) => add(i + 1, `★ ${commandName(o.command!)}`));
      add(0, 'Nessun segnalino', 'quiet');
    }
  }
  if (!asking) skipConfirm = false;
  // Open for a command to choose or dice to play; a hand on the handle wins until the next decision.
  const live = !!me && mine && me.dice.some((_, i) => !me.used[i] && dieUsable(i));
  if (S.drawerPin && S.drawerPin.d !== d) S.drawerPin = null;
  dock.classList.toggle('ask', S.drawerPin ? S.drawerPin.open : asking || live);
  ($('undo2') as HTMLElement).style.display = S.net ? 'none' : '';
  $('cmdwrap').classList.toggle('on', !!g && !menuOpen());
}
/** How far the drawer reaches behind the command board's top edge (hidden by the board), in px. */
export const DOCK_TUCK = 22;
/**
 * Keeps the drawer on the command board: as wide as the board's top edge (between its two upper
 * corner slots) and coming out of that edge: the crew leader's name plate, or the top of the base board.
 */
export function placeDock(): void {
  const wrap = $('cmdwrap'), dock = $('cmddock');
  if (!wrap.classList.contains('on')) return;
  const slots = [...document.querySelectorAll<SVGElement>('#strip [data-drop^="cmd:"]')].map(el => el.getBoundingClientRect()).filter(r => r.width);
  const svg = $('strip').querySelector('svg, .loose')?.getBoundingClientRect();
  if (!slots.length || !svg) return;
  const top = Math.min(...slots.map(r => r.top));
  const upper = slots.filter(r => r.top < top + 30); // the two corner slots at the top (and the quarters next to them)
  const left = Math.min(...upper.map(r => r.left + r.width / 2)), right = Math.max(...upper.map(r => r.left + r.width / 2));
  const root = $('strip').querySelector<SVGSVGElement>('svg[data-strip="2"]');
  if (root) {
    // The owner's strip drawing: the drawer as drawn, behind the board's top edge.
    const vb = root.viewBox.baseVal, u = svg.width / vb.width;
    const edge = svg.top + (DRAWER.edge - vb.y) * u;
    const width = `${Math.round(DRAWER.w * u)}px`;
    if (dock.style.width !== width) dock.style.width = width;
    dock.style.setProperty('--u', u.toFixed(4));
    wrap.style.left = `${svg.left + (DRAWER.mid - vb.x) * u}px`;
    wrap.style.bottom = `${innerHeight - edge - DOCK_TUCK}px`;
    wrap.dataset.edge = String(edge); // the 3D dice show only above it (hudDice.ts)
    return;
  }
  const edge = document.body.classList.contains('tall') ? svg.top + 4 : top - 4; // base board: its top edge runs just above the corner slots
  const width = `${Math.round(right - left)}px`;
  if (dock.style.width !== width) dock.style.width = width;
  wrap.style.left = `${(left + right) / 2}px`;
  wrap.style.bottom = `${innerHeight - edge - DOCK_TUCK}px`;
  delete wrap.dataset.edge;
}

export function placeActions(): void {
  const el = $('actions');
  if (!el.childElementCount) { el.style.display = 'none'; return; }
  el.style.display = 'flex';
  const rect = renderer.domElement.getBoundingClientRect();
  const floor = $('strip').getBoundingClientRect().top - 8; // nothing floats lower than this over the table
  const w = el.offsetWidth, h = el.offsetHeight;
  let x = innerWidth / 2, top = floor - h;
  const dice = tableDiceRect();
  if (dice) {
    // Beside the dice on the table: "no command" and the questions about the dice.
    x = dice.right + 18 + w / 2;
    top = Math.min(floor - h, dice.top - 4); // level with the dice, hanging toward the strip rather than over the road
  }
  const fx = el.dataset.anchor === 'fx' ? fxDiceRect() : null;
  const o = el.dataset.anchor === 'car' && el.dataset.car ? carObjs.get(el.dataset.car) : undefined;
  const anchor = fx ? S.trayDice[0].to : o?.position;
  if (anchor) {
    // Wherever it hides the least: the spaces that can be picked (targets, moves), the vehicles
    // and the dice just rolled must stay in view. Beside the dice (asked by the user, 2026-11-16),
    // else around the car: under it first, then behind it, above, ahead.
    const screen = (p: THREE.Vector3): [number, number] => {
      const q = p.clone().project(camera);
      return [rect.left + (q.x * 0.5 + 0.5) * rect.width, rect.top + (-q.y * 0.5 + 0.5) * rect.height];
    };
    const [gx, gy] = screen(anchor);
    const space = Math.abs(screen(anchor.clone().add(new THREE.Vector3(1, 0, 0)))[0] - gx); // a world unit, in pixels
    const keep: [number, number, number, number][] = []; // left, top, right, bottom of what must stay visible
    for (const m of S.markers) { const [mx, my] = screen(m.at); keep.push([mx - space * 0.75, my - space * 0.5, mx + space * 0.75, my + space * 0.5]); }
    // A slam's preview (the glass car, the arrow) counts double: it is what the question is about.
    for (const p of previewSpots) { const [px, py] = screen(p); const k: [number, number, number, number] = [px - space * 0.8, py - space * 0.6, px + space * 0.8, py + space * 0.5]; keep.push(k, k); }
    for (const c of carObjs.values()) { const [cx, cy] = screen(c.position); keep.push([cx - space * 0.6, cy - space * 0.55, cx + space * 0.6, cy + space * 0.3]); }
    let spots: [number, number][];
    if (fx) {
      keep.push([fx.left - 6, fx.top - 6, fx.right + 6, fx.bottom + 6]);
      const cx = (fx.left + fx.right) / 2, cy = (fx.top + fx.bottom) / 2, rx = fx.right + 14 + w / 2, lx = fx.left - 14 - w / 2;
      spots = [[rx, cy - h / 2], [lx, cy - h / 2], [cx, fx.bottom + 12], [cx, fx.top - 12 - h],
        [rx, fx.bottom + 6], [lx, fx.bottom + 6], [rx, fx.top - 6 - h], [lx, fx.top - 6 - h]];
    } else {
      const gap = space * 0.75 + 10;
      spots = [
        [gx, gy + space * 0.35 + 8], [gx - w / 2 - gap, gy - h / 2], [gx, gy - space * 0.7 - h - 8], [gx + w / 2 + gap, gy - h / 2],
        [gx - w / 2 - gap, gy + space * 0.5], [gx - w / 2 - gap, gy - space * 0.6 - h], [gx, gy + space * 1.1], [gx, gy - space * 1.5 - h],
      ];
    }
    let best = Infinity;
    for (const [sx, sy] of spots) {
      const cx = Math.max(w / 2 + 8, Math.min(innerWidth - w / 2 - 8, sx)), ty = Math.max(cssPx('--top'), Math.min(floor - h, sy));
      let hidden = Math.hypot(cx - sx, ty - sy) * 20; // pushed away from its spot by the screen's edge
      for (const [l, t, r, bt] of keep) hidden += Math.max(0, Math.min(cx + w / 2, r) - Math.max(cx - w / 2, l)) * Math.max(0, Math.min(ty + h, bt) - Math.max(ty, t));
      if (hidden < best - 1) { best = hidden; x = cx; top = ty; }
    }
  }
  el.style.left = `${Math.max(w / 2 + 8, Math.min(innerWidth - w / 2 - 8, x))}px`;
  el.style.top = `${top}px`;
}
$('skip').addEventListener('click', () => skipBeats());
