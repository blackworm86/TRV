"""Cuts the ON FIRE! ring token (Carnage at Devil's Run) out of the scanned components page.

Usage: python tools/art/save_fire_ring.py <custom-fire.png> <out folder>
Writes on_fire.png (transparent background and hole, tail pointing up as on the dashboard in the
rulebook) and on_fire.json (image size, hole centre and radius in pixels), read by src/view/vector/art.ts.
"""
import json, sys
import cv2
import numpy as np

src, out = sys.argv[1], sys.argv[2]
img = cv2.imread(src)
h, w = img.shape[:2]
# The fourth piece on the page: the first flame ring (the page shows three).
x0, x1 = int(w * 0.50), int(w * 0.665)
crop = img[:, x0:x1]
hsv = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV)
solid = ((hsv[..., 1] > 70) & (hsv[..., 2] > 60)).astype(np.uint8) * 255
solid = cv2.morphologyEx(solid, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
n, lab, stats, _ = cv2.connectedComponentsWithStats(solid)
big = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
mask = (lab == big).astype(np.uint8) * 255
x, y, bw, bh, _ = stats[big]
pad = 6
x, y = max(0, x - pad), max(0, y - pad)
mask = mask[y:y + bh + 2 * pad, x:x + bw + 2 * pad]
piece = crop[y:y + bh + 2 * pad, x:x + bw + 2 * pad]
alpha = cv2.GaussianBlur(mask, (3, 3), 0)
rgba = cv2.cvtColor(piece, cv2.COLOR_BGR2BGRA)
rgba[..., 3] = alpha
rgba = cv2.flip(rgba, 0)  # tail up
mask = cv2.flip(mask, 0)
# The hole: the largest empty area that does not touch the border.
empty = (mask == 0).astype(np.uint8)
n, lab, stats, cents = cv2.connectedComponentsWithStats(empty)
best = None
for i in range(1, n):
    sx, sy, sw, sh, area = stats[i]
    if sx == 0 or sy == 0 or sx + sw >= mask.shape[1] or sy + sh >= mask.shape[0]:
        continue
    if best is None or area > stats[best][4]:
        best = i
sx, sy, sw, sh, _ = stats[best]
hole = {'cx': float(cents[best][0]), 'cy': float(cents[best][1]), 'r': float((sw + sh) / 4)}
# Downscale to a sensible web size.
k = 360 / rgba.shape[1]
rgba = cv2.resize(rgba, None, fx=k, fy=k, interpolation=cv2.INTER_AREA)
info = {'w': rgba.shape[1], 'h': rgba.shape[0], **{key: round(v * k, 1) for key, v in hole.items()}}
cv2.imwrite(f'{out}/on_fire.png', rgba)
json.dump(info, open(f'{out}/on_fire.json', 'w'))
print(info)
