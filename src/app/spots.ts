// Whether a die can lie at a spot of the table without going through any piece: plain distance
// checks against round pieces (cars, choppers) and boxes (hazard tokens, with the flames, ramps
// and pits standing on them). Pure: no page, no scene (unit-tested in tests/unit/app/).



/** A round piece on the table: its middle (x, z) and radius, in world units. */
export interface Round { x: number; z: number; r: number }
/** A box on the table: its middle (x, z) and half sizes along x and z, in world units. */
export interface Box { x: number; z: number; hx: number; hz: number }

/** True when a die of half size `half` at (x, z) touches none of the pieces. */
export function clearOf(x: number, z: number, half: number, rounds: readonly Round[], boxes: readonly Box[]): boolean {
  for (const o of rounds) if (Math.hypot(o.x - x, o.z - z) < o.r + half) return false;
  for (const b of boxes) if (Math.abs(b.x - x) < b.hx + half && Math.abs(b.z - z) < b.hz + half) return false;
  return true;
}
