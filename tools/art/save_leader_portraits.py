"""Cuts each crew leader's portrait out of the scanned character boards (Choppe Shoppe).

The boards are assets/licensed/_derived/expansions/character_boards/image<N>.png, in the order of
the leaders in data/trv/choppe_shoppe.json. The portrait is the coloured window at the top right of
the board, in the same place on every board (WINDOW). It is saved as assets/licensed/leaders/<id>.jpg, where the game looks for it.

Usage: python tools/art/save_leader_portraits.py
"""
import json
from pathlib import Path

import cv2
import numpy as np

BOARDS = Path('assets/licensed/_derived/expansions/character_boards')
OUT = Path('assets/licensed/leaders')


#: The portrait window on every board, as shares of the board's width and height (measured on the
#: scans of Ms. Betty, Cruft and Wong; a little inside the window's edge, clear of its cut corners).
WINDOW = (0.475, 0.015, 0.91, 0.335)


def portrait(img: np.ndarray) -> np.ndarray:
    h, w = img.shape[:2]
    x0, y0, x1, y1 = WINDOW
    return img[round(y0 * h):round(y1 * h), round(x0 * w):round(x1 * w)]


def main() -> None:
    leaders = json.loads(Path('data/trv/choppe_shoppe.json').read_text(encoding='utf8'))['leaders']
    OUT.mkdir(parents=True, exist_ok=True)
    for n, leader in enumerate(leaders, 1):
        img = cv2.imread(str(BOARDS / f'image{n}.png'))
        p = portrait(img)
        p = cv2.resize(p, (480, round(480 * p.shape[0] / p.shape[1])), interpolation=cv2.INTER_AREA)
        cv2.imwrite(str(OUT / f"{leader['id']}.jpg"), p, [cv2.IMWRITE_JPEG_QUALITY, 88])
        print(leader['id'], p.shape[1], 'x', p.shape[0])


if __name__ == '__main__':
    main()
