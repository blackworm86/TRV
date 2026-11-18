"""Makes the game's 3D models lighter (asked by the user, 2026-11-18: "procedi con la compressione
degli asset e l'alleggerimento del gioco"). Nearly all of a model's weight is its colour texture: a
2048 x 2048 PNG, about 3 MB, while its mesh is a few hundred KB. Every texture is opaque, so it is
stored again as a JPEG of at most MAX x MAX pixels: about a tenth of the size, the same look on the
table. The meshes are left as they are. The models are rewritten in place; the originals stay in
git history.

Usage: python tools/art/compress_models.py [--max 1024] [--quality 86] [files...]
(no files: every assets/*/modelli/*.glb). A model whose textures are already JPEGs no larger than
MAX is left untouched, so running it twice changes nothing.
"""
import argparse
import glob
import io
import json
import struct

from PIL import Image


def read_glb(path: str) -> tuple[dict, bytes]:
    """The JSON chunk and the binary chunk of a GLB file."""
    b = open(path, 'rb').read()
    magic, version, _ = struct.unpack('<4sII', b[:12])
    if magic != b'glTF' or version != 2:
        raise ValueError(f'{path}: not a glTF 2 binary')
    n, _ = struct.unpack('<I4s', b[12:20])
    doc = json.loads(b[20:20 + n])
    rest = b[20 + n:]
    binary = b''
    if rest:
        m, _ = struct.unpack('<I4s', rest[:8])
        binary = rest[8:8 + m]
    return doc, binary


def write_glb(path: str, doc: dict, binary: bytes) -> None:
    """Writes a GLB from its JSON and binary chunks (each padded to 4 bytes, as the format asks)."""
    js = json.dumps(doc, separators=(',', ':')).encode('utf8')
    js += b' ' * (-len(js) % 4)
    binary += b'\0' * (-len(binary) % 4)
    total = 12 + 8 + len(js) + 8 + len(binary)
    with open(path, 'wb') as f:
        f.write(struct.pack('<4sII', b'glTF', 2, total))
        f.write(struct.pack('<I4s', len(js), b'JSON') + js)
        f.write(struct.pack('<I4s', len(binary), b'BIN\0') + binary)


def shrink(data: bytes, mime: str, size: int, quality: int) -> bytes | None:
    """The image again as a JPEG of at most `size` pixels a side; None when it is fine as it is or has see-through pixels."""
    im = Image.open(io.BytesIO(data))
    if im.mode in ('RGBA', 'LA', 'P') and im.convert('RGBA').getchannel('A').getextrema()[0] < 255:
        return None  # a JPEG has no transparency
    if mime == 'image/jpeg' and max(im.size) <= size:
        return None
    im = im.convert('RGB')
    if max(im.size) > size:
        k = size / max(im.size)
        im = im.resize((round(im.size[0] * k), round(im.size[1] * k)), Image.LANCZOS)
    out = io.BytesIO()
    im.save(out, 'JPEG', quality=quality, optimize=True)
    return out.getvalue()


def compress(path: str, size: int, quality: int) -> tuple[int, int]:
    """Rewrites the model at `path` with smaller textures; returns its size in bytes before and after."""
    before = len(open(path, 'rb').read())
    doc, binary = read_glb(path)
    views = doc.get('bufferViews', [])
    new_data: dict[int, bytes] = {}
    for img in doc.get('images', []):
        if 'bufferView' not in img:
            continue
        v = views[img['bufferView']]
        o = v.get('byteOffset', 0)
        smaller = shrink(binary[o:o + v['byteLength']], img.get('mimeType', ''), size, quality)
        if smaller is not None:
            new_data[img['bufferView']] = smaller
            img['mimeType'] = 'image/jpeg'
    if not new_data:
        return before, before
    # The binary chunk again, view by view, each on a 4-byte boundary.
    out = bytearray()
    for i, v in enumerate(views):
        o = v.get('byteOffset', 0)
        chunk = new_data.get(i, binary[o:o + v['byteLength']])
        out += b'\0' * (-len(out) % 4)
        v['byteOffset'] = len(out)
        v['byteLength'] = len(chunk)
        out += chunk
    doc['buffers'][0]['byteLength'] = len(out)
    write_glb(path, doc, bytes(out))
    return before, len(open(path, 'rb').read())


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('--max', type=int, default=1024)
    ap.add_argument('--quality', type=int, default=86)
    ap.add_argument('files', nargs='*')
    a = ap.parse_args()
    files = a.files or sorted(glob.glob('assets/*/modelli/*.glb'))
    total = [0, 0]
    for f in files:
        b, n = compress(f, a.max, a.quality)
        total[0] += b
        total[1] += n
        print(f'{f}: {b / 1e6:.2f} MB -> {n / 1e6:.2f} MB')
    print(f'total: {total[0] / 1e6:.1f} MB -> {total[1] / 1e6:.1f} MB')


if __name__ == '__main__':
    main()
