// The Big Rig mounted from its parts (assets/big_rig/modelli/schede/big_rig_*.json, built by
// src/view/test-vehicles.ts with the models of its parts): the naming contract, the hitches one
// space apart, the wheels on the ground, the parts' models placed as the sheets say.
// The real models are not loaded here: a box stands for each, nose toward -x as Meshy makes them.
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildTestVehicle, sheetSources, type VehicleSheet } from '../../../src/view/test-vehicles';
import { describeVehicle, missingParts, type Capability } from '../../../src/view/vehicle-rig';
import FRONT from '../../../assets/big_rig/modelli/schede/big_rig_front.json';
import MID from '../../../assets/big_rig/modelli/schede/big_rig_mid.json';
import REAR from '../../../assets/big_rig/modelli/schede/big_rig_rear.json';
import CAR_M from '../../../assets/base/modelli/schede/car_m.json';

/** The Big Rig's sections and the Medium Car (the pilot, phase 7): every vehicle mounted from the models of its parts. */
const SHEETS = { front: FRONT, mid: MID, rear: REAR, car_m: CAR_M } as unknown as Record<string, VehicleSheet>;
/** Half a space, in the sheets' metres: where a section's hitches are from its middle. */
const HALF_SPACE = 3;
/** The size of the box standing for a part's model (model units) and of the one standing for the wheel. */
const PART_BOX: [number, number, number] = [0.95, 0.4, 0.4];
const WHEEL_DIAMETER = 0.92;

/** A box standing for each model the sheet names; the wheel a disc-sized box off its origin. */
function standIns(sheet: VehicleSheet): Record<string, THREE.Object3D> {
  const out: Record<string, THREE.Object3D> = {};
  for (const f of sheetSources(sheet)) {
    const wheel = /wheel/.test(f);
    const m = new THREE.Mesh(new THREE.BoxGeometry(...(wheel ? [WHEEL_DIAMETER, WHEEL_DIAMETER, 0.37] as const : PART_BOX)), new THREE.MeshBasicMaterial());
    if (wheel) m.position.set(0.01, -0.02, 0.03);
    out[f] = new THREE.Group().add(m);
  }
  return out;
}
const build = (sheet: VehicleSheet): THREE.Group => buildTestVehicle(sheet, { crew: false, sources: standIns(sheet) });
const at = (o: THREE.Object3D): THREE.Vector3 => o.getWorldPosition(new THREE.Vector3());

describe('Big Rig sheets', () => {
  it.each(Object.keys(SHEETS))('%s: has every part its capabilities need, read by the parts descriptor', name => {
    // Arrange
    const sheet = SHEETS[name];
    // Act
    const d = describeVehicle(build(sheet));
    // Assert
    expect(d.source).toBe('named');
    expect(missingParts(d, sheet.capabilities as Capability[])).toEqual([]);
    expect([...d.capabilities].sort()).toEqual([...sheet.capabilities].sort());
  });

  it('the hitches are half a space from each section middle, so the sections follow one space apart', () => {
    // Arrange, Act
    const front = describeVehicle(build(SHEETS.front)), mid = describeVehicle(build(SHEETS.mid)), rear = describeVehicle(build(SHEETS.rear));
    // Assert
    expect(at(front.hitches.rear!).x).toBeCloseTo(-HALF_SPACE, 6);
    expect(at(mid.hitches.front!).x).toBeCloseTo(HALF_SPACE, 6);
    expect(at(mid.hitches.rear!).x).toBeCloseTo(-HALF_SPACE, 6);
    expect(at(rear.hitches.front!).x).toBeCloseTo(HALF_SPACE, 6);
    expect(rear.hitches.rear).toBe(null);
  });

  it.each(Object.keys(SHEETS))('%s: every wheel model is as large as its radius, centred on its node and on the ground', name => {
    // Arrange
    const sheet = SHEETS[name];
    // Act
    const d = describeVehicle(build(sheet));
    // Assert
    expect(d.wheels.length).toBeGreaterThanOrEqual(4);
    for (const w of d.wheels) {
      const box = new THREE.Box3().setFromObject(w.roll), mid = box.getCenter(new THREE.Vector3()), hub = at(w.roll);
      expect(box.max.y - box.min.y).toBeCloseTo(2 * w.radius, 6);
      expect(mid.distanceTo(hub)).toBeLessThan(1e-6);
      expect(box.min.y).toBeCloseTo(0, 6);
    }
  });

  it('the tractor steers with its front axle only; its machine gun and its launcher each have their own muzzle', () => {
    // Arrange, Act
    const d = describeVehicle(build(SHEETS.front));
    // Assert
    expect(d.wheels.filter(w => w.steer).map(w => w.axle)).toEqual([0, 0]);
    expect(d.wheels.filter(w => w.axle === 0).every(w => at(w.roll).x > 0)).toBe(true);
    expect(d.turrets.map(t => [t.turret?.name, t.muzzle?.userData.weapon])).toEqual([['turret', 'mg'], ['launcher', 'missile']]);
    // The gun is on the hood, ahead of the launcher, its muzzle ahead of its pivot.
    const gun = d.turrets[0], launcher = d.turrets[1];
    expect(at(gun.turret!).x).toBeGreaterThan(at(launcher.turret!).x);
    expect(at(gun.muzzle!).x).toBeGreaterThan(at(gun.turret!).x);
  });

  it('the rear section carries a machine gun mounted facing backward, its muzzle behind its pivot', () => {
    // Arrange, Act
    const d = describeVehicle(build(SHEETS.rear));
    // Assert
    expect(d.turrets).toHaveLength(1);
    expect(d.turrets[0].turret?.userData.facing).toBeCloseTo(Math.PI, 5);
    expect(at(d.turrets[0].muzzle!).x).toBeLessThan(at(d.turrets[0].turret!).x);
  });

  it('the Medium Car has two axles, the front one steering, and its gun on the hood ahead of its middle', () => {
    // Arrange, Act
    const d = describeVehicle(build(SHEETS.car_m));
    // Assert
    expect(d.wheels).toHaveLength(4);
    expect(d.wheels.filter(w => w.steer).map(w => w.axle)).toEqual([0, 0]);
    expect(at(d.turrets[0].turret!).x).toBeGreaterThan(0);
    expect(at(d.turrets[0].muzzle!).x).toBeGreaterThan(at(d.turrets[0].turret!).x);
  });

  it('a part model is turned half round (the models have their nose toward -x) and scaled as its sheet says', () => {
    // Arrange
    const sheet = SHEETS.mid, body = sheet.parts.find(p => p.node === 'body')!;
    const sources = standIns(sheet);
    // A mark on the nose of the stand-in, at -x.
    const mark = new THREE.Object3D();
    mark.name = 'nose';
    mark.position.set(-PART_BOX[0] / 2, 0, 0);
    sources[body.source!].add(mark);
    // Act
    const v = buildTestVehicle(sheet, { crew: false, sources });
    const box = new THREE.Box3().setFromObject(v.getObjectByName('body_mesh')!);
    // Assert
    expect(at(v.getObjectByName('nose')!).x).toBeCloseTo(PART_BOX[0] / 2 * body.mesh!.scale + (body.mesh!.at?.[0] ?? 0), 5);
    expect(box.max.x - box.min.x).toBeCloseTo(PART_BOX[0] * body.mesh!.scale, 5);
  });

  it('a sheet built without its models falls back to shapes, and names no model for a shape part', () => {
    // Arrange, Act
    const v = buildTestVehicle(SHEETS.front, { crew: false });
    // Assert: the nodes are there (the game can still place and tow it), with nothing drawn for the missing models.
    expect(v.getObjectByName('body')).toBeDefined();
    expect(v.getObjectByName('body_mesh')).toBeUndefined();
    expect(sheetSources(SHEETS.front).sort()).toEqual(['big_rig_front_body.glb', 'big_rig_gun.glb', 'big_rig_launcher.glb', 'big_rig_wheel.glb']);
  });
});
