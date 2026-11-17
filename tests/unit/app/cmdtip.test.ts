import { describe, it, expect } from 'vitest';
import { cmdTipHtml } from '../../../src/app/cmdtip';

describe('command pop-up', () => {
  it('writes the name, the dice the command takes and its effect', () => {
    // Arrange
    const tip = { name: 'NITRO', dice: '1-3', text: 'Aggiungi il dado al movimento dell’auto.' };
    // Act
    const html = cmdTipHtml(tip);
    // Assert
    expect(html).toBe('<b>NITRO</b><small>dado 1-3</small><p>Aggiungi il dado al movimento dell’auto.</p>');
  });
  it('says a star space takes only a command token, and keeps the words already written', () => {
    expect(cmdTipHtml({ name: 'BUMP!', dice: '★', text: 'x' })).toContain('solo con un segnalino comando');
    expect(cmdTipHtml({ name: 'DRIFT', dice: 'dado 3 · 4 · 5', text: 'x' })).toContain('<small>dado 3 · 4 · 5</small>');
  });
});
