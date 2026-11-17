// The pop-up of the command board's commands (asked by the user, 2026-11-17): the board shows each
// command as an icon (src/view/vector/boards.ts); with the pointer on it, a small window gives the
// command's name, the dice it takes and what it does. The board's quarters carry those words in
// data-cmd-name, data-cmd-dice and data-cmd-text.

import { esc } from './util';

/** The words of one command as the pop-up shows them. */
export interface CommandTip { name: string; dice: string; text: string }

/**
 * The pop-up's inner markup. A bare die range ("1-3", "6") is written as "dado …"; "★" is a
 * command only a command token can activate.
 * Example: `cmdTipHtml({ name: 'NITRO', dice: '1-3', text: 'Aggiungi il dado…' })`.
 */
export function cmdTipHtml(t: CommandTip): string {
  const dice = t.dice === '★' ? 'solo con un segnalino comando' : /^[\d-]+$/.test(t.dice) ? `dado ${t.dice}` : t.dice;
  return `<b>${esc(t.name)}</b><small>${esc(dice)}</small><p>${esc(t.text)}</p>`;
}

/** Shows the pop-up over the command under the pointer, above it and kept on screen. */
export function commandTips(): void {
  const pop = document.createElement('div');
  pop.id = 'cmdtip';
  document.body.append(pop);
  let shown: Element | null = null;
  addEventListener('pointermove', e => {
    const el = (e.target as Element | null)?.closest?.('[data-cmd-name]') ?? null;
    if (el !== shown) {
      shown = el;
      if (el) pop.innerHTML = cmdTipHtml({ name: el.getAttribute('data-cmd-name') ?? '', dice: el.getAttribute('data-cmd-dice') ?? '', text: el.getAttribute('data-cmd-text') ?? '' });
      pop.classList.toggle('show', !!el);
    }
    if (!el) return;
    const r = el.getBoundingClientRect();
    const w = pop.offsetWidth, h = pop.offsetHeight;
    pop.style.left = `${Math.min(innerWidth - w - 8, Math.max(8, r.left + r.width / 2 - w / 2))}px`;
    pop.style.top = `${Math.max(8, r.top - h - 10)}px`;
  });
  addEventListener('pointerdown', () => { shown = null; pop.classList.remove('show'); }); // a die being dropped: out of the way
}
