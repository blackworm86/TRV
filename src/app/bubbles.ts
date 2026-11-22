// The players' strip at the top (asked by the user, 2026-11-19: the bubbles took too much of the 3D
// scene): one thin row per player, avatar, name, dice and a pip for each car (on the road, at the
// start, out of action, eliminated; a red mark when damaged). Pointing at a row, or a tap on it,
// opens the player's full bubble under it, over the scene.
// The full bubble (redrawn as asked by the user, 2026-11-18): avatar, the player's
// name (the leader's is in the avatar's pop-up) and command tokens, the dice still to play, then the three cars as thumbnails of their 3D
// models with their pieces under them (upgrade cards, damage tokens, ongoing effect cards, ON FIRE!).
// Pointing at a piece shows it large, under it and centred on the pointer, like the commands'
// pop-up; pointing at the avatar shows the leader's power; a click on a car takes the view to it.

import { RIG_BOARD, bigRig, botTeams, finalFive, leaderOf, upgrades, type Player, type Vehicle } from '../game/trv/engine';
import { miniBacks } from './minis';
import { minorTokenSvg } from '../view/vector/ffboards';
import { markingSvg } from '../view/vector/markings';
import { ongoingCardSvg, ongoingCardText } from '../view/cards';
import { avatarSvg, carSvg, commandTokenSvg, damageTokenSvg, dieSvg, onFireTokenSvg } from '../view/vector/art';
import { carObjs } from './board';
import { carThumb, thumbLate } from './carthumbs';
import { g, viewer } from './game';
import { cardHtml } from './hand';
import { DAMAGE_INFO, PORTRAITS, POWER_INFO } from './info';
import { focusOn } from './keys';
import { shown as atBeat } from './state';
import { $, esc } from './util';

const SIZE: Record<string, string> = { S: 'piccola', M: 'media', L: 'grande' };
/** The Big Rig's sections in a bubble: rear trailer, middle trailer, front cab. */
const RIG_TAG: Record<string, string> = { rear: 'POS', mid: 'CEN', front: 'MOT' };
/** An upgrade with a card of its own (Choppe Shoppe); a TRV9000 team's others are its team card's powers. */
const hasCard = (id: string): boolean => upgrades().some(u => u.id === id);
/** Onboard Computer: the car's damage tokens stay face down, without effect. */
const faceDown = (v: Vehicle): boolean => v.upgrade === 'onboard_computer' || v.upgrade2 === 'onboard_computer';
const stateOf = (v: Vehicle): 'elim' | 'inop' | 'start' | 'road' => (v.status === 'elim' ? 'elim' : v.status === 'inop' ? 'inop' : v.inStart ? 'start' : 'road');

/** One car of the bubble: its thumbnail and, under it, its pieces. */
function carSlot(p: Player, car: Vehicle, redraw: () => void): string {
  const v = atBeat(car), st = stateOf(v), gone = st === 'elim';
  const pic = carThumb(v.id, p.color, redraw);
  let pcs = '';
  if (!gone) {
    for (const u of [v.upgrade, v.upgrade2]) {
      if (!u) continue;
      pcs += hasCard(u)
        ? `<span class="pc up" data-tip="up" data-vid="${v.id}" data-up="${u}">${cardHtml(u, p.color)}</span>`
        : `<span class="pc team" data-tip="team" data-vid="${v.id}" data-up="${u}">★</span>`;
    }
    v.damage.forEach((t, i) => {
      // A motorcycle's minor damage token (BRaFF p3, p7).
      if (t.type === 'minor') { pcs += `<span class="pc dmg" data-tip="dmg" data-vid="${v.id}" data-i="${i}">${minorTokenSvg()}</span>`; return; }
      pcs += t.card && !faceDown(v)
        ? `<span class="pc og" data-tip="og" data-vid="${v.id}" data-i="${i}">${ongoingCardSvg({ id: t.card, name: ongoingCardText(t.card)[0], text: '', key: `b${v.id}${i}` })}</span>`
        : `<span class="pc dmg" data-tip="dmg" data-vid="${v.id}" data-i="${i}">${damageTokenSvg(faceDown(v) ? null : t.type, !faceDown(v), t.dir)}</span>`;
    });
    // The Big Rig's minor damage tokens lie on its section board, on the commands of each section (BRaFF p5).
    if (v.rig) for (const k of p.rig?.damaged.filter(x => x.startsWith(`${v.rig}:`)) ?? []) {
      pcs += `<span class="pc dmg" title="${esc(`Danno minore su ${bigRig().commandName[k.split(':')[1]] ?? k}`)}">${minorTokenSvg()}</span>`;
    }
    if (v.onFire) pcs += `<span class="pc fire" data-tip="fire" data-vid="${v.id}">${onFireTokenSvg()}</span>`;
  }
  // A Final Five motorcycle shows its marking where a car shows its size.
  const tag = v.bike !== undefined ? markingSvg(v.bike, 15) : v.rig ? RIG_TAG[v.rig] : v.size;
  const alt = v.bike !== undefined ? `Moto ${finalFive().marking_names[v.bike]}` : v.rig ? `Big Rig: ${bigRig().sectionName[v.rig]}` : `Auto ${SIZE[v.size]}`;
  return `<div class="slot ${st}"><i class="sz">${tag}</i>`
    + `<button class="car" data-vid="${v.id}" ${gone ? 'disabled' : ''}>${pic ? `<img src="${pic}" alt="${alt}">` : thumbLate(v.id) ? carSvg(v.size, p.color) : '<i class="loading"></i>'}${gone ? '<em class="x">✕</em>' : ''}</button>`
    + `<div class="pcs">${pcs}</div></div>`;
}

/**
 * The bubble of player `p`. `cls`: its state classes (turn, decides, out); `redraw` is called again
 * once the cars' thumbnails are ready.
 */
export function bubbleHtml(p: Player, cls: string, redraw: () => void): string {
  const l = leaderOf(p);
  const pic = l ? PORTRAITS[l.id] : undefined;
  const toks = p.tokens ? `<span class="tok" title="Segnalini comando">${commandTokenSvg()}${p.tokens > 1 ? `<i>${p.tokens}</i>` : ''}</span>` : '';
  const dice = p.bot
    ? `<span class="botbadge">TRV9000 · LIVELLO ${p.bot.protocol}</span>`
    : p.dice.map((v, i) => dieSvg({ kind: 'movement', value: v, color: p.color, forward: 'right', number: true, ui: true }, `class="${p.used[i] ? 'used' : ''}"`)).join('');
  const order = (v: Vehicle): number => (v.rig ? RIG_BOARD.indexOf(v.rig) : 'SML'.indexOf(v.size));
  const cars = g!.vehicles.filter(v => v.owner === p.id).sort((a, b) => order(a) - order(b)).map(v => carSlot(p, v, redraw)).join('');
  // The Big Rig is out at six minor damage tokens (BRaFF p5): the count beside the name.
  const rigCount = p.rig ? `<span class="rigdmg" title="Danni minori del Big Rig">${p.rig.damaged.length}/${bigRig().damage.eliminated_at}</span>` : '';
  // Mini expansions (the approved mockup): a card back beside the name for each card dealt, in the
  // colour of its kind; one played stays, faded. Only the viewer reads their own face-down cards.
  const osc = miniBacks(p, p.id === viewer()?.id);
  const tip = l || p.bot ? `data-tip="av" data-p="${p.id}"` : '';
  const av = pic ? `<img src="${pic}" alt="${esc(l!.name)}">` : avatarSvg(p.color, p.name);
  // The row: a pip per car, in the same order as the full bubble.
  const pips = g!.vehicles.filter(v => v.owner === p.id).sort((a, b) => order(a) - order(b)).map(car => {
    const v = atBeat(car), st = stateOf(v);
    const hurt = st !== 'elim' && (v.damage.length > 0 || !!v.onFire);
    const what = v.bike !== undefined ? 'Moto' : v.rig ? 'Big Rig' : `Auto ${SIZE[v.size]}`;
    return `<i class="pip st-${st}${hurt ? ' hurt' : ''}" title="${esc(`${what}: ${PIP_STATE[st]}${hurt ? ', danneggiata' : ''}`)}">${st === 'elim' ? '✕' : ''}</i>`;
  }).join('');
  const mdice = p.bot ? '<span class="botbadge">TRV9000</span>' : dice;
  return `<div class="bubble pl ${cls}${openBubbles.has(p.id) ? ' open' : ''}" data-p="${p.id}" style="--c:${p.color}">`
    + `<div class="mini"><span class="mav">${av}</span><b class="gothic">${esc(p.name)}</b><span class="mdice">${mdice}</span><span class="pips">${pips}</span>${rigCount}${toks}${osc}</div>`
    + `<div class="drop"><div class="full">`
    + `<div class="av" ${tip}>${av}</div>`
    + `<div class="hd"><b class="gothic">${esc(p.name)}</b>${rigCount}${toks}${osc}</div>`
    + `<div class="dice">${dice}</div><div class="cars${p.team === 'final_five' ? ' five' : ''}">${cars}</div></div></div></div>`;
}

/** A car's state in words, for its pip. */
const PIP_STATE: Record<ReturnType<typeof stateOf>, string> = { road: 'in strada', start: 'in partenza', inop: 'fuori uso', elim: 'eliminata' };
/** The players whose full bubble was opened with a tap: it stays open until tapped again. */
export const openBubbles = new Set<number>();

// ---------------------------------------------------------------- the pop-ups

/** What the pop-up shows for `el`: its markup and whether it is a card (no cream box). */
function tipFor(el: HTMLElement): { html: string; card: boolean } | null {
  if (!g) return null;
  const kind = el.dataset.tip;
  if (kind === 'av') {
    const p = g.players[Number(el.dataset.p)];
    const l = leaderOf(p);
    if (l) {
      const [pn, pd] = POWER_INFO[l.power] ?? [l.power, ''];
      return { card: false, html: `<b>${esc(l.name)}</b><small>${esc(l.title)} · potere</small><p><strong>${esc(pn)}</strong>: ${esc(pd)}</p>` };
    }
    if (p.bot) {
      const team = botTeams().find(t => t.id === p.bot!.team);
      return { card: false, html: `<b>Squadra TRV9000</b><small>Basic Protocol · livello ${p.bot.protocol}</small><p>${team ? `<strong>${esc(team.name)}</strong>. ` : ''}Gioca da sola: muove e spara come dice la sua carta attivazione del round.</p>` };
    }
    return null;
  }
  const found = g.vehicles.find(x => x.id === el.dataset.vid);
  if (!found) return null;
  const v = atBeat(found);
  const owner = v.owner !== null ? g.players[v.owner] : null;
  const whose = `${v.bike !== undefined ? `moto ${finalFive().marking_names[v.bike]}` : `auto ${SIZE[v.size]}`}${owner ? ` di ${esc(owner.name)}` : ''}`;
  if (kind === 'up') return { card: true, html: `${cardHtml(el.dataset.up!, owner?.color ?? '#888')}<div class="cap">${v.status === 'ok' ? '' : 'Non attiva: '}${whose}</div>` };
  if (kind === 'team') {
    const team = owner?.bot ? botTeams().find(t => t.id === owner.bot!.team) as unknown as (Record<string, { text: string }> & { name: string }) | undefined : undefined;
    const text = team?.[v.size]?.text ?? '';
    return { card: false, html: `<b>${esc(el.dataset.up!.replace(/_/g, ' '))}</b><small>${team ? esc(team.name) : 'Carta squadra'} · ${whose}</small><p>${esc(text)}</p>` };
  }
  if (kind === 'og' || kind === 'dmg') {
    const t = v.damage[Number(el.dataset.i)];
    if (!t) return null;
    if (t.type === 'minor') return { card: false, html: `<div class="tokbig">${minorTokenSvg()}</div><b>Danno minore</b><small>Danno · ${whose}</small><p>Occupa uno spazio danno e non fa altro. Una moto danneggiata è fuori uso finché non viene riparata.</p>` };
    if (kind === 'og' && t.card) {
      const [name, text] = ongoingCardText(t.card);
      return { card: true, html: `<div class="ogbig">${ongoingCardSvg({ id: t.card, name, text, key: 'tipbig' })}</div><div class="cap">Effetto continuo · ${whose}</div>` };
    }
    if (faceDown(v)) return { card: false, html: `<div class="tokbig">${damageTokenSvg(null, false)}</div><b>Segnalino coperto</b><small>Danno · ${whose}</small><p>Onboard Computer: il suo effetto è ignorato.</p>` };
    const [n, does] = DAMAGE_INFO[t.type] ?? [t.type, ''];
    return { card: false, html: `<div class="tokbig">${damageTokenSvg(t.type, true, t.dir)}</div><b>${esc(n)}</b><small>Danno · ${whose}</small><p>${esc(does)}</p>` };
  }
  if (kind === 'fire') {
    return { card: false, html: `<div class="tokbig">${onFireTokenSvg()}</div><b>In fiamme</b><small>${whose}</small><p>Prima di muoverla si tira il dado fuoco: movimenti in più, il fuoco si spegne, o l’auto è eliminata.</p>` };
  }
  return null;
}

const pop = document.createElement('div');
pop.id = 'pltip';
document.body.append(pop);
let shown: HTMLElement | null = null;
/** Under the piece, centred on the pointer and kept on the screen; the arrow points at the pointer. */
function place(el: HTMLElement, x: number): void {
  const r = el.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight;
  const left = Math.min(innerWidth - w - 8, Math.max(8, x - w / 2));
  const below = r.bottom + 12;
  pop.style.left = `${left}px`;
  pop.style.top = `${below + h > innerHeight - 8 ? Math.max(8, r.top - h - 12) : below}px`;
  pop.style.setProperty('--ax', `${Math.min(w - 14, Math.max(14, x - left))}px`);
}
$('players').addEventListener('pointermove', e => {
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-tip]');
  if (el !== shown) {
    shown = el;
    const t = el ? tipFor(el) : null;
    if (t) { pop.innerHTML = t.html; pop.className = `show ${t.card ? 'card' : 'text'}`; } else pop.className = '';
  }
  if (shown && pop.className) place(shown, e.clientX);
});
$('players').addEventListener('pointerleave', () => { shown = null; pop.className = ''; });
// A click on a car takes the view to it; a tap on a player's row opens or closes its full bubble.
$('players').addEventListener('click', e => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('button.car[data-vid]');
  if (b) { focusOn(carObjs.get(b.dataset.vid!), true); return; }
  const row = (e.target as HTMLElement).closest<HTMLElement>('.mini')?.parentElement;
  if (!row?.dataset.p) return;
  const id = Number(row.dataset.p);
  if (openBubbles.has(id)) openBubbles.delete(id); else { openBubbles.clear(); openBubbles.add(id); }
  for (const el of $('players').querySelectorAll<HTMLElement>('.pl[data-p]')) el.classList.toggle('open', openBubbles.has(Number(el.dataset.p)));
});
