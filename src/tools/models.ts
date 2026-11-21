// Model check: the generated GLB pieces at table scale, one row per piece type, one column per
// crew colour, next to the procedural stand-in and the untinted model, with idle motion and rotors.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { BASE_CATALOG as CAT, sizeOf, ofKind } from '../game/trv/catalog';
import { Pieces, TextureBank } from '../view/pieces3d';
import { ModelBank, dressed, fitToLength, splitParts, splitWheels, type Tint } from '../view/models3d';
import { mountSheets, sheetsLength } from '../view/sheet-model';
import type { VehicleSheet } from '../view/test-vehicles';
import CAR_S from '../../assets/base/modelli/schede/car_s.json';
import CAR_M from '../../assets/base/modelli/schede/car_m.json';
import CAR_L from '../../assets/base/modelli/schede/car_l.json';
import RIG_FRONT from '../../assets/big_rig/modelli/schede/big_rig_front.json';
import RIG_MID from '../../assets/big_rig/modelli/schede/big_rig_mid.json';
import RIG_REAR from '../../assets/big_rig/modelli/schede/big_rig_rear.json';
import { modelFile, MODEL, SHOW_LENGTH_MM, MODEL_YAW, CHOPPER_PARTS, ROTOR_SPEED, crewTint, WRECK_TINT, WRECK_LENGTH_MM, phaseOf, hover, CarRig, WHEELS } from '../view/models-config';

const TILE_MM = sizeOf(CAT, 'road_tile');
const MM = 13.14 / TILE_MM[0];
/** Every crew's colour, in the catalogue's order. */
const CREWS = CAT.crews.map(c => c.color);

const renderer = new THREE.WebGLRenderer({ antialias: true, stencil: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x2a2019);
scene.add(new THREE.HemisphereLight(0xfff3e0, 0x3a2a20, 1.6));
const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.position.set(3, 6, 4);
scene.add(sun);
const camera = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, 0.05, 100);
camera.position.set(3.5, 9, 13);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(3.5, 0, 3);
controls.update();

const pieces = new Pieces(MM, new TextureBank(renderer.capabilities.getMaxAnisotropy()));
const models = new ModelBank();

interface Row { label: string; url: string; show: number; kind: 'car' | 'chopper' | 'wreck'; stand: () => THREE.Group }
const ROWS: Row[] = [
  // The cars and the Big Rig are mounted from their parts: the bench (bench.html) checks those.
  { label: 'moto', url: MODEL.motorcycle, show: SHOW_LENGTH_MM.bike, kind: 'car', stand: () => new THREE.Group() },
  { label: 'elicottero', url: MODEL.chopper, show: SHOW_LENGTH_MM.chopper, kind: 'chopper', stand: () => pieces.chopper(sizeOf(CAT, 'chopper'), '#ec9230') },
  ...MODEL.wrecks.map((url, i) => ({
    label: `relitto ${i + 1}`, url, show: WRECK_LENGTH_MM[i] ?? SHOW_LENGTH_MM.wreck, kind: 'wreck' as const,
    stand: () => pieces.car(ofKind(CAT, 'wreck')[0].size_mm, '#222', true),
  })),
];

const live: { model: THREE.Object3D; holder: THREE.Group; kind: 'car' | 'chopper'; phase: number; height: number; spin: THREE.Object3D[]; rig?: CarRig; x0: number; z0: number; lastV: number; yaw: number }[] = [];
// ?drive: the cars drive back and forth and change lane, to check wheels, steering and springs.
const DRIVE_TEST = new URLSearchParams(location.search).has('drive');
const out: string[] = [];

ROWS.forEach((row, r) => {
  const z = r * 1.5;
  const stand = row.stand();
  stand.position.set(-1.2, 0, z);
  scene.add(stand);
  void models.load(row.url).then(m => {
    if (!m) { out.push(`${row.label}: manca il file`); show(); return; }
    if (!m.userData.split) {
      if (row.kind === 'chopper') splitParts(m, CHOPPER_PARTS);
      else if (WHEELS[row.url]) splitWheels(m, WHEELS[row.url]);
      m.userData.split = true;
    }
    const tints: (Tint | null)[] = row.kind === 'wreck' ? [WRECK_TINT] : [...CREWS.map(c => crewTint(c, row.kind === 'chopper')), null];
    tints.forEach((tint, i) => {
      const d = tint ? dressed(m, tint) : m.clone(true);
      const size = fitToLength(d, row.show * MM, MODEL_YAW);
      const holder = new THREE.Group();
      holder.add(d);
      holder.position.set(i * 1.6 + 0.6, 0, z);
      scene.add(holder);
      if (row.kind !== 'wreck') {
        const phase = phaseOf(`${row.label}${i}`);
        live.push({ model: d, holder, kind: row.kind, phase, height: size.y, x0: holder.position.x, z0: z, lastV: 0, yaw: 0,
          rig: WHEELS[row.url] ? new CarRig(d, d.scale.x, size.y, phase) : undefined,
          spin: ['rotorMain', 'rotorTail'].map(n => d.getObjectByName(n)).filter((x): x is THREE.Object3D => !!x) });
      }
      if (i === 0) out.push(`${row.label}: ${(size.x / MM).toFixed(0)} × ${(size.z / MM).toFixed(0)} × ${(size.y / MM).toFixed(0)} mm`);
    });
    show();
  });
});
// The vehicles mounted from their parts (the cars, the Big Rig), one per crew colour, behind the others:
// the cars a row each, the Big Rig three to a row (it is three spaces long).
const SHEET_ROWS: { label: string; sheets: VehicleSheet[]; mm: number }[] = [
  { label: 'auto S', sheets: [CAR_S as unknown as VehicleSheet], mm: SHOW_LENGTH_MM.S },
  { label: 'auto M', sheets: [CAR_M as unknown as VehicleSheet], mm: SHOW_LENGTH_MM.M },
  { label: 'auto L', sheets: [CAR_L as unknown as VehicleSheet], mm: SHOW_LENGTH_MM.L },
  { label: 'big rig', sheets: [RIG_FRONT, RIG_MID, RIG_REAR] as unknown as VehicleSheet[], mm: 3 * TILE_MM[0] / 8 },
];
SHEET_ROWS.forEach((row, r) => {
  CREWS.forEach((color, i) => {
    void mountSheets(models, modelFile, row.sheets, crewTint(color)).then(all => {
      if (!all) { if (i === 0) { out.push(`${row.label}: manca un modello`); show(); } return; }
      all.scale.setScalar(row.mm * MM / sheetsLength(row.sheets));
      const rig = row.sheets.length > 1;
      all.position.set(rig ? (i % 3) * 5.6 + 2.8 : i * 1.6 + 0.6, 0, rig ? -6 - Math.floor(i / 3) * 1.6 : -(r + 1) * 1.5);
      scene.add(all);
    });
  });
});
function show(): void { document.getElementById('info')!.textContent = out.join('\n'); }

addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });
const clock = new THREE.Timer();
renderer.setAnimationLoop(t => {
  clock.update(t);
  const dt = clock.getDelta();
  const now = performance.now() / 1000;
  for (const p of live) {
    if (p.kind === 'chopper') hover(p.model, now, p.phase, p.height);
    if (p.rig) {
      let fwd = 0, turn = 0, rate = 0;
      if (DRIVE_TEST) {
        // Out and back along the road, with a lane change on the way out.
        const u = now * 0.5 + p.phase;
        const nx = p.x0 + Math.sin(u) * 0.5, nz = p.z0 + Math.sin(u * 2) * 0.12 * (Math.cos(u) > 0 ? 1 : 0);
        const dx = nx - p.holder.position.x, dz = nz - p.holder.position.z;
        const dist = Math.hypot(dx, dz);
        const reverse = dx < 0;
        let want = dist / Math.max(dt, 1e-4) > 0.05 ? Math.atan2(-dz, dx) : 0;
        if (reverse) want = want > 0 ? want - Math.PI : want + Math.PI;
        turn = want - p.yaw;
        const ny = p.yaw + turn * Math.min(1, dt * 9);
        rate = (ny - p.yaw) / Math.max(dt, 1e-4);
        p.yaw = ny;
        p.holder.position.set(nx, 0, nz);
        p.holder.rotation.y = ny;
        fwd = dist * (reverse ? -1 : 1);
      }
      const v = fwd / Math.max(dt, 1e-4);
      p.rig.update(dt, now, fwd, (v - p.lastV) / Math.max(dt, 1e-4), turn, rate, true);
      p.lastV = v;
    }
    for (const r of p.spin) { if (r.name === 'rotorMain') r.rotation.y += dt * ROTOR_SPEED.rotorMain; else r.rotation.z += dt * ROTOR_SPEED.rotorTail; }
  }
  renderer.render(scene, camera);
});
(window as unknown as { view: unknown }).view = { camera, controls, scene, THREE };
