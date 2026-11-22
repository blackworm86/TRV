// The players' pictures (the profile window, asked by the user, 2026-11-22): for now the faces of
// the Choppe Shoppe crew leaders, small copies in assets/choppe_shoppe/avatar_personaggi/mini/
// (160 px WebP, made from the full portraits beside them); avatars of their own will come later
// and take ids the same way. A player without one shows the initial of its name.

import { leaders } from '../game/trv/engine';
import { esc } from './util';

const URLS: Record<string, string> = Object.fromEntries(Object.entries(
  import.meta.glob<string>('/assets/choppe_shoppe/avatar_personaggi/mini/*.webp', { eager: true, query: '?url', import: 'default' }),
).map(([path, url]) => [path.replace(/^.*\/|\.\w+$/g, ''), url]));

/** The pictures a player can choose, in the order the window shows them: id, name, image address. */
export function avatarChoices(): { id: string; name: string; url: string }[] {
  return leaders().filter(l => URLS[l.id]).map(l => ({ id: l.id, name: l.name, url: URLS[l.id] }));
}

/** The image address of avatar `id`; '' for none or an unknown one. */
export const avatarUrl = (id: string | null | undefined): string => (id && URLS[id]) || '';

/**
 * A round avatar: the picture when there is one, else the name's initial on `color`.
 * `cls` adds classes (e.g. for size).
 */
export function avatarHtml(name: string, avatar?: string | null, color = '#6b5440', cls = ''): string {
  const url = avatarUrl(avatar);
  const initial = esc((name.trim()[0] ?? '?').toUpperCase());
  return url
    ? `<span class="av pic ${cls}" style="--c:${color};background-image:url('${url}')" role="img" aria-label="${esc(name)}"></span>`
    : `<span class="av ${cls}" style="--c:${color}">${initial}</span>`;
}

/** Shows avatar `avatar` (or the initial of `name`) inside an existing `.av` element. */
export function paintAvatar(el: HTMLElement, name: string, avatar?: string | null): void {
  const url = avatarUrl(avatar);
  el.classList.toggle('pic', !!url);
  el.style.backgroundImage = url ? `url('${url}')` : '';
  el.textContent = url ? '' : (name.trim()[0] ?? '?').toUpperCase();
}
