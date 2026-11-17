"""Builds the 3D terrain maps of one road tile face from its official artwork. Dependency-free.

The artwork comes from the print-and-play PDF (one RGB image per tile face, about 8400 x 6400,
framed like the 2000 x 1522 frame of src/view/board3d.ts GRID). Outputs, in <out_dir>:
  albedo.png  the artwork at about 4200 x 3200 (every 2nd pixel of a full-size image)
  mask.png    1000 x 761, white on the tile (spaces and banner), black outside
  height.png  1000 x 761, grey = 128 + 40 h: asphalt h = 0, sand about +1, mud -1, rock
              (impassable spaces) about +3; smoothed, sand dunes added, down to -1 (the
              cardboard top) at the tile's cut edge
  rough.png   1000 x 761: asphalt rough, sand matte, mud wet (low)
  normal.png  2000 x 1522: tangent-space normals of the height plus the painted cracks
Each pixel of the artwork is classed to the nearest terrain colour (asphalt, sand, mud, rock,
and printed marks: grid lines, hazard red, plants, the yellow border of impassable spaces); marks
take the terrain around them. The face's terrain grid (data/trv/game_base.json) decides where
rock can be: rock colours away from impassable (X) spaces are reddish mud, and dark colours on
them are rock in shadow. Half-size images with a soft mask: transparent = outside.

Usage: python -I tools/asset-pipeline/terrain.py <road_tiles.pdf> <image object number> <out_dir> <face, e.g. 2a>
The artwork is licensed: write under assets/estratti/ (not in git).
"""
import json
import math
import re
import sys
import zlib
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from pdf_images import png  # noqa: E402

GW, GH = 1000, 761           # height grid (half the board3d frame)
NW, NH = 2000, 1522          # normal map (the board3d frame)
# Terrain classes: (name, colour, height); None = a printed mark that takes the terrain around it.
CLASSES = [('out', (0, 0, 0), 0.0),
           ('asphalt', (90, 91, 93), 0.0), ('asphalt', (122, 119, 119), 0.0),
           ('sand', (252, 196, 134), 1.0), ('sand', (231, 170, 109), 1.0),
           ('mud', (49, 34, 35), -1.0), ('mud', (80, 52, 50), -1.0),
           ('rock', (155, 83, 79), 3.0), ('rock', (182, 113, 93), 3.0), ('rock', (96, 58, 55), 3.0),
           ('line', (198, 136, 91), None), ('red', (215, 20, 25), None), ('white', (225, 230, 205), None),
           ('plant', (109, 132, 116), None), ('hatch', (238, 173, 68), None)]
ROUGH = {'asphalt': 0.88, 'sand': 0.97, 'mud': 0.42, 'rock': 0.8}
BANNER_Y = 111               # grid rows above the first row of spaces (frame y 222)
H_ZERO, H_UNIT = 128, 40     # height.png grey = H_ZERO + H_UNIT h (board3d.ts reads the same)
# Space grid of board3d.ts GRID, in frame pixels (2000 x 1522).
FRAME = (2000, 1522)
GRID = dict(x0Even=130, x0Odd=220, pitch=233, y0=330, rowPitch=216, tip=34)


def space_outline(r, c, scale=1.0):
    """Corners of the chevron of space (row r, column c) in frame pixels, grown by scale."""
    g = GRID
    cx = (g['x0Odd'] if r % 2 else g['x0Even']) + g['pitch'] * c
    cy = g['y0'] + g['rowPitch'] * r
    hw, hh, t = g['pitch'] / 2, g['rowPitch'] / 2, g['tip']
    return [(cx + x * scale, cy + y * scale)
            for x, y in [(-hw, -hh), (hw, -hh), (hw + t, 0), (hw, hh), (-hw, hh), (-hw + t, 0)]]


def inside_poly(x, y, pts):
    n, c = len(pts), False
    for i in range(n):
        (x1, y1), (x2, y2) = pts[i], pts[i - 1]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            c = not c
    return c


def impassable_mask(face):
    """Height-grid cells on (or just around) the face's impassable spaces."""
    tiles = json.loads((Path(__file__).parents[2] / 'data/trv/game_base.json').read_text(encoding='utf-8'))['tiles']
    t = next(t for t in tiles if '%d%s' % (t['tile'], t['side']) == face)
    m = [[False] * GW for _ in range(GH)]
    sx, sy = FRAME[0] / GW, FRAME[1] / GH
    for r, row in enumerate(t['terrain']):
        for c, v in enumerate(row):
            if v != 'X':
                continue
            pts = space_outline(r, c, 1.15)
            xs, ys = [p[0] for p in pts], [p[1] for p in pts]
            for gy in range(max(0, int(min(ys) / sy)), min(GH, int(max(ys) / sy) + 1)):
                for gx in range(max(0, int(min(xs) / sx)), min(GW, int(max(xs) / sx) + 1)):
                    if inside_poly((gx + 0.5) * sx, (gy + 0.5) * sy, pts):
                        m[gy][gx] = True
    return m


def pdf_image(path, obj):
    """(width, height, RGB bytes, soft-mask bytes or None) of an image object of the PDF."""
    d = Path(path).read_bytes()

    def stream(n):
        m = re.search(rb'(?<!\d)%d 0 obj\s*<<' % n, d)
        sp = d.find(b'stream', m.end())
        head = d[m.start():sp]
        ln = int(re.search(rb'/Length (\d+)', head).group(1))
        start = sp + 6 + (2 if d[sp + 6:sp + 8] == b'\r\n' else 1)
        return head, zlib.decompressobj().decompress(d[start:start + ln])
    head, raw = stream(obj)
    w = int(re.search(rb'/Width (\d+)', head).group(1))
    h = int(re.search(rb'/Height (\d+)', head).group(1))
    sm = re.search(rb'/SMask (\d+) 0 R', head)
    return w, h, raw, (stream(int(sm.group(1)))[1] if sm else None)


def sample(w, h, raw, ow, oh, avg=2, alpha=None):
    """ow x oh grid of colours, each the mean of avg x avg source pixels at the cell centre;
    a transparent pixel (soft mask) makes the cell black, the outside."""
    out = []
    st = w * 3
    n = avg * avg
    for y in range(oh):
        sy = min(h - avg, int((y + 0.5) * h / oh))
        row = []
        for x in range(ow):
            sx = min(w - avg, int((x + 0.5) * w / ow))
            r = g = b = 0
            for yy in range(sy, sy + avg):
                i = yy * st + sx * 3
                for _ in range(avg):
                    r += raw[i]; g += raw[i + 1]; b += raw[i + 2]; i += 3
            if alpha is not None and alpha[sy * w + sx] < 128:
                r = g = b = 0
            row.append((r // n, g // n, b // n))
        out.append(row)
    return out


def classify(cols):
    cache = {}
    lab = []
    for row in cols:
        lr = []
        for c in row:
            key = (c[0] >> 3, c[1] >> 3, c[2] >> 3)
            v = cache.get(key)
            if v is None:
                v = min(range(len(CLASSES)), key=lambda i: sum((c[t] - CLASSES[i][1][t]) ** 2 for t in range(3)))
                cache[key] = v
            lr.append(v)
        lab.append(lr)
    return lab


def fill_marks(lab, rounds=6):
    """Grid lines and hazard marks take the most common terrain around them."""
    H, W = len(lab), len(lab[0])
    marks = {i for i, c in enumerate(CLASSES) if c[2] is None}
    for _ in range(rounds):
        changed = False
        nxt = [r[:] for r in lab]
        for y in range(H):
            for x in range(W):
                if lab[y][x] not in marks:
                    continue
                cnt = {}
                for yy in range(max(0, y - 2), min(H, y + 3)):
                    for xx in range(max(0, x - 2), min(W, x + 3)):
                        v = lab[yy][xx]
                        if v not in marks and v != 0:
                            cnt[v] = cnt.get(v, 0) + 1
                if cnt:
                    nxt[y][x] = max(cnt, key=cnt.get)
                    changed = True
        lab = nxt
        if not changed:
            break
    return [[1 if v in marks else v for v in r] for r in lab]


def box_blur(a, r):
    """Separable box blur of a 2D list of floats."""
    H, W = len(a), len(a[0])
    tmp = []
    for row in a:
        acc = [0.0] * (W + 1)
        for x in range(W):
            acc[x + 1] = acc[x] + row[x]
        tmp.append([(acc[min(W, x + r + 1)] - acc[max(0, x - r)]) / (min(W, x + r + 1) - max(0, x - r)) for x in range(W)])
    out = [[0.0] * W for _ in range(H)]
    for x in range(W):
        acc = [0.0] * (H + 1)
        for y in range(H):
            acc[y + 1] = acc[y] + tmp[y][x]
        for y in range(H):
            out[y][x] = (acc[min(H, y + r + 1)] - acc[max(0, y - r)]) / (min(H, y + r + 1) - max(0, y - r))
    return out


def blur(a, r, times=3):
    for _ in range(times):
        a = box_blur(a, r)
    return a


def value_noise(x, y, scale, seed):
    """Smooth deterministic noise in -1..1."""
    def h(i, j):
        n = (i * 374761393 + j * 668265263 + seed * 2147483647) & 0xffffffff
        n = ((n ^ (n >> 13)) * 1274126177) & 0xffffffff
        return ((n ^ (n >> 16)) & 0xffff) / 32767.5 - 1
    fx, fy = x / scale, y / scale
    i, j = math.floor(fx), math.floor(fy)
    u, v = fx - i, fy - j
    u, v = u * u * (3 - 2 * u), v * v * (3 - 2 * v)
    a = h(i, j) + (h(i + 1, j) - h(i, j)) * u
    b = h(i, j + 1) + (h(i + 1, j + 1) - h(i, j + 1)) * u
    return a + (b - a) * v


def bilinear(a, x, y):
    H, W = len(a), len(a[0])
    x = min(max(x, 0), W - 1.001)
    y = min(max(y, 0), H - 1.001)
    i, j = int(x), int(y)
    fx, fy = x - i, y - j
    top = a[j][i] + (a[j][i + 1] - a[j][i]) * fx
    bot = a[j + 1][i] + (a[j + 1][i + 1] - a[j + 1][i]) * fx
    return top + (bot - top) * fy


def gray_png(path, a, lo, hi):
    H, W = len(a), len(a[0])
    data = bytes(max(0, min(255, int((v - lo) / (hi - lo) * 255 + 0.5))) for row in a for v in row)
    Path(path).write_bytes(png(W, H, 1, data))


def main():
    pdf, obj, out, face = sys.argv[1], int(sys.argv[2]), Path(sys.argv[3]), sys.argv[4]
    out.mkdir(parents=True, exist_ok=True)
    w, h, raw, alpha = pdf_image(pdf, obj)
    print('image', w, h)

    # Colour: every second pixel of a full-size image (about 8400 wide), all of a half-size one.
    k2 = 2 if w > 6000 else 1
    aw, ah = (w + k2 - 1) // k2, (h + k2 - 1) // k2
    rows = bytearray()
    st = w * 3
    for y in range(0, h, k2):
        r = raw[y * st:(y + 1) * st]
        t = bytearray(aw * 3)
        t[0::3] = r[0::3 * k2]; t[1::3] = r[1::3 * k2]; t[2::3] = r[2::3 * k2]
        if alpha is not None:  # transparent outside -> black, as on the full-size faces
            for i, v in enumerate(alpha[y * w:(y + 1) * w:k2]):
                if v < 128:
                    t[i * 3] = t[i * 3 + 1] = t[i * 3 + 2] = 0
        rows += t
    (out / 'albedo.png').write_bytes(png(aw, ah, 3, bytes(rows)))
    print('albedo', aw, ah)

    # Terrain classes on the height grid.
    lab = classify(sample(w, h, raw, GW, GH, 2, alpha))
    # Outside = black reached from the image border; black inside the tile is a printed shadow.
    seen = [[False] * GW for _ in range(GH)]
    stack = [(x, y) for x in range(GW) for y in (0, GH - 1)] + [(x, y) for y in range(GH) for x in (0, GW - 1)]
    while stack:
        x, y = stack.pop()
        if seen[y][x] or lab[y][x] != 0:
            continue
        seen[y][x] = True
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < GW and 0 <= ny < GH and not seen[ny][nx]:
                stack.append((nx, ny))
    shadow = next(i for i, c in enumerate(CLASSES) if c[0] == 'line')
    lab = [[shadow if v == 0 and not seen[y][x] else v for x, v in enumerate(r)] for y, r in enumerate(lab)]
    # Rock only on (and just around) impassable spaces; there, dark colours are rock in shadow.
    xm = impassable_mask(face)
    rock_dark = next(i for i, c in enumerate(CLASSES) if c[1] == (96, 58, 55))
    mud_red = next(i for i, c in enumerate(CLASSES) if c[1] == (80, 52, 50))
    for y in range(GH):
        for x in range(GW):
            name = CLASSES[lab[y][x]][0]
            if xm[y][x] and name in ('mud', 'asphalt'):
                lab[y][x] = rock_dark
            elif not xm[y][x] and name == 'rock':
                lab[y][x] = mud_red
    lab = fill_marks(lab)
    inside = [[0.0 if v == 0 else 1.0 for v in r] for r in lab]
    inside = [[1.0 if v > 0.5 else 0.0 for v in r] for r in blur(inside, 1, 2)]
    gray_png(out / 'mask.png', inside, 0, 1)

    base = [[(CLASSES[v][2] or 0.0) if v else 0.0 for v in r] for r in lab]
    for y in range(min(BANNER_Y, GH)):  # the name banner stays flat
        base[y] = [0.0] * GW
    sandw = blur([[1.0 if CLASSES[v][0] == 'sand' else 0.0 for v in r] for r in lab], 6)
    mudw = blur([[1.0 if CLASSES[v][0] == 'mud' else 0.0 for v in r] for r in lab], 3)
    # Rock keeps steep sides (little blur); the rest of the ground blends softly.
    isrock = [[1.0 if CLASSES[v][0] == 'rock' else 0.0 for v in r] for r in lab]
    rockw = blur(isrock, 2, 2)
    hgt = blur([[0.0 if k else b_ for k, b_ in zip(kr, br)] for kr, br in zip(isrock, base)], 7)
    for y in range(GH):
        for x in range(GW):
            w_ = rockw[y][x]
            if w_ > 0:
                rock = 3.0 + 0.6 * value_noise(x, y, 26, 4) + 0.25 * value_noise(x, y, 7, 5)
                hgt[y][x] = hgt[y][x] * (1 - w_) + rock * w_
    # Dunes on sand, gentle ripples in mud.
    for y in range(BANNER_Y, GH):
        for x in range(GW):
            hgt[y][x] += sandw[y][x] * (0.5 * value_noise(x, y, 60, 1) + 0.2 * value_noise(x, y, 19, 2))
            hgt[y][x] += mudw[y][x] * 0.12 * value_noise(x, y, 9, 3)
    # Fade to 0 near the cut edge (distance to outside, in cells), so the relief meets the tile's edge.
    dist = [[0 if v == 0 else 99 for v in r] for r in inside]
    for y in range(GH):
        for x in range(GW):
            if dist[y][x]:
                d = dist[y][x]
                if x: d = min(d, dist[y][x - 1] + 1)
                if y: d = min(d, dist[y - 1][x] + 1)
                dist[y][x] = d
    for y in range(GH - 1, -1, -1):
        for x in range(GW - 1, -1, -1):
            if dist[y][x]:
                d = dist[y][x]
                if x < GW - 1: d = min(d, dist[y][x + 1] + 1)
                if y < GH - 1: d = min(d, dist[y + 1][x] + 1)
                dist[y][x] = d
    # Down to the lowest level (-1, the tile's cardboard top) at the cut edge, over FADE cells.
    FADE = 7
    hgt = [[-1 + (hgt[y][x] + 1) * min(1.0, dist[y][x] / FADE) for x in range(GW)] for y in range(GH)]
    gray_png(out / 'height.png', [[H_ZERO + H_UNIT * v for v in r] for r in hgt], 0, 255)

    rough = blur([[ROUGH.get(CLASSES[v][0], 0.9) for v in r] for r in lab], 2, 2)
    gray_png(out / 'rough.png', rough, 0, 1)
    print('height, mask, rough', GW, GH)

    # Normals at frame resolution: the smooth height plus painted detail (cracks are dark lines).
    lum = [[0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2] for c in r] for r in sample(w, h, raw, NW, NH, 1, alpha)]
    lb = blur(lum, 3, 1)
    k = GW / NW
    DETAIL, SLOPE = 0.004, 9.0
    fh = []
    for y in range(NH):
        ly, lby = lum[y], lb[y]
        flat = y < 2 * BANNER_Y
        fh.append([bilinear(hgt, (x + 0.5) * k - 0.5, (y + 0.5) * k - 0.5)
                   + (0.0 if flat else max(-60.0, min(60.0, ly[x] - lby[x])) * DETAIL) for x in range(NW)])
    nrm = bytearray(NW * NH * 3)
    for y in range(NH):
        y0, y1 = max(0, y - 1), min(NH - 1, y + 1)
        for x in range(NW):
            x0, x1 = max(0, x - 1), min(NW - 1, x + 1)
            dx = (fh[y][x1] - fh[y][x0]) * SLOPE
            dy = (fh[y1][x] - fh[y0][x]) * SLOPE
            # Texture v runs up the image (flipY), so the green channel takes +dh/dy of the image.
            nx, ny = -dx, dy
            l = math.sqrt(nx * nx + ny * ny + 1.0)
            i = (y * NW + x) * 3
            nrm[i] = int((nx / l * 0.5 + 0.5) * 255)
            nrm[i + 1] = int((ny / l * 0.5 + 0.5) * 255)
            nrm[i + 2] = int((1.0 / l * 0.5 + 0.5) * 255)
    (out / 'normal.png').write_bytes(png(NW, NH, 3, bytes(nrm)))
    print('normal', NW, NH)


if __name__ == '__main__':
    main()
