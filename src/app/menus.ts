// The options and menu popovers.

import { applyLevel, fpsNow } from './quality';
import { DiceThrow, Level, MoveMode, Quality, Speed, Style, saveSettings, settings, type Settings } from './settings';
import { S } from './state';
import { setMoveMode } from './waypoints';
import { $ } from './util';

/** The options that are a box ticked or not. */
type BoolSetting = { [K in keyof Settings]: Settings[K] extends boolean ? K : never }[keyof Settings];

export const LEVEL_NAME: Record<Level, string> = { high: 'alta', medium: 'media', low: 'bassa' };
/** Shows the settings in the Options popover. */
export function syncOptions(): void {
  const pop = $('optspop');
  for (const seg of pop.querySelectorAll<HTMLElement>('.seg')) {
    const key = seg.dataset.set as 'quality' | 'speed' | 'dice' | 'move' | 'style';
    for (const b of seg.querySelectorAll<HTMLButtonElement>('button')) b.classList.toggle('on', b.dataset.v === settings[key]);
  }
  for (const box of pop.querySelectorAll<HTMLInputElement>('input[data-set]')) box.checked = !!settings[box.dataset.set as BoolSetting];
  $('fps').textContent = `${fpsNow ? `${Math.round(fpsNow)} fotogrammi al secondo · ` : ''}qualità in uso: ${LEVEL_NAME[S.level]}`;
}
for (const seg of $('optspop').querySelectorAll<HTMLElement>('.seg')) {
  seg.addEventListener('click', e => {
    const b = (e.target as HTMLElement).closest('button');
    if (!b) return;
    if (seg.dataset.set === 'quality') {
      settings.quality = b.dataset.v as Quality;
      S.fpsSlow = 0;
      applyLevel(settings.quality === 'auto' ? 'high' : settings.quality);
    } else if (seg.dataset.set === 'style') {
      settings.style = b.dataset.v as Style;
      applyLevel(S.level);
    } else if (seg.dataset.set === 'dice') settings.dice = b.dataset.v as DiceThrow;
    else if (seg.dataset.set === 'move') setMoveMode(b.dataset.v as MoveMode);
    else settings.speed = b.dataset.v as Speed;
    saveSettings();
    syncOptions();
  });
}
for (const box of $('optspop').querySelectorAll<HTMLInputElement>('input[data-set]')) {
  box.addEventListener('change', () => { settings[box.dataset.set as BoolSetting] = box.checked; saveSettings(); syncOptions(); });
}
export function closePops(): void {
  $('menupop').classList.remove('show');
  $('menu').classList.remove('on');
}
/** Shows the menu's tab `tab`: the menu itself, the match's options or the graphics'. */
function showTab(tab: string): void {
  for (const b of $('mtabs').querySelectorAll<HTMLElement>('[data-tab]')) b.classList.toggle('on', b.dataset.tab === tab);
  for (const p of $('menupop').querySelectorAll<HTMLElement>('.mpane')) p.classList.toggle('on', p.dataset.pane === tab);
  if (tab !== 'menu') syncOptions();
}
$('mtabs').addEventListener('click', e => { const b = (e.target as HTMLElement).closest<HTMLElement>('[data-tab]'); if (b) showTab(b.dataset.tab!); });
export function togglePop(pop: string, btn: string): void {
  const open = !$(pop).classList.contains('show');
  closePops();
  if (!open) return;
  $(pop).classList.add('show');
  $(btn).classList.add('on');
  syncOptions();
}
$('menu').addEventListener('click', e => { e.stopPropagation(); togglePop('menupop', 'menu'); });
// The version built (vite.config.ts), at the foot of the Menu.
declare const __BUILD__: string;
$('buildtag').textContent = `Versione ${typeof __BUILD__ === 'string' ? __BUILD__ : 'locale'}`;
$('menupop').addEventListener('pointerdown', e => e.stopPropagation());
addEventListener('pointerdown', closePops);
addEventListener('keydown', e => { if (e.key === 'Escape') closePops(); });
