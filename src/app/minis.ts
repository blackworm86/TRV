// The mini expansions on the table, on the left with the commands (asked by the user, 2026-11-22):
// the viewer's hand of face-down cards (One Shots, Bounties, Advanced Airstrikes) over the command
// board, the Bonus Command as a die diamond off the board's top left corner (a die or a command
// token goes on it as on the other commands; its card shows while pointing at it), each road tile's
// Road Condition as an icon on its name banner, and the card backs in the players' bubbles.

import * as THREE from 'three';
import { miniCardName, type Decision, type Player } from '../game/trv/engine';
import { miniCard, miniCardArt, miniCardSvg, type MiniFamily } from '../view/minicards';
import { choose, g, zoneOption } from './game';
import { camera, tileSlots } from './stage';
import { S } from './state';
import { $, esc } from './util';

/** The hands of face-down cards, with their family and the colour of their back. */
const HANDS = [
  { hand: 'oneShots', family: 'one_shots', cls: 'os', what: 'One Shot' },
  { hand: 'bounties', family: 'bounties', cls: 'bo', what: 'Bounty' },
  { hand: 'airstrikes', family: 'advanced_airstrikes', cls: 'aa', what: 'Advanced Airstrike' },
] as const;

/** A mini expansion card as the page shows it: the official card, translated (src/view/minicards.ts). */
const cardDiv = (family: MiniFamily, id: string, cls = 'mcard', tip = true): string =>
  `<div class="${cls}" data-family="${family}" data-card="${esc(id)}"${tip ? ` aria-label="${esc(miniCardName(id))}"` : ''}>${miniCardSvg(family, id)}</div>`;

/**
 * The card backs beside a player's name: the Bonus Command (face up, its name in the tip), then one
 * back per face-down card dealt, faded once played. `mine`: the viewer reads their own cards.
 */
export function miniBacks(p: Player, mine: boolean): string {
  if (!g || p.bot) return '';
  let out = '';
  const bonus = g.bonusCommands?.[p.id];
  if (bonus) out += `<i class="mb bc${p.bonusUsed ? ' used' : ''}" title="${esc(`Comando bonus: ${miniCardName(bonus)}${p.bonusUsed ? ' (usato in questo round)' : ''}`)}"></i>`;
  for (const h of HANDS) {
    const held = g[h.hand];
    if (!held) continue;
    const id = held[p.id];
    const tip = id ? (mine ? `${h.what}: ${miniCardName(id)}` : `${h.what} coperta`) : `${h.what} giocata`;
    out += `<i class="mb ${h.cls}${id ? '' : ' used'}" title="${esc(tip)}"></i>`;
  }
  return out ? `<span class="mbacks">${out}</span>` : '';
}

/**
 * Where the left column stands (asked by the user, 2026-11-22: commands and answers on the left):
 * the command board's left and right edges, the top of its dice tray, the size of its die diamonds
 * and the top of the upper ones (`corner`), read from the strip. Null when the strip has no command
 * diamonds.
 */
export function commandColumn(): { left: number; right: number; top: number; size: number; corner: number } | null {
  const ds = [...document.querySelectorAll<SVGGraphicsElement>('#strip path[data-drop^="cmd:"]')].map(e => e.getBoundingClientRect()).filter(r => r.width > 0);
  if (!ds.length) return null;
  const size = ds[0].width, left = Math.min(...ds.map(r => r.left)), right = Math.max(...ds.map(r => r.right));
  const plate = document.querySelector('#strip .undoplate')?.getBoundingClientRect();
  const corner = Math.min(...ds.map(r => r.top));
  const top = plate && plate.height > 0 ? plate.top - size * 0.85 : corner - size * 1.9;
  return { left, right, top, size, corner };
}

/** The face-down cards `p` holds (One Shots, Bounties, Advanced Airstrikes), in that order. */
export function handCards(p: Player): { family: MiniFamily; id: string }[] {
  if (!g || p.bot) return [];
  return HANDS.flatMap(h => { const id = g![h.hand]?.[p.id]; return id ? [{ family: h.family as MiniFamily, id }] : []; });
}

/**
 * The Bonus Command as the command board draws it (src/view/vector/boards.ts: one more die space,
 * the board grown to hold it), or nothing. `hot`: a die or a token can go on it now.
 */
export function bonusArt(me: Player, hot: boolean): { bonus?: { slot: string; name: string; hot: boolean; used?: 'die' | 'token' } } {
  const id = g?.bonusCommands?.[me.id];
  if (!id || me.bot) return {};
  const range = miniCard('bonus_commands', id)?.range;
  return { bonus: { slot: range === 'ANY' ? '1-6' : range ?? '', name: miniCardName(id), hot, ...(me.bonusUsed ? { used: me.bonusUsed } : {}) } };
}

/** The card shown large ("family:id"), and the viewer's Bonus Command card. */
let zoomed = '', myBonus = '';

/**
 * The viewer's hand, in the tray of dice and tokens over the command board (asked by the user,
 * 2026-11-22), and the Bonus Command's card, shown large while pointing at its die space. The Big
 * Rig's and the Final Five's boards have no such space drawn yet: there it is a diamond of its own
 * off the board's top left corner. Redrawn with the HUD. `d`: the decision asked now; `mine`: it is
 * the viewer's to answer.
 */
export function drawMinis(d: Decision | null, me: Player, mine: boolean): void {
  const box = $('minis'), tray = $('cmdhand');
  drawRoadFlags();
  zoomed = '';
  myBonus = '';
  if (!g || me.bot) { box.innerHTML = ''; tray.innerHTML = ''; return; }
  const playing = d?.kind === 'playCard' && d.player === me.id ? d.options[1].card : null;
  tray.innerHTML = handCards(me).map(c => `<div class="mslot${c.id === playing ? ' hot' : ''}" data-zoom="${c.family}:${esc(c.id)}">${cardDiv(c.family, c.id)}</div>`).join('');
  let html = '<div class="mcard mzoom"></div>';
  const bonus = g.bonusCommands?.[me.id];
  if (bonus) myBonus = bonus;
  if (bonus && (me.rig || me.team === 'final_five')) {
    // Lit when a die or a token can go on it now (the selected die, or any free one).
    const can = mine && !!d && d.options.some((o, i) => o.bonus && (d.kind === 'token' || S.selDie === null || zoneOption('bonus', S.selDie) === i));
    const range = miniCard('bonus_commands', bonus)?.range;
    html += `<div class="mbonus${me.bonusUsed ? ' used' : ''}${can ? ' hotzone' : ''}" data-drop="bonus" data-bonus="1" aria-label="${esc(`Comando bonus: ${miniCardName(bonus)}`)}">`
      + `<svg viewBox="0 0 100 100"><path d="M50 3 L97 50 L50 97 L3 50Z"/></svg>`
      + `<b class="gothic">${esc(range === 'ANY' ? '1-6' : range ?? '')}</b>${me.bonusUsed ? `<i>${me.bonusUsed === 'token' ? 'SEGNALINO' : 'DADO'}</i>` : ''}</div>`;
  }
  box.innerHTML = html;
  placeMinis();
  requestAnimationFrame(placeMinis); // once the strip has its final size
  const b = box.querySelector<HTMLElement>('.mbonus');
  if (b && mine && d) b.onclick = () => {
    if (d.kind === 'token') { const i = d.options.findIndex(o => o.bonus); if (i > 0) choose(i); return; }
    const p = g!.players[d.player];
    const die = S.selDie ?? p.dice.findIndex((_, i) => !p.used[i] && zoneOption('bonus', i) >= 0);
    const i = die !== null && die >= 0 ? zoneOption('bonus', die) : -1;
    if (i >= 0) choose(i);
  };
}

/** Shows `family:id` large beside `at` (the hand: right of the tray; the bonus: above its space), or hides it. */
function zoom(key: string, at?: DOMRect, above = false): void {
  const el = document.querySelector<HTMLElement>('#minis .mzoom');
  if (!el) return;
  if (!key || !at) { el.classList.remove('show'); zoomed = ''; return; }
  if (key !== zoomed) {
    const [family, id] = key.split(':') as [MiniFamily, string];
    el.innerHTML = miniCardSvg(family, id);
    zoomed = key;
  }
  const w = 280, h = w * 1040 / 744;
  const left = above ? Math.max(8, at.left) : Math.min(innerWidth - w - 8, at.right + 12);
  const top = above ? Math.max(68, at.top - h - 12) : Math.max(68, Math.min(innerHeight - h - 8, at.bottom - h));
  el.style.left = `${left}px`;
  el.style.top = `${top}px`;
  el.classList.add('show');
}
// Pointing at a card of the hand, or at the Bonus Command's space, shows the card large.
addEventListener('pointerover', e => {
  const t = e.target as Element | null;
  const slot = t?.closest?.<HTMLElement>('#cmdhand .mslot');
  if (slot) { zoom(slot.dataset.zoom!, $('cmddock').getBoundingClientRect()); return; }
  const bonus = t?.closest?.('[data-bonus]');
  if (bonus && myBonus) { zoom(`bonus_commands:${myBonus}`, bonus.getBoundingClientRect(), true); return; }
  if (zoomed) zoom('');
});

/**
 * Where a question about a card goes (a card to play, a bounty completed): in the left column, over
 * the tray, its left edge on the command board's. Null when the strip has no command board.
 * `w`, `h`: the question's size.
 */
export function cardAskSpot(w: number, h: number): { x: number; top: number } | null {
  const col = commandColumn();
  if (!col) return null;
  const tray = $('cmddock').getBoundingClientRect();
  const above = Math.min(col.top, tray.height ? tray.top : col.top) - 12;
  return { x: Math.max(8, col.left) + w / 2, top: Math.max(68, above - h) };
}

/** Sets the Bonus Command's own diamond (Big Rig, Final Five) off the board's top left corner. */
function placeMinis(): void {
  const col = commandColumn();
  const bonus = document.querySelector<HTMLElement>('#minis .mbonus');
  if (!bonus) return;
  if (!col) { bonus.style.cssText = ''; return; }
  // Beside the top left diamond, edge to edge with it, a step up and to the left.
  const s = col.size;
  bonus.style.cssText = `left:${Math.max(4, col.left - s * 0.56)}px;top:${col.corner - s * 0.56}px;--s:${s}px`;
}
addEventListener('resize', () => requestAnimationFrame(placeMinis));

// ---------------------------------------------------------------- Road Conditions

let flags: { el: HTMLElement; slot: number; mesh: THREE.Mesh }[] = [];
let flagKey = '';
/** The conditions whose text stays shown over their tile (a click on the symbol), by card. */
const pinned = new Set<string>();
/** The cleaned card's symbol, without its title: the part of the card laid on the tile's banner. */
const ICON_CROP = { x: 60, y: 40, w: 624, h: 430 } as const;
/** The symbol's height on the banner (of the banner's depth), and the room around it (of its own height). */
const ICON_FILL = 0.84, ICON_PAD = 0.3;
/** A tile's name banner, as the board draws it (src/view/board3d.ts, `userData.banner`). */
interface Banner { start: THREE.Vector3; length: number; depth: number; indent(room: number): void }
const loader = new THREE.TextureLoader();

/** The card's symbol as a flat piece of the tile's name banner, in the banner's units. */
function roadSymbol(id: string): THREE.Mesh {
  const art = miniCardArt('road_conditions', id);
  const mat = new THREE.MeshStandardMaterial({ color: art ? 0xffffff : 0xf2c230, roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -2 });
  if (art) loader.load(art, t => {
    t.colorSpace = THREE.SRGBColorSpace;
    // The symbol only: the card's top, without its title (the image's v runs from the bottom).
    t.repeat.set(ICON_CROP.w / 744, ICON_CROP.h / 1040);
    t.offset.set(ICON_CROP.x / 744, 1 - (ICON_CROP.y + ICON_CROP.h) / 1040);
    mat.map = t;
    mat.needsUpdate = true;
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Each road tile's Road Condition, printed on the tile's name banner left of the name (asked by the
 * user, 2026-11-22): the card's own yellow and black symbol, part of the map. Over it, an unseen
 * spot for the pointer: pointing shows the whole card, large; a click keeps the card's text shown
 * over the banner, or hides it again.
 */
function drawRoadFlags(): void {
  const cards = g?.roads?.cards ?? [];
  const k = cards.join(',');
  if (k === flagKey) return;
  flagKey = k;
  for (const f of flags) {
    f.el.remove();
    unprint(f);
    f.mesh.geometry.dispose();
    const m = f.mesh.material as THREE.MeshStandardMaterial;
    m.map?.dispose();
    m.dispose();
  }
  flags = [];
  cards.forEach((id, slot) => {
    if (!id) return;
    const card = miniCard('road_conditions', id);
    const text = card ? (Array.isArray(card.text) ? card.text.join(' ') : card.text) : '';
    const el = document.createElement('div');
    el.className = `rcflag${pinned.has(id) ? ' pin' : ''}`;
    el.dataset.card = id;
    el.innerHTML = `<div class="rctext"><b class="gothic">${esc(miniCardName(id).toUpperCase())}</b>${esc(text)}</div>`
      + cardDiv('road_conditions', id, 'mcard rcpop', false);
    el.onclick = () => {
      if (pinned.has(id)) pinned.delete(id); else pinned.add(id);
      el.classList.toggle('pin', pinned.has(id));
    };
    $('fx').append(el);
    flags.push({ el, slot, mesh: roadSymbol(id) });
  });
}

/** Takes a symbol off its banner, the name back in its place. */
function unprint(f: { mesh: THREE.Mesh }): void {
  (f.mesh.parent?.userData.banner as Banner | undefined)?.indent(0);
  f.mesh.removeFromParent();
}

const corner = new THREE.Vector3();
/**
 * Keeps each symbol on its tile's banner (the tiles slide as the road moves on) and the pointer's
 * spot over it, as the view moves (each frame).
 */
export function placeRoadFlags(): void {
  for (const f of flags) {
    const tile = tileSlots[f.slot];
    const banner = tile?.userData.banner as Banner | undefined;
    if (!tile || !banner) { f.el.style.display = 'none'; unprint(f); continue; }
    if (f.mesh.parent !== tile) {
      // At the banner's left end, as tall as most of the banner, lying just over it; the name moves
      // over to make room (asked by the user, 2026-11-22).
      unprint(f);
      const h = banner.depth * ICON_FILL, w = h * ICON_CROP.w / ICON_CROP.h, pad = h * ICON_PAD;
      f.mesh.scale.set(w, h, 1);
      f.mesh.position.set(banner.start.x + pad + w / 2, banner.start.y + 0.001, banner.start.z);
      tile.add(f.mesh);
      banner.indent(w + pad);
    }
    // The spot: the box around the symbol's four corners, on the screen.
    tile.updateMatrixWorld();
    f.mesh.updateMatrixWorld();
    let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity, behind = false;
    for (const [x, y] of [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]]) {
      corner.set(x, y, 0).applyMatrix4(f.mesh.matrixWorld).project(camera);
      if (corner.z >= 1) behind = true;
      const sx = (corner.x + 1) / 2 * innerWidth, sy = (1 - corner.y) / 2 * innerHeight;
      l = Math.min(l, sx); r = Math.max(r, sx); t = Math.min(t, sy); b = Math.max(b, sy);
    }
    f.el.style.cssText = behind ? 'display:none'
      : `left:${l.toFixed(1)}px;top:${t.toFixed(1)}px;width:${(r - l).toFixed(1)}px;height:${(b - t).toFixed(1)}px`;
  }
}
