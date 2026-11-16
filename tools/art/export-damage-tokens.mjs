// Writes one SVG per damage token, in the layout of the owner's template (front left, back right,
// captions under them), with the symbols the game draws. Usage:
//   node tools/art/export-damage-tokens.mjs <output folder>
// It loads the game's own drawing code through Vite, so the files match what the game shows.
import { createServer } from 'vite';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const out = process.argv[2];
if (!out) { console.error('usage: node tools/art/export-damage-tokens.mjs <output folder>'); process.exit(1); }
mkdirSync(out, { recursive: true });
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const art = await server.ssrLoadModule('/src/view/vector/art.ts');
  const dmg = await server.ssrLoadModule('/src/view/vector/damage.ts');
  const template = readFileSync('assets/ui/damage/template.svg', 'utf8');
  const own = dmg.ownerDamage(template);
  if (!own) throw new Error('template: front or back not found');
  // From art.ts's 110 x 100 box back to the template's coordinates (inverse of damage.ts's placement).
  const toTemplate = 'translate(33.09 44) scale(2.0559615) translate(-3 -3)';
  const tokens = [['shrapnel'], ['dazed'], ['dent'], ['blastoff'], ['skid', 'F'], ['skid', 'FL'], ['skid', 'FR'], ['skid', 'B'], ['skid', 'BL'], ['skid', 'BR'], ['on_fire'], ['ongoing_effect']];
  for (const [type, dir] of tokens) {
    const face = art.damageTokenSvg(type, true, dir).replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
    if (!face.startsWith(own.front)) throw new Error(`${type}: front outline not found`);
    const symbol = face.slice(own.front.length);
    const sheet = template.replace(/<\/svg>\s*$/, `  <g id="simbolo">\n    <g transform="${toTemplate}">${symbol}</g>\n  </g>\n</svg>\n`);
    const name = `trv_danno_${type}${dir ? `_${dir.toLowerCase()}` : ''}.svg`;
    writeFileSync(join(out, name), sheet);
    console.log(name);
  }
} finally {
  await server.close();
}
