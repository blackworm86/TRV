"""Extracts the base-game component images from the licensed source files.

Reads  assets/sorgenti/TRV 01 Base Game/  (the user's licensed files, never in git)
Writes assets/estratti/base/      (also never in git)

The file names written here are the ones data/trv/catalog_base.json refers to, so anyone who
owns the licensed files can rebuild the same assets with:

    python tools/assets/extract_base.py

Needs PyMuPDF (fitz) and Pillow.
"""

import io
import json
import sys
import zipfile
from pathlib import Path

import fitz  # PyMuPDF
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "assets" / "sorgenti" / "TRV 01 Base Game"
OUT = ROOT / "assets" / "estratti" / "base"

# Road tiles: PDF page i holds this face (tile number + side).
ROAD_FACES = ["1a", "1b", "2a", "2b", "3a", "3b", "4a", "4b", "5a", "5b"]
# Danger Tiles Base.pdf, page 1: embedded images from top to bottom of the print sheet.
HAZARDS = ["mud", "road", "oil", "mine", "wreck", "back"]
# Custom Tiles Base.pdf, page 1: the damage tokens, top to bottom.
DAMAGE = ["shrapnel", "dazed", "dent", "skid", "blastoff", "back"]
# Player Boards and Dice Base.docx: media file -> (output name, turns of 90 deg to make it upright).
BOARDS = {
    "image1.png": ("dashboards/grey_M", 2), "image2.png": ("dashboards/grey_S", 2), "image3.png": ("dashboards/grey_L", 2),
    "image7.png": ("dashboards/green_M", 2), "image8.png": ("dashboards/green_L", 2), "image9.png": ("dashboards/green_S", 2),
    "image10.png": ("dashboards/orange_L", 2), "image11.png": ("dashboards/orange_M", 2), "image12.png": ("dashboards/orange_S", 2),
    "image13.png": ("dashboards/blue_M", 2), "image14.png": ("dashboards/blue_L", 2), "image15.png": ("dashboards/blue_S", 2),
    "image4.png": ("dashboards/back_M", 2), "image5.png": ("dashboards/back_S", 2), "image6.png": ("dashboards/back_L", 2),
    "image16.png": ("command_boards/grey", 2), "image17.png": ("command_boards/green", 2),
    "image18.png": ("command_boards/orange", 2), "image19.png": ("command_boards/blue", 0),
}
# Dice nets: 3 x 2 faces in the lower two thirds of the image. Per face: (file name, turns of
# 90 deg so that "forward" or the text is up).
DICE = {
    "image20.png": ("direction", [("B", 0), ("F", 0), ("BL", 0), ("FL", 2), ("FR", 0), ("BR", 2)]),
    "image22.png": ("road", [("1a", 0), ("1b", 0), ("3", 0), ("2a", 2), ("1c", 0), ("2b", 2)]),
    "image23.png": ("shooting", [("L_a", 0), ("M", 0), ("SM", 0), ("L_b", 2), ("L_c", 0), ("ANY", 2)]),
    "image24.png": ("slam", [("bottom_a", 0), ("top_a", 0), ("bottom_b", 0), ("bottom_c", 2), ("top_b", 0), ("bottom_d", 2)]),
    "image25.png": ("stunt", [("3a", 0), ("2a", 0), ("2b", 0), ("4", 2), ("1", 0), ("3b", 2)]),
}


def save(img: Image.Image, rel: str, report: dict) -> None:
    path = OUT / f"{rel}.png"
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, optimize=True)
    report[rel] = list(img.size)


def transparent_border(img: Image.Image, dark: bool, threshold: int, crop: bool) -> Image.Image:
    """Makes the background touching the image border transparent (black or white margin)."""
    rgb = img.convert("RGB")
    bg = rgb.convert("L").point(lambda v: 255 if (v < threshold if dark else v > threshold) else 0)
    w, h = bg.size
    seeds = [(x, y) for x in range(0, w, 8) for y in (0, h - 1)] + [(x, y) for y in range(0, h, 8) for x in (0, w - 1)]
    for s in seeds:
        if bg.getpixel(s) == 255:
            ImageDraw.floodfill(bg, s, 128)
    alpha = bg.point(lambda v: 0 if v == 128 else 255)
    out = rgb.convert("RGBA")
    out.putalpha(alpha)
    box = alpha.getbbox()
    return out.crop(box) if crop and box else out


def pdf_images(pdf: Path, page: int) -> list[Image.Image]:
    """Embedded images of a page, in reading order of their first placement on the sheet."""
    doc = fitz.open(pdf)
    p = doc[page]
    found = []
    for info in p.get_images(full=True):
        xref = info[0]
        rect = p.get_image_rects(xref)[0]
        found.append(((round(rect.y0), round(rect.x0)), Image.open(io.BytesIO(doc.extract_image(xref)["image"]))))
    return [im for _, im in sorted(found, key=lambda t: t[0])]


def main() -> int:
    if not SRC.exists():
        print(f"Licensed files not found: {SRC}", file=sys.stderr)
        return 1
    report: dict = {}

    # Road tiles: 2048 px wide, black print margin transparent, frame kept uncropped so the
    # space grid measured on it (src/game/trv, prototypes) stays valid.
    doc = fitz.open(SRC / "Road Tiles Base.pdf")
    for i, face in enumerate(ROAD_FACES):
        xref = doc[i].get_images()[0][0]
        im = Image.open(io.BytesIO(doc.extract_image(xref)["image"])).convert("RGB")
        im = im.resize((2048, round(2048 * im.size[1] / im.size[0])), Image.LANCZOS)
        save(transparent_border(im, dark=True, threshold=22, crop=False), f"road_tiles/{face}", report)

    for name, im in zip(HAZARDS, pdf_images(SRC / "Danger Tiles Base.pdf", 0)):
        save(transparent_border(im, dark=False, threshold=245, crop=True), f"hazards/{name}", report)
    for name, im in zip(DAMAGE, pdf_images(SRC / "Custom Tiles Base.pdf", 0)):
        save(transparent_border(im, dark=False, threshold=245, crop=True), f"damage/{name}", report)

    with zipfile.ZipFile(SRC / "Player Boards and Dice Base.docx") as z:
        for media, (rel, turns) in BOARDS.items():
            im = Image.open(io.BytesIO(z.read(f"word/media/{media}")))
            im = transparent_border(im, dark=False, threshold=238, crop=True).rotate(90 * turns, expand=True)
            save(im, rel, report)
        for media, (die, faces) in DICE.items():
            im = Image.open(io.BytesIO(z.read(f"word/media/{media}"))).convert("RGB")
            w, h = im.size
            cw, ch, top = w / 3, h / 3, h / 3
            for k, (face, turns) in enumerate(faces):
                col, row = k % 3, k // 3
                box = (round(col * cw), round(top + row * ch), round((col + 1) * cw), round(top + (row + 1) * ch))
                cell = im.crop(box).rotate(90 * turns, expand=True).resize((256, 256), Image.LANCZOS)
                save(cell, f"dice/{die}/{face}", report)

    (OUT / "_extract_report.json").write_text(json.dumps(report, indent=1), encoding="utf-8")
    print(f"{len(report)} images written to {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
