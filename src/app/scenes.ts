// The director's scenes (design/gdd/camera-director.md §A; docs/piano-integrazione-veicoli.md, phase 5):
// - the rules' frames grouped into scenes, one readable event each (§A.1): a vehicle driving, a slam
//   with its dice, push and damage, a shot with its die and damage, a ramp jump with its stunt die;
// - each scene's three phases (§A.2): preparation (the camera comes), action (its frames in order,
//   each lasting what the Vehicle Motion system's plan or the dice say), and a hold to read it;
// - the queue that plays them one at a time (§A.3): a scene starts only once the one before is over
//   and the table is truly still, at most `beats.settle_max_s` later; "Salta scena" takes the scene
//   playing and every one queued to their end at once (§A.7).
// Values in `scenes` (presentation_base.json). Pure: no page, no scene graph, its clock given
// (unit-tested in tests/unit/app/scenes.test.ts on real sequences of the rules engine).

import type { Frame } from '../game/trv/engine';
import { P } from './presentation';

/** A scene's kind: what it shows; any frame not grouped is a scene of its own kind. */
export type SceneKind = 'drive' | 'slam' | 'shot' | 'jump' | 'log' | Exclude<Frame['kind'], 'move' | 'log'>;

/** One scene: its frames in order, the vehicle it is about (if any) and where it happens. */
export interface Scene { kind: SceneKind; frames: Frame[]; vehicleId?: string; at?: Frame['at'] }

/** The grouping rules (`scenes` in the data). */
export interface SceneRules { takes: Record<string, string[]>; pushMoves: number; aloneDice: string[]; aloneLogs: string[]; prep: number; hold: Record<string, number> }

/** A frame that starts a scene of its own kind. */
const STARTS: Partial<Record<Frame['kind'], SceneKind>> = { move: 'drive', slam: 'slam', shot: 'shot', jump: 'jump' };

const isStunt = (f: Frame): boolean => f.kind === 'roll' && f.die?.die === 'stunt';

/** Whether frame `f` joins the open scene `s` (log lines are handled before). */
function joins(s: Scene, f: Frame, R: SceneRules): boolean {
  if (s.kind === 'drive') return f.kind === 'move' && f.vehicleId === s.vehicleId;
  // A ramp's stunt die (and its reroll) leads the jump it is rolled for.
  if (s.kind === 'jump' && !s.frames.some(x => x.kind === 'jump')) return isStunt(f) || f.kind === 'jump';
  if (!(R.takes[s.kind] ?? []).includes(f.kind)) return false;
  if (f.kind !== 'move') return true;
  if (s.kind === 'jump') {
    // The landing: the jumping vehicle's one move, onto the space it jumped to.
    return f.vehicleId === s.vehicleId && !s.frames.some(x => x.kind === 'move');
  }
  if (s.kind === 'slam') {
    // The push comes after the direction die: the vehicle pushed, at most `push_moves` spaces.
    const dirAt = s.frames.findIndex(x => x.kind === 'roll' && x.die?.die === 'direction');
    if (dirAt < 0) return false;
    const pushes = s.frames.slice(dirAt).filter(x => x.kind === 'move');
    if (pushes.length >= R.pushMoves) return false;
    return !pushes.length || pushes[0].vehicleId === f.vehicleId;
  }
  return false;
}

/**
 * Groups a choice's frames into scenes (§A.1): moves of one vehicle in a row make a drive scene; a
 * slam takes its dice, the push and what follows from it; a shot its die and the damage; a ramp's
 * stunt die, the jump and its landing make one jump scene; log lines join the scene they fall in
 * (or one of their own when none is open), but a new turn's line starts a scene of its own; the
 * road die is always alone; any other frame is a scene of its own. A new slam (one in a chain,
 * p. 9) starts a new scene.
 */
export function groupScenes(frames: Frame[], R: SceneRules = P.scenes): Scene[] {
  const out: Scene[] = [];
  let cur: Scene | null = null;
  const open = (kind: SceneKind, f: Frame): Scene => {
    const s: Scene = { kind, frames: [f] };
    if (f.vehicleId && kind !== 'jump') s.vehicleId = f.vehicleId;
    if (f.at) s.at = f.at;
    out.push(s);
    return s;
  };
  for (const f of frames) {
    if (f.kind === 'log') {
      // A new turn closes the scene before it.
      if (cur && !R.aloneLogs.includes(f.logKind ?? '')) cur.frames.push(f); else cur = open('log', f);
      continue;
    }
    const alone = f.kind === 'roll' && R.aloneDice.includes(String(f.die?.die));
    if (cur && cur.kind !== 'log' && !alone && joins(cur, f, R)) {
      cur.frames.push(f);
      // The jump scene learns its vehicle and place from the jump itself.
      if (f.kind === 'jump') { if (f.vehicleId) cur.vehicleId = f.vehicleId; if (f.at) cur.at = f.at; }
      continue;
    }
    cur = open(isStunt(f) ? 'jump' : STARTS[f.kind] ?? (f.kind as SceneKind), f);
    if (cur.kind === 'jump' && f.kind === 'jump' && f.vehicleId) cur.vehicleId = f.vehicleId;
    // A die rolled for the turn is shown alone: what comes after it is a scene of its own.
    if (alone) cur = null;
  }
  // A stunt die with no jump after it was rolled for something else: a roll of its own.
  for (const s of out) if (s.kind === 'jump' && !s.frames.some(x => x.kind === 'jump')) s.kind = 'roll';
  return out;
}

/** How long a frame of a scene lasts (seconds at normal speed): `i` is its index in the scene. */
export type FrameLength = (f: Frame, scene: Scene, i: number) => number;

/** A scene laid out in time: when each of its frames starts, from the scene's start (seconds). */
export interface SceneTimes { prep: number; starts: number[]; action: number; hold: number; seconds: number }

/**
 * Lays a scene out (§Formulas): T = prep + the frames one after another + hold. Log lines take
 * no time of their own, and a scene of log lines alone has no preparation and no hold.
 */
export function scheduleScene(s: Scene, length: FrameLength, R: SceneRules = P.scenes): SceneTimes {
  const logsOnly = s.frames.every(f => f.kind === 'log');
  const prep = logsOnly ? 0 : R.prep;
  const starts: number[] = [];
  let t = prep;
  s.frames.forEach((f, i) => { starts.push(t); t += f.kind === 'log' ? 0 : Math.max(0, length(f, s, i)); });
  const hold = logsOnly ? 0 : R.hold[s.kind] ?? R.hold.other ?? 0;
  return { prep, starts, action: t - prep, hold, seconds: t + hold };
}

/** The phase of the scene queue now: waiting for the table to still, or a scene's phase. */
export type ScenePhase = 'idle' | 'wait' | 'prep' | 'action' | 'hold';

/** What the queue works with: the table's state, how long frames last, and what to do with them. */
export interface SceneHost {
  /** True when the table is truly still: vehicles at rest on their springs, dice still, effects over. */
  still: () => boolean;
  length: FrameLength;
  /** A frame's time has come: show it (move a vehicle, throw a die, an effect...). */
  apply: (f: Frame, scene: Scene) => void;
  /** A scene begins (the director takes its one shot) and ends. */
  begin?: (scene: Scene, times: SceneTimes) => void;
  end?: (scene: Scene) => void;
  /**
   * "Salta scena": the frames not shown yet, shown at once as the table they leave (vehicles in place,
   * springs at rest, dice down, log lines written), without playing them.
   */
  jumpToEnd?: (frames: Frame[]) => void;
  /**
   * True while the scene must wait before showing its next frame (a die the player throws by hand,
   * a question): its clock stops, and goes on where it was once this is false. `upcoming` are the
   * frames still to show, the next one first.
   */
  hold?: (upcoming: Frame[]) => boolean;
}

/** When a scene played: from its start to its end, both in the queue's clock. */
export interface Played { scene: Scene; from: number; to: number; skipped?: boolean }

/**
 * Plays scenes one at a time on a clock it is given (`tick(now)`, seconds). A scene starts once the
 * one before is over and the table is still (at most `settleMax` seconds later); it ends once its
 * hold is over and the table is still again (at most `settleMax` after its hold).
 */
export class SceneQueue {
  private readonly todo: Scene[] = [];
  private cur: { scene: Scene; times: SceneTimes; t0: number; next: number } | null = null;
  private waitSince: number | null = null;
  private last = 0;
  /** The scenes played, for the timeline and to check that none overlaps another. */
  readonly played: Played[] = [];
  phase: ScenePhase = 'idle';

  constructor(private readonly host: SceneHost, private readonly settleMax = P.beats.settleMaxS, private readonly rules: SceneRules = P.scenes) {}

  /**
   * Adds a choice's frames, grouped into scenes. A drive that goes on the drive queued last (the
   * same vehicle, not started yet) joins it: a waypoint path is run as one choice per space, and
   * driven as one scene, not stopping on every space.
   */
  push(frames: Frame[]): Scene[] {
    const s = groupScenes(frames, this.rules);
    const last = this.todo[this.todo.length - 1];
    if (last && s.length && last.kind === 'drive' && s[0].kind === 'drive' && last.vehicleId === s[0].vehicleId) {
      last.frames.push(...s.shift()!.frames);
    }
    this.todo.push(...s);
    return s;
  }

  /** The scene playing now, its layout and when it began. */
  current(): { scene: Scene; times: SceneTimes; t0: number } | null { return this.cur; }
  /** Scenes still to play after the current one. */
  queued(): readonly Scene[] { return this.todo; }
  /** The frames still to show: the rest of the scene playing, then those queued. */
  upcoming(): Frame[] {
    return [...(this.cur ? this.cur.scene.frames.slice(this.cur.next) : []), ...this.todo.flatMap(s => s.frames)];
  }
  /** True when nothing plays and nothing waits. */
  idle(): boolean { return !this.cur && !this.todo.length; }

  /** One step of the clock. */
  tick(now: number): void {
    const dt = Math.max(0, now - this.last);
    this.last = now;
    for (let guard = 0; guard < 64; guard++) {
      if (!this.cur) {
        if (!this.todo.length) { this.phase = 'idle'; this.waitSince = null; return; }
        // Waiting for the table to still before the next scene.
        if (this.waitSince === null) this.waitSince = now;
        if (!this.host.still() && now - this.waitSince < this.settleMax) { this.phase = 'wait'; return; }
        this.waitSince = null;
        const scene = this.todo.shift()!;
        const times = scheduleScene(scene, this.host.length, this.rules);
        this.cur = { scene, times, t0: now, next: 0 };
        this.host.begin?.(scene, times);
      }
      const c = this.cur;
      // Waiting for the player (a die thrown by hand): the scene's clock stands still.
      if (c.next < c.scene.frames.length && now - c.t0 >= c.times.starts[c.next] && this.host.hold?.(this.upcoming())) { c.t0 += dt; return; }
      const t = now - c.t0;
      while (c.next < c.scene.frames.length && t >= c.times.starts[c.next]) {
        if (c.next > 0 && this.host.hold?.(this.upcoming())) return;
        this.host.apply(c.scene.frames[c.next], c.scene);
        c.next++;
      }
      if (c.next < c.scene.frames.length) { this.phase = t < c.times.prep ? 'prep' : 'action'; return; }
      if (t < c.times.prep + c.times.action) { this.phase = 'action'; return; }
      // The hold: at least its seconds, then until the table is still (at most settleMax more).
      if (t < c.times.seconds || (!this.host.still() && t < c.times.seconds + this.settleMax)) { this.phase = 'hold'; return; }
      this.played.push({ scene: c.scene, from: c.t0, to: now });
      this.cur = null;
      this.host.end?.(c.scene);
    }
  }

  /**
   * "Salta scena" (§A.7): every frame not shown yet, of the scene playing and of those queued, goes
   * to `jumpToEnd`, which shows the table as they leave it, without playing them. Returns those frames.
   */
  skip(now: number): Frame[] {
    const left = this.upcoming();
    this.host.jumpToEnd?.(left);
    if (this.cur) { this.played.push({ scene: this.cur.scene, from: this.cur.t0, to: now, skipped: true }); this.host.end?.(this.cur.scene); }
    for (const s of this.todo) this.played.push({ scene: s, from: now, to: now, skipped: true });
    this.cur = null;
    this.todo.length = 0;
    this.phase = 'idle';
    this.waitSince = null;
    return left;
  }
}
