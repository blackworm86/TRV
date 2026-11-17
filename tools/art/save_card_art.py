"""Saves the pieces of the official cards that the digital cards are built from, cut from the
scanned print-and-play pages (assets/estratti/expansions/trv_v2) at full resolution:

- the illustration of every Choppe Shoppe upgrade and Carnage ongoing effect, without the card's
  own frame: from just inside the rounded corners down to just above the torn edge of the text
  panel. Written to <cards>/illustrazioni/<id>.jpg;
- the pictograms printed in some upgrade panels (the range of the guns, the three hazard tokens of
  the dispensers): they have no words, so the digital card shows them as printed. Written to
  assets/choppe_shoppe/carte/potenziamenti/pittogrammi/<id>.png, their edge faded to transparent so
  they sit on the digital panel without a seam.

The cards are found and straightened by tools/art/extract_cards.py; which cut is which card comes
from tools/art/upgrade_cards.json and tools/art/ongoing_cards.json. The digital card is drawn by
src/view/vector/cards.ts.

Usage: python tools/art/save_card_art.py
"""
import json
import sys
from pathlib import Path

import cv2
import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
from extract_cards import PAGES, cards_on  # noqa: E402

UPGRADES = Path('assets/choppe_shoppe/carte/potenziamenti')
ONGOING = Path('assets/carnage/carte/effetto_continuo')

#: The illustration's box on the straightened card, as shares of its width and height: inside the
#: rounded corners, above the torn edge (measured on the scans: upgrade panels start at 0.50 at
#: their highest point, ongoing panels at 0.47).
ART_BOX = {
    'upgrade': (0.018, 0.013, 0.982, 0.495),
    'ongoing': (0.022, 0.015, 0.978, 0.462),
}
#: Width of the saved illustration, in px.
ART_WIDTH = {'upgrade': 900, 'ongoing': 640}

#: The pictograms in the upgrade panels, as (left, top, right, bottom) on a 630 x 880 card.
PICTOGRAMS = {
    'rail_gun': (356, 590, 576, 690),
    'punt_gun': (370, 540, 550, 776),
    'rear_guns': (380, 556, 560, 712),
    'oil_dispenser': (386, 714, 608, 850),
    'mine_dispenser': (376, 714, 598, 858),
}
PICTO_SCALE = 2.0  # saved at twice the 630 x 880 card's size


def cards(table_path: str) -> dict[str, np.ndarray]:
    """Every card of a map file, straightened and the right way up, by data id."""
    table = json.loads(Path(table_path).read_text(encoding='utf8'))
    by_page: dict[str, list[np.ndarray]] = {}
    out = {}
    for key, value in table.items():
        if key.startswith('_'):
            continue
        page, n = key.split('-')
        if page not in by_page:
            by_page[page] = cards_on(next(PAGES.glob(f'img-{page}-*.png')))
        card = by_page[page][int(n) - 1]
        card_id, _, turn = value.partition(':')
        if turn == '180':
            card = cv2.rotate(card, cv2.ROTATE_180)
        out[card_id] = card
    return out


def shrink(img: np.ndarray, width: int) -> np.ndarray:
    """Down to `width`, blurred first so the print's halftone does not turn into moiré."""
    k = img.shape[1] / width
    if k > 1.5:
        img = cv2.GaussianBlur(img, (0, 0), k * 0.35)
    return cv2.resize(img, (width, round(width * img.shape[0] / img.shape[1])), interpolation=cv2.INTER_AREA)


def illustration(card: np.ndarray, kind: str) -> np.ndarray:
    h, w = card.shape[:2]
    x0, y0, x1, y1 = ART_BOX[kind]
    return shrink(card[round(y0 * h):round(y1 * h), round(x0 * w):round(x1 * w)], ART_WIDTH[kind])


def pictogram(card: np.ndarray, box: tuple[int, int, int, int]) -> np.ndarray:
    """The pictogram with an alpha channel that fades its edge out (an eighth of its short side)."""
    h, w = card.shape[:2]
    kx, ky = w / 630, h / 880
    x0, y0, x1, y1 = box
    part = card[round(y0 * ky):round(y1 * ky), round(x0 * kx):round(x1 * kx)]
    part = shrink(part, round((x1 - x0) * PICTO_SCALE))
    ph, pw = part.shape[:2]
    fade = max(4, min(ph, pw) // 8)
    ramp = lambda n: np.minimum(1, np.minimum(np.arange(n) + 0.5, n - np.arange(n) - 0.5) / fade)  # noqa: E731
    alpha = (np.outer(ramp(ph), ramp(pw)) * 255).round().astype(np.uint8)
    return np.dstack([part, alpha])


def main() -> None:
    for kind, table, folder in (('upgrade', 'tools/art/upgrade_cards.json', UPGRADES), ('ongoing', 'tools/art/ongoing_cards.json', ONGOING)):
        (folder / 'illustrazioni').mkdir(parents=True, exist_ok=True)
        for card_id, card in cards(table).items():
            art = illustration(card, kind)
            cv2.imwrite(str(folder / 'illustrazioni' / f'{card_id}.jpg'), art, [cv2.IMWRITE_JPEG_QUALITY, 86])
            print(kind, card_id, art.shape[1], 'x', art.shape[0])
            if card_id in PICTOGRAMS:
                (UPGRADES / 'pittogrammi').mkdir(exist_ok=True)
                cv2.imwrite(str(UPGRADES / 'pittogrammi' / f'{card_id}.png'), pictogram(card, PICTOGRAMS[card_id]))


if __name__ == '__main__':
    main()
