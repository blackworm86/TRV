"""Saves the pieces of The Big Rig and the Final Five for the game, from the official scans
(assets/estratti/expansions/big_rig/*.png, the images of Big Rig.docx in assets/sorgenti).

Each piece is cut out of the paper it was scanned on (the white page, or the black page of the
miniature render), turned to read the right way up and saved as a WebP with transparency (quality WEBP_QUALITY: a
PNG of a printed scan, with its paper grain, weighs five times more):

- plance/motrice.webp             the front cab board (Hydraulic Steering), image2
- plance/sezione_<front|mid>.webp the section board's front and mid sections, image17
- plance/sezione_rear.webp        the rear section: both scans stop halfway through Hazard Dispenser,
                                  so it comes from the rulebook's picture of the whole board (p. 6,
                                  supplied by the user as assets/estratti/rulebook/
                                  big_rig_plancia_sezioni.webp, outside git): whole, but only about
                                  470 px wide, until the vector version
- plance/comandi_final_five.webp  the Final Five command board, image3
- plance/cruscotto_<mark>.webp    the five motorcycle dashboards, by their marking
- plance/cruscotto_retro_<mark>.webp
                                  the two scanned dashboard backs (inoperable): circle (image11)
                                  and v (image12), whose marking shows through at the top
- segnalini/danno_minore.webp     the minor damage token, image1
- icone/big_rig_alto.webp         the Big Rig miniature seen from above, image13

The front section of image17 loses a sliver of its left edge to the scan's border; the mid
section is whole. Which marking is which dashboard was read on the scans (the shape printed at
the bottom of each one).

Usage: python tools/art/save_big_rig_assets.py
"""
from pathlib import Path

import cv2
import numpy as np

SRC = Path('assets/estratti/expansions/big_rig')
OUT = Path('assets/big_rig')

#: The dashboards' scans by marking (data/trv/big_rig_final_five.json: final_five.markings).
DASHBOARDS = {'two_lines': 'image7', 'x': 'image4', 'v': 'image6', 'circle': 'image5', 'wave': 'image10'}
#: Columns of image17 (turned clockwise) between the sections: the middle of the gap between two.
STRIP_CUTS = [2761, 5461]
#: The rulebook's picture of the whole section board, and the column where its rear section ends.
RULEBOOK_BOARD = Path('assets/estratti/rulebook/big_rig_plancia_sezioni.webp')
REAR_TO = 461
#: WebP quality of the saved pieces (0-100).
WEBP_QUALITY = 88
#: Saved widths, in pixels.
WIDTH = {'board': 900, 'section': 1200, 'dashboard': 600, 'token': 400}


def cut_out(img: np.ndarray, paper: str = 'white') -> np.ndarray:
    """The piece without the paper around it: BGRA, cropped to the piece.

    The paper is the near-white (or near-black) colour reachable from the image's border; a
    softened edge keeps the outline smooth.
    """
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    if paper == 'white':
        bg = ((hsv[:, :, 2] > 215) & (hsv[:, :, 1] < 30)).astype(np.uint8)
    elif paper == 'grey':  # the rulebook's page
        bg = ((hsv[:, :, 2] > 100) & (hsv[:, :, 2] < 145) & (hsv[:, :, 1] < 30)).astype(np.uint8)
    else:
        bg = (hsv[:, :, 2] < 14).astype(np.uint8)
    bg = cv2.morphologyEx(bg, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    # Only the paper touching the border: a white spot inside the piece is printed art.
    _, labels = cv2.connectedComponents(bg)
    edge = set(np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]])).tolist())
    edge.discard(0)
    piece = (~np.isin(labels, list(edge))).astype(np.uint8)
    # Keep the largest piece only (dust and specks on the paper go).
    n, labels, stats, _ = cv2.connectedComponentsWithStats(piece)
    if n > 1:
        biggest = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
        piece = (labels == biggest).astype(np.uint8)
    piece = cv2.morphologyEx(piece, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    alpha = cv2.GaussianBlur(piece.astype(np.float32) * 255, (0, 0), 1.0).astype(np.uint8)
    ys, xs = np.nonzero(piece)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    return np.dstack([img, alpha])[y0:y1, x0:x1]


def save(img: np.ndarray, rel: str, width: int) -> None:
    """Writes `img` (BGRA) at most `width` pixels wide under OUT."""
    h, w = img.shape[:2]
    if w > width:
        img = cv2.resize(img, (width, round(h * width / w)), interpolation=cv2.INTER_AREA)
    path = OUT / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(path), img, [cv2.IMWRITE_WEBP_QUALITY, WEBP_QUALITY])
    print(path, img.shape[1], 'x', img.shape[0])


def read(name: str) -> np.ndarray:
    img = cv2.imread(str(SRC / f'{name}.png'))
    if img is None:
        raise SystemExit(f'missing scan: {SRC / name}.png (extract Big Rig.docx first)')
    return img


def main() -> None:
    save(cut_out(cv2.rotate(read('image2'), cv2.ROTATE_90_COUNTERCLOCKWISE)), 'plance/motrice.webp', WIDTH['board'])
    save(cut_out(cv2.rotate(read('image3'), cv2.ROTATE_180)), 'plance/comandi_final_five.webp', WIDTH['board'])

    strip = cv2.rotate(read('image17'), cv2.ROTATE_90_CLOCKWISE)
    a, b = STRIP_CUTS
    save(cut_out(strip[:, :a]), 'plance/sezione_front.webp', WIDTH['section'])
    save(cut_out(strip[:, a:b]), 'plance/sezione_mid.webp', WIDTH['section'])
    board = cv2.imread(str(RULEBOOK_BOARD))
    if board is None:
        raise SystemExit(f'missing picture: {RULEBOOK_BOARD}')
    save(cut_out(board[:, :REAR_TO], paper='grey'), 'plance/sezione_rear.webp', WIDTH['section'])

    for mark, name in DASHBOARDS.items():
        save(cut_out(cv2.rotate(read(name), cv2.ROTATE_180)), f'plance/cruscotto_{mark}.webp', WIDTH['dashboard'])
    for side, name in (('circle', 'image11'), ('v', 'image12')):
        save(cut_out(cv2.rotate(read(name), cv2.ROTATE_180)), f'plance/cruscotto_retro_{side}.webp', WIDTH['dashboard'])

    save(cut_out(read('image1')), 'segnalini/danno_minore.webp', WIDTH['token'])
    save(cut_out(read('image13'), paper='black'), 'icone/big_rig_alto.webp', 503)


if __name__ == '__main__':
    main()
