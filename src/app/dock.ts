// The command dock (the question and its buttons) and the action buttons by the dice.

import * as THREE from 'three';
import { type Decision, type Player } from '../game/trv/engine';
import { commandTokenSvg, dieSvg, inkOn } from '../view/vector/art';
import { DRAWER } from '../view/vector/boards';
import { skipBeats } from './beats';
import { carObjs } from './board';
import { choose, dieUsable, g } from './game';
import { camera, renderer } from './stage';
import { S } from './state';
import { fxDiceRect, tableDiceRect } from './tableDice';
import { previewSpots } from './markers';
import { P } from './presentation';
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

/**
 * The drawer behind the command board (the owner's strip drawing, 2026-11-17): the player's dice in
 * 3D, to drag onto a board or a car, or, when a command token may be used, the tokens left, to drag
 * onto a command. Never both (asked by the user, 2026-11-17). It stays out while the player has dice
 * to play or a token to place, and goes back behind the board by itself once they are used up or
 * the turn passes: there is no handle.
 */
export function drawDock(d: Decision | null, mine: boolean, me?: Player): void {
  const dock = $('cmddock'), q = $('cmdq'), row = $('cmdbtns');
  const tokens = !!d && mine && d.kind === 'token';
  // In the player's colour, as the power tab (asked by the user, 2026-11-17).
  if (me) { dock.style.setProperty('--who', me.color); dock.style.setProperty('--whoInk', inkOn(me.color)); }
  // The player's dice: flat faces with their value, dragged onto a board or a car (input.ts).
  // The tokens: the printed command token, dragged the same way (input.ts).
  $('cmddice').innerHTML = tokens ? `<span class="mytok can" data-mytok="1" title="Trascina il segnalino sul comando da attivare">${commandTokenSvg()}</span>`.repeat(me?.tokens ?? 0) : me ? me.dice.map((v, i) => {
    const used = !!me.used[i], can = mine && !used && dieUsable(i), sel = S.selDie === i && !used;
    const die = dieSvg({ kind: 'movement', value: v, color: me.color, number: true, ui: true }, `class="${used ? 'used' : ''} ${sel ? 'sel' : ''}"`);
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
      // The commands it can go on glow on the board (hud.ts); a click on one also places it.
      q.textContent = 'Trascina un segnalino su un comando';
      add(0, 'Nessun segnalino', 'quiet');
    }
  }
  if (!asking) skipConfirm = false;
  // The Final Five put two dice each turn, on two motorcycles, or once a round one on a command
  // (BRaFF p7): there is no "no command" to press, so the drawer says where the next die goes.
  if (d && mine && d.kind === 'assign' && me?.team === 'final_five') {
    const cmd = d.options.some(o => o.command);
    q.textContent = /secondo/.test(d.prompt) ? `Ora il secondo dado: su un'altra moto${cmd ? ' o su un comando' : ''}`
      : `Due dadi su due moto${cmd ? ', oppure uno su un comando' : ''}`;
  }
  // End Turn (asked by the user, 2026-11-18): on the tab, once everything of the turn is done.
  const ending = !!d && mine && d.kind === 'endTurn';
  const end = $('endturn');
  end.style.display = ending ? '' : 'none';
  // Alone on the tab: the dice, all used by now, are not shown with it (asked by the user, 2026-11-18).
  if (ending) $('cmddice').innerHTML = '';
  end.onclick = ending ? () => choose(0) : null;
  // Out while there are dice to play or a token to place; back behind the board otherwise.
  const live = !!me && mine && me.dice.some((_, i) => !me.used[i] && dieUsable(i));
  dock.classList.toggle('ask', asking || live || ending);
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
    // A strip with a drawer of its own (the Final Five's) says where it is: top edge, middle, width.
    const own = root.dataset.drawer?.split(',').map(Number);
    const D = own?.length === 3 ? { edge: own[0], mid: own[1], w: own[2] } : DRAWER;
    // There the six dice go in two rows of three, larger (asked by the user, 2026-11-18).
    dock.classList.toggle('two', own?.length === 3);
    const edge = svg.top + (D.edge - vb.y) * u;
    const width = `${Math.round(D.w * u)}px`;
    if (dock.style.width !== width) dock.style.width = width;
    dock.style.setProperty('--u', u.toFixed(4));
    wrap.style.left = `${svg.left + (D.mid - vb.x) * u}px`;
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
    // The side is chosen once per question, when the view and the dice have come to rest, and kept
    // (asked by the user, 2026-11-17: the answers jumped from one side to the other before one could
    // click them). Until then the answers wait unseen; afterwards they only follow their anchor.
    const now = performance.now() / 1000;
    const still = !S.shotBack && (!S.shot || now > S.shot.t0 + P.director.shot.blendIn + 0.3) && S.trayDice.every(t => t.t >= 1);
    const locked = el.dataset.spot === undefined ? -1 : Number(el.dataset.spot);
    let best = Infinity, pick = -1;
    spots.forEach(([sx, sy], i) => {
      if (locked >= 0 && i !== locked) return;
      const cx = Math.max(w / 2 + 8, Math.min(innerWidth - w / 2 - 8, sx)), ty = Math.max(cssPx('--top'), Math.min(floor - h, sy));
      let hidden = Math.hypot(cx - sx, ty - sy) * 20; // pushed away from its spot by the screen's edge
      for (const [l, t, r, bt] of keep) hidden += Math.max(0, Math.min(cx + w / 2, r) - Math.max(cx - w / 2, l)) * Math.max(0, Math.min(ty + h, bt) - Math.max(ty, t));
      if (hidden < best - 1) { best = hidden; x = cx; top = ty; pick = i; }
    });
    if (locked < 0 && still && pick >= 0) el.dataset.spot = String(pick);
    el.classList.toggle('wait', el.dataset.spot === undefined);
  } else el.classList.remove('wait');
  el.style.left = `${Math.max(w / 2 + 8, Math.min(innerWidth - w / 2 - 8, x))}px`;
  el.style.top = `${top}px`;
}
$('skip').addEventListener('click', () => skipBeats());
