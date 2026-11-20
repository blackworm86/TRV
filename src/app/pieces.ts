// Drawing the table in 3D from a snapshot of the rules: road tiles and terrain on them, the
// GLB models of cars, choppers and wrecks, guns, glows, hazards.

import * as THREE from 'three';
import { snapshot, tileDef, TILE_COLS, type RigSection, type Snapshot } from '../game/trv/engine';
import { BASE_CATALOG as CAT, sizeOf, ofKind } from '../game/trv/catalog';
import { flameCluster, useRampModel, rampPiece } from '../view/terrain/carnage3d';
import { pitPiece } from '../view/terrain/pit3d';
import { buildTile, hazardToken, GRID } from '../view/board3d';
import { ModelBank, dressed, fitToLength, ownMaterials, splitParts, splitWheels, type Tint } from '../view/models3d';
import { MODEL, SHOW_LENGTH_MM, MODEL_YAW, CHOPPER_PARTS, WHEELS, GUNS, BIKE_BACK, type GunSpec, crewTint, WRECK_TINT, wreckModel, wreckLength, phaseOf, CarRig, modelFile } from '../view/models-config';
import { DecalGeometry } from 'three/addons/geometries/DecalGeometry.js';
import { effects } from './beats';
import { HAZ_SIZE, carObjs, chopperObjs, hazardObjs, showFinish } from './board';
import { STAND_IN_AFTER_MS } from './carthumbs';
import { smokeOff, smokeOn, smokes } from './effects';
import { g } from './game';
import { drawHud } from './hud';
import { drawMarkers } from './markers';
import { registerTextures } from './quality';
import { drawMarking } from '../view/vector/markings';
import { layRig } from '../view/rigchain';
import { pruneHeaps } from './wreckage';
import { BOARD_X0, KX, MM, PITCH_W, TILE_H, TILE_T, TILE_W, pieces, scene, tileCache, tileSlots, world } from './stage';
import { S } from './state';
import { PartsRig } from './motion/rig';
import { buildTestVehicle, sheetSources, type VehicleSheet } from '../view/test-vehicles';
import { describeVehicle } from '../view/vehicle-rig';
import CAR_M from '../../assets/base/modelli/schede/car_m.json';
import CAR_S from '../../assets/base/modelli/schede/car_s.json';
import CAR_L from '../../assets/base/modelli/schede/car_l.json';
import RIG_FRONT from '../../assets/big_rig/modelli/schede/big_rig_front.json';
import RIG_MID from '../../assets/big_rig/modelli/schede/big_rig_mid.json';
import RIG_REAR from '../../assets/big_rig/modelli/schede/big_rig_rear.json';

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
 * It swivels toward `o.userData.aim` (a world yaw); at rest it points
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
/** One frame of a gun: it turns toward its aim (or back forward). No recoil (the user, 2026-11-20): the guns throw casings instead. */
export function driveGun(o: THREE.Object3D, carYaw: number, dt: number): void {
  const gun = o.userData.turret as THREE.Object3D | undefined;
  if (!gun) return;
  const aim = o.userData.aim as number | null | undefined;
  let want = aim === null || aim === undefined ? 0 : aim - carYaw;
  want = Math.atan2(Math.sin(want - gun.rotation.y), Math.cos(want - gun.rotation.y));
  gun.rotation.y += want * Math.min(1, dt * 12);
}

/** Shows or hides a piece's stand-in (the flames of a burning car and its marking stay as they are). */
function standIn(o: THREE.Group, on: boolean): void {
  for (const c of o.children) if (c !== o.userData.flames && c !== o.userData.marking && c !== o.userData.model) c.visible = on;
}
/**
 * Hides the stand-in (a flat block) while the model loads, so it is not seen while the models arrive
 * (asked by the user, 2026-11-18); it comes back only if the model cannot load or is late beyond
 * STAND_IN_AFTER_MS.
 */
function awaitModel(o: THREE.Group, load: Promise<THREE.Object3D | null>): void {
  if (o.userData.model) return;
  standIn(o, false);
  const back = (): void => { if (!o.userData.model) standIn(o, true); };
  const t = window.setTimeout(back, STAND_IN_AFTER_MS);
  void load.then(m => { if (!m) { window.clearTimeout(t); back(); } }, () => { window.clearTimeout(t); back(); });
}

/** Swaps a stand-in piece for its model once loaded, at its table length. */
export function useModel(o: THREE.Group, url: string, lengthMm: number, tint: Tint, id: string, dress?: (d: THREE.Object3D) => void): void {
  awaitModel(o, models.load(url));
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
    for (const c of o.children) if (c !== o.userData.flames && c !== o.userData.marking) c.visible = false;
    o.add(d);
    if (GUNS[url]) mountGun(o, d, GUNS[url]);
    dress?.(d);
    o.userData.modelHeight = size.y;
    o.userData.modelSize = size;
    o.userData.spin = (['rotorMain', 'rotorTail'] as const).map(n => d.getObjectByName(n)).filter(Boolean);
    o.userData.model = d;
    o.userData.phase = phaseOf(id);
  });
}

/** The assembly sheet of each Big Rig section (assets/big_rig/modelli/schede/, design/art/big-rig-prompts.md). */
const RIG_SHEETS = { front: RIG_FRONT, mid: RIG_MID, rear: RIG_REAR } as unknown as Record<RigSection, VehicleSheet>;

/**
 * Swaps a stand-in Big Rig section for its model, mounted from its parts as its sheet says (asked by
 * the user, 2026-11-20: the rig redrawn as three full sections, bodies, wheel and launcher each a
 * model of its own): one space long hitch to hitch, its middle on the stand-in's place, nose along
 * +x; wheels that roll and ride their suspensions, the tractor's front axle steering, its launcher
 * turning to its target. The parts take the crew's colour as every model does.
 */
function useRigModel(o: THREE.Group, part: RigSection, tint: Tint, id: string): void {
  // One space from hitch to hitch, whatever the table's measures.
  useSheetModel(o, RIG_SHEETS[part], tint, id, 2 * rigHalf() / RIG_SHEETS[part].length_m, part !== 'front');
}

/** The Medium Car's assembly sheet (assets/base/modelli/schede/car_m.json). */
const MEDIUM_CAR = CAR_M as unknown as VehicleSheet;
/** The Small Car's assembly sheet (assets/base/modelli/schede/car_s.json). */
const SMALL_CAR = CAR_S as unknown as VehicleSheet;
/** The Large Car's assembly sheet (assets/base/modelli/schede/car_l.json). */
const LARGE_CAR = CAR_L as unknown as VehicleSheet;

/**
 * Swaps a stand-in piece for the vehicle its assembly sheet describes, mounted from the models of
 * its parts (view/test-vehicles.ts), `scale` world units per metre of the sheet: nose along +x, its
 * parts moved by the parts rig (motion/rig.ts), its shots leaving from its muzzle. `trailer`: a
 * towed section, which has no engine running.
 */
function useSheetModel(o: THREE.Group, sheet: VehicleSheet, tint: Tint, id: string, scale: number, trailer = false): void {
  const files = sheetSources(sheet);
  const load = Promise.all(files.map(f => models.load(modelFile(f))));
  awaitModel(o, load.then(ms => (ms.every(Boolean) ? ms[0] : null)));
  void load.then(ms => {
    if (o.userData.model || ms.some(m => !m)) return;
    const sources: Record<string, THREE.Object3D> = {};
    // Only the parts with paint zones (the bodywork) take the crew's colour: dusty tyres and worn
    // gun metal are light enough to be painted over by mistake. The others get materials of their
    // own, so the glow of one car does not light another car's wheels and gun.
    const painted = new Set(sheet.parts.filter(p => Array.isArray(p.zones)).map(p => p.source));
    files.forEach((f, i) => { registerTextures(ms[i]!); sources[f] = painted.has(f) ? dressed(ms[i]!, tint) : ownMaterials(ms[i]!); });
    const d = buildTestVehicle(sheet, { crew: false, sources });
    d.traverse(x => { if ((x as THREE.Mesh).isMesh) x.castShadow = true; });
    d.scale.setScalar(scale);
    d.updateMatrixWorld(true);
    const size = new THREE.Box3().setFromObject(d).getSize(new THREE.Vector3());
    const parts = describeVehicle(d);
    o.userData.parts = new PartsRig(parts, d.scale.x);
    // The gun it fires from: its machine gun when it has one, otherwise its launcher.
    o.userData.muzzle = (parts.turrets.find(t => t.turret?.name === 'turret') ?? parts.turrets[0])?.muzzle ?? undefined;
    o.userData.trailer = trailer;
    o.userData.mats = collectMaterials(d);
    for (const c of o.children) if (c !== o.userData.flames && c !== o.userData.marking) c.visible = false;
    o.add(d);
    o.userData.modelHeight = size.y;
    o.userData.modelSize = size;
    o.userData.model = d;
    o.userData.phase = phaseOf(id);
  });
}

export function startSpot(v: { owner: number | null; size: 'S' | 'M' | 'L'; bike?: number; rig?: RigSection }): THREE.Vector3 {
  const n = g!.players.length;
  // The Big Rig waits assembled, front first, in its crew's lane of the starting area (BRaFF p3).
  if (v.rig) return new THREE.Vector3(BOARD_X0 - 0.7 - RIG_TRAIN.indexOf(v.rig) * RIG_GAP, TILE_T, ((v.owner ?? 0) - (n - 1) / 2) * 2.3);
  // The Final Five's five motorcycles stand closer together than the three cars.
  const lane = v.bike !== undefined ? (v.bike - 2) * 0.42 : ({ S: 0, M: 1, L: 2 }[v.size] - 1) * 0.74;
  const z = ((v.owner ?? 0) - (n - 1) / 2) * 2.3 + lane;
  return new THREE.Vector3(BOARD_X0 - 1.0, TILE_T, z);
}

/** The Big Rig's sections, front first, and how far apart they wait in the starting area (world units). */
const RIG_TRAIN: RigSection[] = ['front', 'mid', 'rear'];

type Spot = { r: number; c: number };
/** Half the distance between two spaces one after the other in a lane: a section's hitches are this far from its middle. */
const rigHalf = (): number => (world({ r: 0, c: 1 }).x - world({ r: 0, c: 0 }).x) / 2;

/** The heading of one step from `from` to `to`: 0 straight on, oblique for a lane change, 0 if it is no step. */
function stepYaw(from: Spot, to: Spot): number {
  const dc = to.c - from.c, dr = to.r - from.r;
  if (Math.abs(dr) > 1 || dc < 0 || dc > 1 || (dr === 0 && dc === 0)) return 0;
  const a = world(from), b = world(to);
  return Math.abs(b.z - a.z) < 1e-3 ? 0 : Math.atan2(-(b.z - a.z), b.x - a.x);
}
const RIG_GAP = 0.95;

/** How far apart, across the road, the vehicles sharing a space with a motorcycle stand (world units). */
const BESIDE = 0.3;

/**
 * The marking of a Final Five motorcycle (BRaFF p7) printed on the back of its rider's jacket, as a
 * decal that follows the jacket's shape (asked by the user, 2026-11-18: floating over the motorcycle it
 * hid it). It rides on the body, so it leans and shakes with it. `d`: the fitted model, not yet on the table.
 */
function printMarking(d: THREE.Object3D, k: number): void {
  let body: THREE.Mesh | null = null;
  d.traverse(o => { if ((o as THREE.Mesh).isMesh && o.userData.body && !body) body = o as THREE.Mesh; });
  if (!body) d.traverse(o => { if ((o as THREE.Mesh).isMesh && !body) body = o as THREE.Mesh; });
  const mesh = body as THREE.Mesh | null;
  if (!mesh) return;
  d.updateMatrixWorld(true);
  const m = mesh.matrixWorld;
  const at = new THREE.Vector3(...BIKE_BACK.at).applyMatrix4(m);
  const out = new THREE.Vector3(...BIKE_BACK.normal).transformDirection(m);
  const scale = new THREE.Vector3().setFromMatrixScale(m).x;
  const hit = new THREE.Raycaster(at.clone().addScaledVector(out, scale), out.clone().negate()).intersectObject(mesh, false)[0];
  if (!hit) return;
  const aim = new THREE.Object3D();
  aim.position.copy(hit.point);
  aim.lookAt(hit.point.clone().add(out));
  const size = BIKE_BACK.size * scale;
  const geo = new DecalGeometry(mesh, hit.point, aim.rotation, new THREE.Vector3(size, size, size));
  geo.applyMatrix4(m.clone().invert());
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  if (ctx) drawMarking(ctx, k, 128, '#f3e9d2');
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const print = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }));
  print.name = 'marking';
  mesh.add(print);
}

/** The off-road patches the Big Rig left, by space. */
const offroadObjs = new Map<string, THREE.Mesh>();
/** A patch of churned dirt the size of a space, slightly different on each space. */
function offroadPatch(k: string): THREE.Mesh {
  const r = GRID.pitch * KX * 0.5;
  const geo = new THREE.CircleGeometry(r, 6);
  geo.rotateX(-Math.PI / 2);
  geo.rotateY(Math.PI / 6 + (k.length % 3) * 0.05);
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x5a4330, roughness: 1, transparent: true, opacity: 0.82 }));
  m.renderOrder = 1;
  return m;
}

/** Everything: the table as the rules have it now, the highlights and the interface. */
export function render(): void {
  if (!g) return;
  const snap = snapshot(g);
  if (!S.playing) S.restSnap = snap;
  drawTable(snap);
  drawMarkers();
  drawHud();
}

/** Draws the table from a snapshot (the rules' state now, or a beat being replayed). */
export function drawTable(s: Snapshot): void {
  if (!g) return;
  S.lastSnap = s;
  showTiles(s);
  pruneHeaps(s); // the heaps of destroyed cars: gone with an undo, another game or their tile
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
  // Spaces the Big Rig churned into off-road (BRaFF p5): a patch of broken ground over the printed space.
  const rough = new Set(s.offroad ?? []);
  for (const [k, m] of offroadObjs) if (!rough.has(k)) { scene.remove(m); offroadObjs.delete(k); }
  for (const k of rough) {
    let m = offroadObjs.get(k);
    if (!m) { m = offroadPatch(k); offroadObjs.set(k, m); scene.add(m); }
    const [r, c] = k.split(',').map(Number);
    m.position.copy(world({ r, c }));
    m.position.x += GRID.tip / 2 * KX;
    m.position.y += 0.002;
  }
  // A hazard discarded after resolving (mine, wreck) stays face up for a moment, then goes.
  for (const [k, rec] of hazardObjs) if (!hz.has(k) && rec.gone === undefined) {
    rec.obj.setFaceUp(true);
    rec.gone = performance.now() / 1000 + 1.6;
  }

  const seen = new Set<string>();
  const stackCount = new Map<string, number>();
  // A motorcycle and the vehicles in its space stand side by side, not stacked (BRaFF p7).
  const shared = new Map<string, { n: number; bike: boolean }>();
  for (const v of s.vehicles) if (v.status !== 'elim' && v.pos) {
    const k = `${v.pos.r},${v.pos.c}`, e = shared.get(k) ?? { n: 0, bike: false };
    shared.set(k, { n: e.n + 1, bike: e.bike || (v.bike !== undefined && !v.isWreck) });
  }
  const now = performance.now() / 1000;
  for (const v of [...s.vehicles].filter(x => x.status !== 'elim').sort((a, b) => a.z - b.z)) {
    seen.add(v.id);
    let o = carObjs.get(v.id);
    if (!o) {
      const comp = v.isWreck ? ofKind(CAT, 'wreck')[0] : ofKind(CAT, 'car', { car_size: v.size })[0];
      o = pieces.car(comp.size_mm, v.owner === null ? '#222' : g.players[v.owner].color, v.isWreck);
      if (v.isWreck) useModel(o, wreckModel(v.id), wreckLength(v.id), WRECK_TINT, v.id);
      else if (v.bike !== undefined) {
        const k = v.bike;
        useModel(o, MODEL.motorcycle, SHOW_LENGTH_MM.bike, crewTint(g.players[v.owner!].color), v.id, d => printMarking(d, k));
        o.userData.bike = true;
      } else if (v.rig) useRigModel(o, v.rig, crewTint(g.players[v.owner!].color), v.id);
      // The Medium Car is mounted from its parts (the pilot of the structured models, phase 7).
      else if (v.size === 'M') useSheetModel(o, MEDIUM_CAR, crewTint(g.players[v.owner!].color), v.id, SHOW_LENGTH_MM.M * MM / MEDIUM_CAR.length_m);
      // The Small Car (the Doom Buggy) too, 2026-11-20.
      else if (v.size === 'S') useSheetModel(o, SMALL_CAR, crewTint(g.players[v.owner!].color), v.id, SHOW_LENGTH_MM.S * MM / SMALL_CAR.length_m);
      // And the Large Car (the Eliminator).
      else if (v.size === 'L') useSheetModel(o, LARGE_CAR, crewTint(g.players[v.owner!].color), v.id, SHOW_LENGTH_MM.L * MM / LARGE_CAR.length_m);
      else useModel(o, MODEL.car[v.size], SHOW_LENGTH_MM[v.size], crewTint(g.players[v.owner!].color), v.id);
      carObjs.set(v.id, o);
      scene.add(o);
      o.position.copy(v.pos ? world(v.pos) : startSpot(v));
    }
    o.userData.id = v.id;
    // Its Big Rig section and its crew, for the gun that fires (effects.ts: the rear arc is the rear gun's).
    o.userData.rigSection = v.rig;
    o.userData.owner = v.owner;
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
      const here = shared.get(k)!;
      target = here.bike
        ? world(v.pos).add(new THREE.Vector3(0, hz.has(k) ? HAZ_SIZE.thickness : 0, (n - (here.n - 1) / 2) * BESIDE))
        : world(v.pos).add(new THREE.Vector3(n * 0.12, (hz.has(k) ? HAZ_SIZE.thickness : 0) + n * 0.55, n * 0.08));
    } else target = startSpot(v);
    o.userData.target = target;
    // Its first space: it is put there, it does not drive in from the starting area (asked by the
    // user, 2026-11-20: "il primo passo di ogni macchina deve partire direttamente dalla prima casella").
    if (o.userData.offRoad && v.pos) { o.position.x = target.x; o.position.z = target.z; o.userData.yaw = 0; }
    o.userData.offRoad = !v.pos;
    if (v.rig) { o.userData.restYaw = 0; delete o.userData.hitch; }
    // Inoperable: on one side (the game picks which, each time), smoking. A repair puts it back on its wheels.
    const inop = v.status === 'inop' && !v.isWreck;
    if (inop && !o.userData.flip) o.userData.flipSide = Math.random() < 0.5 ? -1 : 1;
    o.userData.flip = inop ? 1 : 0;
    o.userData.height = o.userData.modelHeight ?? (v.isWreck ? ofKind(CAT, 'wreck')[0] : ofKind(CAT, 'car', { car_size: v.size })[0]).size_mm[2] * MM;
    if (inop) smokeOn(v.id, o, Infinity, false); else if (smokes.get(v.id)?.until === Infinity) smokeOff(v.id);
    o.userData.active = v.id === s.activeCar;
    o.userData.ownerColor = v.owner === null ? null : g.players[v.owner].color;
  }
  // The Big Rig lies as a hitched chain (src/view/rigchain.ts; asked by the project owner, 2026-11-18):
  // the front cab at the heading of its last step (the space it came from is the one the mid section
  // holds now: the rig moves like a train), the trailers turned as the hitches need, the whole chain
  // nearest the spaces its sections stand on. While it moves the trailers are pulled on their hitches
  // (cars.ts, hitchTrains). A section still waiting off the road is not in the chain.
  for (const front of s.vehicles) {
    if (front.rig !== 'front' || front.status === 'elim' || !front.pos) continue;
    const train = [{ v: front, o: carObjs.get(front.id)! }];
    // Sections still in the starting area (the first steps: the rules move the rig like a train, so
    // they come onto the road one step after the other) trail straight behind, hitched, and are
    // pulled in with the rest: left waiting, the cab drove off alone (seen by the user, 2026-11-18).
    const waiting: { o: THREE.Object3D }[] = [];
    for (const sec of RIG_TRAIN.slice(1)) {
      const v = s.vehicles.find(x => x.owner === front.owner && x.rig === sec && x.status !== 'elim');
      if (!v) break;
      if (!v.pos) { if (v.inStart) waiting.push({ o: carObjs.get(v.id)! }); continue; }
      if (waiting.length) break;
      train.push({ v, o: carObjs.get(v.id)! });
    }
    const half = rigHalf();
    const laid = layRig(train.map(t => { const p = t.o.userData.target as THREE.Vector3; return { x: p.x, z: p.z }; }),
      train.length > 1 ? stepYaw(train[1].v.pos!, front.pos) : 0, half);
    train.forEach((t, i) => {
      (t.o.userData.target as THREE.Vector3).setX(laid[i].x).setZ(laid[i].z);
      t.o.userData.restYaw = laid[i].yaw;
      if (i > 0) t.o.userData.hitch = { ahead: train[i - 1].o, half, order: i };
    });
    let last = laid[laid.length - 1], ahead: THREE.Object3D = train[train.length - 1].o;
    waiting.forEach((w, k) => {
      // Straight along the road behind the last section: its rear hitch, then half a section more.
      const x = last.x - half * (Math.cos(last.yaw) + 1), z = last.z + half * Math.sin(last.yaw);
      (w.o.userData.target as THREE.Vector3).setX(x).setZ(z);
      w.o.userData.restYaw = 0;
      w.o.userData.hitch = { ahead, half, order: train.length + k };
      last = { x, z, yaw: 0 };
      ahead = w.o;
    });
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
