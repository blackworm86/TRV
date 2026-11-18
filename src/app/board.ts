// What stands on the table: the picking plane, the finish line, the maps of car, chopper and
// hazard objects, hazard and dice sizes, the FX dice supply and the marker shapes.

import * as THREE from 'three';
import { tileDef, TILE_COLS, type Snapshot } from '../game/trv/engine';
import { BASE_CATALOG as CAT, sizeOf } from '../game/trv/catalog';
import { buildFinish, buildTile, hazardToken, GRID } from '../view/board3d';
import { FINISH_LINES } from '../view/terrain/finish3d';
import { type Die3D } from '../view/dice3d';
import type { Throw } from '../view/dice-throw';
import { BOARD_X0, KX, KZ, MM, PITCH_W, TILE_H, TILE_T, TILE_W, scene } from './stage';

export const pickPlane = new THREE.Mesh(new THREE.PlaneGeometry(140, 80), new THREE.MeshBasicMaterial({ visible: false }));
pickPlane.rotation.x = -Math.PI / 2;
pickPlane.position.y = TILE_T;
scene.add(pickPlane);

// The finish line: the piece that locks into the lead tile once the final tile is out. Which of
// the four (data/trv/finish_lines.json) is the game's own; built the first time it is shown.
const FINISH_ART = import.meta.glob<string>('/assets/base/traguardi/*.webp', { eager: true, query: '?url', import: 'default' });
let finish: THREE.Group | null = null, finishShown = -1;
/** Shows the game's finish line past the lead tile, or takes it off the table. */
export function showFinish(on: boolean, index: number): void {
  if (finish && (!on || finishShown !== index)) { scene.remove(finish); finish = null; }
  if (!on || finish) return;
  const line = FINISH_LINES[index % FINISH_LINES.length];
  const art = Object.entries(FINISH_ART).find(([path]) => path.endsWith(`/${line.id}.webp`))?.[1];
  finish = buildFinish(line, { width: TILE_W, depth: TILE_H, thickness: TILE_T, ...(art ? { art } : {}) });
  // Where a fourth tile would lie: its rows are the lead tile's rows going on.
  finish.position.set(BOARD_X0 + 3 * PITCH_W + (GRID.frameW / 2) * KX, 0, 0);
  finishShown = index;
  scene.add(finish);
}

export const carObjs = new Map<string, THREE.Group>();
export const chopperObjs = new Map<number, THREE.Group>();
export const hazardObjs = new Map<string, { type: string; obj: ReturnType<typeof hazardToken>; gone?: number; ground?: string }>();
export const HAZ = sizeOf(CAT, 'hazard_token');
// A hazard token has the shape and size of a road space (asked by the user), so it covers it.
export const HAZ_FILL = 0.96;
export const HAZ_SIZE = { length: (GRID.pitch + GRID.tip) * KX * HAZ_FILL, depth: GRID.rowPitch * KZ * HAZ_FILL, thickness: HAZ[2] * MM };
export const markerGroup = new THREE.Group();
scene.add(markerGroup);
// Dice tray: this turn's FX dice roll onto the table just below the road.
export const DIE_W = sizeOf(CAT, 'die')[0] * MM;
// Rolled dice are shown at twice their size, so their faces read from the camera.
export const TRAY_SCALE = 2;
/** FX dice land among the cars: a little smaller than the player's own, so they hide less of the road. */
export const FX_SCALE = 1.6;
export const TRAY_Z = TILE_H / 2 + 0.9;
/** One FX die on the table and its current flight: from `from` to `to`, turning from q0 to q1, `t` from 0 to 1 over `dur` seconds, rising `hop` on the way. */
export interface TableDie { kind: string; d: Die3D; from: THREE.Vector3; to: THREE.Vector3; q0: THREE.Quaternion; q1: THREE.Quaternion; t: number; dur: number; hop: number; throw?: Throw | null; struck?: boolean }
/**
 * The FX dice: one copy of each, as in the box (asked by the user, 2026-11-16). They rest in a row
 * off the board, beside the player's own dice; a roll throws the die to the action, and once the
 * effect is over it goes back to its resting place.
 */
export const fxSupply = new Map<string, TableDie>();
/** The FX dice out on the road for the effect being played, in the order they were thrown. */
/** When the dice out on the road go back to rest (seconds, performance clock), or null. */
export const FX_ORDER = ['road', 'stunt', 'slam', 'shooting', 'direction', 'fire'];
export const FORWARD = new THREE.Vector3(1, 0, 0), AWAY = new THREE.Vector3(0, 0, -1);
export const ringGeo = new THREE.RingGeometry(0.42, 0.56, 32);
export const carRingGeo = new THREE.RingGeometry(0.55, 0.78, 40);
export interface Marker { mesh: THREE.Mesh; option: number; at: THREE.Vector3 }
