"""
Prepares a generated vehicle body for the template without reshaping it (design/art/modelli-strutturati.md §18):
removes the loose pieces Meshy leaves inside the wheel wells (springs, arms: the wheels need that place and hide it),
caps the small flat holes (pipe ends, plates open underneath) and drops the under-body plates left open.
Prints what it did; the result is checked with the inspector (closed / not closed) and the template check.

Usage: python tools/models/pulisci_carrozzeria.py in.glb out.glb ASSE_ANTERIORE ASSE_POSTERIORE
(axle positions in metres along the template, the nose toward +x once the model is turned the way the template is).
Written 2026-11-21 for the Avenger, asked by the user.
"""
import sys, numpy as np, trimesh
from collections import defaultdict
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components
SRC, OUT, FX, RX = sys.argv[1], sys.argv[2], float(sys.argv[3]), float(sys.argv[4])
m = trimesh.load(SRC, force='mesh', process=False)
V, Fc, UV, N = m.vertices.copy(), m.faces.copy(), m.visual.uv.copy(), m.vertex_normals.copy()
key = np.round(V / (m.scale * 1e-6)).astype(np.int64)
_, first, inv = np.unique(key, axis=0, return_index=True, return_inverse=True); inv = inv.ravel()
W = V[first]; F = inv[Fc]; n = len(W)
FL = np.array([-1.0, 1, -1]); mn, mx = (W * FL).min(0), (W * FL).max(0); k = 4.8 / (mx - mn)[0]
Q = ((W * FL) - [(mx[0] + mn[0]) / 2, mn[1], (mx[2] + mn[2]) / 2]) * k + [0, 0.18, 0]
E = np.vstack([F[:, [0, 1]], F[:, [1, 2]], F[:, [2, 0]]])
_, lab = connected_components(coo_matrix((np.ones(len(E)), (E[:, 0], E[:, 1])), shape=(n, n)), directed=False)
flab = lab[F[:, 0]]; main = np.bincount(flab).argmax()
drop = set()
for L in np.unique(flab):
    if L == main: continue
    P = Q[lab == L]; lo, hi = P.min(0), P.max(0)
    for ax in (FX, RX):
        if abs(lo[0] - ax) < 0.45 and abs(hi[0] - ax) < 0.45 and hi[1] < 0.9 and min(abs(lo[2]), abs(hi[2])) > 0.3 and np.sign(lo[2]) == np.sign(hi[2]):
            drop.add(L)
keepf = ~np.isin(flab, list(drop))
print('pezzi tolti dai passaruota:', len(drop), 'con', (~keepf).sum(), 'triangoli')
Fc, F = Fc[keepf], F[keepf]
# holes
half = defaultdict(int)
for f in F:
    for a, b in ((f[0], f[1]), (f[1], f[2]), (f[2], f[0])): half[(a, b)] += 1
und = defaultdict(int)
for (a, b), c in half.items(): und[(min(a, b), max(a, b))] += c
open_he = [(a, b) for (a, b) in half if und[(min(a, b), max(a, b))] == 1]
out = defaultdict(list)
for a, b in open_he: out[a].append(b)
rep = {}
for s, w in enumerate(inv): rep.setdefault(w, s)
newV, newUV, newN, newF, left = [], [], [], [], []
opencomp = set()
while any(out.values()):
    s0 = next(a for a, bs in out.items() if bs); cyc = []; a = s0
    while True:
        b = out[a].pop(); cyc.append((a, b)); a = b
        if a == s0: break
    ids = [a for a, _ in cyc]; P = Q[ids]; c = P.mean(0)
    u, sv, vt = np.linalg.svd(P - c); flat = sv[2] / max(sv[0], 1e-9)
    size = np.linalg.norm(P.max(0) - P.min(0))
    if len(ids) > 40 or flat > 0.25:
        left.append((len(ids), round(float(size), 2), round(float(flat), 2), np.round(c, 2).tolist())); opencomp.add(lab[ids[0]]); continue
    nrm = np.zeros(3); cw = W[ids].mean(0)
    for a, b in cyc: nrm += np.cross(W[b] - cw, W[a] - cw)
    nrm /= np.linalg.norm(nrm) or 1
    for a, b in cyc:
        ci = len(V) + len(newV); newV.append(cw); newUV.append((UV[rep[a]] + UV[rep[b]]) / 2); newN.append(nrm)
        newF.append([rep[b], rep[a], ci])
print('buchi chiusi con un tappo:', len(set(tuple(f[:2]) for f in newF)) and len([1 for _ in newF]) , 'triangoli nuovi;', 'buchi lasciati (troppo grandi o storti):', left)
# Under-body plates left open (a hole too large or not flat) go too, unless it is the body itself.
gone = [L for L in opencomp if L != main and Q[lab == L][:, 1].max() < 0.85]
if gone:
    keep2 = ~np.isin(lab[Fc[:, 0] * 0 + inv[Fc[:, 0]]], gone)
    Fc = Fc[keep2]; newF = [f for f in newF if lab[inv[f[0]]] not in gone]
    print('lastre aperte sotto la scocca tolte:', len(gone))
V3 = np.vstack([V, newV]) if newV else V; UV3 = np.vstack([UV, newUV]) if newV else UV; N3 = np.vstack([N, newN]) if newV else N
F3 = np.vstack([Fc, newF]) if newF else Fc
used = np.unique(F3); remap = -np.ones(len(V3), int); remap[used] = np.arange(len(used))
mesh = trimesh.Trimesh(V3[used], remap[F3], vertex_normals=N3[used], process=False)
mesh.visual = trimesh.visual.TextureVisuals(uv=UV3[used], material=m.visual.material)
mesh.export(OUT); print('scritto', OUT, len(mesh.faces), 'triangoli')
