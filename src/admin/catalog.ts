// The asset catalogue: for every item of the admin inspector, which game and type it belongs to,
// whether it is official art (extracted or traced), drawn from the rules data or a draft, and where
// it comes from (data/trv/assets_catalog.json). Pure: unit-tested in tests/unit/admin/.

import RAW from '../../data/trv/assets_catalog.json';

/** One catalogue entry: a category's defaults, or an item's corrections to them. */
export interface CatalogEntry {
  game?: string;
  type?: string;
  status?: string;
  source?: string;
  /** The official file in the repository, `{id}` standing for the item's id. */
  official?: string;
}
/** A category of the inspector: its defaults and the items that differ. */
export interface CatalogCategory extends CatalogEntry {
  items?: Record<string, CatalogEntry>;
}
/** The whole file (schema 1). */
export interface AssetCatalog {
  schema: number;
  games: Record<string, string>;
  types: Record<string, string>;
  statuses: Record<string, { name: string; text: string }>;
  categories: Record<string, CatalogCategory>;
  missing: { game: string; what: string; note: string }[];
}
/** What an item ends up with, every field filled. */
export interface ItemEntry {
  game: string;
  type: string;
  status: string;
  source: string;
  official: string | null;
}

/** The catalogue as the game ships it. */
export const ASSET_CATALOG = RAW as unknown as AssetCatalog;

/**
 * The entry of item `itemId` in category `catId`: the category's fields, with the item's own
 * corrections on top. An item of a category the file does not list is a draft of the base game.
 * Example: `entryFor('carnage', 'fire_die').status` → `'ricalcato'`.
 */
export function entryFor(catId: string, itemId: string, c: AssetCatalog = ASSET_CATALOG): ItemEntry {
  const cat = c.categories[catId] ?? {};
  const own = cat.items?.[itemId] ?? {};
  return {
    game: own.game ?? cat.game ?? 'base',
    type: own.type ?? cat.type ?? 'icone',
    status: own.status ?? cat.status ?? 'bozza',
    source: own.source ?? cat.source ?? '',
    official: own.official ?? cat.official ?? null,
  };
}

/** The site address of an item's official file, or null when it has none. Example: `/assets/choppe_shoppe/capisquadra/asha.jpg`. */
export function officialPath(e: ItemEntry, itemId: string): string | null {
  return e.official ? `/${e.official.replace('{id}', itemId)}` : null;
}
