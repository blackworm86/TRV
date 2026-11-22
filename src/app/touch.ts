// Playing on a tablet, with no mouse to point (asked by the user, 2026-11-22). What the mouse shows
// by pointing (the command pop-up, the ongoing card, a car's card, the cards of the hand, a space's
// name, the details in the players' bubbles, the Road Condition card) the finger shows by holding:
// a long press is a "lens" that shows the same window and keeps it until the next touch. On things
// only to look at (an ongoing card, a car on the table, a player's bubble) a plain tap does it too.
// The pop-ups are the mouse's own (cmdtip.ts, info.ts, inspect.ts, bubbles.ts, minis.ts, input.ts):
// this module feeds them the pointer events a mouse would send, so there is one behaviour to keep.

import { P } from './presentation';

/** A device with no fine pointer gets the bigger targets from the start; any touch turns them on too. */
document.documentElement.classList.toggle('touch', matchMedia('(pointer: coarse)').matches);

/** The elements whose look on hover is CSS only (`:hover`): the lens marks them `.lens` instead. */
const LENS_CSS = '.rcflag, #strip .upcard, .pl, #cmdhand .mslot, #hand .ucard';
/** What a plain tap shows, being there only to be looked at. */
const TAP_INFO = '[data-ongoing], #players [data-tip], canvas';

let held: { x: number; y: number; target: Element; timer: number } | null = null;
let lensOn = false;
/** The last touch was a long press: the lift that ends it chooses nothing (input.ts). */
let lensUsed = false;
let marked: Element | null = null;

/** Whether the touch that just ended was a long press, so it must not also act. */
export const wasLens = (): boolean => lensUsed;

/** Sends `target` what a mouse arriving at (x, y) would send, so its hover pop-up shows. */
function point(target: Element, x: number, y: number): void {
  const init: PointerEventInit = { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerType: 'mouse', isPrimary: true };
  target.dispatchEvent(new PointerEvent('pointerover', init));
  target.dispatchEvent(new PointerEvent('pointermove', init));
  marked?.classList.remove('lens');
  marked = target.closest(LENS_CSS);
  marked?.classList.add('lens');
  lensOn = true;
}

/** Takes the lens away: the pop-ups see the pointer leave, at the place of the new touch. */
function unpoint(target: Element, x: number, y: number): void {
  if (!lensOn) return;
  lensOn = false;
  marked?.classList.remove('lens');
  marked = null;
  const init: PointerEventInit = { bubbles: true, clientX: x, clientY: y, pointerType: 'mouse', isPrimary: true };
  // The pop-ups follow the pointer: at the new place, over nothing that has one, they close.
  target.dispatchEvent(new PointerEvent('pointermove', init));
  for (const el of [document.getElementById('players'), document.querySelector('canvas')]) {
    if (el && !el.contains(target)) el.dispatchEvent(new PointerEvent('pointerleave', init));
  }
}

addEventListener('pointerdown', e => {
  if (e.pointerType !== 'touch') return;
  document.documentElement.classList.add('touch');
  lensUsed = false;
  const target = e.target as Element;
  unpoint(target, e.clientX, e.clientY);
  if (held) clearTimeout(held.timer);
  held = {
    x: e.clientX, y: e.clientY, target,
    timer: window.setTimeout(() => { if (held) { lensUsed = true; point(held.target, held.x, held.y); } }, P.touch.holdMs),
  };
}, true);

addEventListener('pointermove', e => {
  if (e.pointerType !== 'touch' || !held) return;
  // A finger that moves drags or pans: no lens.
  if (Math.hypot(e.clientX - held.x, e.clientY - held.y) > P.touch.slopPx) { clearTimeout(held.timer); held = null; }
}, true);

addEventListener('pointerup', e => {
  if (e.pointerType !== 'touch') return;
  const h = held;
  held = null;
  if (h) clearTimeout(h.timer);
  if (lensUsed) {
    // The lift after a long press does nothing else: no click on a button under the finger.
    addEventListener('click', ev => { ev.stopPropagation(); ev.preventDefault(); }, { capture: true, once: true });
    setTimeout(() => { lensUsed = false; }, 400);
    return;
  }
  // A plain tap on something only to look at shows its window as a long press would.
  if (h && Math.hypot(e.clientX - h.x, e.clientY - h.y) <= P.touch.slopPx && h.target.closest(TAP_INFO)) point(h.target, e.clientX, e.clientY);
}, true);

addEventListener('pointercancel', () => { if (held) clearTimeout(held.timer); held = null; }, true);
// A long press asks the browser for its own menu (copy, save the picture): not on the table.
addEventListener('contextmenu', e => { if (document.documentElement.classList.contains('touch') && !(e.target as Element).closest('input, textarea')) e.preventDefault(); });
