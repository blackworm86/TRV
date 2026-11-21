// The "Produzione modelli" section of the admin inspector (design/art/modelli-strutturati.md §21): the
// list of the models with the step each has reached, the sheet of one model with its prompts ready to
// copy, the rules with their measures read from data/trv/modelli/regole.json, and the specification
// itself laid out. Markup only: src/admin/admin.ts puts it on the page and answers the clicks
// (`data-prod` opens a page, `data-copy` copies the prompt beside it, `data-glb` shows a model in 3D).

import DOC from '../../design/art/modelli-strutturati.md?raw';
import { esc } from '../core/markup';
import { ASSET_CATALOG } from './catalog';
import { markdownHtml } from './markdown';
import { classes, compose, problems, RULES, SHEETS, tableMm, type Piece, type Prompt, type Range, type Sheet } from './produzione';

const R = RULES;
/** The pages of the section, for the side menu: address after `produzione/`, name, count. */
export const PRODUCTION_PAGES: [string, string, number | null][] = [['', 'Modelli', SHEETS.length], ['regole', 'Regole e misure', null], ['specifica', 'Specifica completa', null]];

const num = (n: number | null | undefined, digits = 2): string => n == null ? '—' : n.toLocaleString('it-IT', { maximumFractionDigits: digits });
const range = (r: Range | number[], unit = ''): string => {
  if (!r) return '—';
  const [a, b] = r;
  return (a === b ? num(a) : b == null ? `almeno ${num(a)}` : `${num(a)} – ${num(b)}`) + unit;
};
const table = (head: string[], rows: string[][], cls = ''): string => `<table class="pt ${cls}"><thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead>`
  + `<tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
const badge = (esito: string): string => `<span class="st st-p-${esc(esito)}">${esc(R.esiti[esito] ?? esito)}</span>`;
const step = (n: number): string => `${n}/${R.passi.length} ${esc(R.passi.find(p => p.n === n)?.nome ?? '?')}`;
const game = (g: string): string => esc(ASSET_CATALOG.games[g] ?? g);
const promptBox = (title: string, text: string): string => `<div class="prompt"><div class="ph"><strong>${esc(title)}</strong>`
  + `<button class="btn ghost" data-copy>Copia</button></div><pre>${esc(text)}</pre></div>`;
const SETTING_NAMES: Record<string, string> = { topology: 'Topology', symmetry: 'Symmetry', triangoli: 'triangoli', texture: 'texture', rig: 'rig' };
const settings = (s: Record<string, string | number>): string => Object.entries(s).map(([k, v]) =>
  k === 'triangoli' ? `circa ${num(v as number)} triangoli` : `${SETTING_NAMES[k] ?? k} ${typeof v === 'number' ? num(v) : esc(v)}`).join(' · ');
const exists = (s: Sheet): string[] => problems(s);

// ---------------------------------------------------------------- the list of models

function listHtml(): string {
  const cls = classes();
  const rows = SHEETS.map(s => [
    `<button class="link" data-prod="${esc(s.id)}">${esc(s.nome)}</button><small>${esc(s.id)}</small>`,
    game(s.gioco), esc(cls[s.classe]?.nome ?? s.classe), s.regime === 'specifica' ? 'Specifica' : 'Precedenti',
    step(s.stato.passo), badge(s.stato.esito), String(s.pezzi.length), exists(s).length ? `<span class="bad">${exists(s).length}</span>` : '–',
  ]);
  const count = (e: string): number => SHEETS.filter(s => s.stato.esito === e).length;
  const sum = Object.keys(R.esiti).filter(count).map(e => `${badge(e)} ${count(e)}`).join(' &nbsp; ');
  return `<div class="cat-head"><h2>Produzione modelli</h2></div>
    <p class="cat-note">Ogni modello 3D ha una scheda di produzione: misure, pezzi da generare, prompt per Gemini e per Meshy, tentativi, decisioni.
    I dati stanno nel repository (<code>data/trv/modelli/</code>); questa pagina li legge e non li cambia.</p>
    <p class="psum">${sum}</p>
    ${table(['Modello', 'Gioco', 'Classe', 'Regole', 'Passo', 'Stato', 'Pezzi', 'Problemi'], rows, 'models')}
    <p class="cat-note">"Precedenti": modelli nati prima della specifica del 2026-11-21, nel gioco con le misure di oggi e da ridisegnare alla scala unica.</p>`;
}

// ---------------------------------------------------------------- the sheet of one model

function usedHtml(p: Piece): string {
  const u = p.usato!;
  const boxes = (tool: string, list: Prompt[]): string => list.map(x => promptBox(`${tool} · ${x.titolo}`, x.testo)).join('');
  const fixes = u.correzioni?.length ? `<h5>Correzioni pronte</h5>${u.correzioni.map(c => promptBox(`Se ${c.quando}`, c.testo)).join('')}` : '';
  return `<h4>Prompt usati <small>copiati da ${esc(u.fonte)}</small></h4>${boxes('Gemini', u.gemini)}${boxes('Meshy', u.meshy)}`
    + (u.impostazioni ? `<p class="set">Impostazioni di Meshy: ${settings(u.impostazioni)}</p>` : '') + fixes;
}

function pieceHtml(p: Piece): string {
  const c = compose(p);
  const where = p.file ? `<code>${esc(p.file)}</code> <button class="btn ghost" data-glb="${esc(p.file)}">Vedi in 3D</button>`
    : p.altrove ? `<code>${esc(p.altrove)}</code> (non in questo ramo)` : 'file non ancora generato';
  const composed = c ? `<h4>Prompt composti dai blocchi</h4>`
    + (c.allegati.length ? `<p class="set">Da allegare a Gemini: ${c.allegati.map(esc).join(' · ')}</p>` : '')
    + promptBox('Gemini', c.gemini) + promptBox('Meshy', c.meshy)
    + `<p class="set">Impostazioni di Meshy: ${esc(R.blocchi.meshy.modo)} · ${settings(c.impostazioni)}</p>` : '';
  const tries = p.tentativi.length ? `<h4>Tentativi</h4>${table(['Data', 'Strumento', 'Prompt', 'Esito', 'Note'], p.tentativi.map(t => [
    esc(t.data), esc(t.strumento), esc(t.prompt), badge(t.esito), [t.sorgente ? `<code>${esc(t.sorgente)}</code>` : '', esc(t.nota ?? '')].filter(Boolean).join(' '),
  ]))}` : '<p class="set">Nessun tentativo registrato.</p>';
  return `<section class="piece" id="pz-${esc(p.id)}"><h3>${esc(p.nome)}</h3>
    <p class="set">${esc(p.id)} · ${esc(R.tipi[p.tipo] ?? p.tipo)} · ${where}</p>
    ${p.nota ? `<p>${esc(p.nota)}</p>` : ''}${composed}${p.usato ? usedHtml(p) : ''}${tries}</section>`;
}

function sheetHtml(s: Sheet): string {
  const cls = classes()[s.classe];
  const bad = exists(s);
  const steps = R.passi.map(p => `<li class="${p.n < s.stato.passo ? 'done' : p.n === s.stato.passo ? 'now' : ''}" title="${esc(`${p.chi}. Cancello: ${p.cancello}`)}"><b>${p.n}</b>${esc(p.nome)}</li>`).join('');
  const target: string[][] = cls ? [
    ['Classe', `${esc(cls.nome)}: ${esc(cls.sagoma)}`],
    ['Lunghezza', cls.lunghezza ? `${num(cls.lunghezza)} m, sul tavolo ${tableMm(cls.lunghezza)} mm` : 'da fissare con la dima'],
    ['Altezza', cls.altezza ? `${num(cls.altezza)} m` : '—'], ['Larghezza', cls.larghezza ? `${num(cls.larghezza)} m` : '—'],
    ['Raggio della ruota', cls.ruota ? `${num(cls.ruota)} m` : '—'], ['Posti', cls.posti.length ? cls.posti.map(esc).join(', ') : '—'],
  ] : [];
  const today = s.misure_oggi && (s.misure_oggi.lunghezza || s.misure_oggi.tavolo_mm)
    ? [['Oggi nel gioco', [s.misure_oggi.lunghezza ? `${num(s.misure_oggi.lunghezza)} m` : '', s.misure_oggi.tavolo_mm ? `${num(s.misure_oggi.tavolo_mm)} mm sul tavolo` : ''].filter(Boolean).join(', ')]] : [];
  const seats = s.posti?.length ? `<h3 class="sub">Posti</h3>${table(['Posto', 'Ruolo', 'Posa', 'Note'], s.posti.map(p => [`<code>${esc(p.id)}</code>`, esc(p.ruolo), esc(R.posti.nomi[p.posa] ?? p.posa), esc(p.nota ?? '')]))}` : '';
  const files = (title: string, list?: string[]): string => list?.length ? `<h3 class="sub">${title}</h3><ul class="legend">${list.map(f => `<li><code>${esc(f)}</code></li>`).join('')}</ul>` : '';
  const texts = (title: string, list?: string[]): string => list?.length ? `<h3 class="sub">${title}</h3><ul class="legend">${list.map(f => `<li>${esc(f)}</li>`).join('')}</ul>` : '';
  const pv = s.provenienza;
  return `<div class="cat-head"><h2>${esc(s.nome)}</h2><span class="game">${game(s.gioco)}</span><button class="btn ghost" data-prod="">← Tutti i modelli</button></div>
    <p class="cat-note">${esc(s.scopo)}</p>
    <p class="psum">${badge(s.stato.esito)} &nbsp; ${esc(R.regimi[s.regime] ?? s.regime)} &nbsp;·&nbsp; dal ${esc(s.stato.dal)}</p>
    <ol class="steps">${steps}</ol>
    <p>${esc(s.stato.nota)}</p>
    ${bad.length ? `<ul class="legend bad">${bad.map(b => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}
    <h3 class="sub">Misure</h3>${table(['', ''], [...target, ...today], 'kv')}
    ${seats}
    <div class="p3d" id="p-3d" hidden></div>
    <h3 class="sub">Pezzi</h3>${s.pezzi.map(pieceHtml).join('')}
    <h3 class="sub">Collaudo dimensionale</h3><p class="set">${s.collaudi.length ? `${s.collaudi.length} rapporti` : 'Nessun rapporto: lo script del collaudo arriva con la fase C.'}</p>
    ${texts('Note', s.note)}
    ${s.decisioni.length ? `<h3 class="sub">Decisioni</h3><ul class="legend">${s.decisioni.map(d => `<li><strong>${esc(d.data)}</strong> · ${esc(d.testo)}</li>`).join('')}</ul>` : ''}
    ${files('Schede di montaggio', s.montaggio)}${files('Modelli precedenti, ancora nel repository', s.precedente)}
    <h3 class="sub">Provenienza</h3><p class="set">${esc(pv.strumento)} · ${esc(pv.fonte)}${pv.data ? ` · ${esc(pv.data)}` : ''}</p>
    <section class="comments" id="p-comments" data-key="${esc(s.id)}"></section>`;
}

// ---------------------------------------------------------------- the rules

function rulesHtml(): string {
  const f = R.figura, sc = R.scala, lod = R.lod, b = R.blocchi;
  const vehicles = Object.entries(classes()).filter(([, c]) => c.lunghezza).map(([, c]) => [
    esc(c.nome), esc(c.sagoma), `${num(c.lunghezza)} m`, `${tableMm(c.lunghezza!)} mm`, `${num(c.altezza)} m`, `${num(c.larghezza)} m`, `${num(c.ruota)} m`, c.posti.map(esc).join(', ') || '—',
  ]);
  const budget = Object.entries(R.budget).filter(([, v]) => typeof v === 'object').map(([k, v]) => {
    const x = v as { triangoli: number; texture: number; materiali: number };
    return [esc(k.replace('_', ' ')), `≤ ${num(x.triangoli)}`, num(x.texture), `≤ ${x.materiali}`];
  });
  const blocks: [string, string][] = [['Stile (tutti i pezzi)', b.stile], ['Camera', b.camera], ['Colore e usura (pezzi tinti)', b.colore], ['Dima (pezzi con posti)', b.dima],
    ...Object.entries(b.tipo).map(([k, v]): [string, string] => [`Tipo di pezzo: ${R.tipi[k] ?? k}`, v]), ['Meshy: coda di ogni testo', b.meshy.coda]];
  const meshy = Object.entries(b.meshy.impostazioni).filter(([, v]) => typeof v === 'object').map(([k, v]) => [esc(R.tipi[k] ?? k), settings(v as Record<string, string | number>)]);
  return `<div class="cat-head"><h2>Regole e misure</h2></div>
    <p class="cat-note">I numeri di questa pagina sono letti da <code>data/trv/modelli/regole.json</code>, lo stesso file che usano gli script e i test. La spiegazione di ogni regola è nella specifica completa.</p>
    <h3 class="sub">Una scala sola</h3>
    <p>Scala 1 : ${sc.rapporto}, cioè ${sc.mm_per_metro} mm sul tavolo per ogni metro vero. La casella della strada è lunga circa ${sc.casella_mm} mm; una persona di ${num(f.misure.altezza)} m è alta ${tableMm(f.misure.altezza)} mm. ${esc(sc.nota)}</p>
    <h3 class="sub">Veicoli, per classe</h3>
    ${table(['Veicolo', 'Sagoma', 'Lunghezza', 'Sul tavolo', 'Altezza', 'Larghezza', 'Ruota', 'Posti'], vehicles)}
    <h3 class="sub">La figura standard</h3>
    <p>${esc(f.riposo)}</p>
    ${table(['Misura', 'Metri'], Object.entries(f.misure).map(([k, v]) => [esc(f.nomi_misure[k] ?? k), num(v)]), 'kv')}
    <p>Portata usata di braccia e gambe: dal ${num(f.portata.min * 100)}% al ${num(f.portata.max * 100)}%. Una figura generata passa se ogni osso ha la sua lunghezza entro il ${num(f.tolleranza_ossa * 100)}%.</p>
    <h4>Limiti delle articolazioni (gradi)</h4>
    ${table(['Articolazione', 'Movimento', 'Da', 'A'], f.limiti_gradi.map(([a, m, lo, hi]) => [esc(a), esc(m), num(lo), num(hi)]))}
    <p>Gomiti: ${esc(f.versi.gomiti)}. Ginocchia: ${esc(f.versi.ginocchia)}.</p>
    <h4>Scheletro</h4>
    ${table(['Osso del contratto', 'Nome di Meshy'], f.ossa.map(o => [`<code>${esc(o)}</code>`, f.nomi_meshy[o] ? `<code>${esc(f.nomi_meshy[o])}</code>` : 'da leggere sulla prossima figura']), 'kv')}
    <h3 class="sub">I posti, per posa</h3>
    <p class="cat-note">Metri dall'origine del posto (le anche): avanti e in alto.</p>
    ${table(['Misura', ...['sit', 'ride', 'stand'].map(k => esc(R.posti.nomi[k]))], R.posti.misure.map(([name, ...r]) => [esc(name), ...r.map(x => range(x))]))}
    <h3 class="sub">Collaudo, vernice, parti mobili</h3>
    ${table(['Regola', 'Valore'], [
      ['Proporzioni del pezzo rispetto alla dima', `± ${num(Number(R.collaudo.proporzioni) * 100)}%`],
      ['Punti dei posti', `entro ${num(Number(R.collaudo.punti_posti_m) * 100)} cm`],
      ['Compenetrazione della figura', `al massimo ${num(Number(R.collaudo.compenetrazione_m) * 100)} cm`],
      ['Vernice (colore del giocatore)', `${range(R.vernice.quota_vernice.map(x => x * 100))}% della superficie visibile`],
      ['Usura', `${range(R.vernice.quota_usura.map(x => x * 100))}% dei pannelli verniciati`],
    ], 'kv')}
    <h3 class="sub">Budget</h3>
    ${table(['Pezzo', 'Triangoli', 'Texture', 'Materiali'], budget)}
    <h3 class="sub">Livelli di dettaglio</h3>
    ${lod.verificato ? '' : '<p class="warn">Valori di partenza non misurati: vanno verificati al tavolo col selettore della qualità grafica. Fino ad allora il collaudo li riporta come avviso.</p>'}
    <p>${esc(lod.regola)}</p>
    ${table(['Livello', 'Lunghezza a schermo', 'Triangoli', 'Texture'], lod.veicoli.map(v => [
      `${esc(v.id)} ${esc(v.nome)}`, v.px[1] == null ? `oltre ${v.px[0]} px` : v.px[0] ? `${v.px[0]} – ${v.px[1]} px` : `sotto ${v.px[1]} px`,
      v.triangoli_max ? `al massimo ${num(v.triangoli_max)}` : `${num(v.triangoli! * 100)}%`, v.texture ? num(v.texture) : 'colori piatti']))}
    <p>Isteresi ${num(lod.isteresi * 100)}%; qualità bassa o alta: soglie ± ${num(lod.qualita * 100)}%; durante un'azione mai sotto ${esc(lod.livello_minimo_in_azione)}. Obiettivo: ${num(lod.tavolo_intero_triangoli)} triangoli di veicoli sul tavolo intero, ${num(lod.vista_mappa_triangoli)} in vista mappa.</p>
    <h3 class="sub">Il flusso di lavoro</h3>
    ${table(['Passo', 'Chi', 'Cancello'], R.passi.map(p => [`${p.n}. ${esc(p.nome)}`, esc(p.chi), esc(p.cancello)]))}
    <h3 class="sub">I blocchi dei prompt</h3>
    <p class="cat-note">Il prompt di un pezzo si compone da questi blocchi più la sua parte specifica. Cambiare un blocco cambia i prompt dei pezzi non ancora generati.</p>
    <ul class="legend">${b.regole_gemini.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
    ${blocks.map(([t, x]) => promptBox(t, x)).join('')}
    <h4>Impostazioni di Meshy, per tipo di pezzo</h4>
    <p class="set">${esc(b.meshy.modo)}. ${esc(b.meshy.esportazione)} Da verificare sull'interfaccia di Meshy di oggi.</p>
    ${table(['Tipo', 'Impostazioni'], meshy, 'kv')}`;
}

/** The sheet with id `id`, when there is one. */
export const sheetById = (id: string): Sheet | undefined => SHEETS.find(s => s.id === id);

/**
 * The markup of a page of the section: `''` the list of models, `'regole'` the rules, `'specifica'` the
 * whole specification, else the sheet of the model with that id (the list, when there is none).
 */
export function productionHtml(page: string): string {
  if (page === 'regole') return rulesHtml();
  if (page === 'specifica') return `<div class="cat-head"><h2>Specifica completa</h2></div><p class="cat-note"><code>${esc(R.documento)}</code></p><article class="doc">${markdownHtml(DOC)}</article>`;
  const s = sheetById(page);
  return s ? sheetHtml(s) : listHtml();
}
