// The instant replay of the last damage or destruction, slowed down and from close by.

import * as THREE from 'three';
import { type Frame } from '../game/trv/engine';
import { playBeats } from './beats';
import { carObjs } from './board';
import { g } from './game';
import { drawTable } from './pieces';
import { camera, controls, world } from './stage';
import { S } from './state';
import { $ } from './util';

// When a car is damaged or destroyed, the beats around it are kept: the Replay button (or R) plays
// them again, slowly and from close by, then puts the table and the camera back as they were.

/** Replay speed, and where the camera stands from the spot it looks at. */
export const REPLAY = { speed: 0.45, before: 8, after: 2, camera: new THREE.Vector3(-2.4, 4.4, 5.4) };
export let replaying = false;
export let timeScale = 1;
export let camBefore: { pos: THREE.Vector3; target: THREE.Vector3 } | null = null;

/** Keeps the beats around a damage or a destruction in the frames a choice produced, if any. */
export function keepReplay(frames: Frame[]): void {
  const hit = (f: Frame): boolean => f.kind === 'damage' || f.kind === 'elim';
  const first = frames.findIndex(hit);
  if (first < 0) return;
  let last = first;
  frames.forEach((f, i) => { if (hit(f)) last = i; });
  S.replayFrames = frames.slice(Math.max(0, first - REPLAY.before), last + 1 + REPLAY.after).filter(f => f.kind !== 'log' && f.kind !== 'round' && f.kind !== 'tile');
  const where = frames[first].into ?? frames[first].at;
  S.replayAt = where ? world(where) : null;
  const b = $('replay');
  b.classList.add('fresh');
  window.setTimeout(() => b.classList.remove('fresh'), 9000);
}

export function startReplay(): void {
  if (!g || !S.replayFrames?.length || S.playing) return;
  replaying = true;
  timeScale = REPLAY.speed;
  camBefore = { pos: camera.position.clone(), target: controls.target.clone() };
  S.focusGoal = null;
  if (S.replayAt) { controls.target.copy(S.replayAt).setY(0); camera.position.copy(controls.target).add(REPLAY.camera); }
  $('replaybadge').classList.add('show');
  $('replay').classList.remove('fresh');
  // Back to how the table stood before: the pieces are put there at once, not driven there.
  drawTable(S.replayFrames[0].snap);
  for (const o of carObjs.values()) { const tg = o.userData.target as THREE.Vector3 | undefined; if (tg) o.position.copy(tg); }
  playBeats(S.replayFrames.slice());
}

export function endReplay(): void {
  replaying = false;
  timeScale = 1;
  $('replaybadge').classList.remove('show');
  if (camBefore) { camera.position.copy(camBefore.pos); controls.target.copy(camBefore.target); camBefore = null; }
}
$('replay').addEventListener('click', startReplay);
