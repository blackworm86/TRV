// The "Segnalazioni" section of the admin page: the Beta testers' reports (src/net/reports.ts),
// newest first, filtered by status; each opens with its text, picture, details, the game to open
// again at that point, its status and the admins' note.

import { REPORT_KINDS, REPORT_STATUSES, type Report, type ReportStatus, type ReportStore } from '../net/reports';

const esc = (s: string): string => s.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const when = (at: number): string => new Date(at).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** The filter on show (null: every report) and the report open; kept while the admin moves around. */
let filter: ReportStatus | null = 'nuova';
let open: string | null = null;

function card(r: Report): string {
  const where = r.where === 'online' ? `online · stanza ${r.room ?? '?'}` : r.where === 'locale' ? 'partita in locale' : 'menu';
  const head = `<button class="rep-head" data-open="${esc(r.id)}"><span class="st st-${r.status}">${esc(REPORT_STATUSES[r.status])}</span>`
    + `<b>${esc(REPORT_KINDS[r.kind])}</b><span class="who">${esc(r.name)} · ${esc(when(r.at))}</span><span class="txt">${esc(r.text.slice(0, 140))}</span></button>`;
  if (open !== r.id) return `<li class="rep">${head}</li>`;
  const facts = [
    ['Dove', where + (r.round != null ? ` · round ${r.round}` : '') + (r.turn ? ` · turno di ${r.turn}` : '')],
    ['Versione', r.version], ['Finestra', r.screen], ['Browser', r.ua], ['Account', r.uid],
  ].map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('');
  const statuses = Object.entries(REPORT_STATUSES)
    .map(([k, name]) => `<button class="chip${k === r.status ? ' on' : ''}" data-set-status="${k}">${esc(name)}</button>`).join('');
  return `<li class="rep open">${head}<div class="rep-body" data-id="${esc(r.id)}">
    <p class="rep-text">${esc(r.text)}</p>
    <div class="rep-pic" data-pic><span class="wait">Carico immagine e partita…</span></div>
    <dl>${facts}</dl>
    <div class="chips">${statuses}</div>
    <form class="rep-note"><textarea rows="3" maxlength="2000" placeholder="Note degli admin: cosa si è visto, cosa si è fatto">${esc(r.note)}</textarea><button class="btn ghost">Salva nota</button></form>
  </div></li>`;
}

/**
 * Draws the section into `host` and handles it. `gameUrl(id)`: the address that opens a report's
 * game; `live`: whether the section is still on show; `onCount`: called with how many are new.
 */
export async function drawReports(host: HTMLElement, store: ReportStore, gameUrl: (id: string) => string, live: () => boolean,
  toast: (msg: string) => void, onCount: (n: number) => void): Promise<void> {
  host.innerHTML = `<div class="cat-head"><h2>Segnalazioni</h2></div>
    <p class="cat-note">Quello che i tester mandano dal pulsante Segnala, con la partita e l’immagine del tavolo. Le segnalazioni sono ${esc(store.where)}.</p>
    <div class="reports"><div class="chips" id="r-filter"></div><ul class="reps" id="r-list"><li class="wait">Carico…</li></ul></div>`;
  const section = host.querySelector<HTMLElement>('.reports')!;
  let all: Report[] = [];
  const fillData = async (body: HTMLElement): Promise<void> => {
    const id = body.dataset.id!, box = body.querySelector<HTMLElement>('[data-pic]')!;
    try {
      const d = await store.data(id);
      if (!box.isConnected) return;
      box.innerHTML = (d.shot ? `<a href="${esc(d.shot)}" target="_blank" rel="noopener"><img src="${esc(d.shot)}" alt="Il tavolo al momento della segnalazione"></a>` : '<span class="wait">Nessuna immagine.</span>')
        + (d.game ? `<a class="btn" href="${esc(gameUrl(id))}" target="_blank" rel="noopener">Apri la partita a quel punto</a>` : '<span class="wait">Nessuna partita allegata.</span>');
    } catch (e) { box.innerHTML = `<span class="wait">Non disponibili: ${esc((e as Error).message)}</span>`; }
  };
  const draw = (): void => {
    if (!live()) return;
    const counts = (s: ReportStatus | null): number => (s ? all.filter(r => r.status === s).length : all.length);
    section.querySelector('#r-filter')!.innerHTML = [null, ...Object.keys(REPORT_STATUSES) as ReportStatus[]]
      .map(s => `<button class="chip${filter === s ? ' on' : ''}" data-filter="${s ?? ''}">${s ? esc(REPORT_STATUSES[s]) : 'Tutte'} <span>${counts(s)}</span></button>`).join('');
    const shown = filter ? all.filter(r => r.status === filter || r.id === open) : all;
    section.querySelector('#r-list')!.innerHTML = shown.map(card).join('') || '<li class="wait">Nessuna segnalazione qui.</li>';
    onCount(counts('nuova'));
    const body = section.querySelector<HTMLElement>('.rep-body');
    if (body) void fillData(body);
  };
  section.addEventListener('click', e => {
    const t = e.target as Element;
    const f = t.closest<HTMLElement>('[data-filter]');
    if (f) { filter = (f.dataset.filter || null) as ReportStatus | null; open = null; draw(); return; }
    const h = t.closest<HTMLElement>('[data-open]');
    if (h) {
      open = open === h.dataset.open ? null : h.dataset.open!;
      // Opening a new report marks it seen.
      const r = all.find(x => x.id === open);
      if (r?.status === 'nuova') { r.status = 'vista'; void store.setStatus(r.id, 'vista').catch(err => toast(`Stato non salvato: ${(err as Error).message}`)); }
      draw();
      return;
    }
    const s = t.closest<HTMLElement>('[data-set-status]');
    if (s && open) {
      const r = all.find(x => x.id === open)!, status = s.dataset.setStatus as ReportStatus;
      void store.setStatus(r.id, status).then(() => { r.status = status; toast(`Segnata come ${REPORT_STATUSES[status].toLowerCase()}`); draw(); })
        .catch(err => toast(`Non riuscito: ${(err as Error).message}`));
    }
  });
  section.addEventListener('submit', e => {
    e.preventDefault();
    const r = all.find(x => x.id === open);
    if (!r) return;
    const note = (e.target as HTMLFormElement).querySelector('textarea')!.value;
    void store.setNote(r.id, note).then(() => { r.note = note.trim(); toast('Nota salvata'); }).catch(err => toast(`Non riuscito: ${(err as Error).message}`));
  });
  try { all = await store.list(); draw(); } catch (e) {
    if (live()) section.querySelector('#r-list')!.innerHTML = `<li class="wait">Segnalazioni non disponibili: ${esc((e as Error).message)}. Le regole del database sono aggiornate (docs/deploy.md)?</li>`;
  }
}
