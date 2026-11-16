// The physical catalog of components (data/trv/catalog_<module>.json): what exists on the
// table, how many, how big, and which licensed image draws each face. The 2D interface and the
// 3D scene read components only from here, by kind, so an expansion adds a catalog module
// (new crews, new kinds) without changes to the base game's code paths.

import baseCatalog from '../../../data/trv/catalog_base.json';
import rules from '../../../data/trv/game_base.json';

/** Size in millimetres: width (along the road), depth (across), thickness. */
export type SizeMm = [number, number, number];

export interface Crew { id: string; name: string; color: string; module: string }

/**
 * One kind of physical component. `kind` is an open string: the base game uses road_tile,
 * finish_line, hazard_token, damage_token, dashboard, command_board, car, chopper, wreck, die.
 * Expansions may add kinds; a viewer that does not know a kind skips it.
 */
export interface Component {
  id: string;
  kind: string;
  module: string;
  count?: number;
  count_per_crew?: number;
  size_mm: SizeMm;
  measured: boolean;
  /** Road tile / finish line: image per side (null = art not available). Die: face values. */
  faces?: Record<string, string | null> | (number | string)[];
  front?: string;
  back?: string | null;
  /** Image path with a {crew} placeholder. */
  front_by_crew?: string;
  face_images?: string[];
  face_art?: string;
  rule?: string;
  die?: string;
  car_size?: 'S' | 'M' | 'L';
  tile?: number;
  model?: string;
  color_by_crew?: boolean;
  missing_art?: boolean;
}

export interface CatalogModule {
  schema: number;
  module: string;
  name: string;
  image_root: string;
  crews: { id: string; name: string; color: string }[];
  components: Omit<Component, 'module'>[];
}

export interface Catalog {
  modules: string[];
  crews: Crew[];
  components: Component[];
  /** Image root per module, to build URLs. */
  roots: Record<string, string>;
}

/** Merges catalog modules, base first. Ids must be unique across modules. */
export function buildCatalog(mods: CatalogModule[]): Catalog {
  const c: Catalog = { modules: [], crews: [], components: [], roots: {} };
  const ids = new Set<string>();
  for (const m of mods) {
    if (m.schema !== 1) throw new Error(`catalog ${m.module}: unknown schema ${m.schema}`);
    c.modules.push(m.module);
    c.roots[m.module] = m.image_root;
    for (const cr of m.crews) c.crews.push({ ...cr, module: m.module });
    for (const comp of m.components) {
      if (ids.has(comp.id)) throw new Error(`catalog: duplicate component id ${comp.id}`);
      ids.add(comp.id);
      c.components.push({ ...comp, module: m.module } as Component);
    }
  }
  return c;
}

/** The base game's catalog. */
export const BASE_CATALOG: Catalog = buildCatalog([baseCatalog as unknown as CatalogModule]);

/** Components of a kind, optionally filtered by field values. */
export function ofKind(c: Catalog, kind: string, where: Partial<Component> = {}): Component[] {
  return c.components.filter(x => x.kind === kind &&
    Object.entries(where).every(([k, v]) => (x as unknown as Record<string, unknown>)[k] === v));
}

/** URL of a catalog image path (served from the project root by the dev server). */
export function imageUrl(c: Catalog, comp: Component, rel: string | null | undefined): string | null {
  if (!rel) return null;
  return `/${c.roots[comp.module]}/${rel}.png`;
}

/** Image of a road tile face. */
export function roadTileImage(c: Catalog, tile: number, side: string): string | null {
  const comp = ofKind(c, 'road_tile').find(x => x.tile === tile);
  if (!comp || !comp.faces || Array.isArray(comp.faces)) return null;
  return imageUrl(c, comp, comp.faces[side]);
}

/** Front image of the token for a rule value (e.g. hazard "mine"), or the shared back. */
export function tokenImage(c: Catalog, kind: 'hazard_token' | 'damage_token', rule: string | null, faceUp: boolean): string | null {
  const comp = rule ? ofKind(c, kind).find(x => x.rule === rule) : ofKind(c, kind)[0];
  if (!comp) return null;
  return imageUrl(c, comp, faceUp && rule ? comp.front : comp.back);
}

/** Image of one face of an FX die, by the face index the rules rolled. */
export function dieFaceImage(c: Catalog, die: string, face: number): string | null {
  const comp = ofKind(c, 'die').find(x => x.die === die);
  if (!comp || !comp.face_images) return null;
  return imageUrl(c, comp, comp.face_images[face]);
}

/** A crew's dashboard for a car size; the back when the car is inoperable. */
export function dashboardImage(c: Catalog, crew: string, size: 'S' | 'M' | 'L', operable: boolean): string | null {
  const comp = ofKind(c, 'dashboard', { car_size: size })[0];
  if (!comp) return null;
  return imageUrl(c, comp, operable ? comp.front_by_crew?.replace('{crew}', crew) : comp.back);
}

/** A crew's command board. */
export function commandBoardImage(c: Catalog, crew: string): string | null {
  const comp = ofKind(c, 'command_board')[0];
  return comp ? imageUrl(c, comp, comp.front_by_crew?.replace('{crew}', crew)) : null;
}

/** Physical size of the first component of a kind matching the filter. */
export function sizeOf(c: Catalog, kind: string, where: Partial<Component> = {}): SizeMm {
  const comp = ofKind(c, kind, where)[0];
  if (!comp) throw new Error(`catalog: no ${kind}`);
  return comp.size_mm;
}

/**
 * Checks that the catalog agrees with the rules data: same dice faces in the same order,
 * same token counts, an image for every road tile face. Returns the problems found.
 */
export function checkAgainstRules(c: Catalog): string[] {
  const out: string[] = [];
  const dice = rules.dice as Record<string, (string | number)[]>;
  for (const [die, faces] of Object.entries(dice)) {
    const comp = ofKind(c, 'die').find(x => x.die === die);
    if (!comp) { out.push(`die ${die}: not in the catalog`); continue; }
    if (JSON.stringify(comp.faces) !== JSON.stringify(faces)) out.push(`die ${die}: faces differ from the rules`);
    if (!comp.face_images && comp.face_art !== 'pips') out.push(`die ${die}: no face images`);
    if (comp.face_images && comp.face_images.length !== faces.length) out.push(`die ${die}: ${comp.face_images.length} images for ${faces.length} faces`);
  }
  for (const [type, n] of Object.entries(rules.hazard_tokens)) {
    const comp = ofKind(c, 'hazard_token').find(x => x.rule === type);
    if (!comp || comp.count !== n) out.push(`hazard ${type}: catalog ${comp?.count ?? 0}, rules ${n}`);
  }
  // A type can have several entries (Skid: one per direction), so compare per-type totals.
  const damageTotals = new Map<string, number>();
  for (const d of rules.damage_tokens as { type: string; count: number }[]) damageTotals.set(d.type, (damageTotals.get(d.type) ?? 0) + d.count);
  for (const [type, n] of damageTotals) {
    const comp = ofKind(c, 'damage_token').find(x => x.rule === type);
    if (!comp || comp.count !== n) out.push(`damage ${type}: catalog ${comp?.count ?? 0}, rules ${n}`);
  }
  for (const t of rules.tiles as { tile: number; side: string }[]) {
    const comp = ofKind(c, 'road_tile').find(x => x.tile === t.tile);
    if (!comp || Array.isArray(comp.faces) || !comp.faces?.[t.side]) out.push(`road tile ${t.tile}${t.side}: no image`);
  }
  for (const comp of c.components) {
    if (!Array.isArray(comp.size_mm) || comp.size_mm.length !== 3 || comp.size_mm.some(v => !(v > 0))) out.push(`${comp.id}: bad size_mm`);
  }
  return out;
}
