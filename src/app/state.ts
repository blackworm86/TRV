// Mutable state that several modules change (see S below).

import type * as THREE from 'three';
import type { Decision, Frame, Snapshot, Vehicle } from '../game/trv/engine';
import type { Marker, TableDie } from './board';
import type { Shot } from './director';
import type { Net, Saved } from './game';
import { Level, settings } from './settings';

/**
 * The game client's mutable state shared by several modules (the rest lives in the module that
 * owns it). One object, so any module can change a field: an imported `let` is read-only.
 */
export const S = {
  /**
   * The players' bubbles in turn order (asked by the user, 2026-11-18): while beats play, the order
   * the table had before them, until the roll for the first player or a new round reorders them;
   * null: the order of the round now (see hud.ts turnOrder).
   */
  bubbleOrder: null as number[] | null,
  /** The order the bubbles were last drawn in (seat ids). */
  shownOrder: [] as number[],
  camHome: null as { target: THREE.Vector3; dist: number } | null,
  focusDist: null as number | null,
  focusGoal: null as THREE.Vector3 | null,
  fpsSlow: 0,
  frameSeen: 0,
  fxHomeAt: null as number | null,
  gen: null as Generator<Decision, void, number> | null,
  lastDecider: -1,
  lastSnap: null as Snapshot | null,
  level: settings.quality === 'auto' ? 'high' : settings.quality as Level,
  markers: [] as Marker[],
  net: null as Net | null,
  nextBeatAt: 0,
  /**
   * The last beat has played: until when (performance.now seconds) the table may still be coming to
   * rest before the next choice or the end of the game; 0 while beats are still queued.
   */
  settleBy: 0,
  playing: false,
  /**
   * While the beats play: the table as the beat on show has it (its snapshot). The bubbles, the
   * dashboards and the car's card read the cars' state from it, so a damage token, a car put out of
   * use or set on fire shows up when its beat comes, never before (asked by the user, 2026-11-19).
   */
  shownSnap: null as Snapshot | null,
  /** The table at rest, as last drawn outside the beats: what is shown before the first new beat. */
  restSnap: null as Snapshot | null,
  replayAt: null as THREE.Vector3 | null,
  replayFrames: null as Frame[] | null,
  saved: null as Saved | null,
  selDie: null as number | null,
  /** The crew leader's power tab is pulled out (a click on it). */
  tabOpen: false,
  /** Online upgrade draft: the round this device has sent its pick for (-1: none). */
  draftSent: -1,
  /** Online: this player has sent their crew leader pick (game.ts leaderPick), waiting for the host. */
  leaderSent: false,
  /** Cars whose upgrade card has just fired a passive ability, and until when it glows (performance.now ms). */
  cardFlash: new Map<string, number>(),
  /** The dice drawer opened or closed by hand, for one decision (then it follows the game again). */
  shakeUntil: 0,
  shot: null as Shot | null,
  shotBack: null as { t0: number; from: { pos: THREE.Vector3; look: THREE.Vector3 } } | null,
  trayDice: [] as TableDie[],
  trayFresh: true,
  /** Where the action of the FX dice on the road is: a roll elsewhere sends them home first (rolls.ts). */
  trayAt: null as THREE.Vector3 | null,
  /** One scene at a time: until when (performance.now seconds) the next beat may still wait for the last one's show. */
  calmBy: 0,
  winShown: false,
};

/** Vehicle `v` as the table shows it now: during the beats, its state at the beat on show (S.shownSnap). */
export function shown<T extends Vehicle>(v: T): T {
  const s = S.playing ? S.shownSnap?.vehicles.find(x => x.id === v.id) : undefined;
  if (!s) return v;
  return { ...v, status: s.status, isWreck: s.isWreck, damage: s.damage ?? v.damage, onFire: s.onFire, inStart: s.inStart };
}
