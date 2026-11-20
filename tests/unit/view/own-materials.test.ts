// Each vehicle's parts have materials of their own (src/view/models3d.ts ownMaterials). Regression for
// the bug seen on 2026-11-20: the wheels and gun of every Doom Buggy took the glow of the active one,
// because the parts not painted in the crew's colour shared the loaded model's materials.
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ownMaterials } from '../../../src/view/models3d';

describe('own materials', () => {
  it('two vehicles made of one model light up apart, sharing its texture', () => {
    // Arrange: a loaded wheel model with a textured material.
    const tex = new THREE.Texture();
    const model = new THREE.Group().add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ map: tex })));
    // Act: two copies, the first one lit.
    const a = ownMaterials(model), b = ownMaterials(model);
    const mat = (o: THREE.Object3D): THREE.MeshStandardMaterial => (o.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial;
    mat(a).emissive.set('#ff0000');
    mat(a).emissiveIntensity = 0.5;
    // Assert
    expect(mat(b).emissiveIntensity).toBe(1);
    expect(mat(b).emissive.getHex()).toBe(0x000000);
    expect(mat((model.children[0] as THREE.Mesh).parent!)).toBe(mat(model));
    expect(mat(b).map).toBe(tex);
  });
});
