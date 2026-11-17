"""Extracts the glyph outlines of the CFF fonts embedded in a PDF (the official rulebook) as JSON.

Dependency-free. Each FontFile3 stream (CFF, the subset the PDF carries) becomes one JSON file:
{"name", "upm", "glyphs": {"A": {"d": "<SVG path, font units, y up>", "w": advance}, ...}}.
Glyphs are keyed by character for the ASCII range (CFF standard strings 1-95); other glyphs are
keyed by their glyph name. Only the glyphs the PDF uses are in a subset font.

Usage: python -I tools/asset-pipeline/pdf_fonts.py <file.pdf> <out_dir>
The fonts are licensed material: write them under assets/estratti/ (not in git).
"""
import json
import re
import sys
import zlib
from pathlib import Path

ASCII = {i - 31: chr(i) for i in range(32, 127)}  # standard SID -> character


def index(b, p):
    """Reads a CFF INDEX at p; returns (list of bytes, end position)."""
    count = int.from_bytes(b[p:p + 2], 'big')
    if count == 0:
        return [], p + 2
    osz = b[p + 2]
    offs = [int.from_bytes(b[p + 3 + i * osz:p + 3 + (i + 1) * osz], 'big') for i in range(count + 1)]
    base = p + 3 + (count + 1) * osz - 1
    return [b[base + offs[i]:base + offs[i + 1]] for i in range(count)], base + offs[-1]


def dict_(d):
    """Reads a CFF DICT into {operator: [operands]} (operator 12 x is 1200 + x)."""
    out, ops, i = {}, [], 0
    while i < len(d):
        b0 = d[i]
        if b0 <= 21:
            op = b0
            if b0 == 12:
                i += 1
                op = 1200 + d[i]
            out[op] = ops
            ops = []
            i += 1
        elif b0 == 28:
            ops.append(int.from_bytes(d[i + 1:i + 3], 'big', signed=True)); i += 3
        elif b0 == 29:
            ops.append(int.from_bytes(d[i + 1:i + 5], 'big', signed=True)); i += 5
        elif b0 == 30:
            s, i, done = '', i + 1, False
            while not done:
                for nib in (d[i] >> 4, d[i] & 15):
                    if nib == 15:
                        done = True
                        break
                    s += ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '.', 'e', 'e-', '', '-'][nib]
                i += 1
            try:
                ops.append(float(s))
            except ValueError:
                ops.append(0.0)
        elif 32 <= b0 <= 246:
            ops.append(b0 - 139); i += 1
        elif 247 <= b0 <= 250:
            ops.append((b0 - 247) * 256 + d[i + 1] + 108); i += 2
        elif 251 <= b0 <= 254:
            ops.append(-(b0 - 251) * 256 - d[i + 1] - 108); i += 2
        else:
            i += 1
    return out


def bias(subrs):
    n = len(subrs)
    return 107 if n < 1240 else 1131 if n < 33900 else 32768


class Glyph:
    """Runs a Type 2 charstring and records the outline as an SVG path (font units, y up)."""

    def __init__(self, gsubrs, lsubrs, nominal, default):
        self.g, self.l, self.nom, self.w = gsubrs, lsubrs, nominal, default
        self.x = self.y = 0.0
        self.d = []
        self.stems = 0
        self.width_done = False
        self.open = False

    def width(self, st, even):
        """The first stack-clearing operator may carry the advance width as an extra first operand."""
        if not self.width_done:
            self.width_done = True
            if st and (len(st) % 2 == 1) == even:
                self.w = self.nom + st.pop(0)

    def move(self, dx, dy):
        if self.open:
            self.d.append('Z')
        self.x += dx; self.y += dy
        self.d.append('M%g %g' % (self.x, self.y))
        self.open = True

    def line(self, dx, dy):
        self.x += dx; self.y += dy
        self.d.append('L%g %g' % (self.x, self.y))

    def curve(self, a, b, c, d_, e, f):
        x1, y1 = self.x + a, self.y + b
        x2, y2 = x1 + c, y1 + d_
        self.x, self.y = x2 + e, y2 + f
        self.d.append('C%g %g %g %g %g %g' % (x1, y1, x2, y2, self.x, self.y))

    def run(self, cs, st=None):
        st = [] if st is None else st
        i = 0
        while i < len(cs):
            b0 = cs[i]
            if b0 >= 32 or b0 == 28:
                if b0 == 28:
                    st.append(int.from_bytes(cs[i + 1:i + 3], 'big', signed=True)); i += 3
                elif b0 <= 246:
                    st.append(b0 - 139); i += 1
                elif b0 <= 250:
                    st.append((b0 - 247) * 256 + cs[i + 1] + 108); i += 2
                elif b0 <= 254:
                    st.append(-(b0 - 251) * 256 - cs[i + 1] - 108); i += 2
                else:
                    st.append(int.from_bytes(cs[i + 1:i + 5], 'big', signed=True) / 65536); i += 5
                continue
            i += 1
            if b0 in (1, 3, 18, 23):  # stems
                self.width(st, True)
                self.stems += len(st) // 2; st.clear()
            elif b0 in (19, 20):  # hintmask / cntrmask (implicit vstems first)
                self.width(st, True)
                self.stems += len(st) // 2; st.clear()
                i += (self.stems + 7) // 8
            elif b0 == 21:
                self.width(st, False); self.move(st[-2], st[-1]); st.clear()
            elif b0 == 22:
                self.width(st, True); self.move(st[-1], 0); st.clear()
            elif b0 == 4:
                self.width(st, True); self.move(0, st[-1]); st.clear()
            elif b0 == 5:
                for k in range(0, len(st) - 1, 2):
                    self.line(st[k], st[k + 1])
                st.clear()
            elif b0 in (6, 7):
                horiz = b0 == 6
                for v in st:
                    if horiz:
                        self.line(v, 0)
                    else:
                        self.line(0, v)
                    horiz = not horiz
                st.clear()
            elif b0 == 8:
                for k in range(0, len(st) - 5, 6):
                    self.curve(*st[k:k + 6])
                st.clear()
            elif b0 == 24:  # rcurveline
                for k in range(0, len(st) - 2, 6):
                    self.curve(*st[k:k + 6])
                self.line(st[-2], st[-1]); st.clear()
            elif b0 == 25:  # rlinecurve
                for k in range(0, len(st) - 6, 2):
                    self.line(st[k], st[k + 1])
                self.curve(*st[-6:]); st.clear()
            elif b0 == 26:  # vvcurveto
                k, dx1 = 0, 0
                if len(st) % 4 == 1:
                    dx1, k = st[0], 1
                while k + 3 < len(st):
                    self.curve(dx1, st[k], st[k + 1], st[k + 2], 0, st[k + 3]); dx1 = 0; k += 4
                st.clear()
            elif b0 == 27:  # hhcurveto
                k, dy1 = 0, 0
                if len(st) % 4 == 1:
                    dy1, k = st[0], 1
                while k + 3 < len(st):
                    self.curve(st[k], dy1, st[k + 1], st[k + 2], st[k + 3], 0); dy1 = 0; k += 4
                st.clear()
            elif b0 in (30, 31):  # vhcurveto / hvcurveto
                h = b0 == 31
                k, n = 0, len(st)
                while k + 4 <= n:
                    extra = st[k + 4] if n - k == 5 else 0
                    if h:
                        self.curve(st[k], 0, st[k + 1], st[k + 2], extra, st[k + 3])
                    else:
                        self.curve(0, st[k], st[k + 1], st[k + 2], st[k + 3], extra)
                    h = not h
                    k += 4
                st.clear()
            elif b0 == 10:
                n = int(st.pop()) + bias(self.l)
                if self.run(self.l[n], st):
                    return True
            elif b0 == 29:
                n = int(st.pop()) + bias(self.g)
                if self.run(self.g[n], st):
                    return True
            elif b0 == 11:
                return False
            elif b0 == 14:
                self.width(st, True)
                if self.open:
                    self.d.append('Z'); self.open = False
                return True
            elif b0 == 12:
                e = cs[i]; i += 1
                a = st
                if e == 35:  # flex
                    self.curve(*a[0:6]); self.curve(*a[6:12])
                elif e == 34:  # hflex
                    self.curve(a[0], 0, a[1], a[2], a[3], 0); self.curve(a[4], 0, a[5], -a[2], a[6], 0)
                elif e == 36:  # hflex1
                    self.curve(a[0], a[1], a[2], a[3], a[4], 0)
                    self.curve(a[5], 0, a[6], a[7], a[8], -(a[1] + a[3] + a[7]))
                elif e == 37:  # flex1
                    dx = sum(a[0:10:2]); dy = sum(a[1:10:2])
                    self.curve(*a[0:6])
                    if abs(dx) > abs(dy):
                        self.curve(a[6], a[7], a[8], a[9], a[10], -dy)
                    else:
                        self.curve(a[6], a[7], a[8], a[9], -dx, a[10])
                st.clear()
            else:
                st.clear()
        return False


def cff(b):
    """Parses a CFF font program; returns (name, units per em, is CID, {key: {d, w}})."""
    hdr = b[2]
    names, p = index(b, hdr)
    tops, p = index(b, p)
    strings, p = index(b, p)
    gsubrs, p = index(b, p)
    top = dict_(tops[0])
    cs, _ = index(b, top[17][0])
    n = len(cs)

    def sid(s):
        return ASCII.get(s) or (strings[s - 391].decode('latin-1') if s >= 391 else 'sid%d' % s)

    cid = 1230 in top
    ids = [0]
    cp = top.get(15, [0])[0]
    if cp > 2:
        fmt = b[cp]; q = cp + 1
        while len(ids) < n:
            if fmt == 0:
                ids.append(int.from_bytes(b[q:q + 2], 'big')); q += 2
            else:
                first = int.from_bytes(b[q:q + 2], 'big')
                left = b[q + 2] if fmt == 1 else int.from_bytes(b[q + 2:q + 4], 'big')
                q += 3 if fmt == 1 else 4
                ids.extend(range(first, first + left + 1))
    ids = ids[:n]

    def private(dct):
        size, off = dct[18]
        pd = dict_(b[off:off + size])
        subrs = index(b, off + pd[19][0])[0] if 19 in pd else []
        return subrs, pd.get(21, [0])[0], pd.get(20, [0])[0]

    if cid:
        fds = [dict_(x) for x in index(b, top[1236][0])[0]]
        privs = [private(f) for f in fds]
        sel = top[1237][0]
        fdof = []
        if b[sel] == 0:
            fdof = list(b[sel + 1:sel + 1 + n])
        else:
            nr = int.from_bytes(b[sel + 1:sel + 3], 'big')
            rng = [(int.from_bytes(b[sel + 3 + k * 3:sel + 5 + k * 3], 'big'), b[sel + 5 + k * 3]) for k in range(nr)]
            rng.append((int.from_bytes(b[sel + 3 + nr * 3:sel + 5 + nr * 3], 'big'), 0))
            for k in range(nr):
                fdof += [rng[k][1]] * (rng[k + 1][0] - rng[k][0])
    else:
        privs = [private(top)]
        fdof = [0] * n
    fm = top.get(1207, [0.001])
    upm = round(1 / fm[0]) if fm[0] else 1000
    glyphs = {}
    for gid in range(1, n):
        subrs, nom, dflt = privs[fdof[gid] if gid < len(fdof) else 0]
        g = Glyph(gsubrs, subrs, nom, dflt)
        try:
            g.run(cs[gid])
        except (IndexError, KeyError, TypeError):
            continue
        key = ('cid%d' % ids[gid]) if cid else sid(ids[gid])
        glyphs[key] = {'d': ''.join(g.d), 'w': g.w}
    return names[0].decode('latin-1'), upm, cid, glyphs


def main():
    src, out = Path(sys.argv[1]), Path(sys.argv[2])
    out.mkdir(parents=True, exist_ok=True)
    data = src.read_bytes()
    written = set()
    for m in re.finditer(rb'/FontFile3\s+(\d+)\s+0\s+R', data):
        n = int(m.group(1))
        o = re.search(rb'(?<!\d)%d\s+0\s+obj\b' % n, data)
        head_end = data.find(b'stream', o.end())
        head = data[o.end():head_end]
        ln = int(re.search(rb'/Length\s+(\d+)', head).group(1))
        start = head_end + 6 + (2 if data[head_end + 6:head_end + 8] == b'\r\n' else 1)
        raw = data[start:start + ln]
        if b'Flate' in head:
            raw = zlib.decompress(raw)
        try:
            name, upm, cid, glyphs = cff(raw)
        except Exception as e:  # report and go on with the other fonts
            print('font object', n, 'not read:', e)
            continue
        name = name.split('+')[-1]
        # The PDF can carry several subsets of one font: merge them.
        if (out / (name + '.json')).exists() and name not in written:
            pass
        elif (out / (name + '.json')).exists():
            glyphs = {**json.loads((out / (name + '.json')).read_text())['glyphs'], **glyphs}
        written.add(name)
        (out / (name + '.json')).write_text(json.dumps({'name': name, 'upm': upm, 'cid': cid, 'glyphs': glyphs}))
        print(name, upm, 'CID' if cid else '', len(glyphs), ''.join(sorted(k for k in glyphs if len(k) == 1)))


if __name__ == '__main__':
    main()
