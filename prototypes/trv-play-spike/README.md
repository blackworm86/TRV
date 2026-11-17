<!-- PROTOTYPE - CONCLUDED, see src/app/ -->
# trv-play-spike — partita hot seat giocabile

**Ipotesi**: il gioco base di Thunder Road: Vendetta si gioca bene in hot seat sul tavolo 3D,
con le regole del regolamento applicate dal motore (`src/game/trv/engine.ts`) e il giocatore
che sceglie solo tra mosse legali (anelli sul tavolo o pulsanti).

**Concluso il 2026-11-17.** Il prototipo è diventato il gioco: il codice è in `src/app/` (pagine
`index.html`, `admin.html`, `gallery.html` alla radice), la scelta è spiegata in
`docs/architecture/adr-0001-client-del-gioco.md`. Questo file resta come registro di ciò che il
prototipo ha provato e deciso; i nomi di file qui sotto sono quelli di allora (`main.ts` ora è
diviso nei moduli di `src/app/`, `models-config.ts` è in `src/view/`).

**Come si avvia**: `npm run dev`, poi apri `http://localhost:5173/`.
Serve la grafica estratta in `assets/licensed/_derived/base/` (locale, esclusa da git): chi possiede i
file ufficiali la rigenera con `python tools/assets/extract_base.py`. Senza, i pezzi restano grigi ma la
partita funziona.

**Stato**: concluso, promosso a gioco.

## Cosa c'è
- 2-4 giocatori, tessera di partenza 1a o 1b, tutte le 10 facce delle tessere con terreno e pericoli.
- Round e turni, dadi movimento, dado strada, inerzia, comandi (attacco aereo, nitro, drift, riparazione).
- Terreno (fango, invalicabile, bordi), pericoli (relitto, mina, strada, fango, olio), slam a catena con
  ritiro per il veicolo più grande, sparo, segnalini danno, elicotteri, avanzamento delle tessere,
  tessera finale, traguardo, vittoria per ultimo superstite.
- "Annulla ultima scelta" e ripresa automatica della partita (seed + scelte in localStorage).

## Interfaccia e grafica
- Layout dallo schizzo dell'utente: in alto io, gli avversari con i loro dadi e il dado strada; al centro
  la mappa; in basso i miei dadi, la plancia comandi, i tre cruscotti (danni appesi sotto, auto
  inoperativa capovolta) e l'elicottero. La cronaca è una riga sola: cliccandola si apre il registro.
- I dadi si trascinano su uno spazio libero (cruscotto: "ANY" o +1 inerzia; plancia: quadrante del
  comando), oppure si seleziona un dado e si clicca lo spazio. Clic su uno spazio senza dado
  selezionato: usa il primo dado libero che ci sta. Gli spazi validi si illuminano di verde.
- Grafica tutta vettoriale e provvisoria (`src/view/vector/art.ts`): tutti i dadi (movimento, strada,
  acrobazia, slam, sparo, direzione), segnalini pericolo e danno, cruscotti, plancia, elicottero.
- Mappa vettoriale (`src/view/board3d.ts`): ogni casella è un chevron estruso colorato per effetto
  (strada, fuoristrada, fango, invalicabile con doppio bordo giallo, pericolo in rosso); le tessere
  si incastrano a passo di 8 colonne. Nessuna immagine licenziata nel tavolo.
- Dadi tutti in 3D (`src/view/dice3d.ts`, facce vettoriali): i dadi tirati rotolano sul tavolo sotto la
  strada e restano lì fino al tiro successivo (mostrati al doppio della misura reale per leggerli); i dadi
  dell'interfaccia (miei, avversari, dado strada, dadi posati sulle plance) sono disegnati in 3D da un
  livello WebGL sopra la pagina.
- Segnalini pericolo 3D sulla strada (cartoncino con fronte e retro); si girano quando un'auto ci entra.
  Mina e relitto, scartati dopo l'effetto, restano scoperti per un attimo prima di sparire.
- Fasi del turno (p. 8) nella barra: Assegna, Comando, Movimento, Spara. Nel primo round lo sparo è
  barrato ("Your guns are not online until the second round", p. 10). Avviso a schermo per sparo,
  danni, pericoli ed eliminazioni.
- Animazioni: il motore registra una sequenza di fotogrammi (`Frame` in `engine.ts`: passo, tiro, slam,
  sparo, danno, eliminazione, pericolo scoperto, nuova tessera, inizio round, elicottero) e l'interfaccia
  li riproduce uno alla volta: auto che avanzano casella per casella, dadi che rotolano sul tavolo,
  scossone e onda d'urto negli slam, traccia dello sparo, lampo rosso sul danno, auto eliminate che
  spariscono, tessera nuova che scorre, riquadro di inizio round con i dadi di tutte le crew e il dado
  strada. "Salta" o la barra spaziatrice vanno subito alla fine.
- Spazi di movimento (e bersagli, caselle per l'elicottero) illuminati per intero: verde per muoversi,
  rosso se eliminano l'auto, giallo per sparare, azzurro per l'elicottero.
- Dado strada: quando è utilizzabile il dado in alto si illumina e compare il pulsante; quando non lo è,
  la cronaca dice perché (partita fuori strada o uscita dalla strada).
- Galleria degli asset: `gallery.html` (stessa grafica e stessi pezzi 3D, nessuna immagine licenziata).
- Misure dal catalogo fisico `data/trv/catalog_base.json` (stime, `measured: false`).

## Decisioni sulle regole (confermate dall'utente)
- Dado strada: un'auto che entra dall'area di partenza conta come partita su strada; può usarlo se
  si muove solo su caselle di strada (2026-11-15).

## Interpretazioni provvisorie (da confermare con l'utente)
- Sbandata: i 4 segnalini delle scansioni mostrano tutti "avanti"; il regolamento dice "6 segnalini diversi".
- Lato delle tessere pescate: casuale (il regolamento dice solo di mescolarle).

- Spinte oltre il fronte della tessera di testa (slam, danni): trattate come un'uscita dal fronte.
- Relitti spinti fuori da qualunque bordo: eliminati.
- Pericolo e auto nella stessa casella: prima si risolve il pericolo, poi lo slam.

## Risultati
- Il motore gioca 150 partite casuali (2-4 giocatori) fino alla vittoria, senza blocchi
  (`tests/unit/trv/engine.test.ts`).
- Prova a 1024×768: `production/qa/evidence/trv-play-spike/` (locale, contiene grafica licenziata).

## Comandi della telecamera

- Tasto sinistro: sposta il tabellone (pan). Tasto destro: ruota (orbita). Rotella: zoom.
- WASD o frecce: scorre la vista sul tavolo.
- Tab / Maiusc+Tab: passa da un'auto all'altra del giocatore di turno. 1, 2, 3: auto piccola, media, grande. F: l'auto che sta agendo.

## Modelli 3D

- File in `assets/models/` (creati dall'utente con Meshy, nel repository); tutto ciò che li riguarda (misure sul tavolo, ruote, rotori, vetro, molle) è in `models-config.ts`.
- Pagina di controllo: `models.html` (aggiungi `?drive` per vedere le auto guidare avanti e indietro).

## Grafica ufficiale in vettoriale e terreno in rilievo

Solo in locale: tutto ciò che deriva dalla grafica ufficiale sta in `assets/licensed/` (fuori da
git). Senza quei file il gioco usa i disegni liberi e le tessere a chevron colorati.

- `tools/asset-pipeline/trace.py` vettorizza le scansioni (colori campionati, contorni, curve);
  `pdf_fonts.py` estrae i caratteri incorporati nel regolamento. Il risultato è
  `assets/licensed/vector/official.ts`, che `src/view/vector/art.ts` usa per dadi, segnalini,
  cruscotti e plancia comandi. `?art=open` nell'indirizzo mostra i disegni liberi.
- `tools/asset-pipeline/terrain.py` trasforma una tessera del PDF print-and-play (circa 8400 px)
  in mappe di colore, altezza, normali, ruvidità e contorno (`assets/licensed/terrain/<faccia>/`).
  `buildTile` disegna la faccia in rilievo: sabbia sopra l'asfalto, fango sotto, roccia degli
  spazi invalicabili più alta, crepe incise; `world()` appoggia i pezzi sul terreno. Tutte le 10
  facce, una per volta:
  `python -I tools/asset-pipeline/terrain.py "assets/licensed/TRV 01 Base Game/Road Tiles Base.pdf" <oggetto> assets/licensed/terrain/<faccia> <faccia>`
  con oggetto 4, 7, 10, 13, 16, 19, 22, 25, 28, 31 per le facce 1a, 1b, 2a, 2b, 3a, 3b, 4a, 4b, 5a, 5b.
  La roccia sta solo sugli spazi X di `data/trv/game_base.json`.
- Terreno procedurale (`src/view/terrain/procedural.ts`, codice aperto, nessuna grafica licenziata): dalla
  sola griglia della faccia genera asfalto con crepe e segni di gomme, sabbia con dune e piante, pozze di
  fango, roccia rossa sugli spazi invalicabili (spazi X vicini fanno un unico blocco, nastro giallo-nero
  solo sul bordo esterno), linee della griglia e triangoli dei pericoli. Si usa quando mancano le mappe
  ufficiali, oppure con `?terrain=procedural`; `?terrain=flat` mostra i chevron colorati. Circa 0,6 s per
  faccia sul thread principale (da spostare in un worker).
- Pagine di controllo locali: `assets/licensed/vector/_review.html` (scansione accanto al
  vettoriale) e `_terrain.html?face=2a&view=low` (una faccia in rilievo con auto).

## Interfaccia ridisegnata (2026-11-15)

- **Command board e dashboard** dal disegno vettoriale dell'utente
  (`assets/ui/command_dashboard.svg`, nel repository): `src/view/vector/boards.ts` ne ricava
  le quattro plance e ci scrive sopra testi, dadi e danni. Senza il file si torna ai disegni
  precedenti. La command board è più alta delle dashboard, perché è quella da leggere.
  Manca ancora il retro delle dashboard.
- **Giocatori** in bolle fluttuanti sopra la mappa, con bagliore su chi è di turno; mostrano
  dadi, auto con i danni, comando usato ed elicottero in campo.
- **Fasi del turno** come nastro a frecce sopra le plance.
- **Elicottero non in campo** in 3D accanto alle dashboard.
- **Terreno e informazioni separati**: il terreno procedurale non ha più segni stampati; linee
  delle caselle, nastro giallo-nero e triangoli dei pericoli stanno su un livello a parte
  (pulsante ▦ o tasto G per nasconderlo).
- **Ostacoli 3D** sulle caselle invalicabili: rocce, mesa, rovine, bunker, barricate; il tipo
  per faccia è in `data/trv/terrain_look.json`.
- **Effetti**: ogni dado tirato appare grande al centro con il suo significato; SLAM!, DANNO!,
  BOOM! sul tavolo; un'auto eliminata si lancia contro l'ostacolo, esplode e vola via.
  Dalla console: `__fx.explode(x, z)`, `__fx.crash(__fx.cars()[0])`.
- Prove: `production/qa/evidence/trv-play-spike/ui-redesign-*.jpg`.

## Interfaccia del giocatore, seconda stesura (2026-11-15)

- **Mappa procedurale predefinita**, con ostacoli in rilievo e livello informativo separato
  (linee, nastro, pericoli; tasto G). La grafica ufficiale resta con `?terrain=official`.
- **Striscia del giocatore in un solo disegno**, disposta come nel manuale: command board a
  sinistra, le tre dashboard accostate e allineate, due slot danno sotto ogni dashboard.
  La striscia è ancorata in basso: con le espansioni (carta sopra ogni auto, command board alta
  il doppio) cresce verso l'alto (`STRIP_BOX` in `src/view/vector/boards.ts`).
- **Dadi del giocatore** sopra l'interfaccia, sul bordo del tavolo: si trascinano sulle plance
  o sulle auto 3D.
- **Elicottero** non in campo a terra dietro le auto della sua squadra, nel 3D.
- **Barra asciutta**: fasi, poche parole di richiesta, strumenti. Le scelte (dado strada, slam,
  non sparare) compaiono vicino all'auto che agisce.
- Prove: `production/qa/evidence/trv-play-spike/ui-strip-*.jpg`.

## Attacco e plance a scomparsa (2026-11-15)

- **Arma del modello**: ogni auto usa la propria arma, ritagliata dal modello (`GUNS` in
  `models-config.ts`: vertici, perno e bocca, misurati sulle viste laterale e dall'alto in
  `production/qa/evidence/trv-play-spike/gun-survey-*.jpg`). Ruota verso il bersaglio e rincula.
  Se un modello cambia, le misure vanno rifatte.
- **Raffica**: otto colpi con vampata, fumo, tracciante e scintille; l'elicottero si gira e
  abbassa il muso. Dalla console: `__fx.burst('p0M','p1S')`, `__fx.aim(id, angolo)`,
  `__fx.zoom(id)`.
- **Plance a scomparsa**: piccole durante movimento e sparo, grandi quando si mettono dadi
  (assegnazione, comando, riparazione) o col puntatore sopra; pulsante ▴/▾ o tasto P per
  aprirle o chiuderle a mano. Il tavolo è inquadrato sopra la striscia piccola; quella grande
  si apre sopra il suo bordo inferiore.

## Replay, segnalino danno e plancia piccola (2026-11-15)

- **Plancia sempre piccola**: si ingrandisce solo col puntatore sopra o col pulsante Plance (P).
- **"Nessun comando"** accanto ai dadi.
- **Instant replay**: quando un'auto è danneggiata o distrutta, il pulsante Replay (R) rivede
  quei momenti al rallentatore e da vicino, poi rimette tavolo e telecamera com'erano.
- **Segnalino danno**: quello estratto viene girato grande al centro, con l'auto colpita e il suo
  effetto; i dadi che richiede compaiono accanto. Sulla plancia resta coperto, come da regolamento.
  Il motore mette il segnalino nel fotogramma `damage` (`Frame.token`).
- Dalla console: `__fx.replay()`, `__fx.damage('p1M','shrapnel')`.

## Choppe Shoppe: capisquadra e segnalini comando (2026-11-16)

Prima parte dell'espansione, attivabile dalla schermata iniziale ("Choppe Shoppe: capisquadra e
segnalini comando"). Dati in `data/trv/choppe_shoppe.json`, regole in `src/game/trv/engine.ts`,
test in `tests/unit/trv/choppe_shoppe.test.ts`.

- A inizio partita ogni giocatore riceve due capisquadra a caso e ne tiene uno. La sua plancia
  sostituisce quella dei comandi; in alto a sinistra c'è il potere del giocatore di turno.
- Segnalini comando: uno per turno, su un comando senza dado né segnalino, mai nel turno di
  inerzia. Su un intervallo vale il numero più basso. A fine round tornano alla riserva.
- Giocabili: Bumpo, Abigail, Asha, Vince Vamp, Cruft, Cris Crass, Machine Gun Joe, Madame
  Boudreaux, Wong Lei Hong. Fuori dal mazzo per ora: Ms. Betty (serve il mazzo dei
  potenziamenti) ed Emberco (serve il fuoco di Carnage at Devil's Run).
- **Non ancora fatto**: le 27 carte potenziamento e la loro scelta a rotazione.

Interpretazioni provvisorie, da confermare con il proprietario delle regole:

1. (Confermato il 2026-11-16) Un dado non può andare su un comando che ha già un segnalino, e viceversa: il comando è occupato.
2. Bump!: nessuno ritira; vale quando è l'auto del giocatore di turno a entrare nella casella.
3. Long Arm of the Law: vale anche per l'elicottero, e i veicoli in mezzo non coprono il bersaglio.
4. Spotter e Called Shot: non si tira il dado sparo. Spotter vale anche per l'elicottero.
5. Objection!: il ritiro è offerto solo dopo un colpo mancato.
6. Pain Transfer: l'auto che riceve il danno può andare fuori uso, quella che lo cede può tornare
   operativa; non si può dare un danno a un'auto che ne ha già due.
7. Soul Siphon: il danno si toglie dopo aver risolto il danno del bersaglio; vale anche sparando
   a un relitto.
8. Third Eye: in hot seat il pericolo guardato compare a schermo, quindi lo vedono tutti.
9. Trash into Treasure: vale per ogni ingresso su un pericolo coperto, anche per slam o danno.

## Choppe Shoppe: plancia dei capisquadra e carte potenziamento (2026-11-16)

- **Plancia dei capisquadra** dal secondo disegno del proprietario
  (`assets/ui/command_dashboard_characters.svg`): potere in alto a sinistra, ritratto in alto a
  destra, nome al centro, i quattro comandi sotto. Il pannello dei comandi coincide con quello
  della plancia standard, quindi nella striscia chiusa si vedono comandi e dashboard come sempre;
  aprendola (tasto P o passandoci sopra) compare tutta la plancia.
- **Ritratti**: file locali, mai nel repository, in `assets/licensed/leaders/<id>.png` (o `.jpg`,
  `.webp`). Gli id sono quelli di `data/trv/choppe_shoppe.json`: `bumpo`, `abigail`, `asha`,
  `vince`, `cruft`, `cris`, `joe`, `boudreaux`, `wong`, `betty`, `emberco`. Senza file: colore
  della squadra e iniziale.
- **Carte potenziamento** (casella "Choppe Shoppe: carte potenziamento"): quattro carte a testa,
  se ne tiene una e si passa il resto, fino a tre; poi una per auto. La carta sta sopra la
  dashboard della sua auto, nella striscia aperta. Tutte e 27 hanno il loro effetto nel motore.
- Ms. Betty resta fuori dal mazzo: il suo potere (un potenziamento in più, due sull'auto grande)
  e il comando Tinker non sono ancora fatti.

Interpretazioni provvisorie sulle carte, da confermare:

1. La scelta delle carte è "in contemporanea" sul regolamento; su un solo dispositivo si sceglie
   uno dopo l'altro, quindi chi passa il dispositivo può vedere la mano altrui.
2. (Confermato il 2026-11-16) Oil Dispenser e Mine Dispenser posano il pericolo scoperto.
3. Ghost Mode dà i 2 movimenti quando l'auto attraversa davvero un veicolo con Drift.
4. Boost Switch vale anche nel turno di inerzia.
5. Grappling Hook: lo scambio non fa scattare pericoli né slam.
6. Snowplow, Roll Cage, Anti-Aircraft Radar: l'auto o il relitto è posato nella casella scelta,
   senza gli effetti di un ingresso.
7. Big Red Button elimina le auto adiacenti di chiunque, anche le proprie; non i relitti.
8. Stealth Technology: se tutti i bersagli possibili hanno la carta, si può sparare a ognuno.
9. Rail Gun e Punt Gun si aggiungono all'arco frontale; i veicoli in mezzo non coprono.
10. Smoke Screen e Stealth Technology valgono anche contro gli elicotteri.
11. Tank Treads conta il dado assegnato, anche con Nitro; i pericoli già scoperti agiscono.
12. Skull Shift Knob: fermandosi prima, l'auto rinuncia anche al dado strada.
13. Sandbags blocca anche Junk in the Trunk e Stability Control degli avversari.
14. Heavy Frame conta anche mentre l'auto è fuori uso (altrimenti non potrebbe andarci).

## Cruscotto fisso (2026-11-16)

Sostituisce le plance a scomparsa: il pannello sotto il tavolo non si apre, non si chiude e non
cambia misura durante la partita (niente effetto al passaggio del puntatore, tolti pulsante e
tasto P).

- **Finestra larga (da 1500 px)**: caposquadra a sinistra, carte potenziamento sopra il cruscotto
  della propria auto, plance al centro, dadi e scelte a destra.
- **Finestra stretta**: plance a tutta larghezza; caposquadra, carte e dadi in una riga sopra.
- **Testo vero**: potere del caposquadra e carte potenziamento sono testo della pagina (15-16 px),
  non disegno rimpicciolito. Le plance sono grandi quanto la finestra permette (testo dei comandi
  circa 15 px a 1920x1080, circa 11,5 px a 1280x800).
- **Plancia del caposquadra**: del disegno alto resta la testa (ritratto, nome, segnalini comando)
  nella colonna di sinistra; i suoi quattro comandi stanno sulla plancia comandi della striscia.
- **Scelte**: quelle legate a un'auto restano vicino all'auto; le altre hanno un posto fisso sotto
  i dadi (finestra stretta: sopra l'estremità destra della barra).
- **Barra** più alta, con fasi, domanda e strumenti più grandi (pulsanti da 46 px).
- Prove: `production/qa/evidence/trv-play-spike/cruscotto-fisso-*.jpg`.

## Plancia trasparente e dadi sul tavolo (2026-11-16)

Sostituisce il "cruscotto fisso" qui sopra, che non funzionava.

- **Barra in alto**, sopra i giocatori: fasi del turno, domanda, Salta, Replay, Griglia,
  Cronaca, Annulla, Nuova.
- **Plancia del giocatore senza sfondo**: si vede solo il disegno (plancia comandi o del
  caposquadra, cruscotti, carte potenziamento sopra i cruscotti come prima), sopra il tavolo.
  Dove non c'è plancia il puntatore arriva al tavolo.
- **Dadi diegetici**: i dadi del giocatore sono dadi 3D appoggiati sul tavolo, in fila sotto la
  strada; si trascinano sulla plancia o su un'auto, oppure si clicca il dado e poi lo spazio.
  I dadi usati restano sbiaditi; i dadi tirati (sparo, danni) stanno nella fila sotto.
- **Camera**: niente rotazione, solo pan (tasto sinistro o destro, un dito) e zoom (rotella,
  due dita). Avvicinandosi al terreno la vista si inclina verso l'orizzonte (da circa 61° a 34°).
- **Testi descrittivi** (potere del caposquadra, effetto delle carte) in un carattere normale e
  più grande; il carattere condensato resta per i titoli.
- **Carte potenziamento a forma di carta**: nel draft si sceglie cliccando la carta; poi le carte
  tenute compaiono sopra la plancia e si trascinano su un cruscotto (o su un'auto sul tavolo),
  in qualsiasi ordine. Lo spazio per l'illustrazione è vuoto, in attesa della grafica.
- Regole: l'assegnazione ora chiede "quale carta su quale auto" (prima "quale carta all'auto
  piccola, poi alla media"); l'ultima carta va da sola sull'ultima auto.
- **Limite noto**: a 1280×800 con capisquadra o potenziamenti la plancia occupa quasi metà
  altezza, il tavolo resta piccolo e i testi della plancia scendono a 9-11 px.
- Prove: `production/qa/evidence/trv-play-spike/plancia-trasparente-*.jpg`.

## Ritocchi alla plancia trasparente (2026-11-16, sera)

- **Vista di base più vicina**: inquadra la strada e la fila di dadi sotto di essa, senza la fila
  in più per i dadi tirati (che ora si posano accanto ai dadi del giocatore). Pulsante **Vista**
  nella barra (tasto V) per tornarci.
- **Clic sul cruscotto di un'auto**: la vista va su quell'auto e si avvicina (non quando il clic
  posa un dado o sceglie l'auto da riparare o da potenziare).
- **Niente riquadro "Assegna un dado"**: i dadi da giocare hanno un bagliore verde che pulsa.
- **Carte potenziamento nell'insenatura**: larghe quanto l'insenatura al centro del bordo
  superiore del cruscotto, infilate dietro di esso; sporge solo il nome. Col puntatore sul
  cruscotto la carta sale e mostra l'effetto. La plancia è alta solo con il caposquadra.
- Prove: `vista-base-dadi-luminosi.jpg`, `carta-insenatura-al-passaggio.jpg`,
  `clic-cruscotto-va-all-auto.jpg` in `production/qa/evidence/trv-play-spike/`.

## Plancia larga e pannello del caposquadra (2026-11-16, notte)

- **Plancia a tutta larghezza**: la striscia del giocatore è larga quanto la finestra (finché
  lascia al tavolo più di metà altezza); a 1920×1080 i testi dei comandi sono a circa 18 px.
- **Caposquadra**: il ritratto va nell'avatar del giocatore, in alto (`assets/licensed/leaders/
  <id>.png`; senza immagine resta l'iniziale del giocatore). Nome, titolo e potere stanno in un
  pannello a sinistra della plancia comandi, che porta i comandi del capo. Il disegno alto della
  plancia caposquadra non è più usato in partita.
- **Carte potenziamento**: tagliate al fondo dell'insenatura, così sotto il cruscotto non spunta
  più nulla.
- Prove: `plancia-larga-*.{jpg,png}` in `production/qa/evidence/trv-play-spike/`.

## Nome sopra la plancia, potere su linguetta (2026-11-16, correzione)

Corregge la sezione precedente (il pannello fisso a sinistra era sbagliato).

- **Nome e titolo del caposquadra** su una targa sopra la plancia comandi.
- **Potere del caposquadra** su una linguetta infilata dietro la plancia comandi, da sinistra: si
  vede solo la maniglia con il nome del potere; col puntatore sopra esce e mostra l'effetto. È un
  blocco pieno, quindi chiude anche le tacche del bordo sinistro della plancia. A sinistra della
  striscia resta lo spazio vuoto in cui la linguetta esce.
- **Carte potenziamento**: salgono solo col puntatore sulla carta (il nome che sporge), non su
  tutto il cruscotto.
- Prove: `linguetta-potere-*.jpg`, `carta-sale-solo-sulla-carta.png`.
