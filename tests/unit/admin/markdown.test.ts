// The small Markdown reader of the admin inspector (src/admin/markdown.ts).
import { describe, expect, it } from 'vitest';
import { markdownHtml } from '../../../src/admin/markdown';

describe('markdownHtml', () => {
  it('turns a heading one level down, the page having its own first heading', () => {
    expect(markdownHtml('# Titolo\n\n## 1. Capitolo')).toBe('<h2>Titolo</h2><h3>1. Capitolo</h3>');
  });

  it('joins the lines of a paragraph and marks bold, code and links', () => {
    expect(markdownHtml('Una **riga**\ncon `codice` e un [link](a.md).')).toBe('<p>Una <strong>riga</strong> con <code>codice</code> e un link.</p>');
  });

  it('escapes what would be markup', () => {
    expect(markdownHtml('a < b & "c"')).toBe('<p>a &lt; b &amp; &quot;c&quot;</p>');
  });

  it('lays out a table, a bar inside a cell kept', () => {
    const html = markdownHtml('| A | B |\n|---|---|\n| 1 | x \\| y |\n| **2** | z |');
    expect(html).toBe('<table><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>1</td><td>x | y</td></tr><tr><td><strong>2</strong></td><td>z</td></tr></tbody></table>');
  });

  it('nests a list by its indent and joins a wrapped item', () => {
    const html = markdownHtml('- uno\n  che continua\n  - dentro\n- due');
    expect(html).toBe('<ul><li>uno che continua<ul><li>dentro</li></ul></li><li>due</li></ul>');
  });

  it('numbers an ordered list', () => {
    expect(markdownHtml('1. primo\n2. secondo')).toBe('<ol><li>primo</li><li>secondo</li></ol>');
  });

  it('keeps fenced code as it is, escaped and unmarked', () => {
    expect(markdownHtml('```\na **b** <c>\n  d\n```')).toBe('<pre>a **b** &lt;c&gt;\n  d</pre>');
  });

  it('lays out a quote with what is inside it', () => {
    expect(markdownHtml('> **Status**: ok\n> - voce')).toBe('<blockquote><p><strong>Status</strong>: ok</p><ul><li>voce</li></ul></blockquote>');
  });

  it('ends a paragraph where a list or a table begins', () => {
    expect(markdownHtml('Testo:\n- voce')).toBe('<p>Testo:</p><ul><li>voce</li></ul>');
  });
});
