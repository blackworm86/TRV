"""Saves the Carnage at Devil's Run tokens for the game, from the official scans (assets/estratti):

- the six hazard tokens and their back (Danger Tiles.pdf, assets/estratti/expansions/danger_tiles):
  scanned pointing up, turned to point right like the base game's hazard tokens, cut to the token
  and saved as assets/carnage/segnalini/pericolo/<type>.jpg (back.jpg for the back). The game cuts
  them with the base hazard chevron (src/view/vector/art.ts);
- the two new damage tokens, ON FIRE and ONGOING EFFECT (Custom Tiles.pdf,
  assets/estratti/expansions/custom_tiles), saved like the base damage tokens
  (tools/art/save_damage_tokens.py: cut to the red frame) as assets/carnage/segnalini/danno/<type>.jpg.
  Their back is the base game's: the owner's drawing.

Which scan is which was read off the scans themselves (the printed names and pictures). The danger
tile sheet also holds the base game's mine, oil and back (red; the expansion's back is orange, with its mark) and five plain sand tiles: not tokens of
this expansion, so they are not saved.

Usage: python tools/art/save_carnage_tokens.py
"""
import sys
from pathlib import Path

import cv2
import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
from save_damage_tokens import FACE_RATIO, face_crop, flat, no_paper, shrink_to  # noqa: E402

DANGER = Path('assets/estratti/expansions/danger_tiles')
CUSTOM = Path('assets/estratti/expansions/custom_tiles')
OUT_HAZARD = Path('assets/carnage/segnalini/pericolo')
OUT_DAMAGE = Path('assets/carnage/segnalini/danno')

#: Scan page number → hazard type (Carnage at Devil's Run, CDR p3), and the back.
HAZARDS = {11: 'fire', 12: 'pit_trap', 18: 'ramp', 19: 'desert_glass', 20: 'sand_worm', 21: 'quake', 31: 'back'}
#: Scan page number → damage type.
DAMAGE = {7: 'ongoing_effect', 8: 'on_fire'}
#: Width of a saved hazard token (pointing right) and of a damage token, in px.
HAZARD_WIDTH = 360
#: A pixel whose darkest channel is above this is the white page (the desert glass is pale blue).
PAPER_MIN = 222
#: Share of the cut token, right and bottom, that is the scanner's shadow (measured: ~11 px of 306 at the bottom).
SHADOW = (0.01, 0.036)
DAMAGE_WIDTH = 480


def scan(folder: Path, page: int) -> np.ndarray:
    return flat(cv2.imread(str(next(folder.glob(f'img-{page:04d}-*.png'))), cv2.IMREAD_UNCHANGED))


def token_box(img: np.ndarray) -> np.ndarray:
    """The image cut to the token: the box of everything that is not the white page."""
    ink = (img.min(axis=2) <= PAPER_MIN).astype(np.uint8)
    ink = cv2.morphologyEx(ink, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    ys, xs = np.nonzero(ink)
    return img[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def main() -> None:
    OUT_HAZARD.mkdir(parents=True, exist_ok=True)
    OUT_DAMAGE.mkdir(parents=True, exist_ok=True)
    for page, name in HAZARDS.items():
        tok = token_box(cv2.rotate(scan(DANGER, page), cv2.ROTATE_90_CLOCKWISE))
        # The scanner's shadow under and right of the token is not part of it.
        h, w = tok.shape[:2]
        tok = tok[:round(h * (1 - SHADOW[1])), :round(w * (1 - SHADOW[0]))]
        tok = no_paper(shrink_to(tok, HAZARD_WIDTH), PAPER_MIN)
        cv2.imwrite(str(OUT_HAZARD / f'{name}.jpg'), tok, [cv2.IMWRITE_JPEG_QUALITY, 90])
        print('pericolo', name, tok.shape[1], 'x', tok.shape[0])
    for page, name in DAMAGE.items():
        # Cut to the red frame like the base tokens, so the same outline frames it.
        tok = cv2.resize(shrink_to(face_crop(scan(CUSTOM, page)), DAMAGE_WIDTH), (DAMAGE_WIDTH, round(DAMAGE_WIDTH * FACE_RATIO)), interpolation=cv2.INTER_AREA)
        cv2.imwrite(str(OUT_DAMAGE / f'{name}.jpg'), tok, [cv2.IMWRITE_JPEG_QUALITY, 90])
        print('danno', name, tok.shape[1], 'x', tok.shape[0])


if __name__ == '__main__':
    main()
