"""Paints the faces a generated model was left black on (asked by the user, 2026-11-20: the Avenger
"sembra avere pezzi mal renderizzati in nero; verifica la texture"). Meshy paints a model from a few
views: a face none of them saw (the cabin's floor, the inside of a door, the underside of a fender)
keeps the black of the empty texture, and shows as a black patch on the table. Here every such face
takes the colour of the nearest painted face that looks the same way, a little darker (it is a hidden
place); a face black only in part takes its own colour there. Then the painted islands of the texture
are grown into the empty space around them, so no black bleeds in at their edges when the texture is
seen small.

Also reports the mesh: open edges, edges shared by more than two faces, faces wound against their
neighbours, normals stored against their face. It changes the texture only, never the mesh.

Usage: python tools/art/fill_black_faces.py in.glb out.glb [--dark 14] [--shade 0.8]
Then: python tools/art/compress_models.py --max 1024 out.glb
"""
import argparse
import io

import numpy as np
import trimesh
from PIL import Image, ImageDraw

from compress_models import read_glb, write_glb


def report(mesh: trimesh.Trimesh) -> None:
    """Prints what is wrong with the mesh as a surface, if anything."""
    welded = trimesh.Trimesh(mesh.vertices, mesh.faces, process=False)
    welded.merge_vertices(merge_tex=True, merge_norm=True)
    _, count = np.unique(welded.edges_sorted, axis=0, return_counts=True)
    stored = np.asarray(mesh.vertex_normals)[mesh.faces].mean(1)
    against = int(((stored * mesh.face_normals).sum(1) < 0).sum())
    print(f'  mesh: {len(mesh.faces)} triangles; open edges {int((count == 1).sum())}, edges of more than two faces '
          f'{int((count > 2).sum())}, winding consistent {welded.is_winding_consistent}, normals against their face {against}')


def fill(mesh: trimesh.Trimesh, image: Image.Image, dark: float, shade: float) -> tuple[Image.Image, float]:
    """The texture with its black faces painted and its islands grown; and the share of the surface that was black."""
    tex = np.asarray(image.convert('RGB')).astype(np.float32)
    h, w = tex.shape[:2]
    uv = np.asarray(mesh.visual.uv)[mesh.faces]
    px = np.stack([(uv[..., 0] % 1.0) * w, (1 - (uv[..., 1] % 1.0)) * h], axis=-1)
    covered = np.zeros((h, w), dtype=bool)
    own = np.zeros((len(px), 3), dtype=np.float32)
    lit = np.zeros(len(px), dtype=bool)
    boxes = []
    for i, tri in enumerate(px):
        x0, y0 = np.floor(tri.min(0)).astype(int)
        x1, y1 = np.ceil(tri.max(0)).astype(int) + 1
        x0, y0, x1, y1 = max(x0, 0), max(y0, 0), min(x1, w), min(y1, h)
        m = Image.new('1', (max(1, x1 - x0), max(1, y1 - y0)), 0)
        ImageDraw.Draw(m).polygon([(float(p[0] - x0), float(p[1] - y0)) for p in tri], fill=1, outline=1)
        inside = np.asarray(m, dtype=bool)
        boxes.append((x0, y0, x1, y1, inside))
        part = tex[y0:y1, x0:x1]
        if part.shape[:2] != inside.shape:
            continue
        covered[y0:y1, x0:x1] |= inside
        texels = part[inside]
        bright = texels.mean(1) >= dark
        if len(texels) and bright.mean() >= 0.3:
            lit[i] = True
            own[i] = texels[bright].mean(0)
    # Each black face: the nearest painted face that looks the same way.
    centre, normal = mesh.triangles_center, mesh.face_normals
    donors = np.nonzero(lit)[0]
    out = tex.copy()
    for i, (x0, y0, x1, y1, inside) in enumerate(boxes):
        part = out[y0:y1, x0:x1]
        if part.shape[:2] != inside.shape:
            continue
        if lit[i]:
            colour = own[i]
        else:
            d = np.linalg.norm(centre[donors] - centre[i], axis=1) + 10.0 * ((normal[donors] @ normal[i]) < 0.5)
            colour = own[donors[int(np.argmin(d))]] * shade
        black = inside & (tex[y0:y1, x0:x1].mean(2) < dark)
        part[black] = colour
    # Grow the islands into the empty texture around them, one texel a pass.
    known = covered.copy()
    for _ in range(12):
        total = np.zeros_like(out)
        n = np.zeros((h, w), dtype=np.float32)
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            k = np.roll(known, (dy, dx), axis=(0, 1))
            total += np.roll(out, (dy, dx), axis=(0, 1)) * k[..., None]
            n += k
        new = ~known & (n > 0)
        out[new] = total[new] / n[new][:, None]
        known |= new
    area = mesh.area_faces
    return Image.fromarray(out.round().clip(0, 255).astype(np.uint8)), float(area[~lit].sum() / area.sum())


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('src')
    ap.add_argument('dst')
    ap.add_argument('--dark', type=float, default=14, help='a texel darker than this (0-255) is unpainted')
    ap.add_argument('--shade', type=float, default=0.8, help='a face painted from a neighbour is this much darker')
    a = ap.parse_args()
    mesh = trimesh.load(a.src, process=False).to_geometry()
    print(a.src)
    report(mesh)
    doc, binary = read_glb(a.src)
    views = doc['bufferViews']
    material = doc['materials'][0]['pbrMetallicRoughness']
    img = doc['images'][doc['textures'][material['baseColorTexture']['index']]['source']]
    v = views[img['bufferView']]
    o = v.get('byteOffset', 0)
    painted, share = fill(mesh, Image.open(io.BytesIO(binary[o:o + v['byteLength']])), a.dark, a.shade)
    data = io.BytesIO()
    painted.save(data, 'PNG')
    out = bytearray()
    for i, view in enumerate(views):
        start = view.get('byteOffset', 0)
        chunk = data.getvalue() if i == img['bufferView'] else binary[start:start + view['byteLength']]
        out += b'\0' * (-len(out) % 4)
        view['byteOffset'] = len(out)
        view['byteLength'] = len(chunk)
        out += chunk
    img['mimeType'] = 'image/png'
    doc['buffers'][0]['byteLength'] = len(out)
    write_glb(a.dst, doc, bytes(out))
    print(f'  {share:.0%} of the surface was unpainted; written {a.dst}')


if __name__ == '__main__':
    main()
