"""Extracts the raster images of a PDF (the official rulebook) into files, one per image.

Dependency-free: JPEG streams (DCTDecode) are written as they are; Flate-compressed RGB, grey
and CMYK images are written as PNG (CMYK converted to RGB), with their soft mask as alpha when
present. Images smaller than --min pixels on a side are skipped (rules, dots, textures).

Usage: python -I tools/asset-pipeline/pdf_images.py <file.pdf> <out_dir> [--min 64]
The images are licensed material: write them under assets/licensed/ (not in git).
"""
import re
import struct
import sys
import zlib
from pathlib import Path


def dict_of(head):
    """Very small dictionary reader for image stream headers (flat keys only)."""
    d = {}
    for m in re.finditer(rb'/(\w+)\s*(/\w+|\d+\s+\d+\s+R|-?\d+\.?\d*|\[[^\]]*\]|true|false)', head):
        d.setdefault(m.group(1).decode(), m.group(2).decode())
    return d


def png(width, height, channels, data):
    """PNG from raw 8-bit rows (channels 1, 3 or 4)."""
    kind = {1: 0, 3: 2, 4: 6}[channels]
    stride = width * channels
    raw = b''.join(b'\x00' + data[y * stride:(y + 1) * stride] for y in range(height))

    def chunk(t, body):
        return struct.pack('>I', len(body)) + t + body + struct.pack('>I', zlib.crc32(t + body) & 0xffffffff)
    return (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, kind, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress(raw, 6)) + chunk(b'IEND', b''))


def main():
    src = Path(sys.argv[1])
    out = Path(sys.argv[2])
    minpx = int(sys.argv[sys.argv.index('--min') + 1]) if '--min' in sys.argv else 64
    out.mkdir(parents=True, exist_ok=True)
    data = src.read_bytes()
    objs = {}
    for m in re.finditer(rb'(\d+)\s+0\s+obj\b', data):
        objs[int(m.group(1))] = m.end()

    def body(n):
        pos = objs[n]
        end = data.find(b'endobj', pos)
        chunk = data[pos:end]
        sm = re.search(rb'stream\r?\n', chunk)
        if not sm:
            return chunk, None
        head = chunk[:sm.start()]
        d = dict_of(head)
        length = d.get('Length', '0')
        if length.endswith('R'):
            ln = int(re.search(rb'\d+', body(int(length.split()[0]))[0]).group())
        else:
            ln = int(float(length))
        start = pos + sm.end()
        return head, data[start:start + ln]

    report = []
    for n in sorted(objs):
        head, stream = body(n)
        if stream is None or b'/Image' not in head:
            continue
        d = dict_of(head)
        w, h = int(float(d.get('Width', 0))), int(float(d.get('Height', 0)))
        if min(w, h) < minpx:
            continue
        flt = d.get('Filter', '')
        cs = d.get('ColorSpace', '')
        bpc = int(float(d.get('BitsPerComponent', 8)))
        name = 'img-%04d-%dx%d' % (n, w, h)
        if 'DCT' in flt:
            (out / (name + '.jpg')).write_bytes(stream)
            report.append((name + '.jpg', w, h, cs))
            continue
        if 'Flate' not in flt or bpc != 8:
            report.append((name + ' (skipped: %s %d bpc)' % (flt, bpc), w, h, cs))
            continue
        try:
            raw = zlib.decompress(stream)
        except zlib.error:
            report.append((name + ' (skipped: bad stream)', w, h, cs))
            continue
        ch = {'/DeviceGray': 1, '/DeviceRGB': 3, '/DeviceCMYK': 4}.get(cs, len(raw) // (w * h) if w * h else 3)
        if ch == 4:  # CMYK -> RGB
            rgb = bytearray()
            for i in range(0, w * h * 4, 4):
                c, m_, y, k = raw[i:i + 4]
                rgb += bytes(((255 - c) * (255 - k) // 255, (255 - m_) * (255 - k) // 255, (255 - y) * (255 - k) // 255))
            raw, ch = bytes(rgb), 3
        if ch not in (1, 3):
            report.append((name + ' (skipped: %d channels)' % ch, w, h, cs))
            continue
        # Soft mask as alpha, when it has the same size.
        sm = d.get('SMask')
        if sm and ch == 3:
            mh, ms = body(int(sm.split()[0]))
            md = dict_of(mh)
            if ms and int(float(md.get('Width', 0))) == w and int(float(md.get('Height', 0))) == h and 'Flate' in md.get('Filter', ''):
                alpha = zlib.decompress(ms)
                if len(alpha) == w * h:
                    raw = b''.join(raw[i * 3:i * 3 + 3] + alpha[i:i + 1] for i in range(w * h))
                    ch = 4
        (out / (name + '.png')).write_bytes(png(w, h, ch, raw[:w * h * ch]))
        report.append((name + '.png', w, h, cs))
    for r in report:
        print(*r)
    print(len(report), 'images')


if __name__ == '__main__':
    main()
