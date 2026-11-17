"""Cuts the crew leaders' portraits out of the scanned character boards (Choppe Shoppe), twice:

- the whole portrait window, for the leader's board and info panel:
  assets/choppe_shoppe/capisquadra/<id>.jpg (what src/app/info.ts loads);
- a square avatar centred on the face, for the new user interface:
  assets/choppe_shoppe/avatar_personaggi/<id>.png.

The boards are assets/estratti/expansions/character_boards/image<N>.png, in the order of the
leaders in data/trv/choppe_shoppe.json. Each scan is found on its white page first (the board is
everything darker than the paper), so the window is measured on the board, not on the page.
The print is a halftone: a light blur before shrinking keeps the dots from making moiré.

Usage: python tools/art/save_leader_avatars.py
"""
import json
from pathlib import Path

import cv2
import numpy as np

BOARDS = Path('assets/estratti/expansions/character_boards')
PORTRAITS = Path('assets/choppe_shoppe/capisquadra')
AVATARS = Path('assets/choppe_shoppe/avatar_personaggi')

#: The portrait window inside the board, as shares of the board's width and height: a little
#: inside the window's cut corners and coloured edge (measured on all eleven boards).
WINDOW = (0.478, 0.026, 0.936, 0.350)
#: The middle of each face, as shares of the window's width and height (read on the portraits).
FACE = {
    'betty': (0.35, 0.36), 'bumpo': (0.50, 0.40), 'abigail': (0.50, 0.48), 'asha': (0.55, 0.40),
    'emberco': (0.50, 0.42), 'vince': (0.50, 0.40), 'cruft': (0.50, 0.42), 'cris': (0.50, 0.36),
    'joe': (0.45, 0.38), 'boudreaux': (0.47, 0.33), 'wong': (0.50, 0.48),
}
#: The avatar's side, as a share of the window's width: head and shoulders.
AVATAR_SIDE = 0.86
PORTRAIT_WIDTH = 720
AVATAR_SIZE = 512


def board_box(img: np.ndarray) -> tuple[int, int, int, int]:
    """The board's box on the scanned page: rows and columns mostly darker than the paper."""
    dark = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) < 225
    rows = np.where(dark.mean(1) > 0.3)[0]
    cols = np.where(dark.mean(0) > 0.3)[0]
    return cols[0], rows[0], cols[-1], rows[-1]


def shrink(img: np.ndarray, width: int) -> np.ndarray:
    """`img` at `width` pixels, blurred first in proportion so the halftone does not beat."""
    k = img.shape[1] / width
    if k > 1.5:
        img = cv2.GaussianBlur(img, (0, 0), sigmaX=k * 0.45)
    return cv2.resize(img, (width, round(width * img.shape[0] / img.shape[1])), interpolation=cv2.INTER_AREA)


def main() -> None:
    leaders = json.loads(Path('data/trv/choppe_shoppe.json').read_text(encoding='utf8'))['leaders']
    PORTRAITS.mkdir(parents=True, exist_ok=True)
    AVATARS.mkdir(parents=True, exist_ok=True)
    for n, leader in enumerate(leaders, 1):
        lid = leader['id']
        img = cv2.imread(str(BOARDS / f'image{n}.png'))
        x0, y0, x1, y1 = board_box(img)
        w, h = x1 - x0, y1 - y0
        wx0, wy0, wx1, wy1 = (round(x0 + WINDOW[0] * w), round(y0 + WINDOW[1] * h), round(x0 + WINDOW[2] * w), round(y0 + WINDOW[3] * h))
        window = img[wy0:wy1, wx0:wx1]
        cv2.imwrite(str(PORTRAITS / f'{lid}.jpg'), shrink(window, PORTRAIT_WIDTH), [cv2.IMWRITE_JPEG_QUALITY, 90])
        # The avatar: a square on the face, kept inside the window.
        ww, wh = window.shape[1], window.shape[0]
        side = round(AVATAR_SIDE * ww)
        fx, fy = FACE[lid]
        ax = min(max(round(fx * ww - side / 2), 0), ww - side)
        ay = min(max(round(fy * wh - side / 2), 0), wh - side)
        avatar = shrink(window[ay:ay + side, ax:ax + side], AVATAR_SIZE)
        cv2.imwrite(str(AVATARS / f'{lid}.png'), avatar)
        print(lid, 'ritratto', ww, 'x', wh, '-> avatar', side, 'px')


if __name__ == '__main__':
    main()
