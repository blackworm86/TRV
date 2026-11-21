// A vehicle mounted from the models of its parts, as its assembly sheets say, outside a game: for the
// asset gallery and the model check page. The game mounts its own in app/pieces.ts (`useSheetModel`),
// with the parts rig, the stand-in and the rest of what a piece on the table needs.

import * as THREE from 'three';
import { dressed, ownMaterials, type ModelBank, type Tint } from './models3d';
import { buildTestVehicle, sheetSources, type VehicleSheet } from './test-vehicles';

/**
 * The vehicles of `sheets` one after the other along +x, the first ahead (a Big Rig's sections; one sheet
 * for a car), in metres, the whole centred on its length. Only the parts with paint zones take the crew's
 * colour, as in the game. `file` gives a model's address by its file name; null when a model is missing.
 */
export async function mountSheets(bank: ModelBank, file: (name: string) => string, sheets: VehicleSheet[], tint: Tint): Promise<THREE.Group | null> {
  const parts = await Promise.all(sheets.map(async sheet => {
    const files = sheetSources(sheet);
    const ms = await Promise.all(files.map(f => bank.load(file(f))));
    if (ms.some(m => !m)) return null;
    const painted = new Set(sheet.parts.filter(p => Array.isArray(p.zones)).map(p => p.source));
    const sources: Record<string, THREE.Object3D> = {};
    files.forEach((f, i) => { sources[f] = painted.has(f) ? dressed(ms[i]!, tint) : ownMaterials(ms[i]!); });
    return buildTestVehicle(sheet, { crew: false, sources });
  }));
  if (parts.some(p => !p)) return null;
  const all = new THREE.Group();
  let x = sheetsLength(sheets) / 2;
  parts.forEach((p, i) => { p!.position.x = x - sheets[i].length_m / 2; x -= sheets[i].length_m; all.add(p!); });
  all.traverse(o => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
  return all;
}

/** The length of `sheets` end to end, metres. */
export const sheetsLength = (sheets: VehicleSheet[]): number => sheets.reduce((n, s) => n + s.length_m, 0);
