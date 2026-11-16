// The dice faces drawn by the project owner (assets/ui/dice/*.svg, exported from Illustrator).
// Each file holds the six faces of one die side by side, every face a plain <g> with a
// 96 x 96 rounded square, plus grey captions under them. This module cuts the faces out,
// drops the captions and turns the file's CSS classes into fill attributes, so a face can be
// nested in any page or texture without its <style> leaking onto the rest of the document.

/** Face values of each drawing, left to right, as written in the captions under the faces. */
export const OWNER_DIE_ORDER: Record<string, readonly string[]> = {
  direction: ['F', 'FL', 'FR', 'B', 'BL', 'BR'],
  slam: ['bottom', 'bottom', 'bottom', 'bottom', 'top', 'top'],
};

/** Where a face's square sits in the 100 x 100 box of art.ts's dice (the same as the old drawing). */
const BOX_X = 2, BOX_Y = 2;

/**
 * Splits one owner drawing into its faces.
 * @param raw the SVG file's text.
 * @param order the face values, left to right (OWNER_DIE_ORDER).
 * @returns face value → inner markup for a 100 x 100 box (no <svg> root, no classes).
 * Example: `ownerDieFaces(rawSlam, OWNER_DIE_ORDER.slam).get('top')`.
 */
export function ownerDieFaces(raw: string, order: readonly string[]): Map<string, string> {
  const fills = new Map<string, string>();
  for (const m of raw.matchAll(/\.([\w-]+)\s*\{([^}]*)\}/g)) {
    const fill = /fill:\s*([^;}\s]+)/.exec(m[2]);
    if (fill) fills.set(m[1], fill[1]);
  }
  const faces: { x: number; y: number; body: string }[] = [];
  // A face is a bare <g> (the captions' groups carry a class); faces hold no nested groups.
  for (const m of raw.matchAll(/<g>([\s\S]*?)<\/g>/g)) {
    const rect = /<rect\b[^>]*\bx="([\d.]+)"[^>]*\by="([\d.]+)"/.exec(m[1]);
    if (!rect) continue;
    const body = m[1].replace(/\sclass="([\w-]+)"/g, (_, c: string) => (fills.has(c) ? ` fill="${fills.get(c)}"` : ''));
    faces.push({ x: Number(rect[1]), y: Number(rect[2]), body: body.trim() });
  }
  faces.sort((a, b) => a.x - b.x);
  if (faces.length !== order.length) throw new Error(`die drawing: ${faces.length} faces, expected ${order.length}`);
  const out = new Map<string, string>();
  faces.forEach((f, i) => {
    if (!out.has(order[i])) out.set(order[i], `<g transform="translate(${BOX_X - f.x} ${BOX_Y - f.y})">${f.body}</g>`);
  });
  return out;
}
