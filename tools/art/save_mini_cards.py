"""Saves the cards of the mini expansions, cleaned and ready to be translated.

From the cards cut and straightened by tools/art/extract_cards.py (assets/estratti/mini/carte, out
of git; which cut is which card: tools/art/mini_cards.json), for every game card:

- the card turned the right way up and brought to one size (744 x 1040 px, 63 x 88 mm);
- the English rules text erased: the printed letters are found by their colour against the panel
  and painted over from the panel around them (OpenCV inpainting), so the panel keeps its printed
  wear. The name and the card's kind ("ONE SHOT:", "BOUNTY:"...) stay as printed: they are names;
- the box where that text was, so the digital card sets the Italian text in the same place.

Written to assets/mini_espansioni/carte/<family>/<id>.jpg, and the boxes to
assets/mini_espansioni/carte/layout.json ({family: {id: [[x, y, w, h], ...]}}, in card pixels). The
digital card is drawn by src/view/minicards.ts.

Usage: python tools/art/save_mini_cards.py
"""
import json
from pathlib import Path

import cv2
import numpy as np

SRC = Path('assets/estratti/mini/carte')
OUT = Path('assets/mini_espansioni/carte')
W, H = 744, 1040

#: Where the rules text is looked for on each kind of card (x0, y0, x1, y1, ink): `ink` is 'light'
#: for cream letters on a dark panel, 'dark' for black letters on a light one. Measured on the
#: straightened cards; the text itself is found inside, under the last line of the name.
ZONES = {
    'bonus_commands': [(72, 560, 672, 965, 'light')],
    'one_shots': [(72, 640, 672, 965, 'dark')],
    'road_conditions': [(72, 430, 676, 965, 'dark')],
    'advanced_airstrikes': [(72, 640, 668, 952, 'dark')],
    # Bounties: the purple box (what to do) and the orange one (the reward), each wholly text.
    'bounties': [(172, 262, 644, 470, 'light', 'box'), (180, 692, 644, 896, 'dark', 'box')],
}
#: A line taller than this (px) belongs to the name; the rules text is the lines after it.
TITLE_LINE = 46


def ink_mask(card: np.ndarray, ink: str) -> np.ndarray:
    """The pixels that are printed letters (or other ink) of the given kind."""
    g = cv2.cvtColor(card, cv2.COLOR_BGR2GRAY)
    if ink == 'light':
        return (g > 165).astype(np.uint8) * 255
    return (g < 95).astype(np.uint8) * 255


def text_box(card: np.ndarray, zone: tuple) -> tuple[int, int, int, int] | None:
    """The box of the rules text inside `zone`: the lines under the last line of the name."""
    x0, y0, x1, y1, ink = zone[:5]
    m = ink_mask(card, ink)[y0:y1, x0:x1]
    rows = (m > 0).sum(axis=1) > max(6, m.shape[1] * 0.012)
    lines, start = [], None
    for y, on in enumerate(list(rows) + [False]):
        if on and start is None:
            start = y
        elif not on and start is not None:
            if y - start >= 10:  # thinner: specks of wear and the frame's edge, not letters
                lines.append((start, y))
            start = None
    # Lines a few pixels apart are one line (accents, descenders).
    merged: list[list[int]] = []
    for a, b in lines:
        if merged and a - merged[-1][1] < 6:
            merged[-1][1] = b
        else:
            merged.append([a, b])
    if len(zone) < 6:  # under the name
        last_title = max((i for i, (a, b) in enumerate(merged) if b - a > TITLE_LINE), default=-1)
        merged = merged[last_title + 1:]
    merged = [l for l in merged if l[1] - l[0] > 8]
    if not merged:
        return None
    ty0, ty1 = merged[0][0], merged[-1][1]
    cols = np.where((m[ty0:ty1] > 0).sum(axis=0) > 0)[0]
    return (x0 + int(cols[0]) - 6, y0 + ty0 - 6, int(cols[-1] - cols[0]) + 12, ty1 - ty0 + 12)


def erase(card: np.ndarray, box: tuple[int, int, int, int], ink: str) -> None:
    """Paints the letters inside `box` over with the panel around them."""
    x, y, w, h = box
    mask = np.zeros(card.shape[:2], np.uint8)
    mask[y:y + h, x:x + w] = ink_mask(card, ink)[y:y + h, x:x + w]
    mask = cv2.dilate(mask, np.ones((5, 5), np.uint8), iterations=2)
    # Grown, the letters' mask stays inside the box: the box's own printed edge is not touched.
    keep = np.zeros_like(mask)
    keep[y:y + h, x:x + w] = 255
    mask &= keep
    card[:] = cv2.inpaint(card, mask, 7, cv2.INPAINT_TELEA)


def main() -> None:
    cards = json.load(open('tools/art/mini_cards.json', encoding='utf-8'))['cards']
    layout: dict[str, dict[str, list]] = {}
    for c in cards:
        if c['id'].startswith('_'):
            continue
        card = cv2.imread(str(SRC / f"{c['file']}.png"))
        if c['turn'] == 180:
            card = cv2.rotate(card, cv2.ROTATE_180)
        card = cv2.resize(card, (W, H), interpolation=cv2.INTER_AREA)
        boxes = []
        for zone in ZONES[c['family']]:
            box = (zone[0], zone[1], zone[2] - zone[0], zone[3] - zone[1]) if len(zone) > 5 else text_box(card, zone)
            if box is None:
                print('no text found', c['family'], c['id'])
                continue
            erase(card, box, zone[4])
            boxes.append(list(box))
        out = OUT / c['family']
        out.mkdir(parents=True, exist_ok=True)
        cv2.imwrite(str(out / f"{c['id']}.jpg"), card, [cv2.IMWRITE_JPEG_QUALITY, 88])
        layout.setdefault(c['family'], {})[c['id']] = boxes
        print(c['family'], c['id'], boxes)
    (OUT / 'layout.json').write_text(json.dumps(layout, indent=1), encoding='utf-8')


if __name__ == '__main__':
    main()
