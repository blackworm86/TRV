// Whether a triangle mesh is closed (design/art/modelli-strutturati.md §18, point 8). Corners at the same
// place are one vertex, whatever their UVs or normals, so a texture seam is not a hole. Then every edge
// must have exactly two faces: one face is an open edge (a hole or a single-sided panel), more than two
// a non-manifold edge. Pure numbers, no three.js, so the tests and the inspector use the same count.

/** What the topology check finds in one mesh. */
export interface Topology {
  /** Corners after welding the ones at the same place. */
  vertices: number;
  triangles: number;
  /** Edges with one face only. */
  openEdges: number;
  /** Edges with more than two faces. */
  nonManifoldEdges: number;
  /** Separate pieces, and how many of them have an open or non-manifold edge. */
  pieces: number;
  openPieces: number;
  /** True when nothing is open and nothing is shared by more than two faces. */
  manifold: boolean;
}

/**
 * The topology of the triangles `indices` (three per face) over `positions` (x, y, z per corner).
 * Corners closer than `weld` times the diagonal of the mesh are the same vertex.
 */
export function meshTopology(positions: ArrayLike<number>, indices: ArrayLike<number>, weld = 1e-6): Topology {
  const n = Math.floor(positions.length / 3);
  let lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], positions[i * 3 + k]); hi[k] = Math.max(hi[k], positions[i * 3 + k]); }
  if (!n) { lo = [0, 0, 0]; hi = [0, 0, 0]; }
  const step = Math.max(Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) * weld, 1e-12);
  const ids = new Map<string, number>(), at = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    const key = [0, 1, 2].map(k => Math.round(positions[i * 3 + k] / step)).join(',');
    let id = ids.get(key);
    if (id === undefined) { id = ids.size; ids.set(key, id); }
    at[i] = id;
  }
  const parent = Array.from({ length: ids.size }, (_, i) => i);
  const root = (a: number): number => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
  const edges = new Map<string, { a: number; faces: number }>();
  let triangles = 0;
  for (let f = 0; f + 2 < indices.length; f += 3) {
    const c = [at[indices[f]], at[indices[f + 1]], at[indices[f + 2]]];
    if (c[0] === c[1] || c[1] === c[2] || c[0] === c[2]) continue; // a face with no area has no edges
    triangles++;
    for (let e = 0; e < 3; e++) {
      const a = Math.min(c[e], c[(e + 1) % 3]), b = Math.max(c[e], c[(e + 1) % 3]), key = `${a},${b}`;
      const edge = edges.get(key);
      if (edge) edge.faces++; else edges.set(key, { a, faces: 1 });
      parent[root(a)] = root(b);
    }
  }
  let openEdges = 0, nonManifoldEdges = 0;
  const bad = new Set<number>(), pieces = new Set<number>();
  for (const { a, faces } of edges.values()) {
    pieces.add(root(a));
    if (faces === 1) openEdges++;
    if (faces > 2) nonManifoldEdges++;
    if (faces !== 2) bad.add(root(a));
  }
  return { vertices: ids.size, triangles, openEdges, nonManifoldEdges, pieces: pieces.size, openPieces: bad.size, manifold: !openEdges && !nonManifoldEdges };
}
