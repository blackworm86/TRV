"""Cuts the four finish lines out of the official sheet, along its own cutting outline.

The sheet (Thunder_Road_Finishlines.pdf) has two finish lines on each of its first two pages and
their cutting outlines on the third: a strip with teeth that fit the stepped front edge of a road
tile. Each one is written as a PNG with the outside transparent, turned the way it lies on the
table: teeth to the left (toward the road tiles), the tile's name strip side up.

    python tools/asset-pipeline/finish_lines.py [sheet.pdf] [out_dir]

Needs PyMuPDF and Pillow. Observations only: it prints what it wrote and the sizes it measured.
"""
import io
import os
import sys

import pymupdf
from PIL import Image, ImageDraw

SHEET = os.path.join('assets', 'sorgenti', 'TRV 03 Finish Lines', 'Thunder_Road_Finishlines.pdf')
OUT = os.path.join('assets', 'base', 'traguardi')
# Page (from 0), which outline of page 3 (0 left, 1 right) and the file's name, in the sheet's order.
PIECES = [(0, 0, 'the_cliff'), (0, 1, 'the_wall'), (1, 0, 'the_grid'), (1, 1, 'the_dome')]
DPI = 200
MM_PER_PT = 25.4 / 72


def outlines(doc):
    """The two cutting outlines of the last page, as polygons in page points, left one first."""
    found = []
    for d in doc[2].get_drawings():
        if d['rect'].height < 600:
            continue
        pts = []
        for it in d['items']:
            if it[0] == 'l':
                pts += [it[1], it[2]]
            elif it[0] == 'c':  # a rounded corner: its ends are enough at this size
                pts += [it[1], it[4]]
        found.append((d['rect'], [(p.x, p.y) for p in pts]))
    return sorted(found, key=lambda f: f[0].x0)


def main():
    sheet = sys.argv[1] if len(sys.argv) > 1 else SHEET
    out = sys.argv[2] if len(sys.argv) > 2 else OUT
    os.makedirs(out, exist_ok=True)
    doc = pymupdf.open(sheet)
    cuts = outlines(doc)
    k = DPI / 72
    for page, side, name in PIECES:
        rect, poly = cuts[side]
        pix = doc[page].get_pixmap(dpi=DPI, clip=rect)
        art = Image.open(io.BytesIO(pix.tobytes('png'))).convert('RGBA')
        # The mask is drawn four times larger and shrunk, for a smooth edge.
        big = Image.new('L', (art.width * 4, art.height * 4), 0)
        ImageDraw.Draw(big).polygon([((x - rect.x0) * k * 4, (y - rect.y0) * k * 4) for x, y in poly], fill=255)
        art.putalpha(big.resize(art.size, Image.LANCZOS))
        if side == 1:  # the right-hand ones are printed the other way round
            art = art.rotate(180)
        path = os.path.join(out, name + '.png')
        art.save(path, optimize=True)
        print('%s: %d x %d px, %.1f x %.1f mm, %d KB' % (path, art.width, art.height, rect.width * MM_PER_PT, rect.height * MM_PER_PT, os.path.getsize(path) // 1024))


if __name__ == '__main__':
    main()
