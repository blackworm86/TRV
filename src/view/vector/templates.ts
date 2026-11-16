// Editable templates of the game's components, for the admin asset inspector: a file name for each
// download, a sheet that lays several drawings side by side (die faces, token fronts and backs), a
// card frame for cards that have no art yet (Choppe Shoppe upgrades), and the finishing touches
// that make an SVG string a file a vector editor opens. Pure string work: no DOM, no three.js.

const FONT = `font-family="'League Gothic', Impact, 'Arial Narrow', sans-serif"`;
const BODY_FONT = `font-family="Inter, 'Segoe UI', Arial, sans-serif"`;
const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

/** Lower-case ASCII slug: letters, digits and dashes ("Ms. Betty" -> "ms-betty"). */
export function slug(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'x';
}

/**
 * The download name of a template: `trv_<category>_<id>.<ext>`, each part slugged
 * (underscores inside an id are kept, so data ids stay recognisable).
 * Example: `templateFileName('potenziamenti', 'rail_gun', 'svg')` -> `trv_potenziamenti_rail_gun.svg`.
 */
export function templateFileName(category: string, id: string, ext: string): string {
  const part = (s: string): string => s.split('_').map(slug).join('_');
  return `trv_${part(category)}_${part(id)}.${slug(ext)}`;
}

/** The viewBox size of an SVG string (`[w, h]`), or null when it has none. */
export function svgSize(svgText: string): [number, number] | null {
  const m = /<svg[^>]*\sviewBox="\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)\s*"/.exec(svgText);
  return m ? [Number(m[1]), Number(m[2])] : null;
}

/**
 * Several SVG drawings in one sheet, left to right and wrapping after `cols`, each as a nested
 * <svg> in a cell of `cell` units (its aspect kept), `gap` apart, with an optional caption under each.
 */
export function sheetSvg(items: { svg: string; caption?: string }[], o: { cols?: number; cell?: number; gap?: number; background?: string } = {}): string {
  const cols = Math.max(1, Math.min(o.cols ?? items.length, items.length || 1));
  const cell = o.cell ?? 200, gap = o.gap ?? 20;
  const capH = items.some(i => i.caption) ? cell * 0.16 : 0;
  const rows = Math.max(1, Math.ceil(items.length / cols));
  const W = gap + cols * (cell + gap), H = gap + rows * (cell + capH + gap);
  let body = o.background ? `<rect width="${W}" height="${H}" fill="${o.background}"/>` : '';
  items.forEach((it, i) => {
    const x = gap + (i % cols) * (cell + gap), y = gap + Math.floor(i / cols) * (cell + capH + gap);
    // The nested drawing keeps its own viewBox; width/height place it in the cell.
    const src = it.svg.trim();
    const root = /^<svg\b[^>]*>/.exec(src)?.[0] ?? '<svg>';
    const nested = root.replace(/\s(?:x|y|width|height)="[^"]*"/g, '')
      .replace(/^<svg\b/, `<svg x="${x}" y="${y}" width="${cell}" height="${cell}"`) + src.slice(root.length);
    body += `<g id="item-${i}">${nested}`;
    if (it.caption) body += `<text x="${x + cell / 2}" y="${y + cell + capH * 0.75}" text-anchor="middle" font-size="${capH * 0.7}" fill="#555" ${FONT}>${esc(it.caption)}</text>`;
    body += '</g>';
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${body}</svg>`;
}

/** Splits text into lines of at most `max` characters, at spaces (a longer word gets its own line). */
export function wrapText(text: string, max: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (line && line.length + 1 + word.length > max) { lines.push(line); line = word; } else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(line);
  return lines;
}

/** What {@link cardSvg} draws. */
export interface CardArt {
  /** Card name, in the header band. */
  name: string;
  /** Rules text, wrapped in the lower half. */
  text: string;
  /** Small line above the name ("POTENZIAMENTO"). */
  kicker?: string;
  /** The number printed on the card, if any (top right). */
  n?: number;
  /** Frame colour. */
  color?: string;
  /** Data id, kept as data-id on the root. */
  id?: string;
}

/**
 * A playing card frame, 630 x 880 (63 x 88 mm at 10 units per mm): header with kicker, name and
 * number, an empty art window, the rules text. Each part has its own id, to edit in a vector editor.
 */
export function cardSvg(c: CardArt): string {
  const col = c.color ?? '#e8742a';
  const lines = wrapText(c.text, 34).slice(0, 9);
  let b = `<rect id="bleed" width="630" height="880" rx="34" fill="#17120e"/>`;
  b += `<rect id="frame" x="18" y="18" width="594" height="844" rx="24" fill="#f3e6d0" stroke="${col}" stroke-width="14"/>`;
  b += `<path id="header" d="M25 25 H605 V170 H25Z" fill="${col}"/>`;
  if (c.kicker) b += `<text id="kicker" x="50" y="70" font-size="34" fill="#17120e" opacity=".75" ${FONT}>${esc(c.kicker.toUpperCase())}</text>`;
  b += `<text id="name" x="50" y="${c.kicker ? 145 : 120}" font-size="${c.name.length > 18 ? 62 : 74}" fill="#17120e" ${FONT}>${esc(c.name.toUpperCase())}</text>`;
  if (c.n !== undefined) {
    b += `<g id="number"><circle cx="560" cy="75" r="36" fill="#17120e"/><text x="560" y="93" text-anchor="middle" font-size="52" fill="#f3e6d0" ${FONT}>${c.n}</text></g>`;
  }
  b += `<rect id="art" x="50" y="195" width="530" height="330" rx="12" fill="#d9ccb5" stroke="#17120e" stroke-opacity=".35" stroke-width="3" stroke-dasharray="14 10"/>`;
  b += `<text x="315" y="370" text-anchor="middle" font-size="36" fill="#17120e" opacity=".35" ${FONT}>ILLUSTRAZIONE</text>`;
  b += `<g id="text" ${BODY_FONT} font-size="30" fill="#17120e">${lines.map((l, i) => `<text x="50" y="${590 + i * 38}">${esc(l)}</text>`).join('')}</g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 630 880" width="630" height="880"${c.id ? ` data-id="${esc(c.id)}"` : ''}>${b}</svg>`;
}

/**
 * An SVG string as a file: XML declaration, the SVG namespace (and xlink) on the root, and
 * explicit width/height from the viewBox when missing, so editors open it at its size.
 */
export function standaloneSvg(svgText: string): string {
  let s = svgText.trim().replace(/^<\?xml[^>]*>\s*/, '');
  if (!/^<svg[^>]*\sxmlns="/.test(s)) s = s.replace(/^<svg\b/, '<svg xmlns="http://www.w3.org/2000/svg"');
  if (/xlink:href/.test(s) && !/xmlns:xlink=/.test(s)) s = s.replace(/^<svg\b/, '<svg xmlns:xlink="http://www.w3.org/1999/xlink"');
  const size = svgSize(s);
  if (size && !/^<svg[^>]*\swidth="/.test(s)) s = s.replace(/^<svg\b/, `<svg width="${size[0]}" height="${size[1]}"`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n${s}\n`;
}
