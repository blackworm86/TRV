// The mini expansions' mockup (mockup-mini.html, development only): how they are chosen when a game
// is made, how their cards show during the game, and every translated card. Static: it draws the
// real cards (src/view/minicards.ts) over a screenshot of the table, nothing is played.

import { MINI_FAMILIES, miniCardSvg, miniCards, type MiniFamily } from '../view/minicards';

const $ = (id: string): HTMLElement => document.getElementById(id)!;
const card = (f: MiniFamily, id: string, cls = 'c', style = ''): string => `<div class="${cls}" style="${style}">${miniCardSvg(f, id)}</div>`;

/** What each mini expansion is called and does, in a line, for the setup panel. */
const ABOUT: Record<MiniFamily, { name: string; line: string; more: string }> = {
  bonus_commands: { name: 'Bonus Commands', line: 'Un comando in più a testa, da usare con un dado',
    more: 'Ogni giocatore riceve una carta scoperta: è un comando in più, sulla plancia accanto agli altri. Ci si mette un dado del valore stampato nel rombo, come per i comandi normali.' },
  one_shots: { name: 'One Shots', line: 'Una carta coperta a testa, da giocare una volta',
    more: 'Ogni giocatore riceve una carta coperta che dice quando si può giocare. Il gioco la propone da solo nel momento giusto; giocata, esce dal gioco.' },
  bounties: { name: 'Bounties', line: 'Una taglia segreta: completala e riscuoti il premio',
    more: 'Ogni giocatore riceve una taglia coperta. Quando completa l\'impresa viola, il gioco propone di giocarla subito e riscuotere il premio arancione; se aspetta, dovrà completarla di nuovo.' },
  road_conditions: { name: 'Road Conditions', line: 'Ogni tessera ha la sua condizione: ghiaccio, predoni, tempesta…',
    more: 'Ogni tessera strada (tranne quella di partenza) riceve una condizione a caso, scoperta accanto al suo nome. Vale per tutti, TRV9000 compresi; quando la tessera esce, la carta va negli scarti.' },
  advanced_airstrikes: { name: 'Advanced Airstrikes', line: 'Una carta coperta per l\'elicottero, da giocare una volta',
    more: 'Ogni giocatore riceve una carta coperta per il suo elicottero. Come le One Shots, il gioco la propone nel momento scritto sulla carta; giocata, esce dal gioco.' },
};
/** The three cards of each family shown in its fan. */
const FAN: Record<MiniFamily, string[]> = {
  bonus_commands: ['hands_free', 'rocket_fuel', 'tire_spikes'],
  one_shots: ['flux_capacitor', 'guided_missile', 'radar_array'],
  bounties: ['pinball_wizard', 'hit_and_run', 'death_from_above'],
  road_conditions: ['icy', 'marauders', 'windy'],
  advanced_airstrikes: ['dual_guns', 'trick_shot', 'care_package'],
};

// ---------------------------------------------------------------- 1. setup
const on = new Set<MiniFamily>(['one_shots', 'bounties', 'road_conditions']);
let shown: MiniFamily = 'bounties';
function drawSetup(): void {
  const sw = (b: string, s: string, o = false): string => `<label class="sw${o ? ' on' : ''}"><i></i><span><b>${b}</b><small>${s}</small></span></label>`;
  const fan = (f: MiniFamily): string => `<div class="fan" data-fan="${f}">${FAN[f].map((id, i) => card(f, id, 'c', `left:${i * 26}px;transform:rotate(${(i - 1) * 9}deg)`)).join('')}</div>`;
  const tags = ['CHOPPE', 'CARNAGE', ...(on.size ? [`MINI ×${on.size}`] : [])];
  $('setuppanel').innerHTML = `<h3>Espansioni</h3>`
    + sw('Capisquadra', 'Choppe Shoppe · capisquadra e segnalini comando', true)
    + sw('Potenziamenti', 'Choppe Shoppe · carte potenziamento', true)
    + sw('Carnage at Devil’s Run', 'Tessere, pericoli e fuoco', true)
    + `<h3>Mini espansioni <small><a data-all="1">tutte</a> · <a data-all="0">nessuna</a></small></h3>`
    + MINI_FAMILIES.map(f => `<div class="mini${on.has(f) ? ' on' : ''}" data-f="${f}">${sw(ABOUT[f].name, ABOUT[f].line)}${fan(f)}</div>`).join('')
    + `<p class="note">I TRV9000 non ricevono carte; le Road Conditions valgono per tutti.</p>`
    + `<div class="tags">Nella lobby, la stanza mostra: ${tags.map(t => `<span class="tag">${t}</span>`).join('')}</div>`
    + `<button class="go">Si parte!</button>`;
  for (const el of document.querySelectorAll<HTMLElement>('#setuppanel .mini')) {
    const f = el.dataset.f as MiniFamily;
    el.querySelector('.sw')!.addEventListener('click', e => { e.preventDefault(); if (on.has(f)) on.delete(f); else on.add(f); shown = f; drawSetup(); });
    el.querySelector('.fan')!.addEventListener('click', () => { shown = f; drawSetup(); });
  }
  for (const a of document.querySelectorAll<HTMLElement>('#setuppanel [data-all]')) a.onclick = () => { if (a.dataset.all === '1') MINI_FAMILIES.forEach(f => on.add(f)); else on.clear(); drawSetup(); };
  const a = ABOUT[shown];
  $('setupexplain').innerHTML = `<div class="panel"><h4>${a.name} ${on.has(shown) ? '· in gioco' : '· spenta'}</h4><p class="note">${a.more}</p>`
    + `<div class="card-row">${miniCards(shown).map(c => card(shown, c.id)).join('')}</div></div>`
    + `<div class="panel"><h4>Online</h4><p class="note">Lo stesso elenco, con le caselle, nella stanza: lo cambia solo chi la crea, gli altri lo leggono sotto il titolo. Le mini espansioni accese finiscono nel riepilogo della partita e nelle statistiche.</p></div>`;
}

// ---------------------------------------------------------------- 2. in game
const SCENES: Record<string, { html: string; legend: string }> = {
  turn: {
    html: `
      <div class="rc" style="left:700px">${card('road_conditions', 'icy')}ICY</div>
      <div class="rc open" style="left:1062px">${card('road_conditions', 'tremors')}TREMORS</div>
      ${card('road_conditions', 'tremors', 'pop', 'left:880px;top:180px')}
      <div class="backs" style="left:440px"><i class="bc"></i><i class="os"></i><i class="bo"></i><i class="aa"></i></div>
      <div class="backs" style="left:670px"><i class="bc"></i><i class="os"></i><i class="bo"></i><i class="aa used"></i></div>
      <div class="backs" style="left:880px"><i class="bc"></i><i class="os used"></i><i class="bo"></i><i class="aa"></i></div>
      ${card('bonus_commands', 'hands_free', 'bonus')}<div class="bonuslabel">COMANDO BONUS</div>
      <div class="hand"><h4>LA TUA MANO</h4>${card('one_shots', 'radar_array')}${card('bounties', 'pinball_wizard')}${card('advanced_airstrikes', 'care_package')}</div>
      <div class="callout" style="left:686px;top:140px">1</div>
      <div class="callout" style="left:1062px;top:300px">2</div>
      <div class="callout" style="left:404px;top:104px">3</div>
      <div class="callout" style="left:2px;top:318px">4</div>
      <div class="callout" style="left:196px;top:62px">5</div>`,
    legend: `<ol>
      <li><b>Road Conditions</b>: una bandierina gialla accanto al nome di ogni tessera, col nome della condizione. La tessera di partenza non ne ha.</li>
      <li>Puntando (o toccando) la bandierina, la carta si apre in grande sotto la bandierina.</li>
      <li><b>Dorsi nelle bolle</b>: ogni giocatore mostra quante carte ha ancora, col colore del tipo (grigio scuro Bonus Command, rosso One Shot, grigio chiaro Bounty, azzurro Airstrike). Una carta giocata resta sbiadita. Il contenuto lo vede solo il proprietario.</li>
      <li><b>Bonus Command</b>: è un comando in più: sta scoperto a sinistra, sopra la plancia dei comandi, nello spazio libero accanto alla zona di partenza. Quando un dado del valore giusto è selezionato si illumina di verde e lo si trascina sopra, come sugli altri comandi.</li>
      <li><b>La tua mano</b>: le carte coperte (One Shot, Bounty, Advanced Airstrike) del giocatore che guarda, piccole in alto a sinistra, accanto al round e sopra la prima tessera, dove non coprono strada né dadi; puntandole si ingrandiscono. In hot seat è la mano di chi sta giocando; online la tua.</li></ol>`,
  },
  play: {
    html: `
      <div class="ask" style="left:300px;top:186px">${card('advanced_airstrikes', 'scouting_mission')}<div><p>Giallo, hai piazzato l'elicottero. Giocare Scouting Mission?</p><div class="btns"><button>Gioca Scouting Mission ↵</button><button class="q">Non ora · Esc</button></div></div></div>
      <div class="backs" style="left:440px"><i class="bc"></i><i class="os"></i><i class="bo"></i><i class="aa"></i></div>
      <div class="backs" style="left:670px"><i class="bc"></i><i class="os"></i><i class="bo"></i><i class="aa used"></i></div>
      <div class="backs" style="left:880px"><i class="bc"></i><i class="os used"></i><i class="bo"></i><i class="aa"></i></div>
      ${card('bonus_commands', 'hands_free', 'bonus')}<div class="bonuslabel">COMANDO BONUS</div>
      <div class="hand"><h4>LA TUA MANO</h4>${card('one_shots', 'radar_array')}${card('bounties', 'pinball_wizard')}${card('advanced_airstrikes', 'scouting_mission', 'c hot')}</div>
      <div class="callout" style="left:288px;top:176px">1</div>
      <div class="callout" style="left:196px;top:62px">2</div>`,
    legend: `<ol>
      <li><b>Carta da giocare</b>: quando arriva il momento scritto sulla carta, il gioco chiede al proprietario se giocarla, con la carta vera nel riquadro della domanda (come oggi One Shots). Invio la gioca, Esc la tiene. Il riquadro si mette dove non copre i pezzi interessati.</li>
      <li>Nella mano la carta in questione si alza e si illumina, così si capisce quale si sta usando. Giocata, sparisce dalla mano e il suo dorso nella bolla si sbiadisce.</li></ol>`,
  },
  bounty: {
    html: `
      <div class="reveal">${card('bounties', 'pinball_wizard')}<div><small>TAGLIA COMPLETATA · GIALLO</small><h5>Pinball Wizard</h5><p>Due slam in questo turno: hai completato la taglia. La giochi adesso? Se aspetti, dovrai completarla di nuovo.</p><div class="ask" style="position:static;border:0;padding:0;background:none;box-shadow:none"><div class="btns"><button>Gioca e riscuoti ↵</button><button class="q">Tienila · Esc</button></div></div></div></div>
      <div class="backs" style="left:440px"><i class="bc"></i><i class="os"></i><i class="bo"></i><i class="aa"></i></div>
      <div class="backs" style="left:670px"><i class="bc"></i><i class="os"></i><i class="bo"></i><i class="aa used"></i></div>
      <div class="backs" style="left:880px"><i class="bc"></i><i class="os used"></i><i class="bo"></i><i class="aa"></i></div>
      ${card('bonus_commands', 'hands_free', 'bonus')}<div class="bonuslabel">COMANDO BONUS</div>
      <div class="hand"><h4>LA TUA MANO</h4>${card('one_shots', 'radar_array')}${card('bounties', 'pinball_wizard', 'c hot')}${card('advanced_airstrikes', 'care_package')}</div>
      <div class="callout" style="left:378px;top:174px">1</div>`,
    legend: `<ol>
      <li><b>Taglia completata</b>: appena l'impresa viola è fatta, la carta si gira in grande al centro del tavolo per il proprietario, con il premio e la scelta. Giocata, la vedono tutti (si gira anche per gli avversari, con la scritta "Giallo riscuote la taglia") e poi il premio si risolve sul tavolo: qui scegliere il dado da cambiare.</li></ol>`,
  },
};
let scene = 'turn';
function drawGame(): void {
  $('stage').innerHTML = SCENES[scene].html;
  $('legend').innerHTML = SCENES[scene].legend;
  for (const b of document.querySelectorAll<HTMLElement>('#scenes button')) b.classList.toggle('on', b.dataset.s === scene);
}
for (const b of document.querySelectorAll<HTMLElement>('#scenes button')) b.onclick = () => { scene = b.dataset.s!; drawGame(); };

// ---------------------------------------------------------------- 3. gallery
$('gallery').innerHTML = MINI_FAMILIES.map(f => `<div class="fam"><h3>${ABOUT[f].name} · ${miniCards(f).length} carte</h3><p>${ABOUT[f].line}.</p>`
  + `<div class="grid">${miniCards(f).map(c => `<figure>${card(f, c.id)}<figcaption>${c.name}${c.range ? ` · dado ${c.range === 'ANY' ? 'qualsiasi' : c.range}` : ''}</figcaption></figure>`).join('')}</div></div>`).join('');

// ---------------------------------------------------------------- tabs
for (const b of document.querySelectorAll<HTMLElement>('nav button')) b.onclick = () => {
  for (const x of document.querySelectorAll<HTMLElement>('nav button')) x.classList.toggle('on', x === b);
  for (const s of document.querySelectorAll<HTMLElement>('section[data-tab]')) s.classList.toggle('on', s.dataset.tab === b.dataset.go);
  history.replaceState(null, '', `#${b.dataset.go}`);
};
const start = location.hash.slice(1);
if (start) document.querySelector<HTMLElement>(`nav button[data-go="${start}"]`)?.click();
drawSetup();
drawGame();
