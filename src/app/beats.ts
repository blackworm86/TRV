// Playback of the rules' beats: the queue of frames a choice produced, how long each lasts,
// what each does to the table, and skipping to the end.

import * as THREE from 'three';
import { type Frame, type Snapshot } from '../game/trv/engine';
import { rampSurfaceAt } from '../view/terrain/carnage3d';
import { carObjs, chopperObjs, fxSupply, markerGroup } from './board';
import { ramps, track } from './cars';
import { jumpEstimate, makeJump, planJump, type Jump } from './motion/jump';
import { hopMove, pushMove, quakeMove, slewMove, spinMove, type Move } from './motion/moves';
import { actionDone, actionShot, directBeat, directing, shotFor } from './director';
import { filmBeat, filmDice, filmRoll } from './shots';
import { aimAt, burst, crash, explode, flash, impact, smokeOn, word, words } from './effects';
import { wormEats } from './worm';
import { salvo } from './salvo';
import { shrapnel, shrapnelSeconds } from './shrapnel';
import { drawBotCards } from './botcard';
import { decision, g } from './game';
import { drawHud, toastLine, turnOrder } from './hud';
import { damageUntil, showDamage, showRoll } from './info';
import { drawTable, render } from './pieces';
import { P } from './presentation';
import { endReplay, replaying } from './replay';
import { dropHand } from './handroll';
import { rollOnTable, showOrder, showRound } from './rolls';
import { SPEED_SCALE, settings } from './settings';
import { pushScenes, sceneMode, skipScenes } from './scenePlayer';
import { TILE_W, tileSlots, world } from './stage';
import { S } from './state';
import { $ } from './util';

/**
 * Short-lived 3D effects (impacts, tracers, flashes): `step(u)` with u from 0 to 1. `lingers`: a mark
 * left on the table (a scorch) that fades on its own; nothing waits for it.
 */
export interface Effect { life: number; t: number; step: (u: number) => void; lingers?: boolean }
export const effects: Effect[] = [];
export const queue: Frame[] = [];

export const BEAT = P.beats.seconds as Partial<Record<Frame['kind'], number>>;

/** A gun's burst, from the first round to the last spark. */
const burstSeconds = (): number => P.burst.aim + P.burst.rounds * P.burst.gap + 0.5;
/** The shooting die of a gun's shot (its frame knows whether it hit), not a pit trap's or a salvo's. */
const gunRoll = (f: Frame): boolean => f.kind === 'roll' && f.die?.die === 'shooting' && f.hit !== undefined;
/**
 * A vehicle moved without driving (asked by the user, 2026-11-19), as the move's `why` says: pushed
 * by a slam or a bump, spun by an oil slick, slewed by a skid, shaken by a quake, flung by Blastoff
 * (motion/moves.ts). Its move to start from where it stands now to `to`.
 */
function shoveOf(why: string, o: THREE.Object3D, to: THREE.Vector3): Move | null {
  const from = o.position.clone(), yaw = (o.userData.yaw ?? 0) as number, space = TILE_W / 8;
  if (from.distanceTo(to) < space * 0.1) return null;
  const side = to.z > from.z ? -1 : 1;
  switch (why) {
    case 'slam': case 'push': return pushMove(from, to, yaw, space);
    case 'oil': return spinMove(from, to, yaw, side, space);
    case 'skid': return slewMove(from, to, yaw, side);
    case 'quake': return quakeMove(from, to, yaw, space, from.x * 7 + from.z * 3);
    case 'blastoff': return hopMove(from, to, yaw, space);
    default: return null;
  }
}
/** How long a move without driving lasts (seconds at normal speed), for the beat after it to wait. */
function shoveSeconds(f: Frame): number | null {
  const M = P.motion.moves;
  switch (f.why) {
    case 'slam': case 'push': return 1 / M.pushSpeed + M.pushSettle;
    case 'oil': return M.spinSeconds;
    case 'skid': return M.slewSeconds;
    case 'quake': return M.quakeSeconds;
    case 'blastoff': return M.hopSeconds;
    default: return null;
  }
}

/** The last gun's shot shown: the shooting die that follows fires its burst (asked by the user, 2026-11-19). */
let lastShot: Frame | null = null;
export function beatLength(f: Frame): number {
  // A ramp jump lasts as long as its flight: the next beat waits for the landing.
  if (f.kind === 'jump' && f.from && f.at) {
    const jp = f.vehicleId ? carObjs.get(f.vehicleId)?.userData.jump as Jump | undefined : undefined;
    if (!jp) return jumpEstimate(Math.max(1, f.at.c - f.from.c));
    // Its plan (motion/jump.ts); a stunt's slow motion makes its flight longer: the next beat waits for it too.
    return planJump(jp, directing()).seconds;
  }
  if (f.kind === 'elim' && f.by === 'sand_worm') return P.sandWorm.seconds;
  if (f.kind === 'shot' && f.why === 'missiles') return P.salvo.seconds;
  if (f.kind === 'shot' && f.why === 'shrapnel' && f.from && f.at) return shrapnelSeconds(world(f.from), world(f.into ?? f.at));
  // A gun's shot decided by the die only aims; the shooting die then lasts until its burst is over.
  if (f.kind === 'shot' && !f.why && !f.auto) return P.burst.aimBeat;
  if (gunRoll(f)) return P.burst.afterDie + burstSeconds();
  if (f.kind === 'move' && f.why) { const s = shoveSeconds(f); if (s !== null) return s; }
  if (f.kind !== 'log') return BEAT[f.kind] ?? 0.3;
  if (f.logKind === 'turn') return 0.6;
  return f.logKind === 'dice' || f.logKind === 'bad' || f.logKind === 'good' ? 0.45 : 0.1;
}

/** The longest the table may take to come to rest after the last beat (seconds of real time). */
export const SETTLE_MAX = P.beats.settleMaxS;

/**
 * True when the table is at rest: every car parked on its space (no jump in the air), the FX dice
 * landed, the choppers where they go, the road tiles in place, and no effect, floating word or worm
 * still running. The next choice, the turn splash and the end of the game wait for it (asked by the
 * user, 2026-11-18: each action's animations end before the next action, the end after the last one).
 */
export function settled(): boolean {
  for (const o of carObjs.values()) {
    const tg = o.userData.target as THREE.Vector3 | undefined;
    // Along the table only: a car parked on a ramp rests on its surface, above its target's height.
    if (o.userData.jump || o.userData.shove || (tg && Math.hypot(o.position.x - tg.x, o.position.z - tg.z) > 0.03)) return false;
  }
  for (const td of fxSupply.values()) if (td.t < 1) return false;
  for (const o of chopperObjs.values()) {
    const tg = o.userData.target as THREE.Vector3 | undefined;
    if (tg && o.position.distanceTo(tg) > 0.05) return false;
  }
  for (const grp of tileSlots) if (grp && grp.userData.x !== undefined && Math.abs(grp.userData.x - grp.position.x) > 0.02) return false;
  if (effects.some(e => !e.lingers) || words.length) return false;
  return true;
}

/**
 * Starts replaying the beats the last choice produced. `before`: the table before them, what the
 * bubbles and dashboards show until the first beat (by default the first beat's own table).
 */
export function playBeats(frames: Frame[], before?: Snapshot): void {
  // A choice that shows nothing (the road die declined before a shot is asked, a die assigned). While
  // earlier beats still play, the table stays as they show it: drawn as the rules have it now, a car
  // whose moves are still queued would slide straight to its last space, then back to drive its path
  // (bug of 2026-11-19, a waypoint path ending with "no road die").
  if (!frames.length) { if (S.playing) drawHud(); else render(); return; }
  if (!S.playing) S.shownSnap = before ?? S.restSnap ?? frames[0].snap;
  // The bubbles keep the order they had until the roll for the first player or the new round's
  // beat comes up (then they slide into the new turn order, see applyBeat).
  if (g && frames.some(f => f.kind === 'order')) S.bubbleOrder = g.players.map(p => p.id);
  else if (frames.some(f => f.kind === 'round') && S.shownOrder.length && !S.bubbleOrder) S.bubbleOrder = [...S.shownOrder];
  // With "Movimento nuovo" the frames are played as the director's scenes (scenePlayer.ts).
  if (sceneMode()) pushScenes(frames); else queue.push(...frames);
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
  dropHand(); // dice waiting to be thrown by hand are rolled with the rest
  // The frames not shown yet: the beats' queue, or the scenes still to play.
  const left = [...queue, ...skipScenes()];
  queue.length = 0;
  for (const f of left) {
    if (f.kind === 'log') { toastLine(f); if (f.logKind === 'turn') S.trayFresh = true; }
    // The dice rolled in the skipped beats still lie by the action, at rest: a question may be about them.
    if (f.kind === 'roll' && !replaying) rollOnTable(f);
  }
  // A damage token drawn in the skipped beats is still shown: the player must see what the car took.
  const dmg = [...left].reverse().find(f => f.kind === 'damage');
  if (dmg && !replaying) showDamage(dmg);
  for (const td of fxSupply.values()) { td.t = 1; td.d.mesh.position.copy(td.to); td.d.mesh.quaternion.copy(td.q1); }
  // A jump in the air lands at once (the table is shown as the frames leave it).
  for (const o of carObjs.values()) if (o.userData.jump) { delete o.userData.jump; track(o).finish(); }
  $('roundbox').classList.remove('show');
  document.getElementById('orderbox')?.classList.remove('show');
  finishBeats();
}

/** Questions about the FX dice just rolled: asked beside them, with the view close on them. */
export const FX_ASK = new Set<string>(['slamReroll', 'shootReroll', 'dirReroll', 'stuntReroll']);
/**
 * Questions asked while the effect the dice were rolled for is still going (a reroll, an ability
 * answering the slam or the damage): the dice stay where they fell until it is over, so the
 * question, which sits by them, does not move (asked by the user, 2026-11-18).
 */
export const FX_PENDING = new Set<string>([...FX_ASK, 'plow', 'rollCage', 'pickDamage', 'redButton', 'radar', 'swap']);

export function finishBeats(): void {
  S.playing = false;
  S.shownSnap = null;
  S.settleBy = 0;
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

/**
 * Shows one beat. `film`: the director takes a shot for it (false for the frames of a scene after
 * its first: one shot per scene, design/gdd/camera-director.md §B.7).
 */
export function applyBeat(f: Frame, now: number, film = true): void {
  S.shownSnap = f.snap;
  if (f.kind === 'log') {
    toastLine(f);
    // A new turn clears the dice shown, but never a damage token still being read.
    if (f.logKind === 'turn') { S.trayFresh = true; if (performance.now() > damageUntil) $('rolls').classList.remove('show'); }
    return;
  }
  drawTable(f.snap);
  // A move the vehicle did not drive: its own motion, from where it stands to the space drawn.
  if (f.kind === 'move' && f.why && f.vehicleId) {
    const o = carObjs.get(f.vehicleId), to = o?.userData.target as THREE.Vector3 | undefined;
    const mv = o && to && !o.userData.hitch ? shoveOf(f.why, o, to) : null;
    if (o && mv) { delete o.userData.route; o.userData.shove = mv; }
  }
  drawBotCards(f.snap);
  drawHud(); // the bubbles and the dashboards follow the beat (S.shownSnap)
  const at = f.at ? world(f.at) : null;
  if (film) { if (settings.director2) filmBeat(f); else directBeat(f); }
  switch (f.kind) {
    case 'roll':
      // The old director: a slam's dice end the shot of the impact, the view goes back up to see them land by the cars.
      if (!settings.director2 && shotFor === 'slam' && f.die && (f.die.die === 'slam' || f.die.die === 'direction')) actionDone();
      rollOnTable(f); showRoll(f);
      // The burst comes once the shooting die has landed: on the target (debris, sparks) or wide of it.
      if (gunRoll(f) && lastShot?.from && lastShot.at) {
        const shot = lastShot, hit = !!f.hit;
        let fired = false;
        effects.push({ life: P.burst.afterDie, t: 0, step: u => { if (u >= 1 && !fired) { fired = true; burst(world(shot.from!), world(shot.at!), shot.vehicleId, hit); } } });
      }
      // The new one films the roll: the action's space and where the die lands (shots.ts).
      if (settings.director2 && f.die) { const td = fxSupply.get(f.die.die); if (td) filmRoll(f, td.to); }
      break;
    case 'slam':
      S.shakeUntil = now + 0.35;
      if (at) { impact(at, 0xff6a2a, 1.6); impact(at, 0xffffff, 0.8); word('SLAM!', at, '#ffb02a'); }
      break;
    case 'shot':
      if (f.why === 'missiles' && f.from && f.spaces) salvo(f.vehicleId, world(f.from), f.spaces);
      else if (f.why === 'shrapnel' && f.from && at) shrapnel(world(f.from), at, f.vehicleId, f.into ? world(f.into) : null);
      // A hit with no die (Spotter, Called Shot) fires at once; else the gun aims and waits for the die.
      else if (f.from && at && f.auto) burst(world(f.from), at, f.vehicleId, true);
      else if (f.from && at) { lastShot = f; aimAt(world(f.from), at, f.vehicleId); }
      break;
    case 'damage':
      showDamage(f);
      if (f.vehicleId) flash(f.vehicleId);
      if (at) { impact(at, 0xff2a2a, 1.1); word('DANNO!', at, '#ff4a3a'); }
      break;
    case 'elim':
      // The sand worm swallows its car: eaten, not blown up (even before its model has loaded).
      if (f.vehicleId && f.by === 'sand_worm' && wormEats(f.vehicleId)) break;
      if (f.vehicleId) crash(f.vehicleId, f.into ? world(f.into) : null, f.by, f.at ?? null);
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
        const to = world(f.at);
        const list = ramps(now);
        const n = Math.max(1, Math.min(4, f.at.c - f.from.c));
        const jump: Jump = makeJump({
          from: o.position, rampAt: world(f.from), to, spaces: n,
          seed: `${f.vehicleId}|${f.from.r},${f.from.c}|${f.at.c}|${g?.round ?? 0}`,
          stunt: o.userData.forceStunt as Jump['stunt'] | undefined,
        }, { space: TILE_W / 8, surfaceAt: (x, z) => rampSurfaceAt(list, x, z) });
        o.userData.jump = jump;
        track(o).begin(planJump(jump, directing()));
        const lip = jump.lip;
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
      showRound(f, beatLength(f) / SPEED_SCALE[settings.speed]);
      // The new round's turn order: the bubbles slide into it.
      if (g && f.round) { S.bubbleOrder = turnOrder(f.round.roller, g.players.length); drawHud(); }
      break;
    default:
      break;
  }
}
