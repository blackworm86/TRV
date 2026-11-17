"""Traces the pieces the command icons are built from, out of the official dice faces
(assets/estratti/base/dice, 256 x 256 scans): the car of the slam die (plain, and the one
with the impact burst), the ground bar, the shooting die's crosshair, the direction die's
chevrons and the stunt die's bars. Plus the fire die's skull (Carnage at Devil's Run),
already traced in assets/carnage/vettoriale/fire_die.json.

Every piece is an even-odd path in the die's own 100 x 100 box, so it keeps its place and size
on the face; tools/art/make_command_icons.py moves and scales it.
Writes design/art/icone-comandi/parts.json.

Usage: python tools/art/trace_icon_parts.py
"""
import json
from pathlib import Path

import cv2
import numpy as np

DICE = Path('assets/estratti/base/dice')
OUT = Path('design/art/icone-comandi/parts.json')
UP = 4  # traced at four times the scan's size, smoothed: the scans are small


def trace(face: str, rgb: tuple[int, int, int], tol: int = 40, box: tuple[int, int, int, int] | None = None,
          keep: int | None = None, eps: float = 1.6) -> str:
    """The pixels of colour `rgb` on a die face (inside `box` x0, y0, x1, y1 if given), as a path.
    `keep`: only the largest `keep` shapes (with their holes)."""
    im = cv2.imread(str(DICE / f'{face}.png')).astype(int)
    d = np.abs(im - np.array(rgb[::-1])).sum(2)
    m = (d < tol).astype(np.uint8) * 255
    if box:
        x0, y0, x1, y1 = box
        cut = np.zeros_like(m)
        cut[y0:y1, x0:x1] = m[y0:y1, x0:x1]
        m = cut
    m = cv2.resize(m, None, fx=UP, fy=UP, interpolation=cv2.INTER_CUBIC)
    m = (cv2.GaussianBlur(m, (0, 0), UP * .7) > 127).astype(np.uint8)
    cs, hier = cv2.findContours(m, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
    outer = [i for i in range(len(cs)) if hier[0][i][3] < 0]
    outer.sort(key=lambda i: -cv2.contourArea(cs[i]))
    if keep:
        outer = outer[:keep]
    k = 100 / (256 * UP)
    out = []
    for i in outer:
        rings = [i] + [j for j in range(len(cs)) if hier[0][j][3] == i]
        for j in rings:
            if cv2.contourArea(cs[j]) < (UP * 2) ** 2:
                continue
            ap = cv2.approxPolyDP(cs[j], eps * UP / 2, True)[:, 0, :]
            out.append('M' + 'L'.join(f'{x * k:.2f},{y * k:.2f}' for x, y in ap) + 'Z')
    return ''.join(out)


INK, CREAM, SLAM_SHADE = (35, 37, 46), (255, 248, 217), (219, 110, 33)


def main() -> None:
    fire = json.loads(Path('assets/carnage/vettoriale/fire_die.json').read_text(encoding='utf8'))
    parts = {
        '_source': 'tools/art/trace_icon_parts.py, from the official dice faces; coordinates in the die face, 100 x 100',
        # The plain car (the faded one of the slam die), facing right.
        'car': trace('slam/bottom_a', SLAM_SHADE, 22, keep=1),
        # The car hit from below: the burst is a hole in it. And the ground bar under it.
        'slam_car': trace('slam/bottom_a', INK, 40, box=(0, 100, 256, 199), keep=1),
        'bar': trace('slam/bottom_a', INK, 40, box=(0, 199, 256, 256), keep=1),
        # The shooting die's crosshair, without its letter.
        'crosshair': trace('shooting/M', CREAM, 60, box=(0, 0, 160, 160)),
        # The direction die: the hollow chevron (where the car is) and the filled one (where it goes).
        'chevron': trace('direction/F', CREAM, 60, box=(0, 0, 256, 100), keep=1),
        'chevron_hollow': trace('direction/F', CREAM, 60, box=(0, 100, 256, 200), keep=1),
        # The stunt die's rising bars, all four.
        'bars': trace('stunt/4', INK, 40, box=(0, 175, 256, 256)),
        'stunt_4': trace('stunt/4', INK, 40, box=(0, 0, 256, 175), keep=1),
        # The fire die's skull in flames (Carnage at Devil's Run), as traced for the game.
        'skull': fire['faces']['eliminated'],
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(parts, indent=1), encoding='utf8')
    print({k: len(v) for k, v in parts.items()})


if __name__ == '__main__':
    main()
