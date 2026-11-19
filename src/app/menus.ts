// The options and menu popovers.

import { applyLevel, fpsNow } from './quality';
import { DiceThrow, Level, MoveMode, Quality, Speed, saveSettings, settings } from './settings';
import { S } from './state';
import { setMoveMode } from './waypoints';
import { $ } from './util';

export const LEVEL_NAME: Record<Level, string> = { high: 'alta', medium: 'media', low: 'bassa' };
/** Shows the settings in the Options popover. */
export function syncOptions(): void {
  const pop = $('optspop');
  for (const seg of pop.querySelectorAll<HTMLElement>('.seg')) {
    const key = seg.dataset.set as 'quality' | 'speed' | 'dice' | 'move';
    for (const b of seg.querySelectorAll<HTMLButtonElement>('button')) b.classList.toggle('on', b.dataset.v === settings[key]);
  }
  for (const box of pop.querySelectorAll<HTMLInputElement>('input[data-set]')) box.checked = !!settings[box.dataset.set as 'grid' | 'actionCam' | 'director2' | 'effects' | 'words'];
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
    } else if (seg.dataset.set === 'dice') settings.dice = b.dataset.v as DiceThrow;
    else if (seg.dataset.set === 'move') setMoveMode(b.dataset.v as MoveMode);
    else settings.speed = b.dataset.v as Speed;
    saveSettings();
    syncOptions();
  });
}
for (const box of $('optspop').querySelectorAll<HTMLInputElement>('input[data-set]')) {
  box.addEventListener('change', () => { settings[box.dataset.set as 'grid' | 'actionCam' | 'director2' | 'effects' | 'words'] = box.checked; saveSettings(); syncOptions(); });
}
export function closePops(): void {
  for (const id of ['optspop', 'menupop']) $(id).classList.remove('show');
  for (const id of ['opts', 'menu']) $(id).classList.remove('on');
}
export function togglePop(pop: string, btn: string): void {
  const open = !$(pop).classList.contains('show');
  closePops();
  if (!open) return;
  $(pop).classList.add('show');
  $(btn).classList.add('on');
  if (pop === 'optspop') syncOptions();
}
$('opts').addEventListener('click', e => { e.stopPropagation(); togglePop('optspop', 'opts'); });
$('menu').addEventListener('click', e => { e.stopPropagation(); togglePop('menupop', 'menu'); });
// The version built (vite.config.ts), at the foot of the Menu.
declare const __BUILD__: string;
$('buildtag').textContent = `Versione ${typeof __BUILD__ === 'string' ? __BUILD__ : 'locale'}`;
for (const id of ['optspop', 'menupop']) $(id).addEventListener('pointerdown', e => e.stopPropagation());
addEventListener('pointerdown', closePops);
addEventListener('keydown', e => { if (e.key === 'Escape') closePops(); });
