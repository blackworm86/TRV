// Pointer input: dragging and dropping dice, and clicks and hovers on the map.

import * as THREE from 'three';
import { skipBeats } from './beats';
import { choose, decision, dieUsable, g, zoneOption } from './game';
import { commandTokenSvg } from '../view/vector/art';
import { dieHtml, drawHud } from './hud';
import { markerAt } from './inspect';
import { typing } from './keys';
import { drawMarkers } from './markers';
import { addPoint, planDecision, planning } from './waypoints';
import { renderer } from './stage';
import { S } from './state';
import { tableDieAt } from './tableDice';
import { $, esc, menuOpen } from './util';

export const ghost = $('ghost');
export let drag: { die: number; x: number; y: number; moved: boolean } | null = null;
// A die on the table is picked up before the camera can take the press for a pan.
document.addEventListener('pointerdown', e => {
  if (e.target !== renderer.domElement || e.button !== 0) return;
  const i = tableDieAt(e);
  if (i < 0 || !dieUsable(i)) return;
  e.stopPropagation();
  e.preventDefault();
  drag = { die: i, x: e.clientX, y: e.clientY, moved: false };
  S.selDie = i;
  drawHud();
}, true);
// A die in the drawer behind the command board (dock.ts) is picked up the same way.
document.addEventListener('pointerdown', e => {
  const el = (e.target as Element | null)?.closest?.<HTMLElement>('[data-mydie]');
  if (!el || e.button !== 0) return;
  const i = Number(el.dataset.mydie);
  if (!dieUsable(i)) return;
  e.preventDefault();
  drag = { die: i, x: e.clientX, y: e.clientY, moved: false };
  S.selDie = i;
  drawHud();
}, true);
// A command token in the drawer, dragged onto the command it activates (Choppe Shoppe).
let tokDrag: { x: number; y: number; moved: boolean } | null = null;
document.addEventListener('pointerdown', e => {
  const el = (e.target as Element | null)?.closest?.('[data-mytok]');
  if (!el || e.button !== 0 || decision?.kind !== 'token') return;
  e.preventDefault();
  tokDrag = { x: e.clientX, y: e.clientY, moved: false };
}, true);
addEventListener('pointermove', e => {
  if (!tokDrag) return;
  if (!tokDrag.moved && Math.hypot(e.clientX - tokDrag.x, e.clientY - tokDrag.y) < 6) return;
  if (!tokDrag.moved) { tokDrag.moved = true; ghost.innerHTML = commandTokenSvg(); ghost.style.display = 'block'; }
  ghost.style.left = `${e.clientX - 32}px`;
  ghost.style.top = `${e.clientY - 32}px`;
});
addEventListener('pointerup', e => {
  if (!tokDrag) return;
  const moved = tokDrag.moved;
  tokDrag = null;
  ghost.style.display = 'none';
  if (!moved || decision?.kind !== 'token') return;
  const zone = document.elementFromPoint(e.clientX, e.clientY)?.closest<SVGElement>('[data-drop]')?.dataset.drop;
  const i = zone ? decision.options.findIndex(o => o.command && `cmd:${o.command}` === zone) : -1;
  if (i > 0) choose(i);
});
addEventListener('pointermove', e => {
  if (!drag || !g || !decision) return;
  if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 6) return;
  if (!drag.moved) {
    drag.moved = true;
    const p = g.players[decision.player];
    ghost.innerHTML = dieHtml('movement', p.dice[drag.die], p.color);
    ghost.style.display = 'block';
  }
  ghost.style.left = `${e.clientX - 32}px`;
  ghost.style.top = `${e.clientY - 32}px`;
});
addEventListener('pointerup', e => {
  if (!drag) return;
  const d = drag;
  drag = null;
  ghost.style.display = 'none';
  if (!d.moved) return; // a click: the die stays selected, click a slot to place it
  const under = document.elementFromPoint(e.clientX, e.clientY);
  const zone = under?.closest<SVGElement>('[data-drop]');
  let i = zone ? zoneOption(zone.dataset.drop!, d.die) : -1;
  // Dropped on a car on the table: the glowing ring under it.
  if (i < 0 && under === renderer.domElement) i = markerAt(e)?.option ?? -1;
  if (i >= 0) choose(i); else { S.selDie = null; drawHud(); drawMarkers(); }
});

addEventListener('keydown', e => { if (!menuOpen() && S.playing && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); skipBeats(); } });
// The floating choices answer to Enter and Esc (marked on their buttons), once the animations are over.
addEventListener('keydown', e => {
  if (S.playing || menuOpen() || typing(e) || e.ctrlKey || e.metaKey || e.altKey) return;
  const b = $('actions').querySelector<HTMLButtonElement>(`button[data-key="${e.key}"]`);
  if (b && $('actions').style.display !== 'none') { e.preventDefault(); b.click(); }
  else if (!b) {
    // Third Eye's "Visto", and End Turn on the command board's tab.
    const other = $('leaderpick').querySelector<HTMLButtonElement>(`button[data-key="${e.key}"]`)
      ?? [...$('cmddock').querySelectorAll<HTMLButtonElement>(`button[data-key="${e.key}"]`)].find(x => x.style.display !== 'none');
    if (other) { e.preventDefault(); other.click(); }
  }
});


export const ray = new THREE.Raycaster();
export const pointer = new THREE.Vector2();
export let downAt = { x: 0, y: 0 };
renderer.domElement.addEventListener('pointerdown', e => { downAt = { x: e.clientX, y: e.clientY }; });
renderer.domElement.addEventListener('pointerup', e => {
  if (e.button !== 0 || drag || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 6 || !decision) return;
  const m = markerAt(e);
  if (m && planning()) addPoint(m.option);
  else if (m) choose(m.option);
});
export let hovered = -1;
renderer.domElement.addEventListener('pointermove', e => {
  const m = markerAt(e);
  renderer.domElement.style.cursor = m ? 'pointer' : 'grab';
  const i = m ? m.option : -1;
  if (i === hovered) return;
  hovered = i;
  for (const mk of S.markers) mk.mesh.userData.hover = mk.option === i;
  if (decision && g) {
    const nm = g.players[decision.player].name;
    $('prompt').innerHTML = `<b style="color:${g.players[decision.player].color}">${esc(nm)}</b>` +
      esc(m ? ((planDecision() ?? decision).options[m.option]?.label ?? '') : decision.prompt.replace(`${nm}: `, ''));
  }
});
