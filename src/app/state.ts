// Mutable state that several modules change (see S below).

import type * as THREE from 'three';
import type { Decision, Frame, Snapshot } from '../game/trv/engine';
import type { Marker, TableDie } from './board';
import type { Shot } from './director';
import type { Net, Saved } from './game';
import { Level, settings } from './settings';

/**
 * The game client's mutable state shared by several modules (the rest lives in the module that
 * owns it). One object, so any module can change a field: an imported `let` is read-only.
 */
export const S = {
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
  playing: false,
  replayAt: null as THREE.Vector3 | null,
  replayFrames: null as Frame[] | null,
  saved: null as Saved | null,
  selDie: null as number | null,
  /** The crew leader's power tab is pulled out (a click on it). */
  tabOpen: false,
  /** Cars whose upgrade card has just fired a passive ability, and until when it glows (performance.now ms). */
  cardFlash: new Map<string, number>(),
  /** The dice drawer opened or closed by hand, for one decision (then it follows the game again). */
  shakeUntil: 0,
  shot: null as Shot | null,
  shotBack: null as { t0: number; from: { pos: THREE.Vector3; look: THREE.Vector3 } } | null,
  trayDice: [] as TableDie[],
  trayFresh: true,
  winShown: false,
};
