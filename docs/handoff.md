# Passaggio di consegne (16 novembre 2026)

Documento per riprendere il lavoro in una sessione nuova: per esempio la sessione locale sul PC
dell'utente, pensata per il lavoro sul 3D. Le regole stabili del progetto sono in `CLAUDE.md`;
qui ci sono lo stato attuale, le decisioni prese a voce e cosa resta da fare.

**Alla nuova sessione:** leggi questo file e `CLAUDE.md`, poi riprendi dalla sezione "Da fare".

## Dove siamo

- **Gioco base**: giocabile in hot seat e online.
- **Choppe Shoppe**: i capisquadra (Ms. Betty ed Emberco compresi) e le carte potenziamento sono
  giocabili.
- **Carnage at Devil's Run**: giocabile con i dati veri dei componenti:
  - 10 tessere (6a..10b), trascritte dalle foto dell'utente;
  - 6 tipi di pericolo, il dado fuoco e i segnalini ON FIRE (illimitati);
  - le 11 carte effetto continuo e i danni nuovi (on fire, ongoing effect).
- **Sito**: GitHub Pages (`.github/workflows/pages.yml`) più Firebase Realtime Database (progetto
  `trv-online`). La guida è in `docs/deploy.md`. L'host della partita fa da arbitro; si entra con
  link, QR o codice.
- **Admin**: login Google; l'utente è admin. Il pannello (`prototypes/trv-play-spike/admin.html`)
  mostra tutti gli asset e permette di scaricare i template.
- **Test**: 204 test unitari verdi (`npm run test:unit`). `npm run build:pages` funziona.

## Dove sta il codice

| Cosa | File |
|---|---|
| Motore delle regole (generatori, `play(g)`) | `src/game/trv/engine.ts` |
| Dati delle regole | `data/trv/game_base.json`, `choppe_shoppe.json`, `carnage.json` (con `_rulings`) |
| Interfaccia e scena 3D del gioco | `prototypes/trv-play-spike/main.ts`, `index.html` |
| Tavolo, tessere, segnalini 3D | `src/view/board3d.ts` |
| Terreno procedurale, ostacoli | `src/view/terrain/procedural.ts`, `obstacles.ts` |
| Fuoco a particelle, rampa | `src/view/terrain/carnage3d.ts` |
| Buca della trappola | `src/view/terrain/pit3d.ts` |
| Modelli GLB e loro configurazione | `assets/models/`, `prototypes/trv-play-spike/models-config.ts` |
| Rete e Firebase | `src/net/` (`room.ts`, `firebase-store.ts`, `admin-auth.ts`), `database.rules.json` |
| Pannello admin | `prototypes/trv-play-spike/admin.ts` |
| Prompt per generare modelli (Gemini, Meshy) | `design/art/carnage-ramp-prompts.md`, `design/art/wreck-prompts.md` |
| Screenshot di verifica | `production/qa/evidence/` |

## Decisioni e preferenze dell'utente (non scritte altrove)

- **Interfaccia**:
  - solo desktop, il tablet non conta;
  - il menu principale è una schermata a parte con tre scelte: crea online, crea hot seat,
    partecipa;
  - i colori dei giocatori sono unici;
  - i comandi e le scelte dei segnalini escono da un cassetto che emerge da dietro la plancia
    comandi, largo quanto la plancia;
  - Annulla sta vicino alla plancia, anche con Ctrl+Z;
  - niente log a schermo;
  - bordo verde sulle caselle raggiungibili.
- **Animazioni**: lente e leggibili, con la camera d'azione che segue slam, spari, danni,
  eliminazioni, salti e fuoco.
- **Fuoco**: a particelle e realistico. Le versioni "disegnate" sono state bocciate.
- **Rampa**: è il modello `Ramp.glb` (Barricade Ramp), a terra, centrato nella casella e orientato
  in avanti.
- **Pericoli rivelati**: la basetta del segnalino **resta**. Sopra compaiono il terreno o il pezzo
  3D: fuoco, rampa, olio, vetro, fango.
- **Trappola**: l'utente vuole una buca 3D vera nella mappa, con rocce, cavalletti, coni e
  spazzatura, come in `pit3d.ts`. La prima versione dipinta è stata bocciata ("orrenda", lontana
  dall'artwork).
- **Asset**: la grafica provvisoria va bene online. Gli asset licenziati vanno in
  `assets/licensed/` e il regolamento in `reference/rulebook/`. Né gli uni né l'altro vanno mai su
  git.
- **Regole**: decide il regolamento, e le risposte dell'utente sono in `_rulings` nei file dati.
  Le domande ancora aperte sono nell'artefatto "Regole da decidere"
  (https://claude.ai/artifact/LaSFcU1W9DhTsJe5tBfDc9, collezione `items`). Quando l'utente dice di
  aver risposto, leggile e applicale.

## Da fare

1. **Vista alle spalle delle auto (chase)**: così com'è è inutilizzabile e va rifatta provandola dal
   vivo. Il pulsante è sulla plancia; il codice è in `main.ts` (`setChase`, `chaseButtons`,
   `chaseDie`). Anche i dadi devono seguire la vista.
2. **Trappola**: adeguare `pit3d.ts` all'artwork ufficiale del segnalino. L'utente deve mandarne una
   foto o una scansione.
3. Da verificare dal vivo, perché nella sessione cloud non è stato possibile:
   - segnalini rivelati in 3D e animazioni di salto e fuoco in una partita vera;
   - trascinamento dei dadi nella vista chase;
   - qualità grafica automatica su un PC lento;
   - una partita online con Carnage.
4. Rispondere alle domande aperte dell'artefatto "Regole da decidere" e applicare le risposte.

## Abitudini di lavoro

- Si lavora sul branch `main-rgpe4d`. Dopo ogni push si apre (o si aggiorna) la PR verso `main`;
  il merge lo fa l'utente.
- Dopo ogni merge si controlla che l'azione **Pages** su GitHub Actions sia verde e che il sito sia
  aggiornato. Una volta un test troppo lento su CI ha bloccato il deploy: per questo
  `testTimeout: 30_000` è in `vite.config.ts`.
- Per vedere il gioco: `npm run dev`, poi aprire `/prototypes/trv-play-spike/`. Il pannello admin
  in locale si apre con `admin.html?admin=local`; `models.html` mostra i modelli 3D e dà accesso
  a `window.view` per le prove.
- Nel dev server Vite capita che i moduli restino duplicati dopo modifiche grosse: in quel caso
  riavvia con `--force`.
- Il renderer del gioco ha `stencil: true`, che serve alla buca della trappola.
- Commit in formato Conventional Commits, in italiano.
