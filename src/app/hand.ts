// The upgrade cards in hand (Choppe Shoppe): drawn under the strip, dragged onto a car.
// Drafted, the cards are shown as cards; to put one on a car, drag it onto the car's dashboard
// (or onto the car on the table), or click it and then the car.

import { type Decision } from '../game/trv/engine';
import { upgradeCardSvg, upgradeCardText } from '../view/cards';
import { carObjs, pickPlane } from './board';
import { choose, decision, g } from './game';
import { drawHud } from './hud';
import { upgradeName } from './info';
import { pointer, ray } from './input';
import { camera, renderer } from './stage';
import { $, esc } from './util';

/** Tells the cards on a page apart (their SVG ids). */
let cardSerial = 0;
/**
 * An upgrade card: the digital card (src/view/cards.ts: the official illustration, the Italian name
 * and text on the black panel, the printed pictogram), with a ring in the crew's colour.
 */
export function cardHtml(id: string, color: string, attrs = ''): string {
  return `<div class="ucard drawn" style="--c:${color}" title="${esc(`${upgradeName(id)}: ${upgradeCardText(id).replace(/\*\*/g, '')}`)}" ${attrs}>`
    + `${upgradeCardSvg({ id, name: upgradeName(id), text: upgradeCardText(id), key: `${id}-${cardSerial++}` })}</div>`;
}
export let selCard: string | null = null;
/** The cards still to place, over the table just above the strip. */
export function drawHand(d: Decision | null): void {
  const el = $('hand');
  if (!g || !d || d.kind !== 'upgradeAssign') { el.innerHTML = ''; selCard = null; return; }
  const who = g.players[d.player];
  const ids = [...new Set(d.options.map(o => o.upgrade!))];
  if (selCard && !ids.includes(selCard)) selCard = null;
  el.innerHTML = ids.map(id => cardHtml(id, who.color, `data-up="${id}"${selCard === id ? ' data-sel="1"' : ''}`)).join('');
}

/** Puts card `id` on car `carId`, when the rules allow it. */
export function assignCard(id: string, carId: string): boolean {
  if (!decision || decision.kind !== 'upgradeAssign') return false;
  const i = decision.options.findIndex(o => o.upgrade === id && o.carId === carId);
  if (i < 0) return false;
  selCard = null;
  choose(i);
  return true;
}

/** The car under a point of the screen: its dashboard in the strip, or the car on the table. */
export function carUnder(x: number, y: number): string | null {
  const under = document.elementFromPoint(x, y);
  const dash = under?.closest<SVGElement>('[data-car]');
  if (dash) return dash.dataset.car ?? null;
  if (under !== renderer.domElement) return null;
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.set(((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1);
  ray.setFromCamera(pointer, camera);
  const hit = ray.intersectObject(pickPlane)[0];
  if (!hit) return null;
  let best: string | null = null, bd = 0.8;
  for (const [id, o] of carObjs) {
    const dd = Math.hypot(o.position.x - hit.point.x, o.position.z - hit.point.z);
    if (dd < bd) { bd = dd; best = id; }
  }
  return best;
}

export let cardDrag: { id: string; x: number; y: number; dx: number; dy: number; moved: boolean; el: HTMLElement | null } | null = null;
$('hand').addEventListener('pointerdown', e => {
  const card = (e.target as Element).closest<HTMLElement>('[data-up]');
  if (!card) return;
  e.preventDefault();
  const r = card.getBoundingClientRect();
  cardDrag = { id: card.dataset.up!, x: e.clientX, y: e.clientY, dx: e.clientX - r.left, dy: e.clientY - r.top, moved: false, el: null };
});
addEventListener('pointermove', e => {
  if (!cardDrag) return;
  if (!cardDrag.moved && Math.hypot(e.clientX - cardDrag.x, e.clientY - cardDrag.y) < 6) return;
  if (!cardDrag.moved) {
    cardDrag.moved = true;
    const src = document.querySelector<HTMLElement>(`#hand [data-up="${cardDrag.id}"]`);
    if (src) {
      cardDrag.el = src.cloneNode(true) as HTMLElement;
      cardDrag.el.classList.add('flying');
      document.body.appendChild(cardDrag.el);
      src.style.visibility = 'hidden';
    }
    selCard = cardDrag.id;
  }
  if (cardDrag.el) { cardDrag.el.style.left = `${e.clientX - cardDrag.dx}px`; cardDrag.el.style.top = `${e.clientY - cardDrag.dy}px`; }
});
addEventListener('pointerup', e => {
  if (!cardDrag) return;
  const c = cardDrag;
  cardDrag = null;
  c.el?.remove();
  if (!c.moved) { selCard = selCard === c.id ? null : c.id; drawHud(); return; } // a click: pick the card, then the car
  const car = carUnder(e.clientX, e.clientY);
  if (!car || !assignCard(c.id, car)) drawHud(); // not a car that can take it: the card goes back to the hand
});
