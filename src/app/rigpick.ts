// Aiming at the Big Rig (BRaFF p5: the shooter picks the command to hit before rolling), asked by
// the user on 2026-11-18: instead of buttons, the systems that can be hit show as icons in a circle
// round the section hit, each joined to it by a line; with the pointer on one, the pop-up of the
// boards (cmdtip.ts) gives the system's name and what it does, and a click picks it.

import * as THREE from 'three';
import { bigRig, type Decision } from '../game/trv/engine';
import { commandIconAt } from '../view/vector/art';
import { carObjs } from './board';
import { choose } from './game';
import { camera } from './stage';
import { $, esc } from './util';

/** How far the icons stand from the section, and their size, in px. */
const RADIUS = 96, SIZE = 64;
/** The overlay: the lines and the icons, kept round the section as the view moves. */
let pick: { el: HTMLElement; lines: SVGLineElement[]; icons: HTMLElement[]; ask: HTMLElement; carId: string } | null = null;

/** Shows the aims of a rigTarget decision (`d`, when this screen's player decides it), or takes them away. */
export function drawRigPick(d: Decision | null, mine: boolean): void {
  const carId = d?.kind === 'rigTarget' && mine ? d.options[0]?.carId : undefined;
  const key = carId ? `${carId}|${d!.options.map(o => o.rig).join(',')}` : '';
  if (pick && pick.el.dataset.key === key) return;
  pick?.el.remove();
  pick = null;
  if (!carId || !d) return;
  const br = bigRig();
  const el = document.createElement('div');
  el.id = 'rigpick';
  el.dataset.key = key;
  el.innerHTML = `<svg class="links">${d.options.map(() => '<line/>').join('')}<circle r="7"/></svg><div class="ask">Scegli il sistema da colpire</div>`
    + d.options.map((o, i) => {
      const id = (o.rig ?? '').split(':')[1] ?? '';
      const lines = (br.command_text as Record<string, string[] | undefined>)[id] ?? [];
      return `<button class="aim" data-i="${i}" data-cmd-name="${esc(br.commandName[id] ?? id)}" data-cmd-dice="sistema del Big Rig"`
        + ` data-cmd-text="${esc(lines.join(' '))}"><svg viewBox="0 0 ${SIZE} ${SIZE}">${commandIconAt(id, SIZE / 2, SIZE / 2, SIZE * 0.72, '#f3e9d2')}</svg></button>`;
    }).join('');
  $('fx').append(el);
  const icons = [...el.querySelectorAll<HTMLElement>('.aim')];
  icons.forEach(b => { b.onclick = () => choose(Number(b.dataset.i)); });
  pick = { el, lines: [...el.querySelectorAll<SVGLineElement>('line')], icons, ask: el.querySelector<HTMLElement>('.ask')!, carId };
  placeRigPick();
}

/** Keeps the icons in their circle round the section hit, as the view moves (every frame). */
export function placeRigPick(): void {
  if (!pick) return;
  const obj = carObjs.get(pick.carId);
  if (!obj) return;
  const p = obj.getWorldPosition(new THREE.Vector3()).project(camera);
  const sx = (p.x + 1) / 2 * innerWidth, sy = (1 - p.y) / 2 * innerHeight;
  const dot = pick.el.querySelector('circle')!;
  dot.setAttribute('cx', sx.toFixed(1)); dot.setAttribute('cy', sy.toFixed(1));
  // The fan's middle: over the section, moved in when the section is near the screen's edge.
  const m = RADIUS + 50, cx = Math.min(innerWidth - m, Math.max(m, sx)), cy = Math.max(m + 30, sy);
  const n = pick.icons.length, spread = Math.min(Math.PI * 0.75, (n - 1) * Math.PI * 0.4);
  pick.ask.style.left = `${cx}px`;
  pick.ask.style.top = `${cy - RADIUS - 52}px`;
  pick.icons.forEach((b, i) => {
    // Fanned out above the section: one straight up, two to either side of it.
    const a = -Math.PI / 2 + (n === 1 ? 0 : (i / (n - 1) - 0.5) * spread);
    const x = cx + Math.cos(a) * RADIUS, y = cy + Math.sin(a) * RADIUS;
    b.style.left = `${x}px`;
    b.style.top = `${y}px`;
    const l = pick!.lines[i];
    l.setAttribute('x1', sx.toFixed(1)); l.setAttribute('y1', sy.toFixed(1));
    l.setAttribute('x2', x.toFixed(1)); l.setAttribute('y2', y.toFixed(1));
  });
}
