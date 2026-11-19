// The director's scenes (src/app/scenes.ts) on real sequences of the rules engine: a chain slam
// (rulebook p. 9: the car pushed into another slams it in turn) and a shot that deals damage; the
// queue that plays them one at a time, "Salta scena", and the one owner of the camera
// (src/app/camera-owner.ts). design/gdd/camera-director.md §A; docs/piano-integrazione-veicoli.md, phase 5.
import { describe, expect, it } from 'vitest';
import { newGame, play, type Frame } from '../../../src/game/trv/engine';
import { P } from '../../../src/app/presentation';
import { SceneQueue, groupScenes, scheduleScene, type FrameLength, type Scene } from '../../../src/app/scenes';
import { CameraOwner } from '../../../src/app/camera-owner';

const SEED = (n: number): string => n.toString(16).padStart(8, '0').padEnd(64, 'a');
const PLAYERS = [{ name: 'A', color: '#d33' }, { name: 'B', color: '#36c' }, { name: 'C', color: '#3a3' }];

/** Every frame of a whole game played with a fixed chooser (the same game every run). */
function gameFrames(seed: number): Frame[] {
  const g = newGame({ seed: SEED(seed), players: PLAYERS, startSide: 'a' });
  const it = play(g);
  let r = it.next(0), x = seed;
  for (let n = 0; !r.done && n < 20000; n++) { x = (x * 1103515245 + 12345) & 0x7fffffff; r = it.next(x % r.value.options.length); }
  return g.frames;
}

/** The first scene, over the first games, that `pick` accepts, with the scenes around it. */
function find(pick: (s: Scene[], i: number) => boolean): { scenes: Scene[]; i: number } {
  for (let seed = 1; seed <= 40; seed++) {
    const scenes = groupScenes(gameFrames(seed));
    const i = scenes.findIndex((_, k) => pick(scenes, k));
    if (i >= 0) return { scenes, i };
  }
  throw new Error('no such sequence in the first games');
}

const DICE = P.diceThrow.seconds;
/** Frame lengths as the director takes them from Vehicle Motion and the dice. */
const LENGTHS: Record<string, number> = { slam: 0.45, roll: DICE, move: 0.6, shot: 0.5, damage: 1.2, elim: 1.5 };
const LEN: FrameLength = f => LENGTHS[f.kind] ?? 0.3;
const same = (a?: { r: number; c: number }, b?: { r: number; c: number }): boolean => !!a && !!b && a.r === b.r && a.c === b.c;
const real = (s: Scene): Frame[] => s.frames.filter(f => f.kind !== 'log');
const frame = (kind: Frame['kind'], extra: Partial<Frame> = {}): Frame => ({ kind, snap: {} as Frame['snap'], ...extra });
const nextReal = (s: Scene[], k: number): Scene | undefined => s.slice(k + 1).find(z => z.kind !== 'log');

describe('scenes from the frames of the rules', () => {
  it('makes one scene of each slam of a chain: impact, its dice, the push into the next', () => {
    // Arrange: a slam whose pushed car enters a space where it slams another (a chain, p. 9).
    const { scenes, i } = find((s, k) => {
      const push = real(s[k]).filter(f => f.kind === 'move').pop();
      const next = nextReal(s, k);
      return s[k].kind === 'slam' && next?.kind === 'slam' && same(push?.at, next.at);
    });
    const first = scenes[i], second = nextReal(scenes, i)!;
    // Act
    const kinds = real(first).map(f => (f.kind === 'roll' ? `roll:${f.die!.die}` : f.kind));
    // Assert: the impact, the dice, then the push.
    expect(kinds[0]).toBe('slam');
    expect(kinds).toContain('roll:direction');
    expect(kinds.indexOf('move')).toBeGreaterThan(kinds.indexOf('roll:direction'));
    const push = real(first).filter(f => f.kind === 'move').pop()!;
    // The next slam is a scene of its own, by the car pushed, at the space it was pushed into.
    expect(second.frames[0].kind).toBe('slam');
    expect(second.frames[0].vehicleId).toBe(push.vehicleId);
    expect(second.at).toEqual(push.at);
    // A new turn's line is never inside a slam.
    expect(first.frames.some(f => f.kind === 'log' && f.logKind === 'turn')).toBe(false);
  });

  it('keeps a shot with its die and the damage it deals, the damage after the die has landed', () => {
    // Arrange
    const { scenes, i } = find((s, k) => s[k].kind === 'shot' && s[k].frames.some(f => f.kind === 'damage'));
    const shot = scenes[i];
    // Act
    const t = scheduleScene(shot, LEN);
    // Assert
    const roll = shot.frames.findIndex(f => f.kind === 'roll' && f.die?.die === 'shooting');
    const dmg = shot.frames.findIndex(f => f.kind === 'damage');
    expect(roll).toBeGreaterThan(0);
    expect(dmg).toBeGreaterThan(roll);
    expect(t.starts[dmg] - t.starts[roll]).toBeGreaterThanOrEqual(DICE - 1e-9);
    expect(t.starts[0]).toBe(P.scenes.prep);
  });

  it('lays a slam out as the design says: impact, slam die, direction die, push, hold', () => {
    // Arrange: the frames of a slam as the rules give them.
    const frames = [
      frame('slam', { at: { r: 2, c: 3 }, vehicleId: 'a' }), frame('log'),
      frame('roll', { die: { die: 'slam', face: 0, value: 'bottom' } }),
      frame('roll', { die: { die: 'direction', face: 0, value: 'L' } }), frame('log'),
      frame('move', { vehicleId: 'b', at: { r: 1, c: 3 } }),
    ];
    // Act
    const scenes = groupScenes(frames);
    const t = scheduleScene(scenes[0], LEN);
    // Assert: one scene; T = prep + impact + two dice + push + hold (the design's example).
    const p = P.scenes.prep;
    expect(scenes).toHaveLength(1);
    expect(t.starts).toEqual([p, p + 0.45, p + 0.45, p + 0.45 + DICE, p + 0.45 + 2 * DICE, p + 0.45 + 2 * DICE]);
    expect(t.seconds).toBeCloseTo(p + 0.45 + 2 * DICE + 0.6 + P.scenes.hold.slam, 9);
  });

  it('makes one drive scene of the moves of a vehicle in a row, and a new one for another vehicle', () => {
    // Arrange
    const mv = (v: string, c: number): Frame => frame('move', { vehicleId: v, at: { r: 1, c } });
    // Act
    const s = groupScenes([mv('a', 1), mv('a', 2), mv('a', 3), mv('b', 4)]);
    // Assert
    expect(s.map(x => [x.kind, x.vehicleId, x.frames.length])).toEqual([['drive', 'a', 3], ['drive', 'b', 1]]);
  });

  it('leads a jump with its stunt die and ends it with the landing', () => {
    // Arrange
    const frames = [
      frame('move', { vehicleId: 'a', at: { r: 1, c: 2 } }),
      frame('roll', { die: { die: 'stunt', face: 2, value: 3 } }), frame('log'),
      frame('jump', { vehicleId: 'a', from: { r: 1, c: 2 }, at: { r: 1, c: 5 } }),
      frame('move', { vehicleId: 'a', at: { r: 1, c: 5 } }),
      frame('roll', { die: { die: 'road', face: 0, value: 1 } }),
    ];
    // Act
    const s = groupScenes(frames);
    // Assert
    expect(s.map(x => [x.kind, x.frames.length])).toEqual([['drive', 1], ['jump', 4], ['roll', 1]]);
    expect(s[1].vehicleId).toBe('a');
  });
});

describe('the scene queue', () => {
  interface Rig { q: SceneQueue; shown: string[]; now: { t: number }; ends: number[]; jumped: Frame[] }
  /** A queue on a fake clock: the table is still from `stillFrom` on; records what it shows. */
  function rig(stillFrom = 0): Rig {
    const r: Rig = { q: null as unknown as SceneQueue, shown: [], now: { t: 0 }, ends: [], jumped: [] };
    r.q = new SceneQueue({
      still: () => r.now.t >= stillFrom, length: LEN,
      apply: f => { r.shown.push(`${f.kind}@${r.now.t.toFixed(2)}`); },
      end: () => { r.ends.push(r.now.t); },
      jumpToEnd: fs => { r.jumped.push(...fs); },
    }, 6);
    return r;
  }
  const run = (r: Rig, until: number): void => {
    for (let k = 0; r.now.t <= until; k++) { r.q.tick(r.now.t); r.now.t = (k + 1) / 60; }
  };

  it('drives a waypoint path, pushed one choice per space, as one scene', () => {
    // Bug (2026-11-19): each space of a path was a drive scene of its own, the car stopping on every space.
    const r = rig();
    const mv = (c: number): Frame => frame('move', { vehicleId: 'p0S', at: { r: 0, c } });
    for (let c = 0; c < 4; c++) r.q.push([mv(c)]);
    expect(r.q.queued().map(s => [s.kind, s.frames.length])).toEqual([['drive', 4]]);
    // Another vehicle's drive, pushed after, is a scene of its own.
    r.q.push([frame('move', { vehicleId: 'p1S', at: { r: 1, c: 0 } })]);
    expect(r.q.queued().map(s => s.vehicleId)).toEqual(['p0S', 'p1S']);
  });

  it('plays a real chain slam one scene at a time, never two at once', () => {
    // Arrange: the chain slam from the games above, with the scenes after it.
    const { scenes, i } = find((s, k) => s[k].kind === 'slam' && nextReal(s, k)?.kind === 'slam');
    const frames = scenes.slice(i, i + 3).flatMap(s => s.frames);
    const r = rig();
    r.q.push(frames);
    // Act
    run(r, 30);
    // Assert: every frame shown, in order, and the times of the scenes apart.
    expect(r.shown).toHaveLength(frames.length);
    const p = r.q.played;
    for (let k = 1; k < p.length; k++) expect(p[k].from).toBeGreaterThanOrEqual(p[k - 1].to);
    expect(p.filter(x => x.scene.kind === 'slam').length).toBeGreaterThanOrEqual(2);
    expect(r.q.phase).toBe('idle');
  });

  it('waits for the table to be still before the next scene, at most settle_max_s', () => {
    // Arrange: two scenes; the table is still only from 9 s on.
    const r = rig(9);
    r.q.push([frame('move', { vehicleId: 'a' }), frame('move', { vehicleId: 'b' })]);
    // Act
    run(r, 20);
    // Assert: the first starts when the wait runs out (6 s) and ends when the table stills (9 s);
    // the next starts straight after it.
    const [a, b] = r.q.played;
    expect(a.from).toBeCloseTo(6, 1);
    expect(a.to).toBeCloseTo(9, 1);
    expect(b.from).toBeGreaterThanOrEqual(a.to);
    expect(b.from - a.to).toBeLessThan(0.05);
  });

  it('skips to the end: the frames left go straight to the table, none played', () => {
    // Arrange: a slam scene and a drive scene after it, skipped during the dice of the slam.
    const r = rig();
    r.q.push([
      frame('slam', { vehicleId: 'a' }), frame('roll', { die: { die: 'slam', face: 0, value: 'top' } }),
      frame('roll', { die: { die: 'direction', face: 0, value: 'F' } }), frame('move', { vehicleId: 'a' }),
      frame('move', { vehicleId: 'c' }), frame('move', { vehicleId: 'c' }),
    ]);
    run(r, 1.2);
    const before = r.shown.length;
    // Act
    const left = r.q.skip(r.now.t);
    // Assert
    expect(before).toBeGreaterThan(0);
    expect(r.shown).toHaveLength(before);
    expect(left).toHaveLength(6 - before);
    expect(r.jumped).toEqual(left);
    expect(r.q.phase).toBe('idle');
    expect(r.q.played.every(p => p.skipped)).toBe(true);
    expect(r.ends).toHaveLength(1);
  });
});

describe('the scene queue and a die thrown by hand', () => {
  it('stops the scene before the die and goes on, as laid out, once it is thrown', () => {
    // Arrange: a slam whose direction die the player throws by hand at 3 s.
    const shown: { kind: string; t: number }[] = [];
    let now = 0;
    const q = new SceneQueue({
      still: () => true, length: LEN,
      apply: f => { shown.push({ kind: f.kind, t: now }); },
      hold: up => up[0]?.kind === 'roll' && now < 3,
    }, 6);
    q.push([frame('slam', { vehicleId: 'a' }), frame('roll', { die: { die: 'direction', face: 0, value: 'F' } }), frame('move', { vehicleId: 'a' })]);
    // Act
    for (let k = 0; now <= 10; k++) { q.tick(now); now = (k + 1) / 60; }
    // Assert: the die waits for the throw; what follows keeps its place after it.
    const roll = shown.find(x => x.kind === 'roll')!, move = shown.find(x => x.kind === 'move')!;
    expect(roll.t).toBeGreaterThanOrEqual(3);
    expect(roll.t).toBeLessThan(3 + 2 / 60);
    expect(move.t - roll.t).toBeCloseTo(DICE, 1);
  });
});

describe('one owner of the camera', () => {
  it('keeps the camera with the director during a scene; the others wait for it', () => {
    // Arrange
    const cam = new CameraOwner();
    // Act / Assert
    expect(cam.take('director')).toBe(true);
    expect(cam.take('map')).toBe(false);
    expect(cam.take('zoom')).toBe(false);
    expect(cam.holds('director')).toBe(true);
    expect(cam.release('director')).toBe('map');
    expect(cam.release('map')).toBe('zoom');
  });

  it('gives the view back to the hand of the player at once, until the next scene', () => {
    // Arrange
    const cam = new CameraOwner();
    cam.take('director');
    // Act / Assert
    expect(cam.take('player')).toBe(true);
    expect(cam.holds('director')).toBe(false);
    expect(cam.release('director')).toBe('player');
    expect(cam.take('director')).toBe(true);
  });
});
