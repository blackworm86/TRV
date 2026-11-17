// The damage token outline drawn by the project owner (assets/base/segnalini/danno/template.svg).
// The drawing holds the empty front (dark field in a red frame with the torn edge) on the left and
// the back (the red warning sign, mirrored edge) on the right, with grey captions under them.
// This module cuts the two sides out and moves them into the 110 x 100 box of art.ts's tokens,
// so the symbols drawn by art.ts and every board that nests a token keep working unchanged.

import { inlineClasses, topGroups } from './svg-import';

/** The token's outer edge in the drawing: left of each side, top, and width (the frame included). */
const FRONT_X = 33.09, BACK_X = 293.09, TOP = 44, WIDTH = 213.82;
/** Where the outer edge lands in art.ts's 110 x 100 box (the old drawing's edge: 3 to 107). */
const BOX_X = 3, BOX_Y = 3, BOX_W = 104;
/** The token's dark field colour, used to tell the token's groups from the captions. */
const FIELD = '#15171c';

/** The two sides, as inner markup for a 110 x 100 box. */
export interface OwnerDamage {
  /** The empty front: frame and field; art.ts adds the title and the symbol. */
  front: string;
  /** The back, complete. */
  back: string;
  /** The front's shape (every path of it, placed), to cut the official picture with: clipPath content. */
  frontClip: string;
  /** The back's shape, the same way. */
  backClip: string;
  /** The front's placement in the 110 x 100 box: a transform from the drawing's units. */
  frontAt: string;
  /** The inside of the front's red frame (its inner edge, torn at the bottom), in the drawing's units. */
  frontInner: string;
  /** The front's outer box in the drawing's units: left, top, width. */
  frontBox: { x: number; y: number; w: number };
}

/**
 * Splits the owner's template into front and back.
 * @param raw the SVG file's text.
 * @returns both sides, or null when the drawing does not have one token on each half.
 * Example: `ownerDamage(rawTemplate)?.back`.
 */
export function ownerDamage(raw: string): OwnerDamage | null {
  const k = BOX_W / WIDTH;
  const sides = topGroups(inlineClasses(raw)).filter(g => g.includes(`fill="${FIELD}"`));
  const left = (g: string): number => Number(/<path[^>]*fill="#15171c"[^>]*\bd="M([\d.]+)/.exec(g)?.[1] ?? NaN);
  const front = sides.find(g => left(g) < BACK_X);
  const back = sides.find(g => left(g) >= BACK_X);
  if (!front || !back) return null;
  const at = (x: number): string => `translate(${BOX_X} ${BOX_Y}) scale(${k}) translate(${-x} ${-TOP})`;
  const place = (g: string, x: number): string => `<g transform="${at(x)}">${g}</g>`;
  // A clip path takes shapes, not groups: every path of the side, each with the side's placement.
  const shape = (g: string, x: number): string => [...g.matchAll(/<path\b[^>]*?\sd="([^"]+)"/g)]
    .map(m => `<path transform="${at(x)}" d="${m[1]}"/>`).join('');
  // The red frame is one path with two rings: the outer edge and the inner one (which starts below the top).
  const red = /<path[^>]*fill="#d42a2f"[^>]*\sd="([^"]+)"/.exec(front)?.[1] ?? /<path[^>]*\sd="([^"]+)"[^>]*fill="#d42a2f"/.exec(front)?.[1] ?? '';
  const rings = red.split(/(?=M)/).map(r => r.trim()).filter(Boolean);
  const inner = rings.find(r => Number(/^M[\d.]+,([\d.]+)/.exec(r)?.[1] ?? NaN) > TOP + 1) ?? '';
  return {
    front: place(front, FRONT_X), back: place(back, BACK_X), frontClip: shape(front, FRONT_X), backClip: shape(back, BACK_X),
    frontAt: at(FRONT_X), frontInner: inner, frontBox: { x: FRONT_X, y: TOP, w: WIDTH },
  };
}

/** Inner edge of the front's red frame in the 110 x 100 box: left, top, right (the frame is 13 units thick in the drawing). */
export const FRONT_FIELD = { x: BOX_X + 13 * (BOX_W / WIDTH), y: BOX_Y + 13.09 * (BOX_W / WIDTH), right: BOX_X + 200.73 * (BOX_W / WIDTH) };
