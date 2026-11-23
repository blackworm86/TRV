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
import './touch';
import { commandTips } from './cmdtip';
import './loop';
import * as THREE from 'three';
import { ROWS, COLS, snapshot, terrainAt, type Pos, type Frame } from '../game/trv/engine';
import { bootAccount, bootOnline } from './account';
import { betaGate } from './beta';
import { openReportGame } from './report';
import { startUsage } from './usage';
import './profile';
import { playBeats, queue, skipBeats } from './beats';
import { sceneState, shownLog } from './scenePlayer';
import { carObjs, hazardObjs } from './board';
import { CHASE, chase, chaseLens, setChase } from './chase';
import { burst, crash, explode, word } from './effects';
import { wormReady } from './worm';
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
// The closed Beta: on the real site nothing starts until an invited account is in (beta.ts).
void betaGate().then(() => {
  void bootAccount().catch(e => console.error(e));
  startUsage(); // the admins' usage statistics (usage.ts)
  const invited = bootOnline();
  // From the admin page: a tester's report, its game opened at the point it was sent (report.ts).
  const report = new URLSearchParams(location.search).get('report');
  if (report) {
    void openReportGame(report).then(ok => { if (!ok) alert('Questa segnalazione non ha una partita allegata.'); }, e => { console.error(e); alert('Segnalazione non disponibile.'); });
    return;
  }
  try {
    const raw = invited ? null : localStorage.getItem(SAVE_KEY);
    if (raw) {
      const s = JSON.parse(raw) as Saved;
      if (s?.setup?.seed && Array.isArray(s.choices)) { $('setup').style.display = 'none'; startGame(s); }
    }
  } catch { /* broken save: start fresh */ }
}, e => { console.error(e); $('beta-err').textContent = 'Non riesco a controllare l’invito: ricarica la pagina.'; });

// For automated checks.
(window as unknown as { trv: object }).trv = {
  get game() { return g; }, get decision() { return decision; }, choose, undo, canUndo, get choices() { return S.saved?.choices.length ?? 0; }, render, snapshot: () => g && snapshot(g), terrain: (p: Pos) => g && terrainAt(g, p), zoneOption, scene, hazardObjs, camera, controls,
  get take() { return takeNow(); }, get queue() { return queue; }, get playing() { return S.playing; }, skipBeats, playBeats, // playBeats: replays frames (presentation only), for checks
  get rows() { return ROWS; }, get cols() { return COLS; },
  // The lit spaces and cars, where they are on the screen; `ahead`: a move offered while "a command?" is asked (markers.ts).
  get markers() { return S.markers.map(m => { const v = m.at.clone().project(camera); return { option: m.option, ahead: !!m.ahead, x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight }; }); },
  // "Movimento nuovo": the scenes played and every frame shown with its scene (scenePlayer.ts), and what the bubbles show.
  get scenes() { return { ...sceneState(), log: shownLog }; }, get shownSnap() { return S.shownSnap; },
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
  crash: (id: string, dx = 1.5, dz = 0) => { const o = carObjs.get(id); if (o) crash(id, o.position.clone().add(new THREE.Vector3(dx, 0, dz)), undefined, null); },
  // A car falling into a pit trap `dx` ahead of it.
  pit: (id: string, dx = 1.6) => { const o = carObjs.get(id); if (o) crash(id, o.position.clone().add(new THREE.Vector3(dx, 0, 0)), 'pit', null); },
  burst: (fromId: string, toId: string) => {
    const a = carObjs.get(fromId), b = carObjs.get(toId);
    if (a && b) burst(a.position.clone(), b.position.clone(), toId);
  },
  // Waits for the model, then plays the worm as the game does: the director films it. The car comes
  // back at the end (the rules have not eliminated it), so the show can be watched again.
  worm: (id: string) => wormReady().then(() => {
    if (!g || !carObjs.has(id)) return false;
    playBeats([{ kind: 'elim', vehicleId: id, by: 'sand_worm', snap: snapshot(g) } as unknown as Frame]);
    return true;
  }),
  word: (t: string, x: number, z: number) => word(t, new THREE.Vector3(x, TILE_T, z), '#ffb02a'),
  blocked: (carId: string, because = 'stealth_technology') => { const v = g?.vehicles.find(x => x.id === carId); if (v?.pos) markBlocked({ carId, pos: v.pos, because }); },
  chase: (carId: string | null) => setChase(carId),
  roll: (die: string, value: number | string) => showRoll({ kind: 'roll', die: { die, value } } as unknown as Frame),
} });
