// How the client presents the table (timings, camera shots, jumps, dice), from
// data/trv/presentation_base.json. The file's keys are snake_case, as every data file of the
// project; here they become camelCase once, so the code reads them as it always has.

import RAW from '../../data/trv/presentation_base.json';

/** snake_case -> camelCase. */
const camel = (k: string): string => k.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());

/** A copy of `v` with every object key in camelCase; keys starting with `_` (notes) are left out. */
export function camelKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(camelKeys);
  if (v && typeof v === 'object') {
    return Object.fromEntries(Object.entries(v as Record<string, unknown>)
      .filter(([k]) => !k.startsWith('_'))
      .map(([k, x]) => [camel(k), camelKeys(x)]));
  }
  return v;
}

type Stunt = 'flat' | 'oneWheel' | 'barrel' | 'backflip';
/** The presentation values, as the modules use them (see the data file for what each one means). */
export interface Presentation {
  beats: { seconds: Record<string, number>; speedScale: { full: number; fast: number; skip: number } };
  drive: { speed: number; turnRate: number; parkTurnRate: number; maxYaw: number };
  jump: {
    climb: number; land: number; gravity: number; minAngle: number; maxAngle: number; short: number; minFlight: number; maxDive: number;
    bySpaces: Record<number, { follow: number; tail: number }>;
    odds: Record<number, Partial<Record<Stunt, number>>>;
    lean: number; wobble: number; flipLift: number;
    slowMotion: { from: number; to: number; speed: number };
  };
  director: { diceDist: number; shot: { blendIn: number; blendOut: number; wait: number; follow: number }; lift: number };
  chase: { enabled: boolean; fov: number; back: number; up: number; pitch: number; lift: number; follow: number };
  chaseDice: { size: number; side: number; gap: number; ahead: number; rows: number; cols: number; every: number; slide: number };
  mapView: { fit: { side: number; high: number; gap: number }; swap: number; elevNear: number };
  replay: { speed: number; before: number; after: number; camera: [number, number, number] };
  burst: { aim: number; rounds: number; gap: number; speed: number; spread: number };
}

/** The values in use. */
export const P = camelKeys(RAW) as Presentation;
