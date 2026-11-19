// The parts descriptor of a vehicle model (src/view/vehicle-rig.ts): a model built to the naming
// contract (design/art/modelli-strutturati.md §4, §11.1) and an old one-piece model cut up as today.
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { describeLegacy, describeNamed, describeVehicle, isNamedModel, missingParts } from '../../../src/view/vehicle-rig';
import { BIKE, RIG } from '../../../src/view/models-config';

/** A node with a name, extras and children. */
function node(name: string, extras: Record<string, unknown> = {}, ...kids: THREE.Object3D[]): THREE.Object3D {
  const o = new THREE.Object3D();
  o.name = name;
  Object.assign(o.userData, extras);
  for (const k of kids) o.add(k);
  return o;
}

/** One wheel of an axle, as the contract hangs it: susp → steer (steering axles only) → wheel. */
function corner(axle: number, side: 'L' | 'R', steers: boolean): THREE.Object3D {
  const wheel = node(`wheel_${axle}${side}`, { radius: 0.42 }, node(`wheel_${axle}${side}_mesh`));
  const inner = steers ? node(`steer_${axle}${side}`, { max: 0.5 }, wheel) : wheel;
  return node(`susp_${axle}${side}`, { travel: [-0.08, 0.12] }, inner);
}

/** The test car of the integration plan, as a bare node tree: two axles, a turret with a gun, two seats. */
function namedCar(): THREE.Object3D {
  const barrel = node('barrel', { kick: 0.05 }, node('muzzle', { weapon: 'mg' }));
  const gun = node('gun', { elev: [-0.1, 0.5] }, node('gun_mesh'), node('grip_L'), node('grip_R'), barrel);
  const turret = node('turret', { arc: [-3.14, 3.14] }, node('turret_mesh'), node('seat_gunner', { role: 'gunner', pose: 'stand', operates: 'gun' }), gun);
  const body = node('body', { mass: 1 }, node('body_mesh'),
    node('cockpit', {}, node('seat_driver', { role: 'driver', pose: 'sit', operates: 'steering_wheel', visible: 'cage', exit: 'exit_L' })),
    turret, node('fx_exhaust_0'), node('fx_smoke'));
  return node('vehicle', {}, body,
    node('axle_0', { steer: true }, corner(0, 'L', true), corner(0, 'R', true)),
    node('axle_1', { steer: false }, corner(1, 'L', false), corner(1, 'R', false)));
}

/** An old one-piece car after today's cuts: a body mesh, wheel0…wheel3, a gun with its muzzle. */
function legacyCar(): THREE.Object3D {
  const body = new THREE.Mesh();
  body.name = 'body';
  body.userData.body = true;
  const root = node('model', {}, body);
  for (let k = 0; k < 4; k++) root.add(node(`wheel${k}`, { r: 0.086, steer: k < 2 }));
  const muzzle = new THREE.Object3D();
  const gun = node('gun', { muzzle }, muzzle);
  root.add(gun);
  return root;
}

describe('vehicle parts descriptor', () => {
  it('finds every part of a model built to the naming contract', () => {
    // Arrange
    const car = namedCar();
    // Act
    const d = describeVehicle(car);
    // Assert
    expect(d.source).toBe('named');
    expect(d.body?.name).toBe('body');
    expect(d.wheels.map(w => `${w.axle}${w.side}`)).toEqual(['0L', '0R', '1L', '1R']);
    expect(d.wheels.every(w => w.radius === 0.42 && w.susp && w.travel?.[1] === 0.12)).toBe(true);
    expect(d.wheels.filter(w => w.steer).map(w => w.axle)).toEqual([0, 0]);
    expect(d.turrets).toHaveLength(1);
    expect(d.turrets[0].gun?.name).toBe('gun');
    expect(d.turrets[0].barrel?.name).toBe('barrel');
    expect(d.turrets[0].muzzle?.name).toBe('muzzle');
    expect(d.turrets[0].arc).toEqual([-3.14, 3.14]);
    expect(d.turrets[0].elev).toEqual([-0.1, 0.5]);
    expect(d.turrets[0].kick).toBe(0.05);
    expect(d.seats.map(s => s.role).sort()).toEqual(['driver', 'gunner']);
    expect(d.seats.find(s => s.role === 'driver')?.exit).toBe('exit_L');
    expect(d.grips.map(g => g.name).sort()).toEqual(['grip_L', 'grip_R']);
    expect(Object.keys(d.fx).sort()).toEqual(['fx_exhaust_0', 'fx_smoke']);
    expect([...d.capabilities].sort()).toEqual(['crew', 'detachable', 'steering', 'suspension', 'turret']);
    expect(missingParts(d, [...d.capabilities])).toEqual([]);
  });

  it('reads an old one-piece model from today\'s cuts, with fewer capabilities', () => {
    // Arrange
    const car = legacyCar();
    // Act
    const d = describeVehicle(car);
    // Assert
    expect(isNamedModel(car)).toBe(false);
    expect(d.source).toBe('legacy');
    expect(d.body?.userData.body).toBe(true);
    expect(d.wheels.map(w => `${w.axle}${w.side}`)).toEqual(['0L', '0R', '1L', '1R']);
    expect(d.wheels.every(w => w.radius === 0.086 && w.susp === null && w.travel === null)).toBe(true);
    // Today the cut-out wheel steers itself.
    expect(d.wheels[0].steer).toBe(d.wheels[0].roll);
    expect(d.wheels[2].steer).toBeNull();
    expect(d.turrets[0].turret).toBeNull();
    expect(d.turrets[0].muzzle).toBe(car.getObjectByName('gun')!.userData.muzzle);
    expect([...d.capabilities].sort()).toEqual(['steering', 'turret']);
  });

  it('reads the chopper\'s cut rotors', () => {
    const chopper = node('model', {}, node('rotorMain'), node('rotorTail'));
    const d = describeLegacy(chopper);
    expect(d.rotors.map(r => r.name)).toEqual(['rotorMain', 'rotorTail']);
    expect(d.capabilities.has('rotors')).toBe(true);
  });

  it('names what is missing for a capability declared without its parts', () => {
    // Arrange: suspension declared, one corner without its travel; a turret without its muzzle; no hitch.
    const car = namedCar();
    car.getObjectByName('susp_1R')!.userData.travel = undefined;
    car.getObjectByName('muzzle')!.removeFromParent();
    // Act
    const out = missingParts(describeNamed(car), ['suspension', 'turret', 'articulated']);
    // Assert
    expect(out).toEqual([
      'suspension: ruota 1R senza corsa (travel)',
      'turret: turret senza muzzle',
      'articulated: nessuna cerniera',
    ]);
  });

  it('says an old model cannot come apart or carry a crew', () => {
    const out = missingParts(describeLegacy(legacyCar()), ['suspension', 'crew', 'detachable']);
    expect(out).toContain('suspension: ruota 0L senza susp');
    expect(out).toContain('crew: nessun posto');
    expect(out).toContain('detachable: il modello è tutto d\'un pezzo');
  });

  it('finds the motorcycle\'s fork and the Big Rig\'s hitches', () => {
    const bike = node('vehicle', {}, node('body'), node('fork', { max: 0.6 }, node('wheel_0C', { radius: 0.3 })), node('wheel_1C', { radius: 0.32 }));
    const rig = node('vehicle', {}, node('body'), node('hitch_front'), node('hitch_rear'), node('launcher', {}, node('muzzle')));
    const b = describeVehicle(bike);
    const r = describeVehicle(rig);
    expect(b.fork?.name).toBe('fork');
    expect(b.capabilities.has('steering')).toBe(true);
    expect(b.wheels.map(w => w.side)).toEqual(['C', 'C']);
    expect(r.capabilities.has('articulated')).toBe(true);
    expect(r.turrets[0].gun?.name).toBe('launcher');
    expect(missingParts(r, ['articulated', 'turret'])).toEqual([]);
  });

  it('takes the motion values from the data file, as the code had them', () => {
    expect(RIG.stiffness).toBe(140);
    expect(RIG.damping).toBe(9);
    expect(RIG.engine.freq).toBe(46);
    expect(RIG.maxSteer).toBe(0.5);
    expect(BIKE.maxLean).toBe(0.6);
    expect(BIKE.drift).toBe(1.35);
  });
});
