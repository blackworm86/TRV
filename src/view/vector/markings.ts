// The markings of the Final Five's motorcycles (BRaFF p7): each motorcycle and its dashboard carry
// the same one (two lines, X, V, circle, wave), so the player knows which motorcycle a die moves.
// One drawing, as SVG for the interface and on a canvas for the table.

/** The markings in the order of data/trv/big_rig_final_five.json `final_five.markings`. */
export const MARKINGS = ['two_lines', 'x', 'v', 'circle', 'wave'] as const;

/** The strokes of marking `k` in a 100 x 100 box: SVG path data, and whether the circle has its dot. */
function strokes(k: number): { d: string; dot?: boolean } {
  switch (MARKINGS[k]) {
    case 'two_lines': return { d: 'M36 14 V86 M64 14 V86' };
    case 'x': return { d: 'M20 20 L80 80 M80 20 L20 80' };
    case 'v': return { d: 'M18 22 L50 82 L82 22' };
    case 'circle': return { d: 'M50 14 A36 36 0 1 1 49.9 14 Z', dot: true };
    default: return { d: 'M50 10 C22 26 78 42 50 50 C22 58 78 74 50 90' };
  }
}

/** Marking `k` as an SVG drawing `size` px wide, stroked in `color` over a dark outline. */
export function markingSvg(k: number, size: number, color = '#f3e9d2'): string {
  const s = strokes(k);
  const dot = s.dot ? `<circle cx="50" cy="50" r="9" fill="${color}" stroke="#111" stroke-width="3"/>` : '';
  return `<svg class="marking" viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true">`
    + `<path d="${s.d}" fill="none" stroke="#111" stroke-width="22" stroke-linecap="round" stroke-linejoin="round"/>`
    + `<path d="${s.d}" fill="none" stroke="${color}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>${dot}</svg>`;
}

/** Draws marking `k` on a canvas context, filling a `size` square from its origin. */
export function drawMarking(ctx: CanvasRenderingContext2D, k: number, size: number, color: string): void {
  const s = strokes(k);
  const path = new Path2D(s.d);
  ctx.save();
  ctx.scale(size / 100, size / 100);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 22;
  ctx.stroke(path);
  ctx.strokeStyle = color;
  ctx.lineWidth = 12;
  ctx.stroke(path);
  if (s.dot) {
    ctx.beginPath();
    ctx.arc(50, 50, 9, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }
  ctx.restore();
}
