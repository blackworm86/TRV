// The game's beats played as the director's scenes (docs/piano-integrazione-veicoli.md, phase 6),
// the only way they are played since 2026-11-20 (asked by the user: everything on the new motion;
// before, the option "Movimento nuovo"): the frames of a choice are grouped into scenes (scenes.ts)
// and played one at a time, each starting only once the table is truly still, the camera taking one
// shot per scene. Only the instant replay still plays the beats from the old queue (loop.ts, beats.ts).
// Each frame is shown by the same code as before (beats.ts applyBeat); what changes is when.

import { onBoard, terrainAt, type Frame } from '../game/trv/engine';
import { SceneQueue, type Played, type Scene, type ScenePhase } from './scenes';
import { applyBeat, beatLength, finishBeats, settled } from './beats';
import { carObjs } from './board';
import { track } from './cars';
import { planDrive } from './motion/drive';
import { springStill, type SpringState } from './motion/plan';
import { makeRoute, type Route } from './route';
import { g } from './game';
import { holdForHand } from './handroll';
import { P } from './presentation';
import { replaying } from './replay';
import { TILE_W, world } from './stage';
import { S } from './state';

/** True when the beats are played as scenes: always, but in the instant replay. */
export function sceneMode(): boolean { return !replaying; }

/** A drive scene's route: the moves driven as one (route.ts), and when the car gets to each. */
interface Drive { route: Route; frames: Frame[]; at: number[] }

let q: SceneQueue | null = null;
/** The scenes' clock: seconds of playback (scaled by the animation speed), not of real time. */
let clock = 0;
/** The route of each drive scene, worked out when the scene is laid out. */
const routes = new Map<Scene, Drive | null>();
/** For the checks (tests/integration): every frame shown, in order, with the clock and its scene. */
export const shownLog: { frame: Frame; at: number; scene: number }[] = [];
let sceneCount = 0;
const sceneIndex = new Map<Scene, number>();

/**
 * The route of a drive scene, as loop.ts startRoute plans it for the beats: forward only (each
 * space ahead of the one before), not for a Big Rig trailer on its hitch; cars and motorcycles end
 * along their lane, the Big Rig may stop at a slant. Null when the car slides to its spaces instead.
 */
function driveOf(sc: Scene): Drive | null {
  if (routes.has(sc)) return routes.get(sc)!;
  let out: Drive | null = null;
  const moves = sc.frames.filter(f => f.kind === 'move' && f.at);
  const o = sc.vehicleId ? carObjs.get(sc.vehicleId) : undefined;
  if (o && g && moves.length && !o.userData.hitch) {
    const ahead = (fromX: number, f: Frame): boolean => world(f.at!).x > fromX + TILE_W / 8 * 0.2;
    const frames: Frame[] = [];
    let x = o.position.x;
    // A move it did not drive (pushed, spun: f.why) ends the route; it has its own motion (beats.ts).
    for (const f of moves) { if (f.why || !ahead(x, f)) break; frames.push(f); x = world(f.at!).x; }
    // Coming onto the road, it is put on its first space (pieces.ts) and drives on from there.
    const from = o.userData.offRoad && frames.length ? world(frames.shift()!.at!).setY(o.position.y) : o.position;
    if (frames.length) {
      const ground = (f: Frame): ReturnType<typeof terrainAt> => (onBoard(f.at!) ? terrainAt(g!, f.at!) : 'R');
      const rig = frames[0].snap.vehicles.find(v => v.id === sc.vehicleId)?.rig !== undefined;
      const route = makeRoute(from, frames.map(f => world(f.at!)), frames, frames.map(ground), P.route, !rig);
      const at = planDrive(route).moments.filter(m => m.name === 'space').map(m => m.at);
      out = { route, frames, at };
    }
  }
  routes.set(sc, out);
  return out;
}

/** True when every vehicle's springs are at rest (the true stop of Vehicle Motion, #36). */
function springsStill(): boolean {
  for (const o of carObjs.values()) {
    const rig = (o.userData.parts ?? o.userData.rig) as { springs?: () => SpringState[] } | undefined;
    for (const s of rig?.springs?.() ?? []) if (!springStill(s)) return false;
  }
  return true;
}

function queue(): SceneQueue {
  return q ??= new SceneQueue({
    still: () => settled() && springsStill(),
    length: (f, sc) => {
      if (f.kind === 'move' && sc.kind === 'drive') {
        const d = driveOf(sc);
        const k = d ? d.frames.indexOf(f) : -1;
        // Its time is the car's: from one arrival to the next.
        if (d && k >= 0) return k === 0 ? d.at[0] ?? 0 : (d.at[k] ?? d.at[d.at.length - 1]) - (d.at[k - 1] ?? 0);
      }
      return beatLength(f);
    },
    apply: (f, sc) => {
      const now = performance.now() / 1000;
      if (f.kind === 'move' && sc.kind === 'drive' && f.vehicleId) {
        const o = carObjs.get(f.vehicleId), d = driveOf(sc);
        if (o && g && f.at) o.userData.ground = onBoard(f.at) ? terrainAt(g, f.at) : 'R';
        if (o && d && d.frames[0] === f) { o.userData.route = d.route; track(o).begin(planDrive(d.route)); }
      }
      // One shot per scene: the director films its first frame; the others join that shot.
      const first = sc.frames.find(x => x.kind !== 'log') === f;
      if (!sceneIndex.has(sc)) sceneIndex.set(sc, sceneCount++);
      shownLog.push({ frame: f, at: clock, scene: sceneIndex.get(sc)! });
      applyBeat(f, now, first);
    },
    // A die thrown by hand: the scene waits for TIRA (handroll.ts).
    hold: up => holdForHand(up),
  }, P.beats.settleMaxS);
}

/** Adds a choice's frames to play as scenes. */
export function pushScenes(frames: Frame[]): void { queue().push(frames); }

/**
 * One frame of the playback (`dt`: seconds of playback, scaled by the animation speed): the scene
 * playing goes on; when the last is over and the table still, the playback ends.
 */
export function tickScenes(dt: number): void {
  if (!q || !S.playing) return;
  clock += dt;
  q.tick(clock);
  if (q.idle()) finishBeats();
}

/** "Salta scena": every frame not shown yet, without playing them (beats.ts skipBeats shows the table they leave). */
export function skipScenes(): Frame[] {
  return q ? q.skip(clock) : [];
}

/** Forgets every scene (a new game, the game left). */
export function resetScenes(): void {
  if (q) q.skip(clock);
  routes.clear();
}

/** For the checks: the scenes played, the phase now, the clock and how many frames were shown. */
export function sceneState(): { played: Played[]; phase: ScenePhase; clock: number; shown: number } {
  return { played: q?.played ?? [], phase: q?.phase ?? 'idle', clock, shown: shownLog.length };
}
