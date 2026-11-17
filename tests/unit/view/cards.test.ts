import { describe, expect, it } from 'vitest';
import SHOPPE from '../../../data/trv/choppe_shoppe.json';
import CARNAGE from '../../../data/trv/carnage.json';
import { fitText, ongoingCardSvg, ongoingCardText, textWidth, upgradeCardSvg, upgradeCardText } from '../../../src/view/cards';

describe('digital cards', () => {
  it('has the Italian text of every upgrade and ongoing effect card', () => {
    // Arrange / Act
    const noUpgrade = SHOPPE.upgrades.filter(u => !upgradeCardText(u.id));
    const noOngoing = CARNAGE.ongoing_effects.filter(o => !ongoingCardText(o.id)[1]);
    // Assert
    expect(noUpgrade.map(u => u.id)).toEqual([]);
    expect(noOngoing.map(o => o.id)).toEqual([]);
  });

  it('wraps the text inside the width and shrinks it to fit the height', () => {
    // Arrange
    const text = 'Se il dado assegnato a questa auto è 3 o meno, non rivelare i segnalini pericolo coperti nelle caselle in cui entra in questo turno.';
    // Act
    const roomy = fitText(text, () => 548, 400, 42, 20);
    const tight = fitText(text, () => 548, 120, 42, 20);
    // Assert
    expect(roomy.size).toBe(42);
    expect(tight.size).toBeLessThan(roomy.size);
    for (const l of roomy.lines) expect(textWidth(l.text) * roomy.size).toBeLessThanOrEqual(548);
    for (const l of tight.lines) expect(textWidth(l.text) * tight.size).toBeLessThanOrEqual(548);
    const last = tight.lines[tight.lines.length - 1];
    expect(last.y + tight.size * 0.25).toBeLessThanOrEqual(120);
  });

  it('sets a bracketed paragraph apart, in italics', () => {
    const fit = fitText('Dopo il movimento puoi mettere una mina.\n(Massimo 3 volte per partita.)', () => 900, 300, 40, 20);
    expect(fit.lines.map(l => l.italic)).toEqual([false, true]);
  });

  it('draws an upgrade card with its illustration, name, Italian text and printed pictogram', () => {
    // Act
    const card = upgradeCardSvg({ id: 'rail_gun', name: 'Rail Gun', text: upgradeCardText('rail_gun') });
    // Assert
    expect(card).toMatch(/<image href="[^"]*illustrazioni\/rail_gun\.jpg"/);
    expect(card).toMatch(/<image href="[^"]*pittogrammi\/rail_gun\.png"/);
    expect(card).toContain('>RAIL GUN</text>');
    expect(card).toContain('Questa auto');
    expect(card).not.toMatch(/potenziamenti\/rail_gun\.jpg/); // not the scanned card with its English text
  });

  it('keeps the text of a card with a pictogram beside it clear of the pictogram', () => {
    const card = upgradeCardSvg({ id: 'punt_gun', name: 'Punt Gun', text: upgradeCardText('punt_gun') });
    const lines = [...card.matchAll(/<text x="42" y="[\d.]+">([^<]+)<\/text>/g)].map(m => m[1]);
    const size = Number(/font-weight="500" font-size="(\d+)"/.exec(card)![1]);
    expect(lines.length).toBeGreaterThan(0);
    for (const l of lines) expect(42 + textWidth(l) * size).toBeLessThanOrEqual(440);
  });

  it('sets bold words in bold', () => {
    expect(upgradeCardSvg({ id: 'armor_plating', name: 'Armor Plating', text: upgradeCardText('armor_plating') }))
      .toContain('<tspan font-weight="700">QUALSIASI</tspan>');
  });

  it('gives each drawn card its own ids, so several can share a page', () => {
    const a = upgradeCardSvg({ id: 'spoiler', name: 'Spoiler', text: 'x', key: 'a' });
    const b = upgradeCardSvg({ id: 'spoiler', name: 'Spoiler', text: 'x', key: 'b' });
    const ids = (s: string): string[] => [...s.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
    expect(ids(a).length).toBeGreaterThan(0);
    expect(ids(a).filter(i => ids(b).includes(i))).toEqual([]);
  });

  it('draws an ongoing effect card with its illustration and the Italian name on the red panel', () => {
    const [name, text] = ongoingCardText('nitro_leak');
    const card = ongoingCardSvg({ id: 'nitro_leak', name, text });
    expect(card).toMatch(/<image href="[^"]*illustrazioni\/nitro_leak\.jpg"/);
    expect(card).toContain('>PERDITA DI NITRO</text>');
    expect(card).toContain('fill="#e01a30"');
  });
});
