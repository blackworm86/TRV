// The 2D interface: the players' bubbles, the prompt, the toasts and the log drawer, the
// player's strip with command board and dashboards, the winner's card.

import { leaderOf, leaders, commandName, type Decision, type LogEntry, type Frame } from '../game/trv/engine';
import { ongoingIllustration, upgradeIllustration } from '../view/cards';
import { dieSvg, hazardTokenSvg, commandTokenSvg, dashboardSvg, commandBoardSvg, playerStripSvg, avatarSvg, dataUrl } from '../view/vector/art';
import { FX_ASK } from './beats';
import { chase, chaseButtons } from './chase';
import { drawDock } from './dock';
import { choose, decision, g, hotZones, mySeat, pending, undo, viewer, zoneOption } from './game';
import { assignCard, cardHtml, drawHand, selCard } from './hand';
import { CMD_LINES, ONGOING_INFO, PORTRAITS, POWER_INFO, UPGRADE_INFO, boardCommands, slotText, upgradeName } from './info';
import { fit } from './mapView';
import { drawMarkers } from './markers';
import { syncFxSupply } from './rolls';
import { S } from './state';
import { setDiceOnTable, syncTableDice } from './tableDice';
import { $, esc } from './util';

export function dieHtml(kind: string, value: number | string, color: string | undefined, cls = '', attrs = ''): string {
  // The SVG keeps the layout and takes the clicks; the HUD overlay draws a 3D die on top of it.
  return dieSvg({ kind, value, color, forward: 'right' }, `class="${cls}" data-die3d="${kind}|${value}|${color ?? ''}" ${attrs}`);
}

export function logLine(e: LogEntry): string {
  const dice = (e.dice ?? []).map(d => `<img src="${dataUrl(dieSvg({ kind: d.die, value: d.value, forward: 'right' }))}" alt="">`).join('');
  return `<div class="${e.kind}">${dice}${esc(e.text)}</div>`;
}

export let toastTimer = 0;
/** The running log over the table: removed at the user's request (2026-11-16); the Log button keeps the chronicle. */
export const SHOW_TOAST = false;
export const toastLines: string[] = [];
/** Shows a rules line that matters (shots, damage, hazards, eliminations, turns) over the map. */
export function toastLine(f: Frame): void {
  if (!f.text || !SHOW_TOAST) return;
  const important = f.logKind !== 'info' || /Pericolo|danno|sparo|bersaglio|armi|dado strada|COLPITO|nuova tessera|traguardo/i.test(f.text);
  if (!important) return;
  toastLines.push(`<div class="${f.logKind}">${esc(f.text)}</div>`);
  while (toastLines.length > 4) toastLines.shift();
  const el = $('toast');
  el.innerHTML = toastLines.join('');
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => { el.classList.remove('show'); toastLines.length = 0; }, 3200);
}
/**
 * Whenever a different player must decide (a new turn, or a slam reroll owed to the larger car's
 * owner), the prompt in the bar flashes in their colour; in hot seat it also says to pass the
 * device. No box over the table (asked by the user, 2026-11-16).
 */
export let passUntil = 0;
export function handoff(d: Decision): void {
  if (!g || d.player === S.lastDecider) return;
  S.lastDecider = d.player;
  const el = $('prompt');
  el.classList.remove('pass');
  void el.offsetWidth; // restart the animation
  el.classList.add('pass');
  passUntil = performance.now() + (d.kind === 'slamReroll' ? 2600 : 1800);
}

export function drawHud(): void {
  if (!g) return;
  const me = viewer()!;
  // While the last choice plays out, nothing can be chosen.
  const d = S.playing ? null : decision;
  if (d) handoff(d);
  // A new kind of choice forgets a strip opened or closed by hand.

  // Top: the round, then a bubble per player in seating order (the one on turn glows), the road die.
  document.documentElement.style.setProperty('--who', me.color);
  $('roundinfo').innerHTML = `<small>ROUND</small><b class="gothic">${g.round}</b><span>${g.finalTile ? 'ultima tessera' : `tessera ${g.tilesPlaced}`}</span>`;
  // A bubble per player in seating order (the one on turn glows): avatar and name; under them the
  // dice (available and used); under those the cars with their state. Pointing at a car shows it.
  $('players').innerHTML = g.players.map(p => {
    const turn = p.id === g!.current && g!.winner === null, decides = !!d && d.player === p.id;
    const cars = g!.vehicles.filter(v => v.owner === p.id).sort((a, b) => 'SML'.indexOf(a.size) - 'SML'.indexOf(b.size)).map(v => {
      const state = v.status === 'elim' ? 'eliminata' : v.status === 'inop' ? 'fuori uso' : v.inStart ? 'in partenza' : 'in strada';
      return `<span class="car ${v.status === 'ok' ? '' : v.status}" data-vid="${v.id}"><b>${v.size}</b><small>${state}</small>${v.damage.length ? `<em>${'<i></i>'.repeat(v.damage.length)}</em>` : ''}${v.upgrade ? '<u>★</u>' : ''}</span>`;
    }).join('');
    const pl = leaderOf(p);
    return `<div class="bubble pl ${turn ? 'turn' : ''} ${decides ? 'decides' : ''} ${p.out ? 'out' : ''}" style="--c:${p.color}">
      <div class="av">${pl && PORTRAITS[pl.id] ? `<img src="${PORTRAITS[pl.id]}" alt="${esc(pl.name)}">` : avatarSvg(p.color, p.name)}</div>
      <div class="nm gothic">${esc(p.name)}${pl ? `<small>${esc(pl.name)}${p.tokens ? ` <span class="ctoks">${commandTokenSvg().repeat(p.tokens)}</span>` : ''}</small>` : ''}</div>
      <div class="dice-row">${p.dice.length ? p.dice.map((n, i) => dieHtml('movement', n, p.color, p.used[i] ? 'used' : '')).join('') : '<span class="none">nessun dado</span>'}</div>
      <div class="cars">${cars}</div></div>`;
  }).join('');
  $('roaddie').innerHTML = g.roadDie ? dieHtml('road', g.roadDie, undefined) : '';
  $('roaddie').parentElement!.classList.toggle('glow', d?.kind === 'roadDie');

  // Bar: prompt, contextual actions, last log line.
  const name = d ? g.players[d.player].name : '';
  const text = d ? d.prompt.replace(new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}: `), '') : g.winner !== null ? 'Partita finita.' : '';
  $('prompt').innerHTML = d ? `<b style="color:${g.players[d.player].color}">${esc(name)}</b>${esc(text)}` : S.playing ? '<i>…</i>' : esc(text);
  // A few words per kind of choice: the table and the boards show the rest.
  const SHORT: Partial<Record<Decision['kind'], string>> = {
    assign: 'assegna un dado', command: 'comando?', airstrike: 'piazza l’elicottero', repair: 'quale auto ripari?',
    roadDie: `dado strada: +${g.roadDie}?`, slamReroll: 'slam: ritiri i dadi?', shoot: 'scegli il bersaglio',
    leader: 'scegli il caposquadra', token: 'segnalino comando?', shootReroll: 'ritiri il dado sparo?', dirReroll: 'ritiri il dado direzione?',
    peek: 'guarda un pericolo coperto',
  };
  if (d && SHORT[d.kind]) $('prompt').innerHTML = `<b style="color:${g.players[d.player].color}">${esc(name)}</b>${esc(SHORT[d.kind]!)}`;
  if (d && !S.net && performance.now() < passUntil) $('prompt').insertAdjacentHTML('afterbegin', '<span class="passing">Passa il dispositivo ·</span>');
  // Online, while somebody else decides: say who the table is waiting for.
  if (S.net && pending && pending.player !== mySeat()) S.lastDecider = -1; // my next decision is announced again
  if (S.net && !d && !S.playing && pending) {
    const w = g.players[pending.player];
    $('prompt').innerHTML = `<b style="color:${w.color}">${esc(w.name)}</b>${pending.player === mySeat() ? 'invio…' : 'sta decidendo…'}`;
  }
  ($('skip') as HTMLButtonElement).style.display = S.playing ? '' : 'none';
  // The choices float by the car they are about (see placeActions), not in the bar.
  const actions = $('actions');
  actions.innerHTML = '';
  if (d) {
    const btn = (i: number, label: string, cls = ''): void => {
      const b = document.createElement('button');
      b.textContent = label;
      b.title = d.options[i].label;
      b.className = cls || (d.options[i].danger ? 'danger' : '');
      b.onclick = () => choose(i);
      actions.appendChild(b);
    };
    if (d.kind === 'command' || d.kind === 'token') { /* on the command board's tab: see drawDock */ }
    else if (d.kind === 'shoot') btn(0, 'Non sparare', 'quiet'); // the targets are lit on the table
    else if (d.kind === 'roadDie') { btn(1, `+${g.roadDie} movimenti`, 'road'); btn(0, 'Fermati', 'quiet'); }
    else if (d.kind === 'slamReroll') { btn(0, 'Tieni', 'quiet'); btn(1, 'Ritira i dadi'); }
    else if (d.kind === 'shootReroll' || d.kind === 'dirReroll') { btn(0, 'Tieni', 'quiet'); btn(1, 'Ritira il dado'); }
    // Choices on the table with a way out: the spaces are lit, the button says no.
    else if (['plow', 'rollCage', 'dispense', 'radar'].includes(d.kind)) btn(0, d.options[0].label, d.options[0].danger ? 'danger' : 'quiet');
    // Skull Shift Knob: the one step choice that is not a space.
    else if (d.kind === 'step') d.options.forEach((o, i) => { if (!o.pos) btn(i, o.label, 'quiet'); });
    else if (!['assign', 'airstrike', 'repair', 'leader', 'peek', 'peekResult', 'draft', 'upgradeAssign'].includes(d.kind)) d.options.forEach((o, i) => btn(i, o.label));
  }
  // Choppe Shoppe setup: the upgrade cards to draft, then one for each car.
  if (d && d.kind === 'draft') {
    const who = g.players[d.player];
    const el = $('leaderpick');
    el.innerHTML = `<h2 class="gothic" style="color:${who.color}">${esc(d.prompt)}</h2><div class="hand">`
      + d.options.map((o, i) => `<button class="pickcard" data-i="${i}">${cardHtml(o.upgrade!, who.color)}</button>`).join('') + '</div>';
    el.querySelectorAll<HTMLElement>('.pickcard').forEach(b => { b.onclick = () => choose(Number(b.dataset.i)); });
  }
  // Choppe Shoppe setup: the two crew leaders dealt to the player, as cards to pick from.
  const pick = $('leaderpick');
  pick.style.display = d && ['leader', 'draft', 'peekResult'].includes(d.kind) ? 'grid' : 'none';
  // Third Eye: the hazard token peeked at, face up in the middle of the screen, and "Visto" under it.
  if (d?.kind === 'peekResult') {
    const who = g.players[d.player];
    const type = d.options[0].hazard ?? null;
    pick.innerHTML = `<h2 class="gothic" style="color:${who.color}">${esc(d.prompt.replace(/^Solo per [^:]+: /, 'Third Eye: '))}</h2>`
      + `<div class="peektile">${hazardTokenSvg(type, true)}</div><button class="peekok" data-key="Enter">Visto<kbd>↵</kbd></button>`;
    pick.querySelector<HTMLElement>('.peekok')!.onclick = () => choose(0);
  }
  if (d?.kind === 'leader') {
    const who = g.players[d.player];
    pick.innerHTML = `<h2 class="gothic" style="color:${who.color}">${esc(who.name)}: scegli il caposquadra</h2><div class="pair">`
      + d.options.map((o, i) => {
        const l = leaders().find(x => x.id === o.leader)!;
        const [pn, pd] = POWER_INFO[l.power] ?? [l.power, ''];
        return `<button class="leader" data-i="${i}" style="--c:${who.color}"><b class="gothic">${esc(l.name)}</b><small>${esc(l.title)}</small>`
          + `<p><i>${esc(pn)}</i> ${esc(pd)}</p><ul>`
          + l.commands.map(s => `<li><em>${esc(slotText(s))}</em><span><b>${esc(commandName(s.id))}</b> ${esc((CMD_LINES[s.id] ?? []).join(' '))}</span></li>`).join('')
          + `</ul><span class="stars">${l.tokens ? `<span class="ctoks">${commandTokenSvg().repeat(l.tokens)}</span> ${l.tokens === 1 ? 'segnalino comando' : 'segnalini comando'}` : 'nessun segnalino comando'}</span></button>`;
      }).join('') + '</div>';
    pick.querySelectorAll<HTMLElement>('.leader').forEach(b => { b.onclick = () => choose(Number(b.dataset.i)); });
  }
  // The question sits with its answer: over the buttons, or alone by the car or the dice.
  const left = d?.kind === 'step' ? /(\d+) moviment/.exec(d.prompt)?.[1] : undefined;
  const ASK: Partial<Record<Decision['kind'], string>> = {
    command: 'Un dado su un comando?', roadDie: `Dado strada: +${g.roadDie}?`, slamReroll: 'Slam: ritiri i dadi?', shoot: 'Scegli il bersaglio',
    step: left ? `${left} moviment${left === '1' ? 'o' : 'i'}` : 'Muovi', airstrike: 'Scegli una casella vuota', repair: 'Scegli l’auto da riparare',
    token: `Segnalino comando? (${d ? g.players[d.player].tokens : 0})`, shootReroll: 'Mancato: ritiri il dado sparo?', dirReroll: 'Slam: ritiri la direzione?',
    peek: 'Third Eye: scegli un pericolo coperto', transfer: d?.prompt.replace(/^[^:]+: /, '') ?? '',
  };
  // The upgrades' own questions are asked in full: they name the card.
  const asked = d && (d.kind === 'command' || d.kind === 'token') ? '' : d ? ASK[d.kind] ?? (['plow', 'rollCage', 'dispense', 'radar', 'swap', 'pickDamage', 'redButton'].includes(d.kind) ? d.prompt.replace(/^[^:]+: /, '') : '') : '';
  if (asked) actions.insertAdjacentHTML('afterbegin', `<span class="q">${esc(asked)}</span>`);
  actions.classList.toggle('only', !actions.querySelector('button'));
  actions.classList.toggle('many', actions.querySelectorAll('button').length > 3);
  // Keys: Enter for the main choice, Esc for the quiet one (no, keep, stop), shown on the buttons.
  const btns = [...actions.querySelectorAll<HTMLButtonElement>('button')];
  const main = btns.find(b => !b.classList.contains('quiet')), quiet = btns.find(b => b.classList.contains('quiet'));
  if (main && btns.length <= 3) { main.dataset.key = 'Enter'; main.insertAdjacentHTML('beforeend', '<kbd>↵</kbd>'); }
  if (quiet && btns.length <= 3) { quiet.dataset.key = 'Escape'; quiet.insertAdjacentHTML('beforeend', '<kbd>Esc</kbd>'); }
  actions.dataset.car = g.activeCar ?? '';
  // A question about dice just rolled sits beside those dice; the others by the car, or the bar.
  const aboutFx = !!d && FX_ASK.has(d.kind) && S.trayDice.length > 0;
  actions.dataset.anchor = d?.kind === 'command' || d?.kind === 'token' ? 'dice' : aboutFx ? 'fx' : g.activeCar ? 'car' : 'bar';
  if ($('drawer').style.display === 'block') drawDrawer();

  // The four steps of a turn (rulebook p. 8), the current one lit.
  const stepOf: Record<string, number> = { assign: 1, command: 2, airstrike: 2, repair: 2, step: 3, roadDie: 3, slamReroll: 3, shoot: 4 };
  const cur = d ? stepOf[d.kind] ?? 0 : 0;
  $('steps').innerHTML = ['Assegna', 'Comando', 'Movimento', 'Spara'].map((n, i) => {
    const locked = i === 3 && g!.round <= 1;
    return `<div class="st ${i + 1 === cur ? 'on' : i + 1 < cur ? 'done' : ''} ${locked ? 'off' : ''}"><b>${i + 1 < cur ? '✓' : i + 1}</b><span>${n}</span>${locked ? '<small>dal 2° round</small>' : ''}</div>`;
  }).join('');

  // Bottom: my dice, command board, dashboards, chopper.
  const hot = hotZones();
  const mine = d && d.player === me.id;
  syncTableDice(me, !!mine);
  syncFxSupply();
  const lead = leaderOf(me);
  const cmds = boardCommands(me);
  const cmdArt = {
    color: me.color, used: me.command,
    drop: d?.kind === 'token' && mine ? d.options.filter(o => o.command).map(o => o.command!) : [...hot].filter(z => z.startsWith('cmd:')).map(z => z.slice(4)),
    tokenOn: Object.entries(me.slots).filter(([, v]) => v === 'token').map(([k]) => k), keepOpen: me.tokens > 0,
    // Undo on the board (hot seat only): lit when there is a choice to take back.
    ...(S.net ? {} : { undo: (!S.saved?.choices.length || S.playing ? 'off' : 'on') as 'on' | 'off' }),
    ...(cmds ? { commands: cmds } : {}),
    ...(lead ? { leader: {
      name: lead.name, title: lead.title, power: POWER_INFO[lead.power]?.[0] ?? lead.power, powerText: POWER_INFO[lead.power]?.[1] ?? '',
      tokens: me.tokens, ...(PORTRAITS[lead.id] ? { portrait: PORTRAITS[lead.id] } : {}),
    } } : {}),
  };
  const pickIds = new Set(d?.kind === 'repair' || (d?.kind === 'upgradeAssign' && mine) ? d.options.map(o => o.carId) : []);
  const dashArt = g.vehicles.filter(v => v.owner === me.id).map(v => ({
    carId: v.id, size: v.size, color: me.color, status: v.status, placed: v.placed, damage: v.damage.length,
    dropMove: hot.has(`move:${v.id}`), dropCoast: hot.has(`coast:${v.id}`), pick: pickIds.has(v.id),
    label: v.status === 'elim' ? '' : v.inStart ? 'IN PARTENZA' : '',
    ...(v.onFire && v.status !== 'elim' ? { onFire: true } : {}),
    // Ongoing effect cards (Carnage at Devil's Run) lie under their damage tokens.
    ...(v.damage.some(t => t.card) ? { cards: v.damage.map(t => t.card ? { id: t.card, name: ONGOING_INFO[t.card]?.[0] ?? t.card, art: ongoingIllustration(t.card) } : null) } : {}),
    // Ms. Betty's large car may carry two upgrades: one card naming both.
    ...(v.upgrade && v.status !== 'elim' ? { upgrade: {
      name: v.upgrade2 ? `${upgradeName(v.upgrade)} + ${upgradeName(v.upgrade2)}` : upgradeName(v.upgrade),
      text: [v.upgrade, v.upgrade2].filter((x): x is string => !!x).map(x => UPGRADE_INFO[x] ?? '').join(' · '),
      art: upgradeIllustration(v.upgrade),
    } } : {}),
  }));
  // With crew leaders the strip is wider (the leader's panel on its left): it keeps that size all game.
  const tall = g.players.some(p => leaderOf(p)); // class "tall": the strip has the leader's panel
  if (tall !== document.body.classList.contains('tall')) { document.body.classList.toggle('tall', tall); fit(); }
  drawHand(d);
  // One drawing, laid out as in the rulebook; without the owner's drawing, the boards side by side.
  const strip = $('strip');
  strip.innerHTML = playerStripSvg(cmdArt, dashArt) ?? `<div class="loose">${commandBoardSvg(cmdArt)}${dashArt.map(a => dashboardSvg(a)).join('')}</div>`;
  // The second strip drawing: the dice are in the drawer behind the board, not on the table; the
  // leader's tab comes out on a click; Undo is a plate on the board.
  const strip2 = !!strip.querySelector('[data-strip="2"]');
  setDiceOnTable(!strip2);
  strip.classList.toggle('tab-open', S.tabOpen);
  strip.querySelector('[data-ptab]')?.addEventListener('click', () => { S.tabOpen = !S.tabOpen; strip.classList.toggle('tab-open', S.tabOpen); });
  strip.querySelector('[data-undo]')?.addEventListener('click', e => { if (!(e.currentTarget as Element).classList.contains('off')) undo(); });

  // Clicks on boards: drop the selected die, or pick a car to repair.
  for (const el of document.querySelectorAll<SVGElement>('#bottom [data-drop]')) {
    if (hot.has(el.dataset.drop!)) el.classList.add('hotzone');
    // A command token goes on the slot clicked.
    const tokenAt = d?.kind === 'token' && mine ? d.options.findIndex(o => o.command && `cmd:${o.command}` === el.dataset.drop) : -1;
    if (tokenAt > 0) { el.classList.add('hotzone'); el.addEventListener('click', () => choose(tokenAt)); continue; }
    el.addEventListener('click', () => {
      // No die selected: use the first free die that fits this slot.
      const pick = S.selDie ?? me.dice.findIndex((_, i) => !me.used[i] && zoneOption(el.dataset.drop!, i) >= 0);
      if (pick !== null && pick >= 0) choose(zoneOption(el.dataset.drop!, pick));
    });
  }
  if (d?.kind === 'repair') {
    for (const el of document.querySelectorAll<SVGElement>('#strip [data-car]')) {
      const i = d.options.findIndex(o => o.carId === el.dataset.car);
      if (i >= 0) { el.classList.add('hotzone'); el.addEventListener('click', () => choose(i)); }
    }
  }
  chaseButtons();
  // Upgrade cards: a car takes the selected card (the cards can also be dragged onto it).
  if (d?.kind === 'upgradeAssign') {
    for (const el of document.querySelectorAll<SVGElement>('#strip [data-car]')) {
      if (!d.options.some(o => o.carId === el.dataset.car)) continue;
      el.classList.add('hotzone');
      el.addEventListener('click', () => { if (selCard) assignCard(selCard, el.dataset.car!); });
    }
  }
  ($('undo2') as HTMLButtonElement).disabled = !!S.net || !S.saved?.choices.length || S.playing;
  drawDock(d, !!mine, me);
  ($('roomopen') as HTMLButtonElement).style.display = S.net ? '' : 'none';
  $('home').classList.toggle('on', !!chase);
  $('home').querySelector('small')!.textContent = chase ? 'Reimposta' : 'Vista';
  ($('replay') as HTMLButtonElement).disabled = !S.replayFrames?.length || S.playing;
  if (d?.kind === 'assign') drawMarkers();

  if (g.winner !== null && !S.winShown) {
    S.winShown = true;
    $('wintext').textContent = `${g.players[g.winner].name} vince!`;
    $('win').style.display = 'grid';
  }
}

export function drawDrawer(): void {
  if (!g) return;
  const el = $('drawer');
  el.innerHTML = g.log.slice(-200).map(logLine).join('');
  el.scrollTop = el.scrollHeight;
}
$('ticker').onclick = () => {
  const el = $('drawer');
  el.style.display = el.style.display === 'block' ? 'none' : 'block';
  if (el.style.display === 'block') drawDrawer();
};
