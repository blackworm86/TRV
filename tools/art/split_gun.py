"""Cuts a machine gun model in two, so its barrel can rise and fall (asked by the user, 2026-11-20:
"puoi ritagliare la mitragliatrice in modo che la canna possa alzarsi"). A gun Meshy makes is one
mesh, but made of separate shells (barrel, receiver, shield, post, base...): none is cut, each goes
whole to one side. A shell whose top is below CUT (model units, y up) is part of the mount, which
only turns; every other shell is part of the gun, which also rises about the pin on top of the mount.

Usage: python tools/art/split_gun.py in.glb CUT mount.glb gun.glb
Then make the textures light again: python tools/art/compress_models.py --max 512 mount.glb gun.glb
"""
import sys

import numpy as np
import trimesh


def shells(vertices: np.ndarray, faces: np.ndarray) -> np.ndarray:
    """For each face, the label of the shell it belongs to: faces sharing a point are one shell."""
    _, same = np.unique(np.round(vertices, 5), axis=0, return_inverse=True)
    f = same.reshape(-1)[faces]
    parent = list(range(int(f.max()) + 1))

    def find(a: int) -> int:
        while parent[a] != a:
            parent[a] = parent[parent[a]]
            a = parent[a]
        return a

    for a, b, c in f:
        root = find(a)
        parent[find(b)] = root
        parent[find(c)] = root
    return np.array([find(a) for a in f[:, 0]])


def split(mesh: trimesh.Trimesh, cut: float) -> tuple[np.ndarray, np.ndarray]:
    """The faces of the mount and those of the gun (indices), by the top of each shell."""
    label = shells(mesh.vertices, mesh.faces)
    low = np.zeros(len(mesh.faces), dtype=bool)
    for i in np.unique(label):
        mine = label == i
        if mesh.vertices[mesh.faces[mine]].reshape(-1, 3)[:, 1].max() < cut:
            low |= mine
    return np.nonzero(low)[0], np.nonzero(~low)[0]


def main() -> None:
    src, cut, mount_path, gun_path = sys.argv[1], float(sys.argv[2]), sys.argv[3], sys.argv[4]
    mesh = trimesh.load(src, process=False).to_geometry()
    mount, gun = split(mesh, cut)
    if not len(mount) or not len(gun):
        raise SystemExit(f'{src}: the cut at {cut} leaves one side empty')
    for path, faces in ((mount_path, mount), (gun_path, gun)):
        part = mesh.submesh([faces], append=True, repair=False)
        part.export(path)
        print(f'{path}: {len(faces)} triangles, y {part.bounds[0][1]:.3f}..{part.bounds[1][1]:.3f}')


if __name__ == '__main__':
    main()
