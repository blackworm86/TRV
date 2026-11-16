// Helpers to bring the project owner's Illustrator exports into the game's own SVG markup.
// Illustrator writes the colours as CSS classes in a <style> block (.st0 { fill: ... }); nested in a
// page, that block would restyle every other drawing using the same class names. These helpers turn
// the classes into plain attributes and cut a drawing into its top-level groups.

/** CSS properties copied as attributes; the rest (isolation, blend modes) is left out. */
const KEPT = new Set(['fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'opacity', 'fill-opacity', 'stroke-opacity', 'fill-rule']);

/**
 * Replaces every class="stN" in the drawing with the attributes its CSS rule sets.
 * @param raw the SVG file's text.
 * @returns the same text, without classes on the shapes (the <style> block itself is left in place).
 * Example: `inlineClasses('<style>.a{fill:#f00}</style><path class="a"/>')` → `... <path fill="#f00"/>`.
 */
export function inlineClasses(raw: string): string {
  const attrs = new Map<string, string>();
  for (const m of raw.matchAll(/\.([\w-]+)\s*\{([^}]*)\}/g)) {
    const out: string[] = [];
    for (const decl of m[2].split(';')) {
      const [k, v] = decl.split(':').map(s => s?.trim());
      if (k && v && KEPT.has(k)) out.push(`${k}="${v.replace(/px$/, '')}"`);
    }
    attrs.set(m[1], out.join(' '));
  }
  return raw.replace(/\sclass="([\w-]+)"/g, (_, c: string) => (attrs.get(c) ? ` ${attrs.get(c)}` : ''));
}

/**
 * The top-level <g> elements of a drawing (children of the root <svg>), each as its full markup.
 * @param raw the SVG file's text.
 * Example: `topGroups(raw).filter(g => g.includes('<rect'))`.
 */
export function topGroups(raw: string): string[] {
  const out: string[] = [];
  const tag = /<(\/?)g\b[^>]*?(\/?)>/g;
  let depth = 0, start = -1;
  for (let m = tag.exec(raw); m; m = tag.exec(raw)) {
    if (m[2]) continue; // <g/>
    if (!m[1]) { if (depth++ === 0) start = m.index; }
    else if (--depth === 0 && start >= 0) { out.push(raw.slice(start, m.index + m[0].length)); start = -1; }
  }
  return out;
}
