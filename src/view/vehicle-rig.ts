// The parts of a vehicle model, found by name: what the Vehicle Motion system (#36) animates.
// A model built to the naming contract (design/art/modelli-strutturati.md §4 and §11.1) is read by
// its node names and their glTF extras (three.js puts them in `userData`). An old one-piece model,
// cut up by models3d.ts (`splitWheels`, `splitParts`, `mountGun` in app/pieces.ts), is read from those
// cuts instead, with fewer capabilities. See docs/piano-integrazione-veicoli.md, phase 0.

import type * as THREE from 'three';

/** What a model can do; the motion system animates only these (modelli-strutturati.md §11.1). */
export type Capability = 'suspension' | 'steering' | 'turret' | 'articulated' | 'rotors' | 'crew' | 'detachable';

/** Side of a part: left, right or on the middle line. */
export type Side = 'L' | 'R' | 'C';

/** One wheel. Turn `roll` about its local Z to roll it, `steer` about Y to steer, move `susp` along Y. */
export interface WheelPart {
  /** The node that rolls (`wheel_N{L,R}`, or `wheelK` of an old model). */
  roll: THREE.Object3D;
  /** The node that steers (`steer_N{L,R}`); on an old model the wheel itself; null when it does not steer. */
  steer: THREE.Object3D | null;
  /** The suspension node (`susp_N{L,R}`), null on an old model. */
  susp: THREE.Object3D | null;
  /** Suspension travel along Y, [down, up] in model units, null without a suspension. */
  travel: [number, number] | null;
  /** Wheel radius, model units. */
  radius: number;
  /** Axle number from the front (0 = front). */
  axle: number;
  side: Side;
}

/** One weapon mount. On an old model only `gun` and `muzzle` exist: the gun turns in place. */
export interface TurretPart {
  /** Turns about Y to aim sideways (`turret`, or `launcher` on the Big Rig); null when the gun turns itself. */
  turret: THREE.Object3D | null;
  /** Raises the barrel about Z (`gun`); on an old model, the cut-out gun that turns about Y. */
  gun: THREE.Object3D | null;
  /** Kicks back along −X when firing (`barrel`); null on an old model, where the gun itself kicks. */
  barrel: THREE.Object3D | null;
  /** Where shots and flashes start (`muzzle`). */
  muzzle: THREE.Object3D | null;
  /** Turning limits about Y, radians; null for a full circle. */
  arc: [number, number] | null;
  /** Elevation limits, radians; null when the gun does not elevate. */
  elev: [number, number] | null;
  /** How far the barrel kicks back, model units; null when not given. */
  kick: number | null;
}

/** A crew place (`seat_*`, §5.1): its extras, as read off the model. */
export interface SeatPart {
  node: THREE.Object3D;
  role: string | null;
  pose: string | null;
  /** The node this seat works (`steering_wheel`, `gun`, `fork`, `launcher`), if any. */
  operates: string | null;
  visible: string | null;
  exit: string | null;
}

/** Everything the motion system needs to know about one vehicle model (§11.1). */
export interface PartsDescriptor {
  /** `named`: read by the naming contract; `legacy`: an old one-piece model, read from its cuts. */
  source: 'named' | 'legacy';
  /** The body, which pitches and rolls on its springs. */
  body: THREE.Object3D | null;
  wheels: WheelPart[];
  turrets: TurretPart[];
  hitches: { front: THREE.Object3D | null; rear: THREE.Object3D | null };
  rotors: THREE.Object3D[];
  /** The motorcycle's front fork, which steers. */
  fork: THREE.Object3D | null;
  seats: SeatPart[];
  /** Hand and foot points (`grip_*`, `foot_*`). */
  grips: THREE.Object3D[];
  /** Effect sockets by name (`fx_*`; `muzzle` stays with its turret). */
  fx: Record<string, THREE.Object3D>;
  capabilities: Set<Capability>;
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const pair = (v: unknown): [number, number] | null =>
  Array.isArray(v) && v.length === 2 && v.every(x => typeof x === 'number' && Number.isFinite(x)) ? [v[0], v[1]] : null;
const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);

/** Every node under `root` (itself included), by name; the first one wins when two share a name. */
function byName(root: THREE.Object3D): Map<string, THREE.Object3D> {
  const out = new Map<string, THREE.Object3D>();
  root.traverse(o => { if (o.name && !out.has(o.name)) out.set(o.name, o); });
  return out;
}

/** True when the model follows the naming contract: it has a `body` node and named wheels, rotors, a fork or hitches. */
export function isNamedModel(root: THREE.Object3D): boolean {
  const names = byName(root);
  if (!names.has('body')) return false;
  for (const n of names.keys()) if (/^(wheel_\d+[LRC]|rotor_(main|tail)|fork|hitch_(front|rear))$/.test(n)) return true;
  return false;
}

/** The descriptor of a model built to the naming contract (§4): nodes by name, measures from their extras. */
export function describeNamed(root: THREE.Object3D): PartsDescriptor {
  const names = byName(root);
  const get = (n: string): THREE.Object3D | null => names.get(n) ?? null;
  const wheels: WheelPart[] = [];
  for (const [name, node] of names) {
    const m = /^wheel_(\d+)([LRC])$/.exec(name);
    if (!m) continue;
    const key = `${m[1]}${m[2]}`;
    const susp = get(`susp_${key}`);
    wheels.push({
      roll: node, steer: get(`steer_${key}`), susp,
      travel: susp ? pair(susp.userData.travel) : null,
      radius: num(node.userData.radius) ?? 0,
      axle: Number(m[1]), side: m[2] as Side,
    });
  }
  wheels.sort((a, b) => a.axle - b.axle || a.side.localeCompare(b.side));
  const turrets: TurretPart[] = [];
  for (const mount of ['turret', 'launcher']) {
    const t = get(mount);
    if (!t) continue;
    const gun = t.getObjectByName('gun') ?? (mount === 'launcher' ? t : null);
    const barrel = gun?.getObjectByName('barrel') ?? null;
    turrets.push({
      turret: t, gun, barrel, muzzle: t.getObjectByName('muzzle') ?? null,
      arc: pair(t.userData.arc), elev: gun ? pair(gun.userData.elev) : null, kick: barrel ? num(barrel.userData.kick) : null,
    });
  }
  // A gun fixed on the body, with no turret.
  const fixed = get('gun');
  if (fixed && !turrets.some(t => t.gun === fixed)) {
    const barrel = fixed.getObjectByName('barrel') ?? null;
    turrets.push({ turret: null, gun: fixed, barrel, muzzle: fixed.getObjectByName('muzzle') ?? null, arc: null, elev: pair(fixed.userData.elev), kick: barrel ? num(barrel.userData.kick) : null });
  }
  const seats: SeatPart[] = [];
  const grips: THREE.Object3D[] = [];
  const fx: Record<string, THREE.Object3D> = {};
  // Grips repeat their names on every part a hand holds (steering wheel, gun): take them all.
  root.traverse(node => {
    const name = node.name;
    if (name.startsWith('seat_')) {
      const u = node.userData;
      seats.push({ node, role: str(u.role), pose: str(u.pose), operates: str(u.operates), visible: str(u.visible), exit: str(u.exit) });
    } else if (/^(grip|foot)_/.test(name)) grips.push(node);
    else if (name.startsWith('fx_') && !fx[name]) fx[name] = node;
  });
  const rotors = ['rotor_main', 'rotor_tail'].map(get).filter((x): x is THREE.Object3D => !!x);
  const d: PartsDescriptor = {
    source: 'named', body: get('body'), wheels, turrets,
    hitches: { front: get('hitch_front'), rear: get('hitch_rear') },
    rotors, fork: get('fork'), seats, grips, fx, capabilities: new Set(),
  };
  if (wheels.some(w => w.susp)) d.capabilities.add('suspension');
  if (wheels.some(w => w.steer) || d.fork) d.capabilities.add('steering');
  if (turrets.some(t => t.turret || t.gun)) d.capabilities.add('turret');
  if (d.hitches.front || d.hitches.rear) d.capabilities.add('articulated');
  if (rotors.length) d.capabilities.add('rotors');
  if (seats.length) d.capabilities.add('crew');
  // Separate parts can fly off in a crash.
  if (d.body && (wheels.length || turrets.length || rotors.length)) d.capabilities.add('detachable');
  return d;
}

/**
 * The descriptor of an old one-piece model, from the cuts made today: wheels `wheel0`, `wheel1`…
 * (`splitWheels`: two per axle, the first on +z, which is the left with the nose at −x), the gun
 * (`GUNS` and `mountGun`), the chopper's rotors (`rotorMain`, `rotorTail`) and the body mesh.
 * No suspension, no crew, nothing that comes off.
 */
export function describeLegacy(root: THREE.Object3D): PartsDescriptor {
  const names = byName(root);
  let body: THREE.Object3D | null = null;
  root.traverse(o => { if (o.userData.body && !body) body = o; });
  const wheels: WheelPart[] = [];
  for (const [name, node] of names) {
    const m = /^wheel(\d+)$/.exec(name);
    if (!m) continue;
    const k = Number(m[1]);
    wheels.push({
      roll: node, steer: node.userData.steer ? node : null, susp: null, travel: null,
      radius: num(node.userData.r) ?? 0, axle: Math.floor(k / 2), side: k % 2 === 0 ? 'L' : 'R',
    });
  }
  wheels.sort((a, b) => a.axle - b.axle || a.side.localeCompare(b.side));
  const gun = names.get('gun') ?? null;
  const turrets: TurretPart[] = gun
    ? [{ turret: null, gun, barrel: null, muzzle: (gun.userData.muzzle as THREE.Object3D | undefined) ?? null, arc: null, elev: null, kick: null }]
    : [];
  const rotors = ['rotorMain', 'rotorTail'].map(n => names.get(n)).filter((x): x is THREE.Object3D => !!x);
  const d: PartsDescriptor = {
    source: 'legacy', body, wheels, turrets, hitches: { front: null, rear: null },
    rotors, fork: null, seats: [], grips: [], fx: {}, capabilities: new Set(),
  };
  if (wheels.some(w => w.steer)) d.capabilities.add('steering');
  if (turrets.length) d.capabilities.add('turret');
  if (rotors.length) d.capabilities.add('rotors');
  return d;
}

/** The descriptor of any vehicle model: by names when it follows the contract, otherwise from today's cuts. */
export function describeVehicle(root: THREE.Object3D): PartsDescriptor {
  return isNamedModel(root) ? describeNamed(root) : describeLegacy(root);
}

/**
 * What is missing for the capabilities a model declares (its assembly sheet, or the vehicle type):
 * one line per problem, empty when the descriptor has every part they need. Used by the model check
 * (modelli-strutturati.md §10.2) and the test bench.
 */
export function missingParts(d: PartsDescriptor, declared: readonly Capability[]): string[] {
  const out: string[] = [];
  if (!d.body) out.push('manca il nodo body');
  for (const c of declared) {
    if (c === 'suspension') {
      if (!d.wheels.length) out.push('suspension: nessuna ruota');
      for (const w of d.wheels) {
        const at = `ruota ${w.axle}${w.side}`;
        if (!w.susp) out.push(`suspension: ${at} senza susp`);
        else if (!w.travel) out.push(`suspension: ${at} senza corsa (travel)`);
      }
    }
    if (c === 'steering' && !d.wheels.some(w => w.steer) && !d.fork) out.push('steering: nessuno sterzo né forcella');
    if (c === 'turret') {
      if (!d.turrets.length) out.push('turret: nessuna torretta né arma');
      for (const t of d.turrets) if (!t.muzzle) out.push(`turret: ${t.turret?.name ?? t.gun?.name ?? '?'} senza muzzle`);
    }
    if (c === 'articulated' && !d.hitches.front && !d.hitches.rear) out.push('articulated: nessuna cerniera');
    if (c === 'rotors' && !d.rotors.length) out.push('rotors: nessun rotore');
    if (c === 'crew' && !d.seats.length) out.push('crew: nessun posto');
    if (c === 'detachable' && d.source !== 'named') out.push('detachable: il modello è tutto d\'un pezzo');
  }
  for (const w of d.wheels) if (!(w.radius > 0)) out.push(`ruota ${w.axle}${w.side} senza raggio`);
  return out;
}
