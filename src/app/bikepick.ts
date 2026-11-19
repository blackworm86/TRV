// Which of the Final Five's two motorcycles moves first (BRaFF p7: the crew activates both, one after
// the other), asked by the user on 2026-11-19: instead of the buttons in a corner, a round badge
// stands over each motorcycle that has a die, with that motorcycle's marking, and a click on it picks
// the one that goes first. The badges follow the motorcycles as the view moves.

import * as THREE from 'three';
import { type Decision } from '../game/trv/engine';
import { markingSvg } from '../view/vector/markings';
import { carObjs } from './board';
import { choose, g } from './game';
import { TILE_W, camera } from './stage';
import { $, esc } from './util';

/** How high over the motorcycle the badge floats, in road spaces. */
const LIFT = 0.55;
/** The badges on screen, with the motorcycle each stands over. */
let pick: { el: HTMLElement; badges: { b: HTMLElement; carId: string }[] } | null = null;

/** Shows the badges of a `first` decision (`d`, when this screen's player decides it), or takes them away. */
export function drawBikePick(d: Decision | null, mine: boolean): void {
  const ok = d?.kind === 'first' && mine && !!g;
  const key = ok ? d!.options.map(o => o.carId).join(',') : '';
  if (pick && pick.el.dataset.key === key) return;
  pick?.el.remove();
  pick = null;
  if (!ok || !d) return;
  const el = document.createElement('div');
  el.id = 'bikepick';
  el.dataset.key = key;
  const color = g!.players[d.player]?.color ?? '#888';
  el.innerHTML = d.options.map((o, i) => {
    const v = g!.vehicles.find(x => x.id === o.carId);
    const mark = v?.bike !== undefined ? markingSvg(v.bike, 34) : '';
    return `<button class="bike" data-i="${i}" style="--c:${esc(color)}" title="${esc(o.label)}: muove e spara per prima">`
      + `<span class="mark">${mark}</span><span class="gothic">PRIMA</span></button>`;
  }).join('');
  $('fx').append(el);
  const badges = d.options.map((o, i) => ({ b: el.querySelector<HTMLElement>(`[data-i="${i}"]`)!, carId: o.carId ?? '' }));
  for (const { b } of badges) b.onclick = () => choose(Number(b.dataset.i));
  pick = { el, badges };
  placeBikePick();
}

/** Keeps each badge over its motorcycle as the view moves (every frame). */
export function placeBikePick(): void {
  if (!pick) return;
  const at = pick.badges.map(({ carId }) => {
    const o = carObjs.get(carId);
    if (!o) return null;
    const p = o.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, LIFT * TILE_W / 8, 0)).project(camera);
    return p.z < 1 ? { x: (p.x + 1) / 2 * innerWidth, y: (1 - p.y) / 2 * innerHeight } : null;
  });
  // Two motorcycles close together (side by side in the starting area): the badges step apart.
  const [a, c] = at;
  if (a && c && Math.abs(a.x - c.x) < GAP && Math.abs(a.y - c.y) < GAP) {
    const mid = (a.x + c.x) / 2, side = a.x <= c.x ? -1 : 1;
    a.x = mid + side * GAP / 2; c.x = mid - side * GAP / 2;
  }
  pick.badges.forEach(({ b }, i) => {
    const p = at[i];
    b.style.display = p ? '' : 'none';
    if (!p) return;
    b.style.left = `${p.x.toFixed(1)}px`;
    b.style.top = `${p.y.toFixed(1)}px`;
  });
}
/** Closer than this on screen (px), two badges step apart. */
const GAP = 70;
