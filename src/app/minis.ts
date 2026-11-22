// The mini expansions on the table (the approved mockup, design/ux/mockup/): the viewer's hand of
// face-down cards top left (One Shots, Bounties, Advanced Airstrikes), the Bonus Command card above
// the command board (a die or a command token goes on it as on the other commands), a flag by each
// road tile with its Road Condition (pointing at it opens the card), and the card backs in the
// players' bubbles.

import * as THREE from 'three';
import { TILE_COLS, miniCardName, type Decision, type Player } from '../game/trv/engine';
import { miniCard, miniCardSvg, type MiniFamily } from '../view/minicards';
import { choose, g, zoneOption } from './game';
import { camera, world } from './stage';
import { S } from './state';
import { $, esc } from './util';

/** The hands of face-down cards, with their family and the colour of their back. */
const HANDS = [
  { hand: 'oneShots', family: 'one_shots', cls: 'os', what: 'One Shot' },
  { hand: 'bounties', family: 'bounties', cls: 'bo', what: 'Bounty' },
  { hand: 'airstrikes', family: 'advanced_airstrikes', cls: 'aa', what: 'Advanced Airstrike' },
] as const;

/** A mini expansion card as the page shows it: the official card, translated (src/view/minicards.ts). */
const cardDiv = (family: MiniFamily, id: string, cls = 'mcard'): string =>
  `<div class="${cls}" data-family="${family}" data-card="${esc(id)}" title="${esc(miniCardName(id))}">${miniCardSvg(family, id)}</div>`;

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
 * The viewer's hand (top left) and Bonus Command card (above the command board), redrawn with the
 * HUD. `d`: the decision asked now; `mine`: it is the viewer's to answer.
 */
export function drawMinis(d: Decision | null, me: Player, mine: boolean): void {
  const box = $('minis');
  drawRoadFlags();
  if (!g || me.bot) { box.innerHTML = ''; return; }
  const playing = d?.kind === 'playCard' && d.player === me.id ? d.options[1].card : null;
  const cards = HANDS.map(h => ({ h, id: g![h.hand]?.[me.id] ?? null })).filter(x => x.id);
  let html = cards.length
    ? `<div class="mhand"><h4>LA TUA MANO</h4>${cards.map(x => cardDiv(x.h.family, x.id!, `mcard${x.id === playing ? ' hot' : ''}`)).join('')}</div>` : '';
  const bonus = g.bonusCommands?.[me.id];
  if (bonus) {
    // Lit when a die or a token can go on it now (the selected die, or any free one).
    const can = mine && !!d && d.options.some((o, i) => o.bonus && (d.kind === 'token' || S.selDie === null || zoneOption('bonus', S.selDie) === i));
    const range = miniCard('bonus_commands', bonus)?.range;
    html += `<div class="mbonus${me.bonusUsed ? ' used' : ''}${can ? ' hotzone' : ''}" data-drop="bonus" title="${esc(`Comando bonus: ${miniCardName(bonus)} (dado ${range === 'ANY' ? 'qualsiasi' : range})`)}">`
      + `${miniCardSvg('bonus_commands', bonus)}${me.bonusUsed ? `<b class="on">${me.bonusUsed === 'token' ? 'SEGNALINO' : 'DADO'}</b>` : ''}</div><div class="mbonuslabel">COMANDO BONUS</div>`;
  }
  box.innerHTML = html;
  const b = box.querySelector<HTMLElement>('.mbonus');
  if (b && mine && d) b.onclick = () => {
    if (d.kind === 'token') { const i = d.options.findIndex(o => o.bonus); if (i > 0) choose(i); return; }
    const p = g!.players[d.player];
    const die = S.selDie ?? p.dice.findIndex((_, i) => !p.used[i] && zoneOption('bonus', i) >= 0);
    const i = die !== null && die >= 0 ? zoneOption('bonus', die) : -1;
    if (i >= 0) choose(i);
  };
}

// ---------------------------------------------------------------- Road Conditions

let flags: { el: HTMLElement; at: THREE.Vector3 }[] = [];
let flagKey = '';
/** A flag by each road tile with a condition, with the card, opened by pointing at the flag. */
function drawRoadFlags(): void {
  const cards = g?.roads?.cards ?? [];
  const k = cards.join(',');
  if (k === flagKey) return;
  flagKey = k;
  for (const f of flags) f.el.remove();
  flags = [];
  cards.forEach((id, slot) => {
    if (!id) return;
    const el = document.createElement('div');
    el.className = 'rcflag';
    el.innerHTML = `<span>${esc(miniCardName(id).toUpperCase())}</span>${cardDiv('road_conditions', id, 'mcard rcpop')}`;
    // A tap opens and closes the card on a touch screen.
    el.onclick = () => el.classList.toggle('open');
    $('fx').append(el);
    // On the tile's top edge, towards its right end: the tile's name is printed at its left.
    flags.push({ el, at: world({ r: 0, c: slot * TILE_COLS + TILE_COLS - 2 }).add(new THREE.Vector3(0, 0, -0.55)) });
  });
}
/** Keeps the Road Condition flags on their tiles as the view moves (each frame). */
export function placeRoadFlags(): void {
  for (const f of flags) {
    const p = f.at.clone().project(camera);
    f.el.style.left = `${(p.x + 1) / 2 * innerWidth}px`;
    f.el.style.top = `${(1 - p.y) / 2 * innerHeight}px`;
    f.el.style.display = p.z < 1 ? '' : 'none';
  }
}
