// Playback of the rules' beats: the queue of frames a choice produced, how long each lasts,
// what each does to the table, and skipping to the end.

import * as THREE from 'three';
import { type Frame } from '../game/trv/engine';
import { rampSurfaceAt } from '../view/terrain/carnage3d';
import { carObjs, fxSupply, markerGroup } from './board';
import { JUMP, JUMP_BY_SPACES, JUMP_FLIP_LIFT, JUMP_WOBBLE, Jump, STUNT_SLOWMO, jumpSeconds, ramps } from './cars';
import { actionDone, actionShot, directBeat, directing, shotFor } from './director';
import { filmBeat, filmDice } from './shots';
import { burst, crash, explode, flash, impact, smokeOn, word } from './effects';
import { wormEats } from './worm';
import { drawBotCards } from './botcard';
import { decision, g } from './game';
import { drawHud, toastLine, turnOrder } from './hud';
import { damageUntil, showDamage, showRoll } from './info';
import { drawTable, render } from './pieces';
import { P } from './presentation';
import { endReplay, replaying } from './replay';
import { rollOnTable, showOrder, showRound } from './rolls';
import { SPEED_SCALE, settings } from './settings';
import { TILE_W, world } from './stage';
import { S } from './state';
import { JumpStunt, hash01, pickStunt } from './stunts';
import { $ } from './util';

/** Short-lived 3D effects (impacts, tracers, flashes): `step(u)` with u from 0 to 1. */
export interface Effect { life: number; t: number; step: (u: number) => void }
export const effects: Effect[] = [];
export const queue: Frame[] = [];

export const BEAT = P.beats.seconds as Partial<Record<Frame['kind'], number>>;
export function beatLength(f: Frame): number {
  // A ramp jump lasts as long as its flight: the next beat waits for the landing.
  if (f.kind === 'jump' && f.from && f.at) {
    const jp = f.vehicleId ? carObjs.get(f.vehicleId)?.userData.jump as Jump | undefined : undefined;
    if (!jp) return jumpSeconds(Math.max(1, f.at.c - f.from.c));
    // A stunt's slow motion makes its flight longer: the next beat waits for it too.
    const slow = directing() && (jp.stunt === 'barrel' || jp.stunt === 'backflip')
      ? jp.flight * (STUNT_SLOWMO.to - STUNT_SLOWMO.from) * (1 / STUNT_SLOWMO.speed - 1) : 0;
    return JUMP.climb + jp.flight + JUMP.land + slow;
  }
  if (f.kind === 'elim' && f.by === 'sand_worm') return P.sandWorm.seconds;
  if (f.kind !== 'log') return BEAT[f.kind] ?? 0.3;
  if (f.logKind === 'turn') return 0.6;
  return f.logKind === 'dice' || f.logKind === 'bad' || f.logKind === 'good' ? 0.45 : 0.1;
}

/** Starts replaying the beats the last choice produced. */
export function playBeats(frames: Frame[]): void {
  if (!frames.length) { render(); return; }
  // The bubbles keep the order they had until the roll for the first player or the new round's
  // beat comes up (then they slide into the new turn order, see applyBeat).
  if (g && frames.some(f => f.kind === 'order')) S.bubbleOrder = g.players.map(p => p.id);
  else if (frames.some(f => f.kind === 'round') && S.shownOrder.length && !S.bubbleOrder) S.bubbleOrder = [...S.shownOrder];
  queue.push(...frames);
  S.playing = true;
  S.nextBeatAt = 0;
  markerGroup.clear();
  S.markers = [];
  drawHud();
  if (settings.speed === 'skip' && !replaying) skipBeats();
}

/** Jumps to the end of the replay. */
export function skipBeats(): void {
  if (!S.playing) return;
  for (const f of queue) {
    if (f.kind === 'log') { toastLine(f); if (f.logKind === 'turn') S.trayFresh = true; }
    // The dice rolled in the skipped beats still lie by the action, at rest: a question may be about them.
    if (f.kind === 'roll' && !replaying) rollOnTable(f);
  }
  // A damage token drawn in the skipped beats is still shown: the player must see what the car took.
  const dmg = [...queue].reverse().find(f => f.kind === 'damage');
  if (dmg && !replaying) showDamage(dmg);
  for (const td of fxSupply.values()) { td.t = 1; td.d.mesh.position.copy(td.to); td.d.mesh.quaternion.copy(td.q1); }
  queue.length = 0;
  $('roundbox').classList.remove('show');
  document.getElementById('orderbox')?.classList.remove('show');
  finishBeats();
}

/** Questions about the FX dice just rolled: asked beside them, with the view close on them. */
export const FX_ASK = new Set<string>(['slamReroll', 'shootReroll', 'dirReroll']);
/**
 * Questions asked while the effect the dice were rolled for is still going (a reroll, an ability
 * answering the slam or the damage): the dice stay where they fell until it is over, so the
 * question, which sits by them, does not move (asked by the user, 2026-11-18).
 */
export const FX_PENDING = new Set<string>([...FX_ASK, 'plow', 'rollCage', 'pickDamage', 'redButton', 'radar', 'swap']);

export function finishBeats(): void {
  S.playing = false;
  S.bubbleOrder = null;
  if (replaying) endReplay();
  // A question about the dice just rolled keeps the action camera close on them (it comes there
  // when the beats were skipped); any other moment brings the view back. Not a slam's: its dice lie
  // by the cars, and the view from above shows them with the cars and where one would go.
  if (decision && FX_ASK.has(decision.kind) && !decision.preview && S.trayDice.length) {
    const c = S.trayDice.reduce((a, t) => a.add(t.to), new THREE.Vector3()).multiplyScalar(1 / S.trayDice.length);
    if (settings.director2) filmDice(S.trayDice.map(t => t.to)); else actionShot(c);
  } else {
    actionDone();
    // The effect is over: its dice go back to rest, after a moment to read them. Not while a
    // question about it is still open.
    if (S.trayDice.length && !(decision && FX_PENDING.has(decision.kind))) S.fxHomeAt = performance.now() / 1000 + 1.4;
  }
  render();
}

export function applyBeat(f: Frame, now: number): void {
  if (f.kind === 'log') {
    toastLine(f);
    // A new turn clears the dice shown, but never a damage token still being read.
    if (f.logKind === 'turn') { S.trayFresh = true; if (performance.now() > damageUntil) $('rolls').classList.remove('show'); }
    return;
  }
  drawTable(f.snap);
  drawBotCards(f.snap);
  const at = f.at ? world(f.at) : null;
  if (settings.director2) filmBeat(f); else directBeat(f);
  switch (f.kind) {
    case 'roll':
      // A slam's dice: the shot of the impact is over, the view goes back up to see them land by the cars.
      if (shotFor === 'slam' && f.die && (f.die.die === 'slam' || f.die.die === 'direction')) actionDone();
      rollOnTable(f); showRoll(f);
      break;
    case 'slam':
      S.shakeUntil = now + 0.35;
      if (at) { impact(at, 0xff6a2a, 1.6); impact(at, 0xffffff, 0.8); word('SLAM!', at, '#ffb02a'); }
      break;
    case 'shot':
      if (f.from && at) burst(world(f.from), at, f.vehicleId);
      break;
    case 'damage':
      showDamage(f);
      if (f.vehicleId) flash(f.vehicleId);
      if (at) { impact(at, 0xff2a2a, 1.1); word('DANNO!', at, '#ff4a3a'); }
      break;
    case 'elim':
      // The sand worm swallows its car: eaten, not blown up (even before its model has loaded).
      if (f.vehicleId && f.by === 'sand_worm' && wormEats(f.vehicleId)) break;
      if (f.vehicleId) crash(f.vehicleId, f.into ? world(f.into) : null, f.why ?? '');
      else if (at) explode(at);
      break;
    case 'reveal':
      if (at) impact(at, 0xffffff, 0.9);
      break;
    case 'jump': {
      // Ramp jump: the car takes off from the ramp and lands where the stunt die sent it.
      // The car runs up to the ramp's lip, flies on the arc the ramp's slope gives it and lands
      // short of the space, then rolls forward to its centre: never back.
      const o = f.vehicleId ? carObjs.get(f.vehicleId) : undefined;
      if (o && f.from && f.at) {
        const space = TILE_W / 8;
        const rampAt = world(f.from), to = world(f.at);
        const list = ramps(now);
        // The lip: the far end of the ramp's surface along the road, and its slope there.
        let lip = new THREE.Vector3(rampAt.x + space * 0.3, rampAt.y + space * 0.3, rampAt.z), slope = JUMP.maxAngle;
        for (let k = 0.5; k >= 0; k -= 0.02) {
          const y = rampSurfaceAt(list, rampAt.x + k * space, rampAt.z);
          if (y === null) continue;
          const back = rampSurfaceAt(list, rampAt.x + (k - 0.12) * space, rampAt.z) ?? y;
          lip = new THREE.Vector3(rampAt.x + k * space, y, rampAt.z);
          slope = Math.atan2(y - back, 0.12 * space);
          break;
        }
        // Touch down a little short of the centre and roll on; a short jump lands on the centre.
        const touchX = Math.max(lip.x + JUMP.minFlight * space, to.x - JUMP.short * space);
        const touch = touchX >= to.x ? to.clone() : to.clone().setX(touchX);
        const angle = Math.max(JUMP.minAngle, Math.min(JUMP.maxAngle, slope));
        // The flight time a body thrown at that angle needs to come down on the touch point.
        const rise = (touch.x - lip.x) * Math.tan(angle) - (touch.y - lip.y);
        const flight = Math.sqrt(2 * Math.max(rise, 0.05 * space) / (JUMP.gravity * space));
        const n = Math.max(1, Math.min(4, f.at.c - f.from.c));
        const seed = `${f.vehicleId}|${f.from.r},${f.from.c}|${f.at.c}|${g?.round ?? 0}`;
        const stunt = (o.userData.forceStunt as JumpStunt | undefined) ?? pickStunt(n, hash01(seed));
        // A somersault needs a steeper launch, so more time in the air.
        const launch = stunt === 'backflip' ? Math.min(angle + JUMP_FLIP_LIFT, 1.1) : angle;
        const lift = (touch.x - lip.x) * Math.tan(launch) - (touch.y - lip.y);
        const air = stunt === 'backflip' ? Math.sqrt(2 * Math.max(lift, 0.05 * space) / (JUMP.gravity * space)) : flight;
        const jump: Jump = {
          from: o.position.clone(), lip, touch, to, angle: launch, flight: air, t: 0, landed: false, style: JUMP_BY_SPACES[n], touchPitch: 0,
          stunt, side: hash01(`${seed}|side`) < 0.5 ? 1 : -1, touchRoll: 0,
          wobble: (hash01(`${seed}|wobble`) * 2 - 1) * JUMP_WOBBLE, nod: (hash01(`${seed}|nod`) * 2 - 1) * JUMP_WOBBLE,
        };
        o.userData.jump = jump;
        // The table's snapshot still has the car on the ramp: where it is going is the landing space.
        o.userData.target = to.clone();
        word('SALTO!', lip, '#f2c230', true);
      }
      break;
    }
    case 'fire': {
      // A car catches fire (a burst of flame and a word) or its fire goes out (a puff of smoke).
      const o = f.vehicleId ? carObjs.get(f.vehicleId) : undefined;
      if (!o) break;
      if (f.why === 'on') { explode(o.position.clone(), 0.5, now); word('IN FIAMME!', o.position.clone(), '#ff6a1a'); }
      else { smokeOn(`out-${f.vehicleId}`, o, now + 1.5, false); word('SPENTO', o.position.clone(), '#bfc6cc'); }
      break;
    }
    case 'chopper':
      if (at) impact(at, 0x9fd3ff, 1.2);
      break;
    case 'order': {
      // Shown for as long as the beat lasts at this speed; once the first player is known the
      // bubbles slide into turn order while the panel is still up.
      const len = beatLength(f) / SPEED_SCALE[settings.speed];
      showOrder(f, len);
      const first = f.order?.first;
      if (g && first !== null && first !== undefined) {
        const n = g.players.length;
        window.setTimeout(() => { if (S.playing) { S.bubbleOrder = turnOrder(first, n); drawHud(); } }, len * 1000 * 0.6);
      }
      break;
    }
    case 'round':
      showRound(f);
      // The new round's turn order: the bubbles slide into it.
      if (g && f.round) { S.bubbleOrder = turnOrder(f.round.roller, g.players.length); drawHud(); }
      break;
    default:
      break;
  }
}
