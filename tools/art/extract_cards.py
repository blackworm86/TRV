"""Cuts the cards out of the scanned print-and-play pages (assets/estratti/expansions/trv_v2).

Each page holds up to nine cards, a little rotated by the scanner. The script finds every card
(a dark rounded rectangle on the white page), straightens it and saves it whole, in reading order,
as <out>/<page>-<n>.png. Which card is which is decided afterwards (tools/art/upgrade_cards.json).

Usage: python tools/art/extract_cards.py <out folder> <page number> [<page number> ...]
"""
import sys
from pathlib import Path

import cv2
import numpy as np

PAGES = Path('assets/estratti/expansions/trv_v2')
SCALE = 4  # detection runs on a page this many times smaller


def cards_on(page: Path, flip: bool = True) -> list[np.ndarray]:
    """The straightened cards on `page`; `flip`: turn upside-down cards (black panel at the bottom)."""
    img = cv2.imread(str(page))
    small = cv2.resize(img, (img.shape[1] // SCALE, img.shape[0] // SCALE), interpolation=cv2.INTER_AREA)
    gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
    _, mask = cv2.threshold(gray, 215, 255, cv2.THRESH_BINARY_INV)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8))
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    found = []
    for c in contours:
        (cx, cy), (w, h), ang = cv2.minAreaRect(c)
        if w * h < 0.02 * small.shape[0] * small.shape[1]:
            continue
        if w > h:  # portrait cards: make the long side the height
            w, h, ang = h, w, ang - 90
        if 2.2 < h / w < 3.2:
            # Two cards joined by a speck of ink (or a card and the page's edge): the shape is eroded
            # until it parts, and each part of a card's shape is kept, grown back by the erosion.
            one = np.zeros_like(mask)
            cv2.drawContours(one, [c], -1, 255, -1)
            for k in range(9, 61, 4):
                parts, _ = cv2.findContours(cv2.erode(one, np.ones((k, k), np.uint8)), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
                cards = []
                for q in parts:
                    (qx, qy), (qw, qh), qa = cv2.minAreaRect(q)
                    if qw > qh:
                        qw, qh, qa = qh, qw, qa - 90
                    qw, qh = qw + k - 1, qh + k - 1
                    if 1.3 < qh / qw < 1.62 and qw * qh > 0.5 * w * w * 1.4:
                        cards.append(((qx, qy), (qw, qh), qa, True))
                if cards:
                    found.extend(cards)
                    break
            continue
        if not 1.3 < h / w < 1.62:  # 63 x 88 mm cards (1.40) and mini euro cards, 44 x 68 mm (1.55); anything else is two cards stuck together or the page edge
            continue
        found.append(((cx, cy), (w, h), ang, False))
    # Reading order: rows first (by centre height, in bands of a third of a card), then left to right.
    found.sort(key=lambda r: (round(r[0][1] / (r[1][1] * 0.5)), r[0][0]))
    out = []
    for (cx, cy), (w, h), ang, parted in found:
        cx, cy, w, h = cx * SCALE, cy * SCALE, w * SCALE, h * SCALE
        rot = cv2.getRotationMatrix2D((cx, cy), ang, 1.0)
        turned = cv2.warpAffine(img, rot, (img.shape[1], img.shape[0]), flags=cv2.INTER_CUBIC, borderValue=(255, 255, 255))
        x0, y0 = int(round(cx - w / 2)), int(round(cy - h / 2))
        card = turned[max(0, y0):y0 + int(round(h)), max(0, x0):x0 + int(round(w))]
        # A card parted from another is cut with some page around it: trimmed to the card itself,
        # the rows and columns that are mostly not the white page.
        ink = cv2.cvtColor(card, cv2.COLOR_BGR2GRAY) < 225
        rows, cols = np.where(ink.mean(axis=1) > 0.6)[0], np.where(ink.mean(axis=0) > 0.6)[0]
        if parted and len(rows) and len(cols):
            card = card[rows[0]:rows[-1] + 1, cols[0]:cols[-1] + 1]
        # The scanner may have laid the card upside down: the black text panel belongs at the bottom.
        g = cv2.cvtColor(card, cv2.COLOR_BGR2GRAY)
        third = g.shape[0] // 3
        if flip and g[:third].mean() < g[-third:].mean():
            card = cv2.rotate(card, cv2.ROTATE_180)
        out.append(card)
    return out


def main() -> None:
    out = Path(sys.argv[1])
    out.mkdir(parents=True, exist_ok=True)
    for n in sys.argv[2:]:
        page = next(PAGES.glob(f'img-{int(n):04d}-*.png'))
        for i, card in enumerate(cards_on(page), 1):
            cv2.imwrite(str(out / f'{int(n):04d}-{i}.png'), card)
            print(f'{int(n):04d}-{i}', card.shape[1], 'x', card.shape[0])


if __name__ == '__main__':
    main()
