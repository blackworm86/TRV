// "Segnala": the Beta testers' report (asked by the user, 2026-11-22), from the Menu during a game
// and from the first screen. With the text go the game so far (setup and choices, so the admins can
// open it again at that point), a picture of the table and where and on what it was played
// (src/net/reports.ts). The admins read them in the admin page; `?report=<id>` opens a report's game.

import { FIREBASE_CONFIG } from '../net/firebase-config';
import { REPORT_KINDS, localReportStore, type NewReport, type ReportKind, type ReportStore } from '../net/reports';
import { g, startGame, type Saved } from './game';
import { closePops } from './menus';
import { netMode } from './online';
import { camera, renderer, scene } from './stage';
import { S } from './state';
import { $ } from './util';

declare const __BUILD__: string;
const VERSION = typeof __BUILD__ === 'string' ? __BUILD__ : 'locale';
/** Width of the picture sent, in pixels, and its JPEG quality: about 100–200 KB. */
const SHOT_WIDTH = 1280, SHOT_QUALITY = 0.72;

let storeP: Promise<ReportStore> | null = null;
/** The store the reports go to: Firebase on the real site, this browser with ?net=local. */
function reportStore(): Promise<ReportStore> {
  storeP ??= netMode() === 'firebase' && FIREBASE_CONFIG
    ? import('../net/reports').then(m => m.firebaseReportStore(FIREBASE_CONFIG!))
    : Promise.resolve(localReportStore(localStorage));
  return storeP;
}

/** The signed-in account's id ('locale' off the real site). */
async function myUid(): Promise<string> {
  if (netMode() !== 'firebase' || !FIREBASE_CONFIG) return 'locale';
  const [{ firebaseApp }, { getAuth }] = await Promise.all([import('../net/admin-auth'), import('firebase/auth')]);
  const auth = getAuth(firebaseApp(FIREBASE_CONFIG));
  await auth.authStateReady();
  if (!auth.currentUser) throw new Error('nessun account');
  return auth.currentUser.uid;
}

/** The table as it is now, as a JPEG data URL; null when there is no game on it. */
function tableShot(): string | null {
  if (!g) return null;
  renderer.render(scene, camera); // the drawing buffer is cleared after each frame: draw, then read at once
  const src = renderer.domElement;
  const k = Math.min(1, SHOT_WIDTH / src.width);
  const c = document.createElement('canvas');
  c.width = Math.round(src.width * k);
  c.height = Math.round(src.height * k);
  c.getContext('2d')!.drawImage(src, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', SHOT_QUALITY);
}

let shot: string | null = null;
let kind: ReportKind = 'bug';

function drawKinds(): void {
  $('rep-kinds').innerHTML = Object.entries(REPORT_KINDS)
    .map(([k, name]) => `<button type="button" data-kind="${k}" class="${k === kind ? 'on' : ''}">${name}</button>`).join('');
}

/** Opens the report window, with the picture of the table taken now. */
export function openReport(): void {
  closePops();
  shot = tableShot();
  drawKinds();
  ($('rep-shot') as HTMLInputElement).checked = !!shot;
  ($('rep-shot') as HTMLInputElement).disabled = !shot;
  $('rep-shotrow').classList.toggle('off', !shot);
  ($('rep-pic') as HTMLImageElement).src = shot ?? '';
  $('rep-what').textContent = g ? (S.net ? `Insieme al testo mandi la partita online (stanza ${S.net.code}), round ${g.round}.` : `Insieme al testo mandi la partita in locale, round ${g.round}.`)
    : 'Non c’è una partita in corso: mandi solo il testo.';
  $('rep-err').textContent = '';
  $('report').classList.add('show');
  ($('rep-text') as HTMLTextAreaElement).focus();
}

function closeReport(): void { $('report').classList.remove('show'); }

async function send(): Promise<void> {
  const text = ($('rep-text') as HTMLTextAreaElement).value;
  if (!text.trim()) { $('rep-err').textContent = 'Scrivi che cosa è successo.'; return; }
  const btn = $('rep-send') as HTMLButtonElement;
  btn.disabled = true;
  $('rep-err').textContent = '';
  try {
    const report: NewReport = {
      kind, text, at: Date.now(), uid: await myUid(), name: ($('myname') as HTMLInputElement).value.trim() || 'Tester',
      version: VERSION, ua: navigator.userAgent, screen: `${innerWidth}×${innerHeight}`,
      where: S.net && g ? 'online' : g ? 'locale' : 'menu',
      ...(S.net ? { room: S.net.code } : {}),
      ...(g ? { round: g.round, turn: g.players[g.current]?.name ?? '' } : {}),
    };
    const game = g && S.saved ? JSON.stringify({ setup: S.saved.setup, choices: S.saved.choices }) : undefined;
    const pic = ($('rep-shot') as HTMLInputElement).checked && shot ? shot : undefined;
    await (await reportStore()).send(report, { game, shot: pic });
    ($('rep-text') as HTMLTextAreaElement).value = '';
    closeReport();
    $('rep-thanks').classList.add('show');
    setTimeout(() => $('rep-thanks').classList.remove('show'), 3000);
  } catch (e) {
    console.error(e);
    $('rep-err').textContent = 'Segnalazione non inviata: controlla la connessione e riprova.';
  } finally { btn.disabled = false; }
}

$('rep-kinds').addEventListener('click', e => {
  const b = (e.target as Element).closest<HTMLElement>('[data-kind]');
  if (b) { kind = b.dataset.kind as ReportKind; drawKinds(); }
});
$('reportopen').addEventListener('click', openReport);
$('reporthome').addEventListener('click', openReport);
$('rep-cancel').addEventListener('click', closeReport);
$('rep-send').addEventListener('click', () => void send());
$('report').addEventListener('pointerdown', e => { e.stopPropagation(); if (e.target === $('report')) closeReport(); });
addEventListener('keydown', e => { if (e.key === 'Escape' && $('report').classList.contains('show')) closeReport(); });

/**
 * `?report=<id>` (admins, from the admin page): opens the game of that report at the point it was
 * sent, without saving it over this browser's own local game. Returns false when there is no such id.
 */
export async function openReportGame(id: string): Promise<boolean> {
  const data = await (await reportStore()).data(id);
  if (!data.game) return false;
  const saved = JSON.parse(data.game) as Saved;
  S.scratch = true;
  $('setup').style.display = 'none';
  startGame({ setup: saved.setup, choices: saved.choices });
  document.title = `Segnalazione · ${document.title}`;
  return true;
}
