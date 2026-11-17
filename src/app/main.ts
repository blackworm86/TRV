// The game client (the page index.html loads): loads the modules in order, resumes a saved
// hot seat game or joins a room, and installs the hooks the automated checks and the console use.

import './util';
import './settings';
import './stage';
import './board';
import './effects';
import './game';
import './pieces';
import './beats';
import './cars';
import './info';
import './director';
import './chase';
import './replay';
import './rolls';
import './markers';
import './hud';
import './tableDice';
import './hand';
import './input';
import './keys';
import './inspect';
import './screens';
import './online';
import './account';
import './mapView';
import './hudDice';
import './quality';
import './menus';
import './dock';
import { commandTips } from './cmdtip';
import './loop';
import * as THREE from 'three';
import { ROWS, COLS, snapshot, terrainAt, type Pos, type Frame } from '../game/trv/engine';
import { bootAccount, bootOnline } from './account';
import { playBeats, queue, skipBeats } from './beats';
import { carObjs, hazardObjs } from './board';
import { CHASE, chase, chaseLens, setChase } from './chase';
import { burst, crash, explode, word } from './effects';
import { Saved, canUndo, choose, decision, g, startGame, undo, zoneOption } from './game';
import { showDamage, showRoll } from './info';
import { markBlocked } from './markers';
import { render } from './pieces';
import { applyLevel } from './quality';
import { startReplay } from './replay';
import { syncInert } from './screens';
import { settings } from './settings';
import { TILE_T, camera, controls, scene, world } from './stage';
import { takeNow } from './shots';
import { S } from './state';
import { $, SAVE_KEY } from './util';
commandTips(); // the command board's pop-up: name, dice and effect of the command under the pointer

applyLevel(S.level);
syncInert();
void bootAccount().catch(e => console.error(e));
export const invited = bootOnline();
try {
  const raw = invited ? null : localStorage.getItem(SAVE_KEY);
  if (raw) {
    const s = JSON.parse(raw) as Saved;
    if (s?.setup?.seed && Array.isArray(s.choices)) { $('setup').style.display = 'none'; startGame(s); }
  }
} catch { /* broken save: start fresh */ }

// For automated checks.
(window as unknown as { trv: object }).trv = {
  get game() { return g; }, get decision() { return decision; }, choose, undo, canUndo, get choices() { return S.saved?.choices.length ?? 0; }, render, snapshot: () => g && snapshot(g), terrain: (p: Pos) => g && terrainAt(g, p), zoneOption, scene, hazardObjs, camera, controls,
  get take() { return takeNow(); }, get queue() { return queue; }, get playing() { return S.playing; }, skipBeats, playBeats, // playBeats: replays frames (presentation only), for checks
  get rows() { return ROWS; }, get cols() { return COLS; },
  get cam() { return { chase, chaseSet: CHASE, chaseLens, action: !!S.shot, back: !!S.shotBack, focusGoal: S.focusGoal?.toArray(), focusDist: S.focusDist, settings }; },
};

// Debug handle (prototype only): try the effects from the console without playing, e.g.
// `__fx.crash(__fx.cars()[0], 2, 0)` or `__fx.explode(0, 0)`.
Object.assign(window, { __fx: {
  cars: () => [...carObjs.keys()],
  decision: () => decision && { kind: decision.kind, player: decision.player, prompt: decision.prompt, options: decision.options.map(o => o.label) },
  choose: (i: number) => choose(i),
  damage: (id: string, type: string, card?: string) => showDamage({ kind: 'damage', vehicleId: id, token: { type, ...(card ? { card } : {}) } } as unknown as Frame),
  replay: (n = 14) => { if (!g) return 0; S.replayFrames = g.frames.slice(-n).filter(f => f.kind !== 'log' && f.kind !== 'round' && f.kind !== 'tile'); const f = S.replayFrames.find(x => x.at); S.replayAt = f?.at ? world(f.at) : null; startReplay(); return S.replayFrames.length; },
  aim: (id: string, yaw: number | null) => { const o = carObjs.get(id); if (o) o.userData.aim = yaw; },
  zoom: (id: string, d = 3) => { const o = carObjs.get(id); if (o) { controls.target.copy(o.position); camera.position.copy(o.position).add(new THREE.Vector3(-d * 0.3, d * 0.6, d)); } },
  explode: (x: number, z: number) => explode(new THREE.Vector3(x, TILE_T, z)),
  crash: (id: string, dx = 1.5, dz = 0) => { const o = carObjs.get(id); if (o) crash(id, o.position.clone().add(new THREE.Vector3(dx, 0, dz)), ''); },
  burst: (fromId: string, toId: string) => {
    const a = carObjs.get(fromId), b = carObjs.get(toId);
    if (a && b) burst(a.position.clone(), b.position.clone(), toId);
  },
  word: (t: string, x: number, z: number) => word(t, new THREE.Vector3(x, TILE_T, z), '#ffb02a'),
  blocked: (carId: string, because = 'stealth_technology') => { const v = g?.vehicles.find(x => x.id === carId); if (v?.pos) markBlocked({ carId, pos: v.pos, because }); },
  chase: (carId: string | null) => setChase(carId),
  roll: (die: string, value: number | string) => showRoll({ kind: 'roll', die: { die, value } } as unknown as Frame),
} });
