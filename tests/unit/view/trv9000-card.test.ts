// The TRV9000 activation cards redrawn in the game's look (src/view/vector/trv9000.ts).
import { describe, it, expect } from 'vitest';
import trv9000 from '../../../data/trv/trv9000.json';
import { botCardSvg, type BotCardArt } from '../../../src/view/vector/trv9000';

const CARDS = trv9000.cards as BotCardArt[];
const COMMANDS = trv9000.commands as Record<string, string>;
const COLOR = '#3a6fc4';

describe('TRV9000 card drawing', () => {
  it('draws every card as a standalone SVG with no bare attributes', () => {
    for (const c of CARDS) {
      const svg = botCardSvg(c, { color: COLOR, active: 0, commands: COMMANDS });
      expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
      // Every attribute in every tag has a value (an <img> refuses an SVG file without them).
      for (const tag of svg.match(/<[a-zA-Z][^>]*>/g)!) expect(tag.replace(/\s[\w:-]+="[^"]*"/g, '')).toMatch(/^<[\w:-]+\s*\/?>$/);
    }
  });

  it('lights the active line in the team colour, and no line without one', () => {
    const c = CARDS[0];
    expect(botCardSvg(c, { color: COLOR, active: 2, commands: COMMANDS })).toContain(`fill="${COLOR}"/>`);
    expect(botCardSvg(c, { color: COLOR, active: null, commands: COMMANDS })).not.toContain(`fill="${COLOR}"/>`);
  });

  it('writes the size letter of each line and the number of each step', () => {
    const c = CARDS.find(x => x.id === 3)!;
    const svg = botCardSvg(c, { color: COLOR, commands: COMMANDS });
    for (const l of c.lines) expect(svg).toContain(`>${l.car}</text>`);
    const numbers = c.lines.flatMap(l => l.steps.filter(s => !s.startsWith('fire:')).map(s => s.slice(0, -1)));
    for (const n of numbers) expect(svg).toContain(`>${n}</text>`);
    expect(svg).toContain('ATTACCO AEREO');
  });
});
