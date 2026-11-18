// Centres the drawing of every command icon in its 100 x 100 box (asked by the user, 2026-11-17:
// "assicurati che le icone dei comandi siano centrate rispetto al settore"). The icons drawn by
// tools/art/make_command_icons.py sit where their parts fell, up to 13 units off centre; the game
// and the mockups put the box's centre on the command's sector, so the drawing must be centred in
// the box. Run after make_command_icons.py: it measures each drawing in a browser (its bounding
// box, without the shapes of masks and defs) and wraps the whole content in one
// <g data-centred transform="translate(…)">. A mask's content is in the user space of the element
// it masks, so it moves with the group. Running it again measures the drawing without that
// wrapper, so it never adds up.
//
// Usage: node tools/art/center_command_icons.mjs   (SHOT_BROWSER = a Chromium, see page-shot.sh)
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const FOLDERS = ['assets/base/icone/comandi', 'assets/choppe_shoppe/icone/comandi', 'assets/big_rig/icone/comandi'];
const files = FOLDERS.flatMap(d => readdirSync(d).filter(f => f.endsWith('.svg')).map(f => `${d}/${f}`));

/** The icon's markup with any earlier centring removed. */
const unwrap = svg => svg.replace(/<g data-centred transform="[^"]*">([\s\S]*)<\/g><\/svg>/, '$1</svg>');

const browser = await chromium.launch({ executablePath: process.env.SHOT_BROWSER || undefined });
const page = await browser.newPage();
for (const file of files) {
  const svg = unwrap(readFileSync(file, 'utf8'));
  await page.setContent(svg);
  const [cx, cy] = await page.evaluate(() => {
    const s = document.querySelector('svg');
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    [...s.childNodes].filter(n => n.nodeName !== 'defs' && n.nodeName !== 'mask').forEach(n => g.appendChild(n));
    s.appendChild(g);
    const r = g.getBBox();
    return [r.x + r.width / 2, r.y + r.height / 2];
  });
  const dx = (50 - cx).toFixed(2), dy = (50 - cy).toFixed(2);
  const open = svg.indexOf('>') + 1, close = svg.lastIndexOf('</svg>');
  writeFileSync(file, `${svg.slice(0, open)}<g data-centred transform="translate(${dx} ${dy})">${svg.slice(open, close)}</g></svg>${svg.slice(close + 6)}`);
  console.log(file, dx, dy);
}
await browser.close();
