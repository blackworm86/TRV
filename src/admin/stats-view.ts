// The "Statistiche" section of the admin page (asked by the user, 2026-11-23): who plays, how much
// and how long, what of the game is used, on which devices, and what breaks. The records and their
// sums are in src/net/usage.ts; the store in src/net/usage-store.ts.

import { leaderName, upgradeName } from '../net/stats';
import { EXPANSIONS, matchState, summarizeUsage, type Expansion, type Tally, type UsageSummary } from '../net/usage';
import type { UsageSource } from '../net/usage-store';

const esc = (s: string): string => s.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const when = (at: number): string => (at ? new Date(at).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '–');
/** A time in seconds as hours and minutes. */
export function hours(s: number): string {
  const m = Math.round(s / 60);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`;
}
const NAMES: Record<string, string> = {
  desktop: 'Computer', tablet: 'Tablet', modern: 'Moderno', console: 'Console anni ’90', arcade: 'Sala giochi',
  big_rig: 'Big Rig', final_five: 'Final Five', ...EXPANSIONS,
};
const name = (k: string): string => NAMES[k] ?? k;

function tile(label: string, value: string, note = ''): string {
  return `<div class="us-tile"><span>${esc(label)}</span><b>${esc(value)}</b>${note ? `<small>${esc(note)}</small>` : ''}</div>`;
}

/** A count by name as horizontal bars, longest first. */
function bars(title: string, t: Tally, label: (k: string) => string = name, limit = 8): string {
  if (!t.length) return `<section class="us-box"><h4>${esc(title)}</h4><p class="wait">Ancora nessun dato.</p></section>`;
  const max = t[0][1], shown = t.slice(0, limit), rest = t.slice(limit).reduce((a, [, n]) => a + n, 0);
  const rows = shown.map(([k, n]) => `<li><span>${esc(label(k))}</span><i style="--w:${(n / max) * 100}%"></i><b>${n}</b></li>`).join('')
    + (rest ? `<li class="rest"><span>Altri</span><i style="--w:0%"></i><b>${rest}</b></li>` : '');
  return `<section class="us-box"><h4>${esc(title)}</h4><ul class="us-bars">${rows}</ul></section>`;
}

/** Matches started each day, local and online stacked, with a tooltip per day. */
function chart(s: UsageSummary): string {
  const max = Math.max(1, ...s.perDay.map(d => d.local + d.online));
  const cols = s.perDay.map(d => {
    const tot = d.local + d.online, [y, m, dd] = d.day.split('-');
    const tip = `${Number(dd)}/${Number(m)}/${y}: ${tot} partit${tot === 1 ? 'a' : 'e'} · ${d.local} in locale · ${d.online} online`;
    return `<div class="us-col" data-tip="${esc(tip)}" tabindex="0" aria-label="${esc(tip)}">`
      + `<div class="us-stack" style="height:${(tot / max) * 100}%">${d.online ? `<i class="on" style="flex:${d.online}"></i>` : ''}${d.local ? `<i class="lo" style="flex:${d.local}"></i>` : ''}</div></div>`;
  }).join('');
  const first = s.perDay[0].day.split('-');
  return `<section class="us-box wide"><h4>Partite al giorno <small>ultimi ${s.perDay.length} giorni</small></h4>
    <div class="us-legend"><span><i class="lo"></i>In locale</span><span><i class="on"></i>Online</span><span class="max">max ${max} al giorno</span></div>
    <div class="us-chart">${cols}<div class="us-tip" hidden></div></div>
    <div class="us-axis"><span>${Number(first[2])}/${Number(first[1])}</span><span>oggi</span></div></section>`;
}

function players(s: UsageSummary): string {
  if (!s.rows.length) return '<p class="wait">Ancora nessun giocatore.</p>';
  const rows = s.rows.map(r => `<tr><th>${esc(r.name || '(senza nome)')}<small>${r.user ? `@${esc(r.user)}` : esc(r.uid.slice(0, 10))}</small></th>`
    + `<td>${r.matches || '–'}</td><td>${r.online ? `${r.wins} / ${r.online}` : '–'}</td><td>${r.time ? hours(r.time) : '–'}</td><td>${r.days || '–'}</td>`
    + `<td>${esc(when(r.lastSeen))}</td><td>${esc(r.device || '–')}</td></tr>`).join('');
  return `<div class="us-scroll"><table class="sum us-table"><thead><tr><th>Giocatore</th><th>Partite</th><th>Vittorie online</th><th>Tempo nel gioco</th><th>Giorni</th><th>Ultima volta</th><th>Dispositivo</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function health(s: UsageSummary, now: number): string {
  const errs = s.errors.length
    ? `<div class="us-scroll"><table class="sum us-table"><thead><tr><th>Errore</th><th>Volte</th><th>Giocatori</th><th>Ultima</th><th>Versioni</th></tr></thead><tbody>${
      s.errors.slice(0, 30).map(e => `<tr><th>${esc(e.msg)}<small>${esc(e.where || 'posizione sconosciuta')}</small></th><td>${e.count}</td><td>${e.users}</td><td>${esc(when(e.last))}</td><td>${esc(e.versions.join(', ') || '–')}</td></tr>`).join('')
    }</tbody></table></div>`
    : '<p class="wait">Nessun errore registrato.</p>';
  const left = s.abandoned.length
    ? `<ul class="us-list">${s.abandoned.slice(0, 15).map(m => `<li><b>${m.mode === 'online' ? `Online · stanza ${esc(m.room ?? '?')}` : 'In locale'}</b>`
      + `<span>${m.players} giocatori · round ${m.rounds} · ${hours(m.active)} giocati · ferma dal ${esc(when(m.last))}</span><small>${esc(matchState(m, now))} · versione ${esc(m.version || '?')}</small></li>`).join('')}</ul>`
    : '<p class="wait">Nessuna partita lasciata a metà.</p>';
  const fps = (n: number): string => (n ? `${n} fps` : '–');
  return `<div class="us-tiles">${tile('Fotogrammi al secondo, computer', fps(s.fps.desktop), 'media delle giornate')}${tile('Fotogrammi al secondo, tablet', fps(s.fps.tablet), 'media delle giornate')}${tile('Errori registrati', String(s.errors.reduce((a, e) => a + e.count, 0)), `${s.errors.length} diversi`)}</div>
    <h4 class="us-h4">Errori più frequenti</h4>${errs}<h4 class="us-h4">Partite abbandonate <small>ferme da più di 2 ore senza vincitore</small></h4>${left}`;
}

/** The page for summary `s`, read at `now` from `where`. */
export function statsHtml(s: UsageSummary, now: number, where: string, openRooms: number): string {
  const m = s.matches;
  return `<div class="cat-head"><h2>Statistiche</h2><button class="btn ghost" data-st-reload>Aggiorna</button></div>
    <p class="cat-note">Partite (in locale e online), tempo nel gioco, dispositivi ed errori degli account della Beta, registrati da quando le regole del database hanno la sezione <code>stats</code> (docs/deploy.md, punto 13). Le vittorie online vengono dalle statistiche personali di ogni account. Dati ${esc(where)} · aggiornati alle ${esc(new Date(now).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }))}.</p>
    <h3 class="sub">Riepilogo</h3>
    <div class="us-tiles">
      ${tile('Giocatori attivi oggi', String(s.players.today), `${s.players.week} in 7 giorni · ${s.players.month} in 30 · ${s.players.known} in tutto`)}
      ${tile('Partite giocate', String(m.total), `${m.local} in locale · ${m.online} online`)}
      ${tile('Concluse', String(m.finished), `${m.abandoned} abbandonate · ${m.ongoing} in corso`)}
      ${tile('Durata media', m.finished ? `${m.avgMinutes} min` : '–', m.finished ? `${m.avgRounds} round in media` : 'nessuna partita conclusa')}
      ${tile('Tempo nel gioco', hours(s.time.total), `${hours(s.time.perDay)} per giocatore al giorno`)}
      ${tile('Stanze aperte ora', String(openRooms), `${m.botWins} partite vinte da TRV9000`)}
    </div>
    ${chart(s)}
    <h3 class="sub">Giocatori</h3>${players(s)}
    <h3 class="sub">Uso del gioco</h3>
    <div class="us-grid">
      ${bars('Espansioni e mini espansioni', s.usage.expansions, k => EXPANSIONS[k as Expansion] ?? k)}
      ${bars('Giocatori al tavolo', s.usage.playerCounts)}
      ${bars('TRV9000 per livello', s.usage.botLevels)}
      ${bars('Big Rig e Final Five', s.usage.teams)}
      ${bars('Leader in gioco', s.usage.leaders, leaderName)}
      ${bars('Upgrade in gioco', s.usage.upgrades, upgradeName)}
      ${bars('Colori vincitori', s.usage.winners)}
    </div>
    <h3 class="sub">Dispositivi e impostazioni</h3>
    <p class="cat-note">Una giornata per account.</p>
    <div class="us-grid">
      ${bars('Dispositivo', s.usage.devices)}${bars('Sistema', s.usage.os)}${bars('Browser', s.usage.browsers)}
      ${bars('Stile grafico', s.usage.styles)}${bars('Qualità grafica', s.usage.qualities)}${bars('Versione del gioco', s.usage.versions, k => k, 5)}
    </div>
    <h3 class="sub">Salute del gioco</h3>${health(s, now)}`;
}

/** Draws the section into `host` from `source`; `live` says whether it is still on show. */
export async function drawStats(host: HTMLElement, source: UsageSource, live: () => boolean): Promise<void> {
  host.innerHTML = '<div class="cat-head"><h2>Statistiche</h2></div><p class="wait">Carico le statistiche…</p>';
  try {
    const data = await source.load(), now = Date.now();
    if (!live()) return;
    host.innerHTML = statsHtml(summarizeUsage(data, now), now, source.where, data.openRooms);
  } catch (err) {
    if (live()) host.innerHTML = `<div class="cat-head"><h2>Statistiche</h2></div><p class="wait">Statistiche non disponibili: ${esc((err as Error).message)}. Le regole del database sono aggiornate (docs/deploy.md, punto 13)?</p>`;
    return;
  }
  host.querySelector('[data-st-reload]')?.addEventListener('click', () => { void drawStats(host, source, live); });
  // The tooltip of the chart: the day under the pointer (or the focus).
  const box = host.querySelector<HTMLElement>('.us-chart'), tip = box?.querySelector<HTMLElement>('.us-tip');
  if (!box || !tip) return;
  const show = (col: HTMLElement | null): void => {
    if (!col) { tip.hidden = true; return; }
    tip.textContent = col.dataset.tip ?? '';
    tip.hidden = false;
    const x = col.offsetLeft + col.offsetWidth / 2;
    const half = tip.offsetWidth / 2 + 4;
    tip.style.left = `${Math.min(Math.max(x, half), box.clientWidth - half)}px`;
  };
  box.addEventListener('pointerover', e => show((e.target as Element).closest<HTMLElement>('.us-col')));
  box.addEventListener('pointerleave', () => show(null));
  box.addEventListener('focusin', e => show((e.target as Element).closest<HTMLElement>('.us-col')));
  box.addEventListener('focusout', () => show(null));
}
