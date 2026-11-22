"""Saves the cards of the mini expansions, cleaned and ready to be translated.

From the cards cut and straightened by tools/art/extract_cards.py (assets/estratti/mini/carte, out
of git; which cut is which card: tools/art/mini_cards.json), for every game card:

- the card turned the right way up and brought to one size (744 x 1040 px, 63 x 88 mm), its black
  frame set in the same place on every card and the border around it repainted in the card stock's
  colour: the scans were cut unevenly, with the page's white at the corners (Bonus Commands, dark
  to their edge, keep their scan);
- the English rules text erased: the printed letters are found by their colour against the panel
  and painted over from the panel around them (OpenCV inpainting), so the panel keeps its printed
  wear. The name and the card's kind ("ONE SHOT:", "BOUNTY:"...) stay as printed: they are names;
- the box where that text was, so the digital card sets the Italian text in the same place (on a
  Bounty, its purple and orange boxes, found by their colour).

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
    'advanced_airstrikes': [(72, 640, 668, 936, 'dark')],
    # Bounties: the purple box (what to do) and the orange one (the reward), each wholly text: found
    # by their colour (see panel_box); the numbers are where to look.
    'bounties': [(120, 200, 700, 520, 'light', 'purple'), (120, 620, 700, 960, 'dark', 'orange')],
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


#: The Bounties' two boxes, by colour (OpenCV's HSV: hue 0-180): the purple one and the orange one.
PANELS = {'purple': ((115, 110, 70), (150, 255, 255)), 'orange': ((5, 120, 150), (25, 255, 255))}


def panel_box(card: np.ndarray, zone: tuple) -> tuple[int, int, int, int] | None:
    """The inside of a Bounty's coloured box within `zone`: the largest patch of its colour, a little in."""
    x0, y0, x1, y1 = zone[:4]
    lo, hi = PANELS[zone[5]]
    hsv = cv2.cvtColor(card[y0:y1, x0:x1], cv2.COLOR_BGR2HSV)
    m = cv2.inRange(hsv, np.array(lo), np.array(hi))
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
    n, _, stats, _ = cv2.connectedComponentsWithStats(m)
    if n < 2:
        return None
    i = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    x, y, w, h = stats[i, :4]
    return (x0 + int(x) + 8, y0 + int(y) + 8, int(w) - 16, int(h) - 16)


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


#: Where the black frame goes on every redrawn card (px of the 744 x 1040 card): the same margin of
#: card stock all round, as measured on the cards scanned whole (4.7 % of the width at the sides,
#: 3.4 % of the height at top and bottom: 35 px either way).
FRAME_MARGIN = 35
#: The families whose frame is found and set in place, the border repainted. The Bonus Commands are
#: dark to their edge (no frame to find): they keep their scan.
REDRAWN = {'one_shots', 'bounties', 'road_conditions', 'advanced_airstrikes'}
#: Rows and columns this close to the scan's edge (of its size) are the scanner's, never the frame.
EDGE_SKIP = 0.012


def find_frame(card: np.ndarray) -> list[int]:
    """The outer edges of the card's black frame (left, top, right, bottom), in the scan's pixels."""
    m = cv2.cvtColor(card, cv2.COLOR_BGR2GRAY) < 90
    h, w = m.shape
    rows = m[:, int(w * .2):int(w * .8)].mean(axis=1)
    cols = m[int(h * .2):int(h * .8), :].mean(axis=0)
    sy, sx = int(h * EDGE_SKIP), int(w * EDGE_SKIP)
    top = next(y for y in range(sy, h) if rows[y] > .45)
    bottom = next(y for y in range(h - 1 - sy, -1, -1) if rows[y] > .45)
    left = next(x for x in range(sx, w) if cols[x] > .45)
    right = next(x for x in range(w - 1 - sx, -1, -1) if cols[x] > .45)
    return [left, top, right, bottom]


def fix_frame(f: list[int], size: tuple[int, int], typical: tuple[float, float]) -> list[int]:
    """A frame cut short by the scan's edge (or lengthened by a stain) brought to the family's size.

    `typical`: the family's usual frame width and height, in the scan's pixels. The side whose margin
    is furthest from the opposite one is the wrong one, and is set from the other.
    """
    w, h = size
    left, top, right, bottom = f
    if abs((right - left) - typical[0]) > typical[0] * .012:
        if left < w - 1 - right:
            left = right - round(typical[0])
        else:
            right = left + round(typical[0])
    if abs((bottom - top) - typical[1]) > typical[1] * .012:
        if top < h - 1 - bottom:
            top = bottom - round(typical[1])
        else:
            bottom = top + round(typical[1])
    return [left, top, right, bottom]


def stock_colour(card: np.ndarray, f: list[int]) -> np.ndarray:
    """The card stock's colour: the margin under the frame and beside it, without the scan's edge."""
    h, w = card.shape[:2]
    left, top, right, bottom = f
    sy, sx = int(h * EDGE_SKIP) + 4, int(w * EDGE_SKIP) + 4
    parts = [card[bottom + 8:h - sy, w // 4:w * 3 // 4], card[h // 4:h * 3 // 4, sx:max(sx + 1, left - 8)]]
    px = np.concatenate([p.reshape(-1, 3) for p in parts if p.size])
    return np.median(px, axis=0)


def redraw(card: np.ndarray, f: list[int], stock: np.ndarray, seed: int) -> np.ndarray:
    """The card at 744 x 1040 with its frame in the usual place and a clean, even border.

    Inside the frame, the scan; around it, the card stock repainted in one colour with a light grain
    of print, so every card has the same border (the scans' edges were cut unevenly, with the page's
    white at the corners). The corners are rounded by the page (src/view/minicards.ts).
    """
    left, top, right, bottom = f
    m = FRAME_MARGIN
    sx, sy = (W - 2 * m) / (right - left), (H - 2 * m) / (bottom - top)
    move = np.float32([[sx, 0, m - left * sx], [0, sy, m - top * sy]])
    inner = cv2.warpAffine(card, move, (W, H), flags=cv2.INTER_AREA, borderMode=cv2.BORDER_REPLICATE)
    rng = np.random.default_rng(seed)
    grain = rng.normal(0, 3.5, (H, W, 1))
    out = np.clip(np.broadcast_to(stock, (H, W, 3)) + grain, 0, 255).astype(np.uint8)
    out[m:H - m, m:W - m] = inner[m:H - m, m:W - m]
    return out


def main() -> None:
    cards = [c for c in json.load(open('tools/art/mini_cards.json', encoding='utf-8'))['cards'] if not c['id'].startswith('_')]
    layout: dict[str, dict[str, list]] = {}
    scans = {}
    for c in cards:
        card = cv2.imread(str(SRC / f"{c['file']}.png"))
        if c['turn'] == 180:
            card = cv2.rotate(card, cv2.ROTATE_180)
        scans[c['id']] = card
    # The family's usual frame and card stock, from all its cards: a scan cut short or stained on
    # one side does not decide them.
    frames = {c['id']: find_frame(scans[c['id']]) for c in cards if c['family'] in REDRAWN}
    typical, stock = {}, {}
    for fam in REDRAWN:
        ids = [c['id'] for c in cards if c['family'] == fam]
        typical[fam] = (float(np.median([frames[i][2] - frames[i][0] for i in ids])), float(np.median([frames[i][3] - frames[i][1] for i in ids])))
        stock[fam] = np.median([stock_colour(scans[i], frames[i]) for i in ids], axis=0)
    for n, c in enumerate(cards):
        card = scans[c['id']]
        if c['family'] in REDRAWN:
            f = fix_frame(frames[c['id']], (card.shape[1], card.shape[0]), typical[c['family']])
            card = redraw(card, f, stock[c['family']], n)
        else:
            card = cv2.resize(card, (W, H), interpolation=cv2.INTER_AREA)
        boxes = []
        for zone in ZONES[c['family']]:
            box = panel_box(card, zone) if len(zone) > 5 else text_box(card, zone)
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
