"""Traces the flat-colour regions of a raster image (PNG) into SVG paths. Dependency-free.

Each pixel is classed to the nearest colour of a given palette (after optional block averaging
and a majority filter, which clean a printed scan), each class becomes one path: its region's
pixel boundary, simplified (Ramer-Douglas-Peucker) and smoothed into cubic curves where it bends
gently, kept straight at corners. Paths use fill-rule evenodd, so holes come out by themselves.

Usage:
  python -I tools/asset-pipeline/trace.py <in.png> <out.json> --palette bg=#734c99,ink=#fff8da
      [--crop x,y,w,h] [--step 2] [--majority 1] [--min-area 12] [--eps 0.8] [--width 100]
      [--svg preview.svg]
The first palette entry is the background and is not traced. Output JSON:
  {"viewBox": [w, h], "layers": [{"name", "color", "d"}]}, in units where the crop is `--width` wide.
The images are licensed material: keep inputs and outputs under assets/licensed/ (not in git).
"""
import argparse
import json
import math
import struct
import zlib


def read_png(path):
    """Decodes an 8-bit PNG; returns (width, height, channels, bytearray)."""
    d = open(path, 'rb').read()
    p, idat = 8, b''
    w = h = ct = 0
    while p < len(d):
        ln, = struct.unpack('>I', d[p:p + 4])
        t, body = d[p + 4:p + 8], d[p + 8:p + 8 + ln]
        if t == b'IHDR':
            w, h, _, ct = struct.unpack('>IIBB', body[:10])
        elif t == b'IDAT':
            idat += body
        p += 12 + ln
    ch = {0: 1, 2: 3, 4: 2, 6: 4}[ct]
    raw = zlib.decompress(idat)
    st = w * ch
    out = bytearray(h * st)
    prev = bytearray(st)
    q = 0
    for y in range(h):
        f = raw[q]
        line = bytearray(raw[q + 1:q + 1 + st])
        q += 1 + st
        if f == 1:
            for i in range(ch, st):
                line[i] = (line[i] + line[i - ch]) & 255
        elif f == 2:
            for i in range(st):
                line[i] = (line[i] + prev[i]) & 255
        elif f == 3:
            for i in range(st):
                line[i] = (line[i] + ((line[i - ch] if i >= ch else 0) + prev[i]) // 2) & 255
        elif f == 4:
            for i in range(st):
                a = line[i - ch] if i >= ch else 0
                b, c = prev[i], (prev[i - ch] if i >= ch else 0)
                pa, pb, pc = abs(b - c), abs(a - c), abs(a + b - 2 * c)
                line[i] = (line[i] + (a if pa <= pb and pa <= pc else b if pb <= pc else c)) & 255
        out[y * st:(y + 1) * st] = line
        prev = line
    return w, h, ch, out


def hexrgb(s):
    s = s.lstrip('#')
    return tuple(int(s[i:i + 2], 16) for i in (0, 2, 4))


def classify(img, palette, crop, step):
    """Labels of the crop, `step` x `step` blocks averaged, each the index of the nearest colour."""
    w, h, ch, d = img
    x0, y0, cw, chh = crop
    cols = [hexrgb(c) for _, c in palette]
    W, H = cw // step, chh // step
    lab = [[0] * W for _ in range(H)]
    cache = {}
    n = step * step
    for Y in range(H):
        row = lab[Y]
        for X in range(W):
            r = g = b = 0
            for yy in range(y0 + Y * step, y0 + Y * step + step):
                base = (yy * w + x0 + X * step) * ch
                for kk in range(step):
                    i = base + kk * ch
                    r += d[i]; g += d[i + 1]; b += d[i + 2]
            key = (r // n >> 2, g // n >> 2, b // n >> 2)
            v = cache.get(key)
            if v is None:
                rr, gg, bb = r / n, g / n, b / n
                v = min(range(len(cols)), key=lambda j: (cols[j][0] - rr) ** 2 * 0.3 + (cols[j][1] - gg) ** 2 * 0.59 + (cols[j][2] - bb) ** 2 * 0.11)
                cache[key] = v
            row[X] = v
    return lab


def upsample(img, crop, up):
    """The crop enlarged `up` times with bilinear interpolation: antialiased edges then classify
    to a smooth sub-pixel boundary instead of a staircase. Returns an image tuple like read_png."""
    w, h, ch, d = img
    x0, y0, cw, chh = crop
    W, H = cw * up, chh * up
    out = bytearray(W * H * 3)
    for Y in range(H):
        sy = min(max((Y + 0.5) / up - 0.5, 0), chh - 1)
        iy = int(sy); fy = sy - iy; iy2 = min(iy + 1, chh - 1)
        for X in range(W):
            sx = min(max((X + 0.5) / up - 0.5, 0), cw - 1)
            ix = int(sx); fx = sx - ix; ix2 = min(ix + 1, cw - 1)
            a = ((y0 + iy) * w + x0 + ix) * ch; b = ((y0 + iy) * w + x0 + ix2) * ch
            c = ((y0 + iy2) * w + x0 + ix) * ch; e = ((y0 + iy2) * w + x0 + ix2) * ch
            o = (Y * W + X) * 3
            for k in range(3):
                top = d[a + k] + (d[b + k] - d[a + k]) * fx
                bot = d[c + k] + (d[e + k] - d[c + k]) * fx
                out[o + k] = int(top + (bot - top) * fy + 0.5)
    return W, H, 3, out


def majority(lab, n):
    """3 x 3 mode filter, n times: removes speckles and ragged print edges."""
    H, W = len(lab), len(lab[0])
    for _ in range(n):
        out = [r[:] for r in lab]
        for y in range(1, H - 1):
            for x in range(1, W - 1):
                c = {}
                for yy in (y - 1, y, y + 1):
                    r = lab[yy]
                    for xx in (x - 1, x, x + 1):
                        v = r[xx]
                        c[v] = c.get(v, 0) + 1
                best = max(c, key=c.get)
                if c[best] >= 5:
                    out[y][x] = best
        lab = out
    return lab


def loops(mask):
    """Closed boundary loops of a boolean grid (pixel edges; outer clockwise, holes counter)."""
    H, W = len(mask), len(mask[0])

    def inside(x, y):
        return 0 <= x < W and 0 <= y < H and mask[y][x]
    nxt = {}
    for y in range(H):
        for x in range(W):
            if not mask[y][x]:
                continue
            if not inside(x, y - 1):
                nxt.setdefault((x, y), []).append((x + 1, y))
            if not inside(x + 1, y):
                nxt.setdefault((x + 1, y), []).append((x + 1, y + 1))
            if not inside(x, y + 1):
                nxt.setdefault((x + 1, y + 1), []).append((x, y + 1))
            if not inside(x - 1, y):
                nxt.setdefault((x, y + 1), []).append((x, y))
    out = []
    while nxt:
        start = next(iter(nxt))
        loop, v = [start], start
        while True:
            ends = nxt[v]
            e = ends.pop()
            if not ends:
                del nxt[v]
            v = e
            if v == start:
                break
            loop.append(v)
        m = len(loop)
        pts = [p for i, p in enumerate(loop)
               if (p[0] - loop[i - 1][0], p[1] - loop[i - 1][1]) != (loop[(i + 1) % m][0] - p[0], loop[(i + 1) % m][1] - p[1])]
        out.append(pts)
    return out


def area(pts):
    return abs(sum(pts[i - 1][0] * p[1] - p[0] * pts[i - 1][1] for i, p in enumerate(pts))) / 2


def rdp(pts, eps):
    """Open polyline simplification."""
    if len(pts) < 3:
        return pts
    (ax, ay), (bx, by) = pts[0], pts[-1]
    dx, dy = bx - ax, by - ay
    L = math.hypot(dx, dy)
    best, bi = -1, 0
    for i in range(1, len(pts) - 1):
        px, py = pts[i]
        dist = abs(dy * (px - ax) - dx * (py - ay)) / L if L else math.hypot(px - ax, py - ay)
        if dist > best:
            best, bi = dist, i
    if best <= eps:
        return [pts[0], pts[-1]]
    return rdp(pts[:bi + 1], eps)[:-1] + rdp(pts[bi:], eps)


def rdp_closed(pts, eps):
    if len(pts) < 4:
        return pts
    far = max(range(len(pts)), key=lambda i: (pts[i][0] - pts[0][0]) ** 2 + (pts[i][1] - pts[0][1]) ** 2)
    a = rdp(pts[:far + 1], eps)
    b = rdp(pts[far:] + [pts[0]], eps)
    return a[:-1] + b[:-1]


def fmt(v):
    return ('%.2f' % v).rstrip('0').rstrip('.')


def smooth_path(pts, k, corner_deg, window=3.0):
    """Closed polygon -> SVG path: cubic curves through gentle bends, straight lines at corners."""
    n = len(pts)
    if n < 3:
        return ''
    P = [(x * k, y * k) for x, y in pts]
    win = window * k

    def reach(i, step):
        """The first vertex at least `win` away from vertex i, walking by `step`."""
        j = i
        for _ in range(n - 1):
            j = (j + step) % n
            if math.hypot(P[j][0] - P[i][0], P[j][1] - P[i][1]) >= win:
                break
        return P[j]

    def turn(i):
        # Measured over a window, so a corner cut into two half turns by antialiasing still counts.
        a, b, c = reach(i, -1), P[i], reach(i, 1)
        u, v = (b[0] - a[0], b[1] - a[1]), (c[0] - b[0], c[1] - b[1])
        lu, lv = math.hypot(*u) or 1e-9, math.hypot(*v) or 1e-9
        return math.degrees(math.acos(max(-1, min(1, (u[0] * v[0] + u[1] * v[1]) / lu / lv))))
    corner = [turn(i) > corner_deg for i in range(n)]

    def tan(i, out):
        a, b, c = P[i - 1], P[i], P[(i + 1) % n]
        if corner[i]:
            return (c[0] - b[0], c[1] - b[1]) if out else (b[0] - a[0], b[1] - a[1])
        return ((c[0] - a[0]) / 2, (c[1] - a[1]) / 2)
    s = 'M%s %s' % (fmt(P[0][0]), fmt(P[0][1]))
    for i in range(n):
        j = (i + 1) % n
        if corner[i] and corner[j]:
            s += 'L%s %s' % (fmt(P[j][0]), fmt(P[j][1]))
            continue
        chord = math.hypot(P[j][0] - P[i][0], P[j][1] - P[i][1])

        def clip(t):
            l = math.hypot(*t) or 1e-9
            return (t[0] * min(1, chord / l), t[1] * min(1, chord / l))
        t0, t1 = clip(tan(i, True)), clip(tan(j, False))
        c1 = (P[i][0] + t0[0] / 3, P[i][1] + t0[1] / 3)
        c2 = (P[j][0] - t1[0] / 3, P[j][1] - t1[1] / 3)
        s += 'C%s %s %s %s %s %s' % (fmt(c1[0]), fmt(c1[1]), fmt(c2[0]), fmt(c2[1]), fmt(P[j][0]), fmt(P[j][1]))
    return s + 'Z'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('src')
    ap.add_argument('out')
    ap.add_argument('--palette', required=True)
    ap.add_argument('--crop', default='')
    ap.add_argument('--step', type=int, default=1)
    ap.add_argument('--majority', type=int, default=0)
    ap.add_argument('--min-area', type=float, default=4)
    ap.add_argument('--eps', type=float, default=0.8)
    ap.add_argument("--corner", type=float, default=50)
    ap.add_argument("--window", type=float, default=3.0)
    ap.add_argument('--width', type=float, default=100)
    ap.add_argument('--svg', default='')
    ap.add_argument('--up', type=int, default=1)
    a = ap.parse_args()
    palette = [tuple(x.split('=')) for x in a.palette.split(',')]
    img = read_png(a.src)
    crop = tuple(int(v) for v in a.crop.split(',')) if a.crop else (0, 0, img[0], img[1])
    if a.up > 1:
        img = upsample(img, crop, a.up)
        crop = (0, 0, img[0], img[1])
    lab = majority(classify(img, palette, crop, a.step), a.majority)
    H, W = len(lab), len(lab[0])
    k = a.width / W
    layers = []
    for li in range(1, len(palette)):
        mask = [[v == li for v in row] for row in lab]
        d = ''
        for lp in loops(mask):
            if area(lp) < a.min_area * a.up * a.up:
                continue
            d += smooth_path(rdp_closed(lp, a.eps * a.up), k, a.corner, a.window * a.up)
        layers.append({'name': palette[li][0], 'color': palette[li][1], 'd': d})
    vb = [round(a.width, 3), round(H * k, 3)]
    json.dump({'viewBox': vb, 'layers': layers}, open(a.out, 'w'))
    if a.svg:
        body = '<rect width="100%%" height="100%%" fill="%s"/>' % palette[0][1]
        body += ''.join('<path fill="%s" fill-rule="evenodd" d="%s"/>' % (l['color'], l['d']) for l in layers)
        open(a.svg, 'w').write('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %s %s">%s</svg>' % (vb[0], vb[1], body))
    print(a.out, 'grid %dx%d' % (W, H), ' '.join('%s:%d' % (l['name'], len(l['d'])) for l in layers))


if __name__ == '__main__':
    main()
