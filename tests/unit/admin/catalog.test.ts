// The asset catalogue (data/trv/assets_catalog.json) as the admin inspector reads it (src/admin/catalog.ts).
import { describe, expect, it } from 'vitest';
import { ASSET_CATALOG, entryFor, officialPath, type AssetCatalog } from '../../../src/admin/catalog';

const SMALL: AssetCatalog = {
  schema: 1,
  games: { base: 'Base', carnage: 'Carnage' },
  types: { carte: 'Carte', dadi: 'Dadi' },
  statuses: { estratto: { name: 'E', text: '' }, bozza: { name: 'B', text: '' }, ricalcato: { name: 'R', text: '' } },
  categories: {
    cards: { game: 'base', type: 'carte', status: 'estratto', source: 'sheet', official: 'assets/base/carte/{id}.jpg' },
    tokens: { game: 'carnage', type: 'carte', status: 'bozza', source: 'open', items: { die: { type: 'dadi', status: 'ricalcato' } } },
  },
  missing: [],
};

describe('entryFor', () => {
  it('gives an item its category\'s game, type, status and source', () => {
    // Arrange / Act
    const e = entryFor('cards', 'rail_gun', SMALL);
    // Assert
    expect(e).toMatchObject({ game: 'base', type: 'carte', status: 'estratto', source: 'sheet' });
  });

  it('lets an item override only the fields it names', () => {
    const e = entryFor('tokens', 'die', SMALL);
    expect(e).toMatchObject({ game: 'carnage', type: 'dadi', status: 'ricalcato', source: 'open' });
  });

  it('marks an item of an unknown category as a draft of the base game', () => {
    expect(entryFor('nowhere', 'x', SMALL)).toMatchObject({ game: 'base', status: 'bozza' });
  });
});

describe('officialPath', () => {
  it('puts the item id into the official file pattern, as a site address', () => {
    expect(officialPath(entryFor('cards', 'rail_gun', SMALL), 'rail_gun')).toBe('/assets/base/carte/rail_gun.jpg');
  });

  it('is null for an item with no official file', () => {
    expect(officialPath(entryFor('tokens', 'die', SMALL), 'die')).toBeNull();
  });
});

describe('the catalogue data', () => {
  it('uses only the games, types and statuses it declares', () => {
    const c = ASSET_CATALOG;
    for (const [id, cat] of Object.entries(c.categories)) {
      for (const e of [cat, ...Object.values(cat.items ?? {})]) {
        if (e.game) expect(c.games, `${id}: game ${e.game}`).toHaveProperty(e.game);
        if (e.type) expect(c.types, `${id}: type ${e.type}`).toHaveProperty(e.type);
        if (e.status) expect(c.statuses, `${id}: status ${e.status}`).toHaveProperty(e.status);
      }
    }
    for (const m of c.missing) expect(c.games).toHaveProperty(m.game);
  });
});
