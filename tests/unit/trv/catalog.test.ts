import { describe, it, expect } from 'vitest';
import {
  BASE_CATALOG, buildCatalog, checkAgainstRules, dieFaceImage, dashboardImage, roadTileImage, tokenImage, ofKind,
  type CatalogModule,
} from '../../../src/game/trv/catalog';

describe('base catalog', () => {
  it('agrees with the rules data on dice, tokens and tiles', () => {
    expect(checkAgainstRules(BASE_CATALOG)).toEqual([]);
  });
  it('lists the component counts of the rulebook (p. 3)', () => {
    const total = (kind: string): number => ofKind(BASE_CATALOG, kind).reduce((n, c) => n + (c.count ?? 0), 0);
    expect(total('hazard_token')).toBe(26);
    expect(total('damage_token')).toBe(20);
    expect(total('wreck')).toBe(4);
    expect(ofKind(BASE_CATALOG, 'road_tile')).toHaveLength(5);
    expect(BASE_CATALOG.crews).toHaveLength(4);
  });
  it('builds image urls for each component face', () => {
    expect(roadTileImage(BASE_CATALOG, 3, 'b')).toBe('/assets/licensed/_derived/base/road_tiles/3b.png');
    expect(tokenImage(BASE_CATALOG, 'hazard_token', 'mine', true)).toBe('/assets/licensed/_derived/base/hazards/mine.png');
    expect(tokenImage(BASE_CATALOG, 'hazard_token', 'mine', false)).toBe('/assets/licensed/_derived/base/hazards/back.png');
    expect(dieFaceImage(BASE_CATALOG, 'direction', 1)).toBe('/assets/licensed/_derived/base/dice/direction/FL.png');
    expect(dashboardImage(BASE_CATALOG, 'green', 'L', true)).toBe('/assets/licensed/_derived/base/dashboards/green_L.png');
    expect(dashboardImage(BASE_CATALOG, 'green', 'L', false)).toBe('/assets/licensed/_derived/base/dashboards/back_L.png');
  });
});

describe('catalog modules', () => {
  const expansion: CatalogModule = {
    schema: 1, module: 'test_exp', name: 'Test', image_root: 'assets/licensed/_derived/test_exp',
    crews: [{ id: 'red', name: 'Rosso', color: '#f00' }],
    components: [{ id: 'big_rig', kind: 'big_rig', count: 1, size_mm: [90, 30, 25], measured: false }],
  };
  it('adds an expansion module with new crews and kinds next to the base game', () => {
    const c = buildCatalog([BASE_CATALOG_MODULE(), expansion]);
    expect(c.crews.map(x => x.id)).toContain('red');
    expect(ofKind(c, 'big_rig')[0].module).toBe('test_exp');
  });
  it('rejects a module that reuses a component id', () => {
    const clash: CatalogModule = { ...expansion, components: [{ id: 'chopper', kind: 'chopper', size_mm: [1, 1, 1], measured: false }] };
    expect(() => buildCatalog([BASE_CATALOG_MODULE(), clash])).toThrow(/duplicate/);
  });
});

function BASE_CATALOG_MODULE(): CatalogModule {
  return {
    schema: 1, module: 'base', name: 'Gioco base', image_root: BASE_CATALOG.roots.base,
    crews: BASE_CATALOG.crews.map(({ id, name, color }) => ({ id, name, color })),
    components: BASE_CATALOG.components.map(({ module: _m, ...rest }) => rest),
  };
}
