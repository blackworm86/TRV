"""Traces the official fire die faces (Carnage at Devil's Run) into vector paths for the game.

Source: word/media/image21.png inside assets/sorgenti/TRV 01 Base Game/Player Boards and Dice
Base.docx, the die's six faces as printed (orange
symbols on yellow), two rows of three: +2, smoke, +2 / +1, smoke, skull. Each symbol is traced
(outlines and holes, even-odd fill), centred in a 100 x 100 face and written to
assets/carnage/vettoriale/fire_die.json, which art.ts's fireDieSvg draws.

Usage: python tools/art/trace_fire_die.py
"""
import json
import zipfile
from pathlib import Path

import cv2
import numpy as np

SRC = Path('assets/sorgenti/TRV 01 Base Game/Player Boards and Dice Base.docx')
SRC_MEMBER = 'word/media/image21.png'
OUT = Path('assets/carnage/vettoriale/fire_die.json')
#: The faces on the sheet, left to right and top to bottom, as the data names them (data/trv/carnage.json).
CELLS = [['+2', 'out', '+2b'], ['+1', 'outb', 'eliminated']]
#: The symbol fills this share of the face.
FILL = 0.74


def path_of(mask: np.ndarray, x0: int, y0: int, k: float, ox: float, oy: float) -> str:
    contours, _ = cv2.findContours(mask, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
    parts = []
    for c in contours:
        if cv2.contourArea(c) < 30:
            continue
        c = cv2.approxPolyDP(c, 1.2, True)
        pts = [f'{(p[0][0] - x0) * k + ox:.1f} {(p[0][1] - y0) * k + oy:.1f}' for p in c]
        parts.append('M' + ' L'.join(pts) + 'Z')
    return ''.join(parts)


def main() -> None:
    with zipfile.ZipFile(SRC) as z:
        img = cv2.imdecode(np.frombuffer(z.read(SRC_MEMBER), np.uint8), cv2.IMREAD_COLOR)
    h, w = img.shape[:2]
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    ink = cv2.inRange(hsv, (0, 120, 120), (18, 255, 255))  # the orange, not the yellow
    bg = img[40, 40][::-1]
    fg = cv2.mean(img, ink)[:3][::-1]
    faces = {}
    rows = [(int(h * 0.33), int(h * 0.66)), (int(h * 0.66), h)]
    for r, names in enumerate(CELLS):
        for c, name in enumerate(names):
            x0, x1 = c * w // 3, (c + 1) * w // 3
            y0, y1 = rows[r]
            cell = ink[y0:y1, x0:x1]
            ys, xs = np.nonzero(cell)
            bx0, bx1, by0, by1 = xs.min(), xs.max(), ys.min(), ys.max()
            k = 100 * FILL / max(bx1 - bx0, by1 - by0)
            ox = 50 - (bx1 - bx0) * k / 2
            oy = 50 - (by1 - by0) * k / 2
            faces[name] = path_of(cell[by0:by1 + 1, bx0:bx1 + 1].copy(), 0, 0, k, ox, oy)
    data = {
        '_source': 'traced by tools/art/trace_fire_die.py from the official fire die faces',
        'bg': '#%02x%02x%02x' % tuple(int(v) for v in bg),
        'ink': '#%02x%02x%02x' % tuple(int(v) for v in fg),
        'faces': faces,
    }
    OUT.write_text(json.dumps(data), encoding='utf8')
    print(data['bg'], data['ink'], {k: len(v) for k, v in faces.items()})


if __name__ == '__main__':
    main()
