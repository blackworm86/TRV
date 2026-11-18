import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { Worm, type WormSpec } from '../../../src/view/worm';

// A plain tube standing in for the model: 1 tall, 0.2 wide, its mouth at the top, pointing up.
const TALL = 1, RADIUS = 0.2;
const SPEC: WormSpec = {
  hinge: [0, 0.3, 0], axis: [0, 1, 0], jaw: 0.2, root: 0.15,
  colors: { hide: 0xa8683a, hideDark: 0x5a3220, belly: 0xe0bf8c, bone: 0xeadfc4, boneTip: 0x4a3a2c, flesh: 0xb3262a, throat: 0x2a0508 },
};
const tube = (): THREE.BufferGeometry => new THREE.CylinderGeometry(RADIUS, RADIUS, TALL, 16, 20, true);
const REST = { bend: 0, dir: 0, gape: 0 };
/** The vertices of the worm in a pose. */
function posed(w: Worm, p: { bend: number; dir: number; gape: number }): THREE.Vector3[] {
  w.pose(p);
  const pos = w.mesh.geometry.getAttribute('position');
  return Array.from({ length: pos.count }, (_, i) => new THREE.Vector3().fromBufferAttribute(pos, i));
}
const rimRadius = (v: THREE.Vector3[], rest: THREE.Vector3[]): number =>
  Math.max(...v.filter((_, i) => rest[i].y > TALL - 1e-6).map(q => Math.hypot(q.x, q.z)));

describe('the sand worm, posed', () => {
  it('stands with its base on the origin and paints every vertex', () => {
    const w = new Worm(tube(), SPEC);
    const rest = posed(w, REST);
    expect(Math.min(...rest.map(q => q.y))).toBeCloseTo(0, 6);
    expect(w.height).toBeCloseTo(TALL, 6);
    const col = w.mesh.geometry.getAttribute('color');
    expect(col.count).toBe(rest.length);
    for (let i = 0; i < col.count; i++) expect(Number.isFinite(col.getX(i) + col.getY(i) + col.getZ(i))).toBe(true);
  });
  it('wears the model’s own material when it has one, with no seam of light where the texture splits it', () => {
    // Arrange: the tube's texture seam leaves two vertices at each place along it.
    const skin = new THREE.MeshStandardMaterial({ color: 0x123456 });
    const w = new Worm(tube(), SPEC, skin);
    // Act
    w.pose({ bend: 0.7, dir: 0.4, gape: 0.3 });
    // Assert: its own material (a copy), and twin vertices share one normal.
    expect((w.mesh.material as THREE.MeshStandardMaterial).color.getHex()).toBe(0x123456);
    expect(w.mesh.material).not.toBe(skin);
    const pos = w.mesh.geometry.getAttribute('position'), nor = w.mesh.geometry.getAttribute('normal');
    let twins = 0;
    for (let i = 0; i < pos.count; i++) for (let j = i + 1; j < pos.count; j++) {
      if (new THREE.Vector3().fromBufferAttribute(pos, i).distanceTo(new THREE.Vector3().fromBufferAttribute(pos, j)) > 1e-7) continue;
      twins++;
      expect(new THREE.Vector3().fromBufferAttribute(nor, i).distanceTo(new THREE.Vector3().fromBufferAttribute(nor, j))).toBeLessThan(1e-6);
    }
    expect(twins).toBeGreaterThan(10);
  });
  it('bends above its root only, leaning the way it is told', () => {
    const w = new Worm(tube(), SPEC);
    const rest = posed(w, REST).map(q => q.clone()), bent = posed(w, { bend: 0.8, dir: 0, gape: 0 });
    const rootY = TALL * SPEC.root;
    rest.forEach((q, i) => { if (q.y <= rootY) expect(bent[i].distanceTo(q)).toBeLessThan(1e-9); });
    const top = (v: THREE.Vector3[]): number => v.filter((_, i) => rest[i].y > TALL - 1e-6).reduce((a, q) => a + q.z, 0);
    expect(top(bent)).toBeGreaterThan(top(rest) + 1);
    expect(top(posed(w, { bend: 0.8, dir: Math.PI, gape: 0 }))).toBeLessThan(top(rest) - 1);
  });
  it('keeps its length when it bends', () => {
    const w = new Worm(tube(), SPEC);
    // The middle line of the tube follows an arc as long as the straight body above the root.
    const m = w.mouth(REST, new THREE.Vector3()).clone(), b = w.mouth({ bend: 1, dir: 0, gape: 0 }, new THREE.Vector3());
    const rootY = TALL * SPEC.root, s = m.y - rootY, k = 1 / (TALL - rootY);
    // `m.z`: how far off the middle line the point is (the tube's seam shifts its middle a little).
    expect(b.y).toBeCloseTo(rootY + Math.sin(k * s) / k - m.z * Math.sin(k * s), 6);
    expect(b.z).toBeCloseTo((1 - Math.cos(k * s)) / k + m.z * Math.cos(k * s), 6);
  });
  it('opens its jaws wider than at rest and shuts them tighter, moving nothing below the throat', () => {
    const w = new Worm(tube(), SPEC);
    const rest = posed(w, REST).map(q => q.clone());
    const open = posed(w, { bend: 0, dir: 0, gape: 0.6 }).map(q => q.clone()), shut = posed(w, { bend: 0, dir: 0, gape: -0.5 });
    expect(rimRadius(open, rest)).toBeGreaterThan(RADIUS * 1.3);
    expect(rimRadius(shut, rest)).toBeLessThan(RADIUS * 0.8);
    const throat = SPEC.hinge[1] + TALL / 2; // the tube's base was at -TALL / 2
    rest.forEach((q, i) => { if (q.y <= throat) expect(open[i].distanceTo(q)).toBeLessThan(1e-9); });
  });
});
