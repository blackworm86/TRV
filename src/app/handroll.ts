// Rolling the dice by hand (asked by the user, 2026-11-19; design/ux/tiro-a-mano/mockup.html, option
// A chosen). With the option "Tiro dei dadi: A mano", when the beats reach a die rolled during the
// turn for an action on the road (shooting, slam, direction, stunt, fire...), the playback stops: the
// dice of that action hover by it, lit, and the player whose turn it is throws them with the TIRA
// button (or Space). The dice of the start of the round stay automatic, and so do a TRV9000 team's.
// The rules have already rolled them (the seed decides, online too): the throw is the player's moment,
// not a new result. Online only the player of the turn throws by hand; the others see an automatic roll.

import * as THREE from 'three';
import { type Frame } from '../game/trv/engine';
import { DIE_W, FX_SCALE } from './board';
import { g, mySeat } from './game';
import { replaying } from './replay';
import { fxDie } from './rolls';
import { settings } from './settings';
import { filmRoll } from './shots';
import { TILE_T, TILE_W, camera, renderer, world } from './stage';
import { S } from './state';
import { esc } from './util';

/** One road space, in world units. */
const SP = TILE_W / 8;
/** The dice of the action waiting to be thrown (null when none), and where they hover. */
let held: { frames: Frame[]; spots: THREE.Vector3[] } | null = null;
/** The rolls already thrown by hand: the playback goes on with them. */
const thrown = new WeakSet<Frame>();

/** The die's name, as the player reads it. */
const DIE_NAME: Record<string, string> = {
  shooting: 'dado sparo', slam: 'dado slam', direction: 'dado direzione', stunt: 'dado acrobazia', road: 'dado strada', fire: 'dado fuoco',
};

/** The player whose turn the frame belongs to (the owner of the car moving, else the player of the turn). */
function turnPlayer(f: Frame): number | null {
  const car = f.snap.activeCar ? f.snap.vehicles.find(v => v.id === f.snap.activeCar) : undefined;
  return car?.owner ?? g?.current ?? null;
}

/** True when this roll is one the player throws by hand. */
function byHand(f: Frame): boolean {
  if (settings.dice !== 'hand' || replaying || settings.speed === 'skip' || f.kind !== 'roll' || !f.die || !f.at || thrown.has(f)) return false;
  const p = turnPlayer(f);
  if (p === null || !g || g.players[p]?.bot) return false;
  return !S.net || p === mySeat();
}

/**
 * Called by the playback before a beat: when `queue[0]` is a roll to throw by hand, the playback
 * stops there (true) and the dice of that action (the rolls at the same space up to the next other
 * beat) hover by it, waiting for TIRA.
 */
export function holdForHand(queue: Frame[]): boolean {
  if (held) return true;
  const f = queue[0];
  if (!f || !byHand(f)) return false;
  const frames: Frame[] = [];
  for (const x of queue) {
    if (x.kind === 'log') continue;
    if (x.kind !== 'roll' || !x.die || !x.at || x.at.r !== f.at!.r || x.at.c !== f.at!.c || frames.some(y => y.die!.die === x.die!.die)) break;
    frames.push(x);
  }
  const at = world(f.at!);
  // Above the action, a little toward the camera, in a row.
  const step = DIE_W * FX_SCALE * 1.7;
  const spots = frames.map((_, i) => at.clone().add(new THREE.Vector3((i - (frames.length - 1) / 2) * step, 0, 0.55 * SP)).setY(TILE_T + 1.1 * SP));
  held = { frames, spots };
  frames.forEach((x, i) => {
    const td = fxDie(x.die!.die);
    td.d.mesh.visible = true;
    td.t = 1; td.throw = null; // standing still where this module puts it
    td.d.mesh.position.copy(spots[i]);
  });
  filmRoll(f, spots[0]);
  showButton(frames);
  return true;
}

/** Throws the dice waiting: the playback goes on, and they fly from where they hover to where they land. */
export function throwDice(): void {
  if (!held) return;
  for (const f of held.frames) thrown.add(f);
  held = null;
  $box()?.classList.remove('show');
  S.nextBeatAt = 0;
}

/** Forgets the dice waiting (the beats were skipped). */
export function dropHand(): void {
  if (!held) return;
  for (const f of held.frames) thrown.add(f);
  held = null;
  $box()?.classList.remove('show');
}

const $box = (): HTMLElement | null => document.getElementById('handroll');
function showButton(frames: Frame[]): void {
  let box = $box();
  if (!box) {
    box = document.createElement('div');
    box.id = 'handroll';
    document.body.appendChild(box);
    box.addEventListener('click', e => { if ((e.target as HTMLElement).closest('button')) throwDice(); });
  }
  const names = frames.map(f => DIE_NAME[f.die!.die] ?? 'dado');
  const p = turnPlayer(frames[0]);
  const who = p !== null && g ? g.players[p] : null;
  box.innerHTML = `<b class="gothic">${frames.length > 1 ? 'Tira i dadi' : 'Tira il dado'}</b>`
    + `<span>${who ? `<i style="color:${who.color}">${esc(who.name)}</i> · ` : ''}${esc(names.join(' e '))}</span>`
    + '<button class="gothic">TIRA!</button><kbd>Spazio</kbd>';
  box.classList.add('show');
}

/** Each frame: the waiting dice hover and turn slowly, the TIRA button sits beside them. */
export function tickHand(now: number): void {
  if (!held) return;
  const h = held;
  h.frames.forEach((f, i) => {
    const m = fxDie(f.die!.die).d.mesh;
    m.position.copy(h.spots[i]).setY(h.spots[i].y + Math.sin(now * 2.4 + i) * 0.08 * SP);
    m.rotation.set(Math.sin(now * 1.3 + i) * 0.5, now * 1.6 + i, Math.cos(now * 1.1 + i) * 0.4);
  });
  const box = $box();
  if (!box) return;
  const rect = renderer.domElement.getBoundingClientRect();
  const last = h.spots[h.spots.length - 1].clone().add(new THREE.Vector3(DIE_W * FX_SCALE, 0, 0)).project(camera);
  const x = rect.left + (last.x * 0.5 + 0.5) * rect.width, y = rect.top + (-last.y * 0.5 + 0.5) * rect.height;
  box.style.left = `${Math.max(8, Math.min(innerWidth - box.offsetWidth - 8, x + 16))}px`;
  box.style.top = `${Math.max(70, Math.min(innerHeight - box.offsetHeight - 8, y - box.offsetHeight / 2))}px`;
}

// Space throws the dice waiting.
addEventListener('keydown', e => {
  if (!held || e.code !== 'Space' || (e.target as HTMLElement)?.closest?.('input, textarea')) return;
  e.preventDefault();
  throwDice();
});
