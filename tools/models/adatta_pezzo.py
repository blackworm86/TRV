"""
Fits a generated piece (wheel, gun mount, gun) to its vehicle without reshaping what it shows
(design/art/modelli-strutturati.md §18, "La dima segue il modello"):
  - drops the separate pieces lying wholly under the main one (a loose plate under a mount),
  - caps the open loops (a ring left open behind a rim),
  - unpinches the edges shared by four faces (two blocks touching along one edge), half a millimetre apart,
  - stretches one band of heights (a mount's neck) so the piece reaches what stands on it,
  - turns it nose to +x, takes one of its points as origin and scales it per axis into metres.
Prints what it did; the result is checked with the inspector (closed / not closed) and the template check.

Usage: python tools/models/adatta_pezzo.py in.glb out.glb --scala SX SY SZ [--origine X Y Z] [--gira]
       [--allunga Y0 Y1 DY] [--togli-sotto]
(--origine and --allunga in the model's own units, before turning; --allunga moves what is above Y1 up by DY
and spreads the stretch over Y0..Y1.)
Written 2026-11-21 for the Avenger's wheel, gun mount and gun, asked by the user.
"""
import argparse, numpy as np, trimesh
from collections import defaultdict
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components

ap = argparse.ArgumentParser()
ap.add_argument('src'); ap.add_argument('out')
ap.add_argument('--scala', nargs=3, type=float, required=True)
ap.add_argument('--origine', nargs=3, type=float, default=[0, 0, 0])
ap.add_argument('--gira', action='store_true')
ap.add_argument('--allunga', nargs=3, type=float)
ap.add_argument('--togli-sotto', action='store_true')
a = ap.parse_args()

m = trimesh.load(a.src, force='mesh', process=False)
V, Fc, UV = m.vertices.copy(), m.faces.copy(), m.visual.uv.copy()
tol = m.scale * 1e-6

def weld(V):
    key = np.round(V / tol).astype(np.int64)
    _, first, inv = np.unique(key, axis=0, return_index=True, return_inverse=True)
    return first, inv.ravel()

def pieces(F, n):
    E = np.vstack([F[:, [0, 1]], F[:, [1, 2]], F[:, [2, 0]]])
    return connected_components(coo_matrix((np.ones(len(E)), (E[:, 0], E[:, 1])), shape=(n, n)), directed=False)[1]

# 1. loose pieces under the main one
if a.togli_sotto:
    first, inv = weld(V); F = inv[Fc]; lab = pieces(F, len(first)); fl = lab[F[:, 0]]
    main = np.bincount(fl).argmax(); floor = V[Fc[fl == main]].reshape(-1, 3)[:, 1].min()
    keep = np.ones(len(Fc), bool)
    for L in np.unique(fl):
        if L != main and V[Fc[fl == L]].reshape(-1, 3)[:, 1].max() <= floor + tol:
            keep &= fl != L; print(f'tolto il pezzo staccato sotto il principale ({(fl == L).sum()} triangoli)')
    Fc = Fc[keep]

# 2. open loops: one fan per cycle of open half-edges, the centre copied per triangle (UV halfway along the edge)
first, inv = weld(V); F = inv[Fc]
cnt = defaultdict(int)
for f in F:
    for i in range(3): cnt[tuple(sorted((f[i], f[(i + 1) % 3])))] += 1
half = defaultdict(list)
for fi, f in enumerate(Fc):
    for i in range(3):
        p, q = f[i], f[(i + 1) % 3]
        if cnt[tuple(sorted((inv[p], inv[q])))] == 1: half[inv[p]].append((inv[q], p, q))
newV, newUV, newF = [], [], []
for s in list(half):
    while half[s]:
        cyc = []; x = s
        while half[x]:
            h = half[x].pop(); cyc.append(h); x = h[0]
            if x == s: break
        if len(cyc) < 3: continue
        c = np.mean([V[p] for _, p, _ in cyc], 0)
        for _, p, q in cyc:
            k = len(V) + len(newV); newV.append(c); newUV.append((UV[p] + UV[q]) / 2); newF.append([q, p, k])
        print(f'tappato un buco di {len(cyc)} spigoli')
if newV:
    V = np.vstack([V, newV]); UV = np.vstack([UV, newUV]); Fc = np.vstack([Fc, newF])

# 3. edges with four faces: split the faces into the blocks they close, move one block's copy of the edge away
first, inv = weld(V); F = inv[Fc]
ef = defaultdict(list)
for fi, f in enumerate(F):
    for i in range(3): ef[tuple(sorted((f[i], f[(i + 1) % 3])))].append(fi)
bad = {e for e, fs in ef.items() if len(fs) > 2}
if bad:
    rows, cols = [], []
    for e, fs in ef.items():
        if e in bad or len(fs) != 2: continue
        rows.append(fs[0]); cols.append(fs[1])
    blk = connected_components(coo_matrix((np.ones(len(rows)), (rows, cols)), shape=(len(F), len(F))), directed=False)[1]
    moved = 0; wid = list(inv)
    for e in bad:
        groups = sorted({blk[fi] for fi in ef[e]})
        for g in groups[1:]:
            fs = np.where(blk == g)[0]; cen = V[Fc[fs]].reshape(-1, 3).mean(0)
            for fi in fs:
                for j in range(3):
                    if wid[Fc[fi, j]] in e:
                        p = Fc[fi, j]; d = cen - V[p]; d /= np.linalg.norm(d) + 1e-12
                        V = np.vstack([V, V[p] + d * 5e-4 / max(a.scala)]); UV = np.vstack([UV, UV[p]]); wid.append(-1); Fc[fi, j] = len(V) - 1
            moved += 1
    print(f'staccati {len(bad)} spigoli con quattro facce ({moved} blocchi spostati di mezzo millimetro)')

# 4. stretch one band of heights
if a.allunga:
    y0, y1, dy = a.allunga; y = V[:, 1]
    V[:, 1] = y + np.where(y >= y1, dy, np.where(y > y0, dy * (y - y0) / (y1 - y0), 0))
    print(f'allungata la fascia {y0}..{y1} di {dy} unità')

# 5. origin, turn, scale
V = V - a.origine
if a.gira: V[:, [0, 2]] *= -1
V = V * a.scala
used = np.unique(Fc); remap = -np.ones(len(V), int); remap[used] = np.arange(len(used))
out = trimesh.Trimesh(V[used], remap[Fc], process=False,
                      visual=trimesh.visual.TextureVisuals(uv=UV[used], material=m.visual.material))
out.export(a.out)
lo, hi = out.vertices.min(0), out.vertices.max(0)
print(f'{len(out.faces)} triangoli; da {lo.round(3).tolist()} a {hi.round(3).tolist()} m')
