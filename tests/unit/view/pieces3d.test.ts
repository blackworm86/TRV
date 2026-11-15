import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { faceUpQuaternion } from '../../../src/view/pieces3d';

const NORMALS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const TEXUP = [[0, 1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1], [0, 1, 0], [0, 1, 0]];

describe('die orientation', () => {
  for (let face = 0; face < 6; face++) {
    it(`puts face ${face} on top with its image pointing forward`, () => {
      const q = faceUpQuaternion(face, new THREE.Vector3(1, 0, 0));
      const n = new THREE.Vector3(...(NORMALS[face] as [number, number, number])).applyQuaternion(q);
      const u = new THREE.Vector3(...(TEXUP[face] as [number, number, number])).applyQuaternion(q);
      expect(n.distanceTo(new THREE.Vector3(0, 1, 0))).toBeLessThan(1e-9);
      expect(u.distanceTo(new THREE.Vector3(1, 0, 0))).toBeLessThan(1e-9);
    });
  }
});
