"""Saves the base game's damage tokens for the game, from the official scans
(assets/estratti/base/damage/*.png, cut by tools/assets/extract_base.py from Custom Tiles Base.pdf).

The front of each token and the back are kept as printed: assets/base/segnalini/danno/<type>.jpg.
The game cuts them with the owner's outline (assets/base/segnalini/danno/template.svg), so the
white page left in the notches of the torn edge never shows.

SKID comes in six tokens, one per direction (rulebook p. 12), but the scans hold only the forward
one: a grid of chevrons, rows offset by half a space like the board, the car on the hollow chevron
and the space it moves to on the filled one. The other five are made from it the way the official
direction die shows its six faces: the filled chevron moves to the space in that direction (half a
space ahead or behind on the row above or below, or one space behind on the same row), always
pointing forward. Written as skid_<F|FL|FR|B|BL|BR>.jpg.

Usage: python tools/art/save_damage_tokens.py
"""
from pathlib import Path

import cv2
import numpy as np

SRC = Path('assets/estratti/base/damage')
OUT = Path('assets/base/segnalini/danno')
TYPES = ['blastoff', 'dazed', 'dent', 'shrapnel', 'skid', 'back']
WIDTH = 480

#: The chevron grid of the skid scan (1064 x 960 px), measured on it: the car's (hollow) chevron,
#: the step between spaces along a row, and between rows.
CAR = (366, 628)
STEP = 147
ROW = 136
#: The filled chevron of the forward token: its centre and a box around it.
FILLED = (517, 627)
HALF = (76, 62)
#: Where the filled chevron goes, as (spaces ahead, rows down) from the car.
DIRS = {'F': (1, 0), 'FL': (0.5, -1), 'FR': (0.5, 1), 'B': (-1, 0), 'BL': (-0.5, -1), 'BR': (-0.5, 1)}


def box(cx: float, cy: float) -> tuple[slice, slice]:
    x, y = round(cx), round(cy)
    return slice(y - HALF[1], y + HALF[1]), slice(x - HALF[0], x + HALF[0])


def skid_tokens(img: np.ndarray) -> dict[str, np.ndarray]:
    """The six skid tokens from the forward scan."""
    # The filled chevron, as printed, and the cream of it (to paste only the chevron, not the grid).
    fy, fx = box(*FILLED)
    chevron = img[fy, fx].copy()
    gray = cv2.cvtColor(chevron, cv2.COLOR_BGR2GRAY)
    sat = cv2.cvtColor(chevron, cv2.COLOR_BGR2HSV)[:, :, 1]
    mask = ((gray > 150) & (sat < 90)).astype(np.uint8)
    mask = cv2.dilate(mask, np.ones((3, 3), np.uint8))
    mask = cv2.GaussianBlur(mask.astype(np.float32), (0, 0), 1.2)[:, :, None]
    # The plain grid under it: the next space along the same row looks the same, unlit.
    plain = img.copy()
    py, px = box(FILLED[0] + STEP, FILLED[1])
    plain[fy, fx] = img[py, px]
    out = {}
    for name, (ahead, down) in DIRS.items():
        tok = plain.copy()
        ty, tx = box(CAR[0] + ahead * STEP, CAR[1] + down * ROW)
        under = tok[ty, tx].astype(np.float32)
        tok[ty, tx] = (under * (1 - mask) + chevron.astype(np.float32) * mask).round().astype(np.uint8)
        out[f'skid_{name}'] = tok
    return out


def no_paper(img: np.ndarray, paper_min: int | None = None) -> np.ndarray:
    """The token with the white page around it (in the notches and at the corners) painted over
    with the token's own edge colours, so a cut that falls a hair outside the print shows the
    edge, never white. `paper_min`: for pale tokens, the darkest channel above which a pixel is page."""
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    if paper_min is None:  # the page and its grey shadow around a dark token
        paper = ((hsv[:, :, 2] > 150) & (hsv[:, :, 1] < 50)).astype(np.uint8)
    else:  # a pale token: only what is near white is the page
        paper = (img.min(axis=2) > paper_min).astype(np.uint8)
    # Only the paper that touches the border: the white of the print (titles, signs) stays.
    n, labels = cv2.connectedComponents(paper)
    edge = set(np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))) - {0}
    mask = np.isin(labels, list(edge)).astype(np.uint8)
    mask = cv2.dilate(mask, np.ones((5, 5), np.uint8))
    return cv2.inpaint(img, mask * 255, 6, cv2.INPAINT_TELEA)


def shrink_to(img: np.ndarray, width: int) -> np.ndarray:
    """Down to `width`, blurred first so the print's halftone does not turn into moiré."""
    k = img.shape[1] / width
    small = cv2.GaussianBlur(img, (0, 0), k * 0.35) if k > 1.5 else img
    return cv2.resize(small, (width, round(width * img.shape[0] / img.shape[1])), interpolation=cv2.INTER_AREA)


def save(img: np.ndarray, name: str) -> None:
    small = no_paper(shrink_to(img, WIDTH))
    cv2.imwrite(str(OUT / f'{name}.jpg'), small, [cv2.IMWRITE_JPEG_QUALITY, 90])
    print(name, small.shape[1], 'x', small.shape[0])


def flat(rgba: np.ndarray) -> np.ndarray:
    """The token on white, as printed (the scans' transparent border becomes paper again)."""
    if rgba.shape[2] == 4:
        a = rgba[:, :, 3:4].astype(np.float32) / 255
        return (rgba[:, :, :3] * a + 255 * (1 - a)).round().astype(np.uint8)
    return rgba


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for t in TYPES:
        img = flat(cv2.imread(str(SRC / f'{t}.png'), cv2.IMREAD_UNCHANGED))
        if t == 'skid':
            for name, tok in skid_tokens(img).items():
                save(tok, name)
        else:
            save(img, t)


if __name__ == '__main__':
    main()
