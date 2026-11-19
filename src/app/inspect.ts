// The car inspection tip: a car's damage and abilities, shown on hover.
// Pointing at a car on the table shows its card (the bubbles have their own pop-ups, bubbles.ts): owner, state, damage
// and its special ability (the upgrade card, Choppe Shoppe).

import { type Vehicle } from '../game/trv/engine';
import { Marker, carObjs, pickPlane } from './board';
import { g } from './game';
import { DAMAGE_INFO, ONGOING_INFO, UPGRADE_INFO, upgradeName } from './info';
import { drag, pointer, ray } from './input';
import { camera, renderer } from './stage';
import { S, shown } from './state';
import { $, esc } from './util';

export const SIZE_NAME: Record<string, string> = { S: 'piccola', M: 'media', L: 'grande' };
/** The card of a car, as HTML. */
export function carTipHtml(v: Vehicle): string {
  const owner = v.owner !== null && g ? g.players[v.owner] : null;
  const title = v.isWreck ? 'Relitto' : `Auto ${SIZE_NAME[v.size]}${owner ? ` di ${esc(owner.name)}` : ''}`;
  const state = v.status === 'elim' ? 'Eliminata' : v.status === 'inop' ? 'Fuori uso' : v.inStart ? 'In partenza' : 'In strada';
  const hidden = v.upgrade === 'onboard_computer' || v.upgrade2 === 'onboard_computer';
  const dmg = v.damage.length
    ? `<ul>${v.damage.map(t => {
      if (hidden) return '<li>Segnalino coperto</li>';
      // An ongoing effect card (Carnage at Devil's Run) under the token: its name and text.
      const card = t.card ? ONGOING_INFO[t.card] : undefined;
      if (card) return `<li><b>${esc(card[0])}</b> — ${esc(card[1])}</li>`;
      const [n, does] = DAMAGE_INFO[t.type] ?? [t.type, ''];
      return `<li><b>${esc(n)}</b>${does ? ` — ${esc(does)}` : ''}</li>`;
    }).join('')}</ul>`
    : '<p>Nessun danno.</p>';
  const ups = [v.upgrade, v.upgrade2].filter((x): x is string => !!x);
  const ability = ups.length ? ups.map(u => `<p><b>${esc(upgradeName(u))}</b>: ${esc(UPGRADE_INFO[u] ?? '')}${v.status !== 'ok' ? ' <i>(non attiva: auto fuori uso)</i>' : ''}</p>`).join('') : '<p>Nessuna abilità speciale.</p>';
  return `<h4>${title}</h4><span class="state">${state} · ${v.damage.length} ${v.damage.length === 1 ? 'danno' : 'danni'}</span>`
    + `<h5>Danni</h5>${dmg}<h5>Abilità speciale</h5>${ability}`;
}
export let tipFor: string | null = null;
/** Shows the card of car `id` by the pointer at (x, y), or hides it (null). */
export function showCarTip(id: string | null, x = 0, y = 0): void {
  const el = $('cartip');
  const v = id && g ? g.vehicles.find(z => z.id === id) : undefined;
  if (!v) { el.classList.remove('show'); tipFor = null; return; }
  if (tipFor !== id) {
    tipFor = id;
    el.style.setProperty('--c', v.owner !== null && g ? g.players[v.owner].color : '#9a8f84');
    el.innerHTML = carTipHtml(shown(v));
  }
  el.classList.add('show');
  const w = el.offsetWidth, h = el.offsetHeight;
  el.style.left = `${Math.min(innerWidth - w - 8, x + 16)}px`;
  el.style.top = `${Math.max(8, Math.min(innerHeight - h - 8, y + 16))}px`;
}
/** The car under the pointer on the table, or null. */
export function carAt(e: PointerEvent): string | null {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
  ray.setFromCamera(pointer, camera);
  let best: string | null = null, bd = Infinity;
  for (const [id, o] of carObjs) {
    if (!o.visible) continue;
    const hit = ray.intersectObject(o, true)[0];
    if (hit && hit.distance < bd) { bd = hit.distance; best = id; }
  }
  return best;
}
export let tipAt = 0;
renderer.domElement.addEventListener('pointermove', e => {
  if (e.buttons || drag) { showCarTip(null); return; }
  const t = performance.now();
  if (t - tipAt < 60) return; // a ray against every car is not free: a few times a second is enough
  tipAt = t;
  showCarTip(carAt(e), e.clientX, e.clientY);
});
renderer.domElement.addEventListener('pointerleave', () => showCarTip(null));

export function markerAt(e: PointerEvent): Marker | null {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
  ray.setFromCamera(pointer, camera);
  const hit = ray.intersectObject(pickPlane)[0];
  if (!hit) return null;
  let best: Marker | null = null, bd = 0.75;
  for (const m of S.markers) {
    const dd = Math.hypot(m.at.x - hit.point.x, m.at.z - hit.point.z);
    if (dd < bd) { bd = dd; best = m; }
  }
  return best;
}
