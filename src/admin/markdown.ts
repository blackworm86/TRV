// A small Markdown reader for the admin inspector: it lays out the project's own design documents
// (design/art/modelli-strutturati.md) as HTML. Only what those documents use: headings, paragraphs,
// lists (nested by indent), tables, quotes, fenced code, and inline code, bold and links (shown as
// their text). Everything is escaped first. Pure: unit-tested in tests/unit/admin/markdown.test.ts.

import { esc } from '../core/markup';

/** The inline marks of one line of text, escaped. */
function inline(s: string): string {
  return esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
}

interface Li { indent: number; ordered: boolean; text: string }

/** A run of list items as nested lists, by their indent. */
function lists(items: Li[]): string {
  let i = 0;
  const level = (indent: number): string => {
    const tag = items[i].ordered ? 'ol' : 'ul';
    let html = '';
    while (i < items.length && items[i].indent >= indent) {
      if (items[i].indent > indent) { html = html.replace(/<\/li>$/, '') + level(items[i].indent) + '</li>'; continue; }
      html += `<li>${inline(items[i].text)}</li>`;
      i++;
    }
    return `<${tag}>${html}</${tag}>`;
  };
  let out = '';
  while (i < items.length) out += level(items[i].indent);
  return out;
}

/** The cells of a table row: `| a | b |` gives `['a', 'b']`; `\|` is a bar inside a cell. */
function cells(row: string): string[] {
  return row.trim().replace(/^\||\|$/g, '').replace(/\\\|/g, '\u0000').split('|').map(c => c.trim().replace(/\u0000/g, '|'));
}

const LIST = /^(\s*)([-*]|\d+\.)\s+(.*)$/;
const HEAD = /^(#{1,5})\s+(.*)$/;
const isTableStart = (lines: string[], i: number): boolean => lines[i].trimStart().startsWith('|')
  && /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1] ?? '') && (lines[i + 1] ?? '').includes('-');

/**
 * The HTML of the Markdown text `md`. A `#` heading becomes `<h2>`, `##` `<h3>` and so on, since the
 * page it goes into has its own `<h1>`. Example: `markdownHtml('**a** `b`')` → `<p><strong>a</strong> <code>b</code></p>`.
 */
export function markdownHtml(md: string): string {
  const lines = md.replace(/\r\n?/g, '\n').split('\n');
  let out = '';
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    if (line.trimStart().startsWith('```')) {
      const code: string[] = [];
      for (i++; i < lines.length && !lines[i].trimStart().startsWith('```'); i++) code.push(lines[i]);
      i++;
      out += `<pre>${esc(code.join('\n'))}</pre>`;
      continue;
    }
    const h = HEAD.exec(line);
    if (h) { const n = h[1].length + 1; out += `<h${n}>${inline(h[2])}</h${n}>`; i++; continue; }
    if (isTableStart(lines, i)) {
      const head = cells(lines[i]);
      const rows: string[][] = [];
      for (i += 2; i < lines.length && lines[i].trimStart().startsWith('|'); i++) rows.push(cells(lines[i]));
      out += `<table><thead><tr>${head.map(c => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>`
        + rows.map(r => `<tr>${r.map(c => `<td>${inline(c)}</td>`).join('')}</tr>`).join('') + '</tbody></table>';
      continue;
    }
    if (line.startsWith('>')) {
      const quote: string[] = [];
      for (; i < lines.length && lines[i].startsWith('>'); i++) quote.push(lines[i].replace(/^>\s?/, ''));
      out += `<blockquote>${markdownHtml(quote.join('\n'))}</blockquote>`;
      continue;
    }
    if (LIST.test(line)) {
      const items: Li[] = [];
      for (; i < lines.length && lines[i].trim(); i++) {
        const m = LIST.exec(lines[i]);
        if (m) items.push({ indent: m[1].length, ordered: /\d/.test(m[2]), text: m[3] });
        else if (/^\s/.test(lines[i])) items[items.length - 1].text += ` ${lines[i].trim()}`; // a wrapped line of the item above
        else break;
      }
      out += lists(items);
      continue;
    }
    const para: string[] = [];
    for (; i < lines.length && lines[i].trim() && !HEAD.test(lines[i]) && !LIST.test(lines[i]) && !lines[i].startsWith('>')
      && !lines[i].trimStart().startsWith('```') && !isTableStart(lines, i); i++) para.push(lines[i].trim());
    out += `<p>${inline(para.join(' '))}</p>`;
  }
  return out;
}
