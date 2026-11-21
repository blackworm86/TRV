// The "Tester della Beta" section of the admin page: who may open the game during the closed Beta
// (src/net/testers.ts). The first time it opens, every account registered so far is let in.

import { emailsIn, type InvitedAccount, type InvitedEmail, type TesterStore } from '../net/testers';

const esc = (s: string): string => s.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const day = (at: number): string => (at ? new Date(at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

const emailRow = (e: InvitedEmail): string =>
  `<li><span><b>${esc(e.email)}</b><small>invitata il ${esc(day(e.at))}</small></span><button class="btn ghost" data-rm-email="${esc(e.key)}">Togli</button></li>`;
const accountRow = (a: InvitedAccount): string =>
  `<li><span><b>${esc(a.name || a.user)}</b><small>@${esc(a.user)} · dal ${esc(day(a.at))}</small></span><button class="btn ghost" data-rm-account="${esc(a.uid)}">Togli</button></li>`;

/**
 * Draws the section into `host` and handles its buttons. `live` says whether the section is still
 * on show (a redraw after a write is skipped when the admin went elsewhere); `toast` shows a short note.
 */
export async function drawTesters(host: HTMLElement, store: TesterStore, live: () => boolean, toast: (msg: string) => void): Promise<void> {
  host.innerHTML = `<div class="cat-head"><h2>Tester della Beta</h2></div>
    <p class="cat-note">Durante la Beta chiusa il gioco si apre solo per gli account invitati: gli admin, gli account registrati prima della Beta e le email che aggiungi qui. Chi è invitato accede con l’account Google di quella email. Le liste sono ${esc(store.where)}.</p>
    <form class="testers-add"><textarea name="emails" rows="4" placeholder="Una o più email Google: una per riga, separate da virgole, o incolla un intero elenco (anche il file esportato da Firebase)" required></textarea><div><button class="btn">Invita</button><small id="t-found"></small></div></form>
    <p class="cat-note" id="t-import"></p>
    <div class="testers"><section><h3 class="sub">Email invitate <span id="t-ne"></span></h3><ul id="t-emails"><li class="wait">Carico…</li></ul></section>
    <section><h3 class="sub">Account <span id="t-na"></span></h3><ul id="t-accounts"><li class="wait">Carico…</li></ul></section></div>`;
  const redraw = async (): Promise<void> => {
    const { emails, accounts } = await store.list();
    if (!live()) return;
    host.querySelector('#t-ne')!.textContent = String(emails.length);
    host.querySelector('#t-na')!.textContent = String(accounts.length);
    host.querySelector('#t-emails')!.innerHTML = emails.map(emailRow).join('') || '<li class="wait">Nessuna email invitata.</li>';
    host.querySelector('#t-accounts')!.innerHTML = accounts.map(accountRow).join('') || '<li class="wait">Nessun account.</li>';
  };
  const fail = (err: unknown): void => toast(`Non riuscito: ${(err as Error).message}`);
  const form = host.querySelector('form')!, input = form.querySelector('textarea')!, found = host.querySelector('#t-found')!;
  // How many emails the pasted text holds, as it is typed.
  input.addEventListener('input', () => {
    const n = emailsIn(input.value).length;
    found.textContent = input.value.trim() ? (n ? `${n} email trovat${n === 1 ? 'a' : 'e'}` : 'Nessuna email valida') : '';
  });
  form.addEventListener('submit', e => {
    e.preventDefault();
    void (async () => {
      const list = emailsIn(input.value);
      if (!list.length) { toast('Nessuna email valida nel testo'); return; }
      const before = new Set((await store.list()).emails.map(x => x.email));
      const fresh = list.filter(x => !before.has(x));
      await store.addEmails(fresh);
      input.value = '';
      found.textContent = '';
      const already = list.length - fresh.length;
      toast(`${fresh.length} tester invitat${fresh.length === 1 ? 'o' : 'i'}${already ? ` · ${already} già in lista` : ''}`);
      await redraw();
    })().catch(fail);
  });
  host.querySelector('.testers')!.addEventListener('click', e => {
    const b = (e.target as Element).closest<HTMLButtonElement>('[data-rm-email], [data-rm-account]');
    if (!b) return;
    b.disabled = true;
    const done = b.dataset.rmEmail !== undefined ? store.removeEmail(b.dataset.rmEmail) : store.removeAccount(b.dataset.rmAccount!);
    void done.then(() => { toast('Tolto dai tester'); return redraw(); }).catch(err => { b.disabled = false; fail(err); });
  });
  try {
    // Once: everyone with an account before the Beta stays in (asked by the user, 2026-11-21).
    const added = await store.importOnce();
    if (added !== null && live()) host.querySelector('#t-import')!.textContent = `Primo avvio della Beta: aggiunti ${added} account registrati finora.`;
    await redraw();
  } catch (err) {
    if (live()) host.querySelector('#t-emails')!.innerHTML = `<li class="wait">Liste non disponibili: ${esc((err as Error).message)}. Le regole del database sono aggiornate (docs/deploy.md)?</li>`;
  }
}
