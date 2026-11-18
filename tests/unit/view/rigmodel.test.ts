import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { cutRig, rigPartAt, rigSectionMiddle, type RigModelSpec } from '../../../src/view/rigmodel';

// A made-up truck along x, nose at -x: pins at -0.15 and 0.15, so a section is 0.3 long.
const SPEC: RigModelSpec = { pins: [-0.15, 0.15], wheels: { front: [], mid: [], rear: [] } };

/** A truck of three small boxes in a row, one per section, standing on one long flat plate. */
function truck(): THREE.Object3D {
  const g = new THREE.Group();
  const parts = [-0.3, 0, 0.3].map(x => new THREE.BoxGeometry(0.2, 0.1, 0.1).translate(x, 0.06, 0));
  // The plate's top: two triangles the length of the truck (its 0.005 high end faces would be left, unseen).
  const plate = new THREE.PlaneGeometry(0.9, 0.12).rotateX(-Math.PI / 2).translate(0, 0.005, 0);
  const all = [...parts, plate].map(p => p.toNonIndexed());
  const merged = new THREE.BufferGeometry();
  const pos = all.flatMap(p => Array.from(p.getAttribute('position').array));
  merged.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.add(new THREE.Mesh(merged, new THREE.MeshStandardMaterial()));
  return g;
}
const triangles = (o: THREE.Object3D): number => {
  let n = 0;
  o.traverse(x => { const m = x as THREE.Mesh; if (m.isMesh) n += (m.geometry.index?.count ?? 0) / 3; });
  return n;
};

describe('the one-piece Big Rig cut at its hitches', () => {
  it('puts each section half a section from its pin', () => {
    expect(rigSectionMiddle(SPEC, 'front')).toBeCloseTo(-0.3);
    expect(rigSectionMiddle(SPEC, 'mid')).toBeCloseTo(0);
    expect(rigSectionMiddle(SPEC, 'rear')).toBeCloseTo(0.3);
  });

  it('tells the section of a point by its side of the pins', () => {
    expect(rigPartAt(SPEC, -0.2)).toBe('front');
    expect(rigPartAt(SPEC, 0)).toBe('mid');
    expect(rigPartAt(SPEC, 0.2)).toBe('rear');
  });

  it('gives each section its own box and drops the long base plate', () => {
    const cut = cutRig(truck(), SPEC);
    // A box is 12 triangles; the plate's would make one section larger.
    expect(triangles(cut.front)).toBe(12);
    expect(triangles(cut.mid)).toBe(12);
    expect(triangles(cut.rear)).toBe(12);
  });
});
