// Drawing the table in 3D from a snapshot of the rules: road tiles and terrain on them, the
// GLB models of cars, choppers and wrecks, guns, glows, hazards.

import * as THREE from 'three';
import { snapshot, tileDef, TILE_COLS, type Snapshot } from '../game/trv/engine';
import { BASE_CATALOG as CAT, sizeOf, ofKind } from '../game/trv/catalog';
import { flameCluster, useRampModel, rampPiece } from '../view/terrain/carnage3d';
import { pitPiece } from '../view/terrain/pit3d';
import { buildTile, hazardToken, GRID } from '../view/board3d';
import { ModelBank, dressed, fitToLength, splitParts, splitWheels, type Tint } from '../view/models3d';
import { MODEL, SHOW_LENGTH_MM, MODEL_YAW, CHOPPER_PARTS, WHEELS, GUNS, type GunSpec, crewTint, WRECK_TINT, wreckModel, wreckLength, phaseOf, CarRig } from '../view/models-config';
import { effects } from './beats';
import { HAZ_SIZE, carObjs, chopperObjs, hazardObjs, showFinish } from './board';
import { smokeOff, smokeOn, smokes } from './effects';
import { g } from './game';
import { drawHud } from './hud';
import { drawMarkers } from './markers';
import { registerTextures } from './quality';
import { BOARD_X0, KX, MM, PITCH_W, TILE_H, TILE_T, TILE_W, pieces, scene, tileCache, tileSlots, world } from './stage';
import { S } from './state';
import { $ } from './util';

/**
 * Revealed hazards that stay on the board as terrain, and the terrain code each one draws in 3D on
 * its space (asked by the user, 2026-11-16): the token goes, the ground changes. O is an oil slick
 * on asphalt (look only: for the rules oil is road, src/game/trv/engine.ts).
 */
export const HAZARD_GROUND: Partial<Record<string, string>> = {
  road: 'R', mud: 'M', oil: 'O', desert_glass: 'D', ramp: 'P', fire: 'F', pit_trap: 'pit',
};
/** Seconds a revealed terrain hazard's token stays face up before the ground takes its place. */
export const HAZARD_TO_GROUND_S = 1.2;
/** Hazards revealed for long enough to be drawn as ground (board key -> since when it is face up). */
export const groundSince = new Map<string, number>();
/** Revealed hazards already drawn as ground on their tile. */
export const grounded = new Set<string>();
/** The faces on the table last time (to notice the road moving on a tile). */
export let lastBoard = '';
/** Each frame: when a revealed terrain hazard's moment is over, the table is drawn again (tile and token). */
export function groundTick(now: number): void {
  if (!S.lastSnap) return;
  for (const [k, since] of groundSince) {
    if (now - since >= HAZARD_TO_GROUND_S && !grounded.has(k)) { drawTable(S.lastSnap); return; }
  }
}

export function showTiles(s: Snapshot): void {
  if (!g) return;
  // The road moved on a tile: the hazards' columns moved back by one tile's width; so do these.
  const lead = s.board.map(t => `${t.tile}${t.side}`).join();
  if (lastBoard && lastBoard.split(',').slice(1).join() === s.board.slice(0, 2).map(t => `${t.tile}${t.side}`).join()) {
    const move = (m: Map<string, number> | Set<string>): void => {
      const entries = m instanceof Map ? [...m] : [...m].map(k => [k, 0] as [string, number]);
      m.clear();
      for (const [k, v] of entries) {
        const [r, c] = k.split(',').map(Number);
        if (c < TILE_COLS) continue;
        const nk = `${r},${c - TILE_COLS}`;
        if (m instanceof Map) m.set(nk, v); else m.add(nk);
      }
    };
    move(groundSince);
    move(grounded);
  }
  lastBoard = lead;
  for (const k of [...groundSince.keys()]) if (!s.hazards.some(([hk]) => hk === k)) { groundSince.delete(k); grounded.delete(k); }
  s.board.forEach((t, i) => {
    const startFace = t.tile === 1 && g!.tilesPlaced === 3;
    const def = tileDef(t);
    const key = `${t.tile}${t.side}${startFace ? g!.players.length : ''}`;
    let grp = tileCache.get(key);
    if (!grp) {
      grp = buildTile(def, { width: TILE_W, depth: TILE_H, thickness: TILE_T, ...(startFace ? { players: g!.players.length } : {}) });
      tileCache.set(key, grp);
    }
    const x = BOARD_X0 + i * PITCH_W + (GRID.frameW / 2) * KX;
    if (tileSlots[i] !== grp) {
      const fresh = !tileSlots.includes(grp);
      tileSlots[i] = grp;
      if (!grp.parent) scene.add(grp);
      // A new lead tile slides in from beyond the road; the others slide back into place.
      if (fresh && grp.userData.x === undefined) grp.position.set(S.playing ? x + PITCH_W : x, 0, 0);
    }
    grp.userData.x = x;
  });
  // Tiles no longer on the board leave the table.
  for (const grp of tileCache.values()) if (grp.parent && !tileSlots.includes(grp)) { scene.remove(grp); grp.userData.x = undefined; }
}


// Generated models (assets/base/modelli, made by the project owner): one per piece type, tinted with the crew colour.
export const models = new ModelBank();
void useRampModel(MODEL.ramp, u => models.load(u)); // the ramps on the tiles take the model once it has loaded
export function collectMaterials(root: THREE.Object3D): THREE.MeshStandardMaterial[] {
  const out: THREE.MeshStandardMaterial[] = [];
  root.traverse(x => {
    const m = (x as THREE.Mesh).material;
    for (const mm of Array.isArray(m) ? m : m ? [m] : []) if (mm instanceof THREE.MeshStandardMaterial) out.push(mm);
  });
  return out;
}
/**
 * The player-colour light on a car (`o.userData.glow`): cars that can still take a die, and the
 * car that is moving. It lights the model itself, no rings on the table.
 */
export function applyGlow(o: THREE.Object3D, now: number): void {
  const glow = (o.userData.active && o.userData.ownerColor ? { color: o.userData.ownerColor, strength: 0.55 } : o.userData.glow) as { color: string; strength: number } | null | undefined;
  const mats = (o.userData.mats ?? []) as THREE.MeshStandardMaterial[];
  const s = glow ? glow.strength * (0.75 + 0.25 * Math.sin(now * 4)) : 0;
  for (const m of mats) {
    if (glow) m.emissive.set(glow.color);
    m.emissiveIntensity = s;
  }
}
/**
 * The car's own gun, cut out of the model (GUNS in models-config.ts) so it can turn on its mount.
 * It swivels toward `o.userData.aim` (a world yaw) and kicks back at every round; at rest it points
 * forward. It rides on the body, so it leans and shakes with it.
 */
export function mountGun(o: THREE.Group, model: THREE.Object3D, spec: GunSpec): void {
  const gun = model.getObjectByName(spec.name);
  if (!gun) return;
  let body: THREE.Object3D | null = null;
  model.traverse(x => { if (x.userData.body && !body) body = x; });
  const frame = gun.parent;
  if (body && frame) {
    (body as THREE.Object3D).add(frame); // the frame carried the body's transform: now the body does
    frame.position.set(0, 0, 0); frame.rotation.set(0, 0, 0); frame.scale.set(1, 1, 1);
  }
  const muzzle = new THREE.Object3D();
  muzzle.position.set(spec.muzzle[0] - spec.pivot[0], spec.muzzle[1] - spec.pivot[1], spec.muzzle[2] - spec.pivot[2]);
  gun.add(muzzle);
  gun.userData.muzzle = muzzle;
  gun.userData.piece = gun.children[0];
  gun.userData.restX = gun.children[0].position.x;
  o.userData.turret = gun;
}
/** How far a gun kicks back along its barrel at each round, in model units. */
export const GUN_KICK = 0.02;
/** One frame of a gun: it turns toward its aim (or back forward) and recovers from the recoil. */
export function driveGun(o: THREE.Object3D, carYaw: number, dt: number): void {
  const gun = o.userData.turret as THREE.Object3D | undefined;
  if (!gun) return;
  const aim = o.userData.aim as number | null | undefined;
  let want = aim === null || aim === undefined ? 0 : aim - carYaw;
  want = Math.atan2(Math.sin(want - gun.rotation.y), Math.cos(want - gun.rotation.y));
  gun.rotation.y += want * Math.min(1, dt * 12);
  const kick = ((gun.userData.kick ?? 0) as number) * Math.exp(-dt * 22);
  gun.userData.kick = kick;
  (gun.userData.piece as THREE.Object3D).position.x = (gun.userData.restX as number) + kick * GUN_KICK; // the barrel points to -x
}

/** Swaps a stand-in piece for its model once loaded, at its table length. */
export function useModel(o: THREE.Group, url: string, lengthMm: number, tint: Tint, id: string): void {
  void models.load(url).then(m => {
    if (!m) return;
    if (!m.userData.split) {
      if (url === MODEL.chopper) splitParts(m, CHOPPER_PARTS);
      else if (WHEELS[url]) { splitWheels(m, WHEELS[url]); if (GUNS[url]) splitParts(m, [GUNS[url]]); }
      m.userData.split = true;
    }
    registerTextures(m);
    const d = dressed(m, tint);
    const size = fitToLength(d, lengthMm * MM, MODEL_YAW);
    if (WHEELS[url]) o.userData.rig = new CarRig(d, d.scale.x, size.y, phaseOf(id));
    o.userData.mats = collectMaterials(d);
    // Hides the placeholder only: the flames of a burning car (added before the model arrived) stay.
    for (const c of o.children) if (c !== o.userData.flames) c.visible = false;
    o.add(d);
    if (GUNS[url]) mountGun(o, d, GUNS[url]);
    o.userData.modelHeight = size.y;
    o.userData.modelSize = size;
    o.userData.spin = (['rotorMain', 'rotorTail'] as const).map(n => d.getObjectByName(n)).filter(Boolean);
    o.userData.model = d;
    o.userData.phase = phaseOf(id);
  });
}

export function startSpot(v:{ owner: number | null; size: 'S' | 'M' | 'L' }): THREE.Vector3 {
  const sizeIdx = { S: 0, M: 1, L: 2 }[v.size];
  const n = g!.players.length;
  const z = ((v.owner ?? 0) - (n - 1) / 2) * 2.3 + (sizeIdx - 1) * 0.74;
  return new THREE.Vector3(BOARD_X0 - 1.0, TILE_T, z);
}

/** Everything: the table as the rules have it now, the highlights and the interface. */
export function render(): void {
  if (!g) return;
  drawTable(snapshot(g));
  drawMarkers();
  drawHud();
}

/** Draws the table from a snapshot (the rules' state now, or a beat being replayed). */
export function drawTable(s: Snapshot): void {
  if (!g) return;
  S.lastSnap = s;
  showTiles(s);
  showFinish(s.finalTile, g.finishLine);
  const hz = new Map(s.hazards);

  for (const [k, h] of hz) {
    let rec = hazardObjs.get(k);
    if (rec && (rec.type !== h.type || rec.gone !== undefined)) { scene.remove(rec.obj.group); rec = undefined; }
    if (!rec) { rec = { type: h.type, obj: hazardToken(h.type, HAZ_SIZE) }; hazardObjs.set(k, rec); scene.add(rec.obj.group); }
    const [r, c] = k.split(',').map(Number);
    // world() is the middle of the space's body; the token's box also holds the point, half a point further on.
    rec.obj.group.position.copy(world({ r, c }));
    rec.obj.group.position.y += 0.003;
    rec.obj.group.position.x += GRID.tip / 2 * KX;
    rec.obj.setFaceUp(h.faceUp);
    // A revealed terrain hazard: after its moment face up, the token (kept as the base) shows the
    // ground it stands for in 3D, with its piece on top: flames, the ramp (asked by the user, 2026-11-16).
    const code = HAZARD_GROUND[h.type];
    if (code && h.faceUp) {
      const now = performance.now() / 1000;
      if (!groundSince.has(k)) groundSince.set(k, now);
      if (now - groundSince.get(k)! >= HAZARD_TO_GROUND_S) {
        grounded.add(k);
        if (rec.ground !== code) {
          rec.ground = code;
          const space = TILE_W / 8;
          rec.obj.setGround(code, code === 'F' ? flameCluster(space * 0.9, r * 31 + c * 7) : code === 'P' ? rampPiece(space * 0.9) : code === 'pit' ? pitPiece(space, r * 31 + c * 7 + 1) : undefined);
        }
      }
    } else if (rec.ground) { rec.ground = undefined; rec.obj.setGround(null); }
  }
  // A hazard discarded after resolving (mine, wreck) stays face up for a moment, then goes.
  for (const [k, rec] of hazardObjs) if (!hz.has(k) && rec.gone === undefined) {
    rec.obj.setFaceUp(true);
    rec.gone = performance.now() / 1000 + 1.6;
  }

  const seen = new Set<string>();
  const stackCount = new Map<string, number>();
  const now = performance.now() / 1000;
  for (const v of [...s.vehicles].filter(x => x.status !== 'elim').sort((a, b) => a.z - b.z)) {
    seen.add(v.id);
    let o = carObjs.get(v.id);
    if (!o) {
      const comp = v.isWreck ? ofKind(CAT, 'wreck')[0] : ofKind(CAT, 'car', { car_size: v.size })[0];
      o = pieces.car(comp.size_mm, v.owner === null ? '#222' : g.players[v.owner].color, v.isWreck);
      if (v.isWreck) useModel(o, wreckModel(v.id), wreckLength(v.id), WRECK_TINT, v.id);
      else useModel(o, MODEL.car[v.size], SHOW_LENGTH_MM[v.size], crewTint(g.players[v.owner!].color), v.id);
      carObjs.set(v.id, o);
      scene.add(o);
      o.position.copy(v.pos ? world(v.pos) : startSpot(v));
    }
    o.userData.id = v.id;
    o.userData.wreck = v.isWreck;
    // ON FIRE! (Carnage at Devil's Run): flames ride on the car while it burns.
    const flames = o.userData.flames as THREE.Object3D | undefined;
    if (v.onFire && !flames) {
      const f = flameCluster(TILE_W / 8 * 0.7, v.id.length * 13 + v.id.charCodeAt(1));
      f.position.y = 0.25;
      o.add(f);
      o.userData.flames = f;
    } else if (!v.onFire && flames) { o.remove(flames); delete o.userData.flames; }
    let target: THREE.Vector3;
    if (v.pos) {
      const k = `${v.pos.r},${v.pos.c}`;
      const n = stackCount.get(k) ?? 0;
      stackCount.set(k, n + 1);
      target = world(v.pos).add(new THREE.Vector3(n * 0.12, (hz.has(k) ? HAZ_SIZE.thickness : 0) + n * 0.55, n * 0.08));
    } else target = startSpot(v);
    o.userData.target = target;
    // Inoperable: on one side (the game picks which, each time), smoking. A repair puts it back on its wheels.
    const inop = v.status === 'inop' && !v.isWreck;
    if (inop && !o.userData.flip) o.userData.flipSide = Math.random() < 0.5 ? -1 : 1;
    o.userData.flip = inop ? 1 : 0;
    o.userData.height = o.userData.modelHeight ?? (v.isWreck ? ofKind(CAT, 'wreck')[0] : ofKind(CAT, 'car', { car_size: v.size })[0]).size_mm[2] * MM;
    if (inop) smokeOn(v.id, o, Infinity, false); else if (smokes.get(v.id)?.until === Infinity) smokeOff(v.id);
    o.userData.active = v.id === s.activeCar;
    o.userData.ownerColor = v.owner === null ? null : g.players[v.owner].color;
  }
  // Eliminated pieces (cars and wrecks alike) leave the game: a puff of dark smoke, then they shrink away.
  for (const [id, o] of carObjs) if (!seen.has(id)) {
    carObjs.delete(id);
    smokeOff(id);
    if (S.playing) {
      const puff = new THREE.Object3D();
      puff.position.copy(o.position);
      smokeOn(`${id}-gone`, puff, now + 1.4, true);
    }
    effects.push({ life: 0.7, t: 0, step: u => { o.scale.setScalar(Math.max(0.01, 1 - u)); o.rotation.z = u * 1.2; if (u >= 1) scene.remove(o); } });
  }

  // A chopper not in play waits on the ground behind its crew's cars; an airstrike flies it in.
  s.choppers.forEach((at, pid) => {
    let o = chopperObjs.get(pid);
    const spot = at ? world(at).setY(1.1) : new THREE.Vector3(BOARD_X0 - 2.5, TILE_T, (pid - (g!.players.length - 1) / 2) * 2.3);
    if (!o) {
      o = pieces.chopper(sizeOf(CAT, 'chopper'), g!.players[pid].color);
      useModel(o, MODEL.chopper, SHOW_LENGTH_MM.chopper, crewTint(g!.players[pid].color, true), `chopper${pid}`);
      chopperObjs.set(pid, o); scene.add(o); o.position.copy(spot);
    }
    o.userData.target = spot;
    o.userData.parked = !at;
  });
}
