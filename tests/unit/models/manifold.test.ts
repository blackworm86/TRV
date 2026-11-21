// The closed-model check (src/models/manifold.ts, design/art/modelli-strutturati.md §18 point 8): welded
// corners, open edges, edges with more than two faces, and the pieces that have them.
import { describe, expect, it } from 'vitest';
import { meshTopology } from '../../../src/models/manifold';

/** A tetrahedron: four corners, four faces wound outward. */
const TETRA = { p: [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1], i: [0, 2, 1, 0, 1, 3, 0, 3, 2, 1, 2, 3] };
/** The same tetrahedron with every face on corners of its own, as a texture seam leaves them. */
const SPLIT = { p: TETRA.i.flatMap(v => TETRA.p.slice(v * 3, v * 3 + 3)), i: TETRA.i.map((_, k) => k) };

describe('meshTopology', () => {
  it('finds a closed solid manifold', () => {
    const t = meshTopology(TETRA.p, TETRA.i);
    expect(t).toMatchObject({ vertices: 4, triangles: 4, openEdges: 0, nonManifoldEdges: 0, pieces: 1, openPieces: 0, manifold: true });
  });

  it('welds corners at the same place, so a texture seam is not a hole', () => {
    expect(meshTopology(SPLIT.p, SPLIT.i)).toMatchObject({ vertices: 4, openEdges: 0, manifold: true });
  });

  it('counts the open edges of a solid with one face missing', () => {
    const t = meshTopology(TETRA.p, TETRA.i.slice(0, 9));
    expect(t).toMatchObject({ openEdges: 3, nonManifoldEdges: 0, openPieces: 1, manifold: false });
  });

  it('counts an edge shared by three faces as non-manifold', () => {
    // Three triangles on the edge from (0,0,0) to (1,0,0), like the pages of a book.
    const p = [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, -1, 0];
    const t = meshTopology(p, [0, 1, 2, 0, 1, 3, 0, 1, 4]);
    expect(t.nonManifoldEdges).toBe(1);
    expect(t.manifold).toBe(false);
  });

  it('tells a closed piece from an open one in the same mesh', () => {
    const shifted = TETRA.p.map((v, k) => (k % 3 === 0 ? v + 5 : v));
    const p = [...TETRA.p, ...shifted], i = [...TETRA.i, ...TETRA.i.slice(0, 9).map(v => v + 4)];
    expect(meshTopology(p, i)).toMatchObject({ pieces: 2, openPieces: 1, manifold: false });
  });

  it('skips a face with no area', () => {
    expect(meshTopology(TETRA.p, [...TETRA.i, 0, 0, 1])).toMatchObject({ triangles: 4, manifold: true });
  });
});
