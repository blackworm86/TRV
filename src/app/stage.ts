// The 3D stage: renderer, scene, camera and its controls, lights, the table, the physical
// measures of the pieces, and where a road space is in the world.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TILE_COLS, type Pos } from '../game/trv/engine';
import { BASE_CATALOG as CAT, sizeOf } from '../game/trv/catalog';
import { Pieces, TextureBank } from '../view/pieces3d';
import { spaceCenterPx, GRID, TILE_PITCH_PX } from '../view/board3d';


// stencil: the revealed pit trap opens a hole through the board (terrain/pit3d.ts).
export const renderer = new THREE.WebGLRenderer({ antialias: true, stencil: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.prepend(renderer.domElement);

export const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a120c);
export const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 200);
export const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
// The table only pans and zooms (asked by the user): no orbiting. Closer to the ground the view
// tilts a little toward the horizon (see tiltView).
controls.enableRotate = false;
controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN };
controls.screenSpacePanning = false; // pan along the table, not the screen
controls.maxPolarAngle = Math.PI / 2;
controls.minDistance = 4;
controls.maxDistance = 90;

scene.add(new THREE.HemisphereLight(0xfff1dc, 0x3a2414, 1.1));
export const lamp = new THREE.DirectionalLight(0xffe2b8, 2.0);
lamp.position.set(-10, 30, 14);
lamp.castShadow = true;
lamp.shadow.mapSize.set(4096, 2048);
Object.assign(lamp.shadow.camera, { left: -30, right: 30, top: 16, bottom: -16 });
lamp.shadow.bias = -0.0004;
scene.add(lamp);
export const table = new THREE.Mesh(new THREE.PlaneGeometry(140, 80), new THREE.MeshStandardMaterial({ color: 0x4a2f1c, roughness: 0.85 }));
table.rotation.x = -Math.PI / 2;
table.receiveShadow = true;
scene.add(table);

// One scale for the whole table (world units per mm), from the road tile's catalog length.
export const TILE_MM = sizeOf(CAT, 'road_tile');
export const MM = 13.14 / TILE_MM[0];
export const TILE_W = TILE_MM[0] * MM, TILE_H = TILE_MM[1] * MM, TILE_T = TILE_MM[2] * MM;
export const KX = TILE_W / GRID.frameW, KZ = TILE_H / GRID.frameH;
export const PITCH_W = TILE_PITCH_PX * KX; // tiles interlock: one tile every 8 columns
export const BOARD_X0 = -1.5 * PITCH_W;
export const bank = new TextureBank(renderer.capabilities.getMaxAnisotropy());
export const pieces = new Pieces(MM, bank);

/** World position of a space centre (columns run across the three tiles), on the tile's ground. */
export function world(p: Pos): THREE.Vector3 {
  const slot = Math.floor(p.c / TILE_COLS);
  const [px, py] = spaceCenterPx(p.r, p.c - slot * TILE_COLS);
  // A relief tile (official terrain maps) has sand above and mud below its asphalt.
  const ground = (tileSlots[slot]?.userData.heightAt as ((x: number, y: number) => number) | undefined)?.(px, py) ?? 0;
  return new THREE.Vector3(BOARD_X0 + slot * PITCH_W + px * KX, TILE_T + ground, (py - GRID.frameH / 2) * KZ);
}

// Road tiles built from the terrain data, cached per face.
export const tileCache = new Map<string, THREE.Group>();
export const tileSlots: (THREE.Group | null)[] = [null, null, null];
