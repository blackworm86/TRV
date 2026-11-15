# Art Bible: Thunder Road Vendetta (porting digitale)

> **Status**: Draft
> **Owned By**: art-director
> **Last Updated**: 2026-11-15
> **Art Director Sign-Off (AD-ART-BIBLE)**: REVISED 2026-11-15 — CONCERNS risolti: ciclo di vita tavolo→pannello di dadi movimento e danni (1.3, 3.3, 3.7, 7.4), carattere display (7.1), rimando (2.4). Restano input mancanti documentati: tinte esatte ed emblemi delle bande (4.3), facce dei dadi strada/sparo/slam/movimento (3.7), budget di memoria e poligoni (8.4).

`/art-bible` writes these nine sections in this order and replaces each
section's `[To be designed]` line as that section is approved. A section still
holding its placeholder is incomplete; a later run fills only those.

## 1. Visual Identity Statement

### 1.1 Regola visiva

**"Se non lo potresti toccare sul tavolo, e leggere a colpo d'occhio da seduto, non va sul tavolo."**

Ogni ambiguità visiva si risolve in due passi, in quest'ordine: (a) è un oggetto
fisico plausibile (cartone, legno, feltro, plastica) illuminato dall'unica luce
principale della scena? (b) il giocatore ne legge la funzione a 1024×768? Se (a) e
(b) confliggono, vince (b). Il tavolo fisico è il *come*, la leggibilità è il
*perché*.

Questa regola rende operativa l'ancora visiva del concept ("Il tavolo fisico",
scelta dell'utente) assorbendo il criterio della direzione alternativa "Il tavolo
leggibile": il tavolo è fisico nella resa, la leggibilità è il criterio di
arbitraggio.

### 1.2 Principi di supporto

**P1. Il peso dice cosa conta** — *serve il Pilastro 2 (Ogni dado si spiega)*.
Spessore, ombra e altezza sono informazione, non decorazione. Tessere pericolo,
segnalini danno e auto hanno volume diverso e proiettano un'ombra coerente con
l'unica luce della scena, così si capisce a colpo d'occhio che cosa sta sopra a che
cosa e che cosa si è appena mosso.
*Test*: quando non è chiaro quanto un elemento debba risaltare, scegli la versione
in cui spessore e ombra lo collocano al livello giusto della gerarchia (strada sotto,
pericolo e danno sopra, auto sopra ancora), mai una in cui ombra o profondità lo
nascondono o lo confondono con un altro.

**P2. Il dado è un oggetto, il risultato è un fatto** — *serve il Pilastro 1 (Il
regolamento è la legge)*. Il dado rotola con fisica credibile, ma la faccia che si
ferma è sempre il valore già deciso dal nucleo di regole. La fisica è coreografia:
non decide nulla, e l'animazione non suggerisce mai un esito diverso da quello dello
stato.
*Test*: quando l'effetto fisico del dado (rimbalzo, quasi-caduta, inclinazione) è in
tensione con l'esito, scegli l'esito: la faccia finale è identica al valore nello
stato, senza eccezioni, anche se la coreografia va forzata o abbreviata. Verificabile
con test automatico sullo stato e screenshot.

**P3. L'atmosfera è sempre saltabile e mai opaca** — *serve i Pilastri 2 e 3 (Ogni
dado si spiega; Turni veloci, partita pronta)*. Luce calda, feltro, legno, polvere e
vignettatura creano il tavolo, ma non coprono mai una casella, un segnalino o una
causa. Ogni effetto atmosferico e ogni animazione è ridimensionabile o saltabile; il
colore funzionale (una tinta per banda, una per pericolo, una per danno) non viene
mai alterato dalla luce fino a perdere contrasto; pericolo e danno si distinguono
anche per forma o icona, non solo per colore.
*Test*: quando un effetto d'atmosfera (nebbia, bagliore, profondità di campo, ombra
lunga) compete con la leggibilità o con la velocità, scegli la versione più sobria:
il tavolo pieno non nasconde mai una casella a 1024×768 con il dito sopra, e un
effetto non allunga mai un turno oltre il suo budget.

### 1.3 Cosa fa il trattamento "tavolo fisico" alla grafica ufficiale

La grafica ufficiale non si ridisegna: si **monta** su oggetti fisici.

- **Tessere strada e pericoli**: la grafica piatta diventa la faccia superiore di una
  lastra di cartone con spessore e bordo visibili. La forma a chevron delle caselle si
  conserva: è il linguaggio di griglia del gioco. Nessuna ri-illustrazione.
- **Segnalini (pericolo, danno)**: stessa logica, spessore di un segnalino di
  cartone vero, ombra morbida. Il retro (rosso con triangolo; nero con icona freno) fa
  parte della fisicità e del Pilastro 2: si capisce cosa è coperto e cosa rivelato. I
  pericoli restano sul tavolo per tutta la loro vita; i danni ci stanno solo il tempo
  della pescata e della rivelazione, poi passano coperti nel pannello dell'auto a
  schermo (7.1; ciclo di vita in 7.4). Il gioco base non ha segnalini comando: un
  comando si attiva ponendo un dado movimento sulla plancia comandi, che è un pannello
  a schermo (decisione C1).
- **Illuminazione**: una luce principale calda e una di riempimento morbida, ombre
  soffici e brevi. Materiali opachi, niente speculari lucidi sulla carta; unica
  eccezione la pozza d'olio, la cui iridescenza è già nell'arte e può avere una
  leggerissima lucentezza.
- **Palette**: la luce calda non sposta i colori dell'arte ufficiale oltre quanto
  serve a farla sedere sul tavolo. Se grigio asfalto, sabbia e rosso pericolo perdono
  contrasto sotto la luce, si corregge la luce, non l'arte.
- **Camera**: fissa o pochi preset, inclinazione moderata; la prospettiva non fa mai
  perdere una casella dietro un'altra.

### 1.4 Artefatti delle scansioni

Tessere pericolo, segnalini danno, cruscotti e plance comandi forniti sono scansioni
di componenti stampati (linee di taglio, margini di foglio, ombre di scansione, fondo
carta, orientamento capovolto). Le tessere strada invece sono arte digitale pulita.

- **Si rimuovono**: linee di taglio, margini del foglio, ombre di scansione e fondo
  carta esterno al pezzo. Sono rumore di digitalizzazione; l'ombra reale la produce la
  scena (P1), e un'ombra scansionata più quella della scena darebbe una doppia ombra
  incoerente con la luce.
- **Si mantengono**: grana, usura e bordi irregolari *dentro* il pezzo (per esempio i
  bordi rossi sbrecciati dei danni): sono la sua identità fisica.
- **Procedura**: ritaglio per pezzo con maschera pulita lungo il contorno,
  raddrizzamento e orientamento corretto, estrusione dello spessore in 3D. Se un pezzo
  scansionato è troppo sgranato o sfocato ai bordi, si segnala all'utente e si cerca la
  fonte originale: non si inventa un surrogato (decisione su eventuali rifacimenti
  rinviata alla Sezione 8).

### 1.5 Vincolo del set segnaposto

L'identità regge con **arte segnaposto aperta**, perché l'arte ufficiale non entra
mai in un repository pubblico.

- Il linguaggio del tavolo (spessore, luce, materiali, forme a chevron, ombre, UI,
  dadi) è interamente nostro e riproducibile senza l'arte ufficiale.
- Il segnaposto è minimale e funzionale (chevron grigi, colori funzionali, icone
  semplici), non un clone stilistico dell'arte ufficiale.
- *Test*: lo stesso screenshot di riferimento, con il segnaposto, passa gli stessi
  controlli di leggibilità di P3.

### 1.6 Non valutabile senza altra arte

1. **Modelli di auto ed elicottero**: non forniti; scala, silhouette e leggibilità a
   piccola dimensione da decidere (modelli 3D o sagome/pedine, e da quale fonte).
2. **Dadi (facce e modello)**: non forniti; dimensioni, materiale, simboli e contrasto
   delle facce da decidere (grafica ufficiale delle facce o set segnaposto).
3. **Qualità reale delle scansioni** a piena risoluzione, su schermo e tablet, e
   disponibilità dei retri.
4. **Leggibilità di cruscotti e plance comandi** (numeri nei rombi, pallini) a 1024×768:
   da testare nel prototipo.
5. **Simboli piccoli sotto luce calda e camera inclinata** (triangoli pericolo con
   etichette 2, 2/3, 2/3/4; mina turchese su sabbia): serve un prototipo con la camera
   reale.
6. **Distinzione pericolo/danno per forma**: rosso pericolo e rosso-arancio danno sono
   vicini; da verificare accostati durante la rivelazione di un danno sul tavolo (3.3).
7. **Prestazioni su tablet con ombre dinamiche**: da valutare con il technical-artist.

### 1.7 Rischi

- **Rosso ambiguo**: triangolo pericolo, bordo danno e retro pericolo sono tutti nella
  famiglia del rosso; la luce calda può avvicinarli. Mitigazione: forma e icona.
- **Doppia ombra** sulle scansioni non pulite (1.4).
- **Tensione con il Pilastro 3**: dadi fisici e luce calda costano tempo se non
  saltabili; P3 lo copre, ma va tradotto nel budget di animazione da fissare con il
  game-designer.

## 2. Mood & Atmosphere

### 2.1 Vincolo di fondo: una sola luce, molte intensità

La Sezione 1 fissa una luce principale calda e una di riempimento morbida. Questa
sezione **non** introduce un'illuminazione diversa per stato. Il cambio di stato si
comunica solo con queste leve, in ordine di preferenza:

1. **Livello UI**: banner, cornici, dimensione e posizione dei pannelli. È la leva più
   economica e non tocca mai l'arte.
2. **Focus**: evidenziazione di ciò che agisce, o attenuazione di ciò che **non è zona
   di gioco** (bordo del tavolo, area fuori strada).
3. **Vignettatura**: solo sulla cornice del tavolo, mai sopra una casella.
4. **Intensità della luce principale**: variazione contenuta (punto di partenza ±15%
   sul valore base, da tarare nel prototipo).
5. **Rapporto principale/riempimento (contrasto)**: più alto = ombre più marcate = più
   tensione. Limite: le ombre non coprono mai una casella (P1, P3).
6. **Camera**: solo salti tra preset, brevi e sempre saltabili.

**Escluse**:
- cambio di temperatura o colore della luce (es. luce blu nella sconfitta): sposta i
  colori funzionali dell'arte ufficiale, viola 1.3;
- profondità di campo sul piano di gioco: nasconde caselle, viola P3 (ammessa solo sul
  fondo fuori dal tavolo);
- desaturazione globale: altera il colore funzionale (ammessa solo sull'ambiente attorno
  al tavolo, mai su strada, segnalini o auto).

**Regola di saltabilità (P3)**: un'impostazione **"Atmosfera minima"** riduce ogni
stato alla luce base della pianificazione più il solo livello UI (banner e testo);
nessuno stato perde informazione. Ogni effetto di questa sezione rispetta il budget di
animazione da fissare con il game-designer (rischio 1.7).

### 2.2 Alternative considerate

- **A. Una luce per stato** (calda in pianificazione, dura in risoluzione, fredda nella
  sconfitta): soluzione cinematografica classica, ma contraddice 1.3 e P3. Scartata.
- **B. Tutto nella UI, scena immobile**: la più sicura, ma il tavolo diventa inerte
  mentre la Sezione 1 chiede un tavolo fisico che "respira". Scartata come soluzione
  unica, conservata come modalità "Atmosfera minima".
- **C. Luce fissa in direzione e temperatura, modulata in intensità e contrasto, più
  focus e UI**: **scelta**. Rispetta 1.1, ha un fallback garantito nella UI e rende gli
  stati distinti.

### 2.3 Riferimento comune: il tavolo a riposo

Il valore base è la luce della **pianificazione**: calda, morbida, uniforme sulla
strada, ombre brevi, vignettatura leggera solo sulla cornice. Tutti gli altri stati si
descrivono come scarto da questo.

### 2.4 Stati

**1. Menu principale / preparazione partita** (scelta squadre e modalità)
- *Emozione*: anticipazione, "apriamo la scatola"; invita senza mettere fretta (Pilastro
  3: partita pronta).
- *Luce*: base con contrasto leggermente più alto; la luce principale cade su ciò che si
  sceglie, il resto del tavolo nella penombra della cornice.
- *Descrittori*: polveroso, promettente, ordinato, da locandina.
- *Energia*: 2/5.
- *Veicolo del mood*: i componenti disposti sul tavolo come prima di una partita (pile
  chiuse, auto in fila). Il registro "locandina" del banner di capitolo (titolo condensato
  crema con ombra rossa) dà il tono tipografico del titolo; con il set segnaposto si rende
  con un carattere aperto (1.5).
- *Saltabile*: un'eventuale animazione d'ingresso si salta con un input; la preparazione
  non attende mai un'animazione.

**2. Pianificazione del turno** (assegnare i dadi, plancia comandi, archi frontali)
- *Emozione*: lucidità calma; è lo stato del "giocatore attento" (Pilastro 2): tutto
  davanti, niente distrae.
- *Luce*: base; lo stato più uniforme e meno contrastato, ombre brevi, nessuna
  vignettatura oltre la cornice.
- *Descrittori*: quieto, leggibile, ponderato, sospeso.
- *Energia*: 1/5, la più bassa del gioco, voluta.
- *Veicolo del mood*: il focus sull'auto selezionata (cornice UI, 4.4) e gli archi
  frontali come sovrapposizione grafica piatta, non oggetto fisico. Nessun movimento
  ambientale sul piano di gioco (niente polvere che passa sopra le caselle).
- *Nota*: è lo stato in cui si passa più tempo, quindi il riferimento della prova di
  leggibilità a 1024×768.

**3. Risoluzione** (tiri, rivelazione pericoli, catene di slam con dado slam e dado
direzione, sparo, pescata danni)
- *Emozione*: il picco d'azione, tensione e scarica: "succede ora, e capisco perché".
- *Luce*: contrasto più alto (riempimento più debole, ombre più nette ma sempre brevi),
  luce principale un poco più intensa, vignettatura più marcata sulla cornice; il focus
  passa al singolo evento (dado, segnalino rivelato, auto spinta).
- *Descrittori*: secco, cinetico, polveroso, metallico, sincopato.
- *Energia*: 5/5.
- *Veicolo del mood*: il dado come oggetto che rotola e proietta un'ombra netta (P2); il
  ribaltamento del segnalino dal retro (rosso con triangolo per i pericoli, nero con icona
  freno per i danni) al fronte; nelle catene di slam una sequenza leggibile, un evento
  alla volta con la sua causa (Pilastro 2).
- *Saltabile*: ogni passo si accelera o si salta; il risultato compare comunque come
  fatto nel registro e nel livello UI (P2).
- *Rischio*: è lo stato in cui l'atmosfera rischia di più di diventare opaca; qui il
  limite al contrasto (ombre che non coprono caselle) conta più che altrove.

**4. Scorrimento della tessera** (rimozione della tessera di coda con le auto sopra,
posa della nuova tessera di testa)
- *Emozione*: momento drammatico, "la strada mangia chi resta indietro"; fatalità o
  sollievo secondo dove sono le proprie auto.
- *Luce*: la tessera di coda perde luce (intensità locale, o vignettatura che la invade
  dal bordo) prima di essere sollevata; la tessera di testa entra in piena luce base.
  **Calo luminoso localizzato, mai cambio di colore.**
- *Descrittori*: inesorabile, pesante, definitivo, ritmico.
- *Energia*: 4/5, singolo accento forte.
- *Veicolo del mood*: lo spessore della tessera che si solleva con le auto sopra (P1).
  Prima della rimozione un **indicatore UI** segnala quali auto stanno per uscire: la
  causa è visibile prima dell'effetto (Pilastro 2).
- *Camera* (**decisione D4 dell'utente**): **resta fissa**. Nessuna carrellata e nessuno
  scatto di preset: lo stato è portato da calo di luce locale e indicatore UI.
  (Alternative scartate: carrellata che segue lo scorrimento, contro 1.3 e costosa in
  tempo; scatto opzionale tra preset.)

**5. Fine round** (passaggio del dado strada)
- *Emozione*: respiro, passaggio di consegne; punteggiatura, non evento.
- *Luce*: ritorno alla base; ombre più morbide, vignettatura leggera.
- *Descrittori*: breve, cerimoniale, pulito.
- *Energia*: 2/5.
- *Veicolo del mood*: il dado strada che cambia mano come oggetto (piccolo spostamento
  verso il lato del nuovo primo giocatore) e un banner UI con nome o colore della squadra.
- *Saltabile*: durata minima per difetto (Pilastro 3).

**6. Un giocatore esce dalla partita / posata la tessera finale** (picco di tensione)
- *Emozione*: allarme e restringimento: "da qui in poi è il finale".
- *Luce*: la vignettatura si stringe **in modo permanente** fino alla fine della partita;
  contrasto un gradino sopra la base; luce principale leggermente più bassa sui bordi.
- *Descrittori*: stretto, teso, crepuscolare (solo come intensità, non come colore),
  irreversibile.
- *Energia*: 4/5, sostenuta.
- *Veicolo del mood*: un cambiamento persistente della cornice del tavolo, così chi
  guarda a metà capisce di essere nel finale; per l'eliminazione, il pannello della
  squadra uscita che si **chiude** (si oscura, 7.4); un banner UI per l'evento puntuale.
- *Distinzione dallo stato 4*: lo scorrimento è un accento locale e transitorio, questo
  un'atmosfera globale e permanente.

**7. Vittoria** (traguardo o ultima squadra con auto operabili)
- *Emozione*: trionfo pieno ma breve, poi riconoscimento ("ho vinto e so perché").
- *Luce*: luce principale al massimo consentito, vignettatura aperta: l'unico stato in
  cui la cornice del tavolo è completamente illuminata.
- *Descrittori*: luminoso, esplosivo, polveroso, da locandina.
- *Energia*: 5/5 all'apertura, poi 2/5 sul riepilogo.
- *Veicolo del mood*: le auto vincitrici in primo piano; il registro "locandina" torna
  come banner, chiudendo il cerchio con il menu; poi un riepilogo con le cause chiave
  della partita (Pilastro 2, se previsto da game-designer e ux-designer).
- *Saltabile*: la celebrazione si salta con un input e porta al riepilogo.

**8. Sconfitta / giocatore eliminato che resta a guardare**
- *Emozione*: per chi perde, accettazione dignitosa, non punizione; per chi è fuori e
  guarda, presenza da **spettatore**: la partita continua e la si capisce ancora.
- *Luce*: sconfitta a fine partita = luce base, vignettatura media, nessun drammatismo
  aggiunto. Spettatore eliminato = la scena resta quella di chi gioca, **invariata**;
  cambia solo il suo livello UI (comandi personali spenti, etichetta "Spettatore",
  pannello della propria banda chiuso, 7.4).
- *Descrittori*: sobrio, quieto, partecipe, smorzato (solo nella UI).
- *Energia*: 1-2/5.
- *Alternativa scartata*: desaturare la scena per lo spettatore; in hot seat lo schermo
  è condiviso con chi gioca ancora, e T1 vuole la stessa partita in locale e online.

**9. Online, in attesa del turno avversario** (Tier 2)
- *Emozione*: pazienza informata: "so chi sta pensando e posso ripassare il tavolo".
- *Luce*: identica alla pianificazione; il tavolo resta pienamente leggibile.
- *Descrittori*: calmo, vigile, consultabile.
- *Energia*: 1/5.
- *Veicolo del mood*: solo il livello UI: un indicatore persistente "sta pianificando:
  [squadra]" con colore ed emblema della squadra (4.3) e un segnale di attività lento,
  mai lampeggiante, in un'area fissa fuori dal piano di gioco; i comandi propri visibili
  ma inattivi (tratteggio, 3.8).
- *Distinzione dallo stato 2*: a parità di luce cambiano la proprietà dei comandi e
  l'indicatore di chi agisce; voluto, per T1.

### 2.5 Matrice di distinzione

| Stato | Intensità principale | Contrasto | Vignettatura | Leva principale | Energia |
|---|---|---|---|---|---|
| Menu/preparazione | base | +1 | media | focus sui componenti | 2 |
| Pianificazione | base | base | minima | focus UI sull'auto | 1 |
| Risoluzione | +1 | +2 | marcata | focus sull'evento, dado | 5 |
| Scorrimento | calo locale | +1 | invade la tessera | spessore tessera, indicatore | 4 |
| Fine round | base | base | minima | dado strada, banner | 2 |
| Uscita / tessera finale | −1 sui bordi | +1 | stretta e permanente | cornice persistente | 4 |
| Vittoria | massima | +1 | aperta | registro "locandina" | 5→2 |
| Sconfitta / spettatore | base | base | media / invariata | UI in sola lettura | 1-2 |
| Attesa online | base | base | minima | indicatore di chi agisce | 1 |

Pianificazione, fine round e attesa online condividono la stessa luce **per scelta**
(momenti "di tavolo"): si distinguono per livello UI e proprietà dei comandi.

### 2.6 Non valutabile

- I valori numerici delle leve (±15%, rapporti principale/riempimento) sono punti di
  partenza da verificare nel prototipo con camera e arte reali, su schermo di riferimento
  e tablet.
- Le durate (fine round, scorrimento) dipendono dal budget di animazione del
  game-designer.
- Il "riepilogo con le cause" della vittoria è una funzione, non una scelta d'arte: la
  decidono game-designer e ux-designer.

## 3. Shape Language

### 3.1 Principio guida: le forme sono già nel gioco

La grammatica delle forme **non si inventa**: si estrae dai componenti ufficiali e ogni
forma si **riserva** al suo significato. Una forma che nel gioco vuol dire una cosa non
decora nient'altro. È la traduzione formale del Pilastro 1 e di P3 (pericolo e danno si
distinguono anche per forma).

### 3.2 La casella a chevron: forma di griglia

- **Cosa si vede**: la strada è una griglia di caselle a chevron (punta in avanti, incavo
  dietro) con un filetto chiaro tra le caselle; il banner di capitolo ha la stessa
  terminazione a punta.
- **Significato**: direzione di marcia; ogni casella "punta" dove va la strada. È la forma
  più importante del gioco: tutto il resto si colloca rispetto a lei.
- **Regole**:
  1. La casella a chevron si conserva identica (1.3) ed è l'unica griglia del gioco.
  2. **Il chevron è riservato a strada e movimento.** La UI non usa chevron decorativi: un
     chevron in UI significa sempre "direzione o spostamento" (come nell'icona del danno
     SKID, dove la fila di chevron rappresenta caselle).
  3. Il filetto tra le caselle resta visibile anche con la luce più bassa (stato 6 di
     2.4); se si perde, si corregge la luce (1.3).
- *Serve*: Pilastro 1; P1 (strada al livello più basso, lastra con spessore).
- *Alternativa scartata*: griglia esagonale o quadrata "più leggibile" in digitale;
  cambia il gioco (anti-pilastro: niente riequilibrio).

### 3.3 Segnalini: la sagoma dice la famiglia

**Segnalini pericolo**
- *Sagoma*: rettangolo verticale con punta in alto e incavo a V in basso, cioè **la
  casella a chevron ruotata**: la forma di "qualcosa che occupa una casella".
- *Fronti* (dal regolamento, p. 7): **Road** (asfalto grigio: la casella diventa strada),
  **Mud** (fango bruno su ocra: la casella diventa fango), **Oil Slick** (olio iridescente
  su grigio), **Wreck** e **Mine** (blu notte con icona lineare rosso-arancio). *Retro*:
  rosso con doppio triangolo bianco.
- *Regola*: la sagoma a casella è la firma "pericolo"; nella UI (tooltip, registro) il
  pericolo compare sempre con questa sagoma in miniatura.

**Segnalini danno**
- *Sagoma*: quadrato con **bordo inferiore strappato** e cornice rossa sbrecciata. Retro
  nero con icona freno rossa.
- *Regola*: il bordo strappato è la firma "danno"; nessuna decorazione UI ha bordi
  strappati.

**Tre difese contro l'ambiguità tra i due rossi** (1.7, 4.6): **sagoma** (casella a punta
contro quadrato strappato), **icona** (triangolo contro freno), **luogo** (i pericoli
vivono sulla strada, cioè sul tavolo; i danni, dopo la risoluzione, vivono nel pannello
dell'auto a schermo, 7.1). Il luogo separa i due rossi per tutta la partita tranne che in
un momento: la rivelazione di un danno avviene sul tavolo accanto all'auto colpita (7.4),
e lì pericolo e danno possono trovarsi vicini sulla stessa tessera. In quel momento il
luogo non aiuta e la distinzione è affidata **solo a sagoma e icona**: è quindi quello il
caso da verificare nel prototipo (1.6, punto 6), più dell'accostamento statico.

*Spessore (P1)*: tutti i segnalini sul tavolo hanno lo spessore di un cartone reale;
pericolo e danno stanno allo stesso livello gerarchico, sopra la strada e sotto le auto.
Per il danno questo vale solo durante pescata e rivelazione: nel pannello a schermo il
segnalino è una faccia piatta che conserva la sua sagoma strappata, senza spessore né
ombra di scena (7.1).

*Alternativa scartata*: uniformare tutti i segnalini a un'unica forma con bordo colorato;
più pulito in digitale, ma butta via la distinzione per forma che il gioco già fornisce e
indebolisce la leggibilità per i daltonici.

### 3.4 Auto: sagome per taglia, orientamento per stato

- **Fatti dal regolamento**: ogni banda ha tre auto (piccola, media, grande); ogni auto
  occupa una casella; un'auto **inoperabile si gira all'indietro** sulla tessera e il suo
  cruscotto si capovolge (p. 6). Modelli e miniature **non sono forniti** (1.6).
- **Requisito valido per qualsiasi fonte**: piccola, media e grande si distinguono **per
  sagoma vista dall'alto, non solo per scala**. *Prova*: le tre sagome riempite di nero e
  normalizzate alla stessa altezza restano distinguibili a 1024×768 con la camera reale.
- **Orientamento come informazione**: la sagoma ha un fronte e un retro inequivocabili
  (muso, parabrezza o volume asimmetrico), perché il verso dell'auto comunica lo stato
  operabile/inoperabile e la direzione dell'arco frontale.
- **Sagome segnaposto** (**decisione D3 dell'utente: tre archetipi**), da sostituire se
  arrivano modelli ufficiali:
  - *Piccola*: corta e tondeggiante, rapporto lunghezza/larghezza ~1,5:1, spigoli
    arrotondati.
  - *Media*: berlina, ~2:1, profilo bilanciato.
  - *Grande*: ~2,4:1, squadrata, con un volume rialzato (cassone, abitacolo alto) che
    proietta un'ombra più lunga.
  - Le tre crescono anche in **altezza** (P1: l'auto più grande ha l'ombra più netta).
  - *Alternativa scartata*: stessa sagoma in scala diversa più etichetta numerica;
    fallisce la prova delle sagome normalizzate e dipende da testo piccolo.
- **Colore di squadra** (4.3): la sagoma porta la taglia, colore ed emblema portano la
  squadra; nessuna delle due informazioni dipende dall'altra.

### 3.5 Wreck

- **Fatti dal regolamento** (p. 7): i wreck sono figure di auto bruciate (4 nella scatola),
  trattate come auto piccole inoperabili: si speronano, si possono colpire, sono eliminati
  da qualunque danno o se finiscono un turno sulla casella di un elicottero.
- **Regola di forma**: sagoma di **auto piccola** (stessa taglia, coerente con la regola),
  ma riconoscibile come **relitto** per materia e profilo: carrozzeria annerita e
  deformata, nessun colore di squadra, nessun emblema. *Prova*: un wreck accanto a
  un'auto piccola inoperabile di qualunque squadra si distingue a 1024×768 senza colore.

### 3.6 Elicottero

- Citato sulla plancia comandi (Airstrike). Modello non fornito.
- **Regola di forma**: è l'**unico oggetto sollevato dal tavolo**: ombra staccata e
  spostata (P1: altezza = informazione). La sagoma dominante è il **disco del rotore**, un
  cerchio, che lo distingue da tutto ciò che sta a terra.
- Il cerchio come oggetto di scena è riservato all'elicottero (il mirino circolare del
  cruscotto è un'icona stampata, non un oggetto: nessun conflitto).
- *Alternativa scartata*: elicottero appoggiato sulla casella come segnalino piatto;
  perde l'informazione "vola, è fuori dall'ordine normale".

### 3.7 Dadi

- **Fatti dal regolamento**: 4 dadi movimento per banda (nel colore della banda) e 5 dadi
  FX: **strada**, **stunt**, **sparo**, **slam**, **direzione**. Le icone dei danni
  mostrano il dado **direzione in viola** (con chevron: Shrapnel) e il dado **stunt in
  lime** (con barre a gradini: Dazed, Blast Off). Facce complete, colori degli altri dadi
  e materiale **non sono forniti** (1.6).
- **Regole di forma**:
  1. I dadi sono gli **unici cubi** della scena e della UI: nessun pulsante o pannello è
     cubico o isometrico.
  2. Spigoli arrotondati quanto basta a rotolare in modo credibile, non da sembrare
     caramelle; la faccia superiore resta leggibile dall'angolo di camera.
  3. Dopo l'arresto il risultato si **duplica come fatto** nella UI, con una miniatura
     della faccia nella sua forma (P2): la UI non dipende dalla lettura della faccia 3D
     inclinata.
  4. Il dado direzione si allinea ai chevron del tabellone (regolamento p. 10): la sua
     faccia è leggibile **come direzione rispetto alla griglia**, non solo come simbolo.
- *Gerarchia*: in risoluzione il dado che rotola è forma eroe (3.9). Fuori dalla
  risoluzione i dadi FX restano a riposo sul tavolo, in una zona fissa della cornice fuori
  dalla griglia (il dado strada accanto al lato del primo giocatore, 2.4 stato 5); i dadi
  movimento, una volta tirati, non stanno più sul tavolo ma nel pannello della banda, come
  facce.
- *Ciclo di vita*:
  - **Dadi movimento**: all'inizio di ogni round tutti i giocatori tirano i loro quattro
    dadi movimento (regolamento p. 8, *Start of Round*; nel primo round si usa il tiro della
    preparazione). Si tirano **sul tavolo**, come oggetti 3D (P2: la faccia che si ferma è
    il valore del nucleo). Appena fermi, ogni dado passa nel pannello della banda a schermo
    come **segnalino-faccia**: la miniatura della regola 3, con lo stesso valore e lo stesso
    colore di banda. Il dado 3D lascia il tavolo. Da lì l'assegnazione avviene solo sul
    pannello: il segnalino-faccia va nella casella del cruscotto dell'auto, nel coast o in
    una casella della plancia comandi, e lì resta visibile finché le regole lo tengono in
    gioco. Sul tavolo non resta un duplicato: di ogni dado esiste una sola copia alla volta.
  - **Dadi FX** (strada, stunt, sparo, slam, direzione): vivono e rotolano **solo sul
    tavolo**; il risultato si duplica come fatto nella UI (regola 3), ma non entrano in un
    pannello.
  - Il passaggio tavolo → pannello è definito una volta sola, in 7.4.

### 3.8 Grammatica delle forme della UI

Estratta dai componenti ufficiali (cruscotto e plancia comandi):

| Forma | Origine | Significato in UI |
|---|---|---|
| **Rettangolo a spigoli smussati** (ottagono allungato) | sagoma di cruscotto e plancia | contenitore, pannello, finestra |
| **Rombo** | valori di dado sulla plancia (6, 3-5, 1-3, ANY), "+1 COAST" | valore, soglia, condizione di dado |
| **Rettangolo tratteggiato** | casella "ANY" del cruscotto | slot vuoto o disponibile, scelta possibile, comando inattivo |
| **Rettangolo pieno a filetto** | casella "END TURN" | slot occupato, scelta confermata |

Forma d'accento: il **pulsante rosso tondo** del cruscotto come "azione di conferma
primaria" — proposta da validare con l'ux-designer, che decide l'interazione.

**Forme riservate, mai decorative in UI**: chevron (strada e movimento), triangolo
(pericolo), bordo strappato (danno), cubo (dado), cerchio come oggetto di scena
(elicottero).

*Alternative considerate*: (a) UI generica moderna (pillole, card arrotondate): stona con
il tavolo e somiglia a un "motore generico" (anti-pilastro); (b) UI che ricopia le plance
alla lettera: troppo rumorosa a 1024×768; (c) **grammatica estratta, quattro forme con un
significato ciascuna: scelta**. È riproducibile anche con il set segnaposto (1.5).

### 3.9 Forme eroe e forme di supporto

| Livello | Forme | Quando sono eroe |
|---|---|---|
| Eroe | auto (ed elicottero quando è in gioco) | sempre: le più alte e le più sature |
| Eroe di stato | dado in rotolamento, segnalino che si rivela | solo in risoluzione (2.4, stato 3) |
| Supporto attivo | segnalini pericolo e danno, wreck, triangoli pericolo stampati | sempre leggibili, mai dominanti |
| Fondo | caselle, filetto, tessera | sempre, contrasto basso e uniforme |
| Cornice | tavolo, feltro, legno | mai: solo atmosfera, saltabile |

È la gerarchia di P1 ("strada sotto, pericolo e danno sopra, auto sopra ancora") tradotta
in forme.

### 3.10 Non valutabile

- Sagome reali di auto, elicottero e wreck (modelli non forniti).
- Facce dei dadi.
- Leggibilità delle sagome dei segnalini con camera inclinata: serve il prototipo.
- Le icone fuoco arancio su giallo presenti nel file delle plance: componente di
  appartenenza non identificato (le note dei file citano dadi fuoco dell'espansione
  *Carnage at Devil's Run*); non collocate nella grammatica finché non è chiarito.

## 4. Color System

Tutti gli hex sono **approssimativi, stimati a occhio** su immagini compresse o
scansionate: **da campionare dall'arte ufficiale** a piena risoluzione e in spazio
colore noto prima di usarli in codice, shader o UI.

### 4.1 Palette primaria (7 colori)

| # | Nome | Hex indicativo (da campionare) | Fonte | Significato |
|---|---|---|---|---|
| 1 | **Grigio asfalto** | ~#6F7073 | caselle strada | la strada (1 movimento, consente il bonus del dado strada); neutro di riferimento della griglia |
| 2 | **Sabbia** | ~#F2B577 | caselle fuori strada, cielo del banner | terreno fuori strada (1 movimento, niente bonus del dado strada) |
| 3 | **Bruno fango** | ~#3B2420 (casella), bordo ocra ~#E6A83A (segnalino) | caselle e segnalini fango | fango (2 movimenti) |
| 4 | **Rosso pericolo** | ~#C9282D | triangoli sulle caselle, retro dei pericoli | pericolo, minaccia sulla strada |
| 5 | **Rosso-arancio danno** | ~#D8452B (cornici), ~#E8503A (icone MINE/WRECK) | cornici dei danni, icone su blu notte | danno subito o inflitto |
| 6 | **Inchiostro** (terna) | nero ~#1A1A1C, crema ~#EFE4C6, grigio caldo ~#B8B6B3 | cruscotti, plance, titoli | struttura, informazione, testo: la "carta stampata" del gioco |
| 7 | **Turchese mina** | ~#4FA79A | icona stampata di mina sulle caselle | segnale stampato sulla strada |

**Colori funzionali secondari da proteggere**: viola del **dado direzione** ~#7A5A88 e lime
del **dado stunt** ~#9DC63E (icone dei danni); blu notte ~#1F2030 (fronti MINE e WRECK);
iridescenza dell'olio (eccezione di materiale, 1.3); arancio fuoco ~#EE5A2A su giallo
~#FFE100 (componente non identificato, 3.10).

*Alternative considerate*: (a) palette di 5 colori fondendo i due rossi: più semplice, ma
i due rossi hanno significati distinti nel gioco, scartata; (b) un colore d'accento UI "di
marca" (es. ciano): scartato in 4.4; (c) **7 colori tutti derivati dall'arte: scelta**. Il
gioco ha già la sua palette: il nostro compito è proteggerla.

### 4.2 Uso semantico: un colore, un significato

- **Rosso pericolo (4)** = "qui c'è un pericolo". Solo triangoli stampati e retro dei
  segnalini pericolo. In UI solo per riferirsi a un pericolo (tooltip, registro), sempre
  con il triangolo o la sagoma a casella.
- **Rosso-arancio danno (5)** = "danno". Solo cornici e icone dei danni. In UI solo con il
  bordo strappato o l'icona del danno.
- **Rosso del pulsante del cruscotto** (~#D33030): un terzo rosso molto vicino al 4. In UI
  **solo** con la forma del pulsante tondo, mai come colore di stato o di errore.
- **Errori e avvisi della UI** ("mossa non valida"): **mai in rosso** (nel gioco il rosso
  è pericolo o danno). Testo crema su nero con un'icona dedicata, forma decisa
  dall'ux-designer.
- **Colori di banda**: 4.3. **Selezione e mosse legali**: 4.4, mai un colore della palette
  primaria né un colore di banda.

### 4.3 Colori delle bande

**I quattro colori ufficiali del gioco base** (indicati dall'utente): **bianco**,
**arancione**, **verde scuro**, **azzurro/ciano**. Le tinte esatte vanno campionate da
fonti ufficiali (miniature o componenti a colori), non stimate.

**Come si applica il colore di banda** (**decisione D2 dell'utente: auto + UI, sempre con
emblema**):
1. **Auto ed elicottero**: carrozzeria o base. È il veicolo principale del colore.
2. **Cruscotto e plancia comandi**: un filetto o una fascia di banda, senza ricolorare
   l'arte ufficiale.
3. **UI**: etichetta del giocatore, indicatore di chi agisce (2.4, stato 9), banner di
   fine round.
4. **Emblema di banda sempre accanto al colore**: se esistono emblemi ufficiali si usano
   quelli; altrimenti un segno segnaposto per banda, di forma distinta, escluse le forme
   riservate (3.8).

**Regola universale**: ogni auto ha un **contorno di contrasto** (doppio filetto
chiaro/scuro) che la stacca da asfalto, sabbia e fango qualunque sia il colore. Il colore
di banda **non compare mai** su un segnalino pericolo o danno, né come evidenziazione.

**Conflitti noti e rinforzi obbligatori**:

| Banda | Si confonde con | Rinforzo |
|---|---|---|
| **Arancione** | rosso-arancio dei danni (5); sabbia (2) sotto luce calda | emblema sull'auto e in UI; contorno scuro sull'auto su sabbia; mai arancione di banda su elementi di danno o pericolo |
| **Azzurro/ciano** | turchese della mina (7) | la mina è un'icona stampata a punte, l'auto è un volume con emblema: distinti per forma e livello (3.9); nessun uso del ciano di banda su icone stampate |
| **Verde scuro** | asfalto (1) e fango (3) in luce bassa (2.4, stato 6) | contorno chiaro sull'auto; la luce non scende mai sotto il punto in cui il contorno si perde |
| **Bianco** | crema dell'evidenziazione (4.4) e della UI inchiostro | l'evidenziazione è un **filetto sulla casella** (tratteggiato o pieno) con alone scuro, mai un riempimento o un alone sull'auto; l'auto bianca ha sempre il contorno scuro |

### 4.4 Palette UI e dove diverge dal mondo

- **Base UI = inchiostro (6)**: pannelli neri, testo crema, superfici secondarie grigio
  caldo. È il linguaggio di cruscotto e plancia: la UI sembra parte del gioco, non un
  overlay generico.
- **Divergenza 1, selezione e mosse legali** (**decisione D1 dell'utente: crema con alone
  scuro**):
  - *Possibile/legale*: filetto crema **tratteggiato** (come la casella ANY del cruscotto).
  - *Selezionato*: filetto crema **pieno**, più spesso (come la casella END TURN).
  - Il filetto ha **sempre un alone o una doppia linea nero inchiostro**, così si legge su
    asfalto, sabbia e fango.
  - Il segnale passa per **forma e luminanza, non per tinta**: robusto al daltonismo.
  - *Scartati*: ciano elettrico (vicino al turchese mina e alla banda azzurra), giallo (si
    spegne sulla sabbia sotto luce calda), bianco puro (stona con il tavolo caldo e si
    confonde con la banda bianca).
- **Divergenza 2, archi frontali**: sovrapposizione piatta crema semitrasparente con bordo
  tratteggiato; mai rossa (il rosso è pericolo).
- **Divergenza 3, la UI non è illuminata dalla luce di scena**: non subisce intensità,
  vignettatura o contrasto di 2.1; testo e controlli restano a contrasto costante in ogni
  stato.
- **Contrasto minimo del testo**: crema su nero supera ampiamente WCAG AA; grigio caldo su
  nero va verificato per il testo piccolo.

### 4.5 Temperatura per tessera

- **Nessuna temperatura per tessera o capitolo.** La temperatura della luce è unica e
  costante (1.3, 2.1); l'arte ufficiale porta già da sé le differenze tra tessere (più
  sabbia, più fango, banner diversi), e una tinta di luce per tessera le altererebbe.
- **Unica eccezione**: gli accenti d'intensità locali degli stati (scorrimento della
  tessera, 2.4 stato 4), che cambiano la luminanza e mai la tinta.
- *Alternativa scartata*: una temperatura per capitolo per dare il senso del viaggio;
  altera i colori funzionali (P3) ed è un'interpretazione aggiunta all'arte ufficiale. Il
  senso di capitolo, se serve, lo porta il banner nella UI.

### 4.6 Sicurezza per il daltonismo

Valutazione **teorica** (comportamento noto di protanopia, deuteranopia e tritanopia sulle
tinte stimate). **Da verificare con un simulatore sugli screenshot reali del prototipo**:
nessuna simulazione è stata eseguita.

| Coppia o elemento | Rischio | Perché | Rinforzo obbligatorio |
|---|---|---|---|
| Rosso pericolo vs rosso-arancio danno | **Fallisce** (protan/deutan; difficile anche per la visione tipica sotto luce calda) | tinte vicine, luminanza simile | sagoma, posizione, icona (3.3) |
| Triangolo rosso su asfalto grigio | **A rischio** (protan) | il rosso scurisce, cala il contrasto col grigio | doppio triangolo a filetto e numeri crema (già nell'arte). Se non bastano, contorno chiaro sottile: **da approvare a parte**, tocca la resa dell'arte (1.3) |
| Turchese mina su sabbia | **A rischio** (protan/deutan, e per dimensione) | luminanza simile, icona piccola | sagoma a punte della mina (da verificare a 1024×768, 1.6); in UI icona + testo nel tooltip |
| Bruno fango vs asfalto in luce bassa | **A rischio** (tutti) | entrambi scuri | bordo sfrangiato del fango; la luce non scende sotto il punto in cui il bordo si perde |
| Olio iridescente su grigio | **A rischio** (tutti) | contrasto basso, colore inaffidabile | contorno scuro e bordo chiaro della pozza (già nell'arte), sagoma |
| Dado direzione (viola) vs dado stunt (lime) | Probabilmente **regge** | grande differenza di luminanza | simboli già diversi (chevron contro barre): da conservare |
| Arancio fuoco su giallo | **A rischio** (tritan; protan sul rosso-arancio) | tinte vicine sull'asse giallo-rosso | forma piena già leggibile; uso del componente da chiarire |
| Bande arancione / azzurra / verde scuro / bianca | **A rischio** contro danno, mina, asfalto, evidenziazione (4.3) | vedi tabella 4.3 | emblema sempre presente, contorno di contrasto, regole di 4.3 |
| Selezione e mosse legali | **Regge per costruzione** | segnale di forma e luminanza | nessuno aggiuntivo |

**Rinforzi sonori**: rivelazione di un pericolo, pescata di un danno, eliminazione di
un'auto e scorrimento della tessera richiedono **segnali sonori distinti tra loro**, come
rinforzo non visivo per le coppie che falliscono. Realizzazione: audio-director.

**Regola di progetto**: nessuna informazione di gioco è portata dal solo colore. Ogni voce
della palette semantica ha una forma, un'icona o una posizione che la identifica da sola.
*Prova*: lo screenshot di riferimento in scala di grigi resta interamente giocabile.

### 4.7 Non valutabile

- **Hex esatti**: le scansioni hanno dominanti, compressione JPEG e bilanciamento del
  bianco della carta; vanno campionati dai file sorgente in spazio colore noto.
- **Tinte esatte delle quattro bande**: da fonti ufficiali a colori.
- **Effetto della luce calda sui colori** in three.js (tone mapping, spazio colore): da
  verificare con il technical-artist nel prototipo (1.3).
- **Facce e colori dei dadi** strada, sparo, slam e movimento: input mancante.
- **Simulazione del daltonismo**: richiede screenshot del prototipo.

## 5. Character Design Direction

In questo gioco non ci sono personaggi: il ruolo lo fanno i **pezzi** (auto, elicotteri,
wreck). Questa sezione ne fissa l'identità, la distinguibilità e il dettaglio.

### 5.1 Archetipo del giocatore

- Il giocatore **è la sua banda**: tre auto (piccola, media, grande) e un elicottero,
  identificati da colore ed emblema di banda (4.3). Nessun avatar, nessun ritratto.
- *Serve*: Pilastro 1 (al tavolo non ci sono personaggi; non ne aggiungiamo).
- Le Character Boards delle espansioni (Tier 4) restano **arte ufficiale 2D** sulla
  plancia, non diventano personaggi 3D.
- *Alternativa scartata*: un pilota/capobanda illustrato per giocatore; aggiunge contenuto
  non presente nel gioco e richiede nuova illustrazione (fuori dal perimetro di 1.3).

### 5.2 Distinguere i pezzi a colpo d'occhio: un'informazione, un canale

| Informazione | Canale | Riferimento |
|---|---|---|
| Banda (propria o avversaria) | colore + emblema + contorno di contrasto | 4.3 |
| Taglia (piccola, media, grande) | sagoma vista dall'alto | 3.4 |
| Stato (operabile / inoperabile) | orientamento: l'auto inoperabile è girata all'indietro (regolamento p. 6); il suo pannello cruscotto a schermo mostra il lato inoperabile (7.4) | 3.4, 7.4 |
| Pezzo neutrale (wreck) | nessun colore di banda, materia bruciata | 3.5 |
| Elicottero | unico oggetto sollevato, disco del rotore, colore di banda | 3.6 |
| Banda di turno (hot seat) | livello UI (indicatore, banner), mai un alone sulle auto | 2.4, 4.4 |

*Test*: coprendo uno qualsiasi dei canali (es. guardando in scala di grigi, o coprendo
l'emblema), le altre informazioni restano leggibili. *Serve*: Pilastro 2.

### 5.3 Posa ed espressione: la postura dei pezzi

I pezzi sono miniature: **non hanno espressione, hanno postura**. Tutto è "mosso da una
mano sul tavolo".

- **Movimento**: il pezzo si solleva appena, scivola casella per casella lungo il
  percorso a chevron, si riappoggia. Il percorso è leggibile come sequenza di caselle
  (Pilastro 2), non come traiettoria libera.
- **Slam**: il regolamento impila il veicolo che si muove **sopra** quello già nella
  casella fino alla risoluzione (p. 9). L'impilamento è **uno stato di gioco da mostrare**,
  non solo un'animazione: il veicolo sopra resta visibilmente sopra finché dado slam e
  dado direzione non hanno deciso chi si sposta.
- **Inoperabile**: l'auto ruota di 180° sulla propria casella, senza inclinarsi né
  ribaltarsi (un'inclinazione nasconderebbe la casella).
- **Nessun danno estetico** sui modelli (fumo, fuoco, ammaccature): aggiungerebbe
  informazione che il gioco non ha (Pilastro 1). I danni si leggono sul cruscotto, dove il
  regolamento li colloca; l'unico segno sul pezzo è l'orientamento.
- *Design test*: quando un'animazione di un pezzo è ambigua, scegli quella che un
  giocatore potrebbe fare con la mano sul tavolo vero.

### 5.4 Dettaglio alla distanza di camera (LOD)

- La camera è fissa alla distanza del tavolo; un pezzo è grande **circa quanto una
  casella**.
- **Budget di dettaglio**: sagoma, blocco di colore di banda, emblema, marcatore del
  fronte (muso/parabrezza). Ciò che a 1024×768 occupa meno di ~4 px non si modella né si
  texturizza.
- **Un solo livello di dettaglio** nell'MVP (camera fissa): nessuna catena di LOD. I
  modelli finali (Tier 3) restano entro lo stesso budget di leggibilità.
- *Test*: il pezzo si legge alla dimensione di una casella **sulla casella più lontana
  dalla camera**, a 1024×768.

### 5.5 Leggibilità dei pezzi contro l'ambiente

I pezzi sono gli elementi **più alti e più saturi** della scena; la strada resta a
contrasto basso e uniforme (gerarchia 3.9). Una banda il cui colore si avvicina al fondo
(arancione su sabbia, verde scuro su asfalto o fango) è recuperata dal contorno di
contrasto (4.3), mai abbassando l'arte della strada.

## 6. Environment Design Language

L'ambiente di questo gioco è **il tavolo**. Il mondo narrativo vive solo nell'arte
ufficiale delle tessere.

### 6.1 Mondo e "architettura"

- **Il mondo** (deserto, deposito di rottami, strada senza legge, banner "Chapter") sta
  interamente nell'arte ufficiale delle tessere. **Non ne aggiungiamo**: niente scenari
  3D attorno alla strada, niente edifici, niente orizzonte (Pilastro 1; 1.3: si monta,
  non si ridisegna).
- **L'unica architettura nostra è il tavolo**: un piano di **legno caldo** con un
  **tappetino di feltro scuro** sotto la zona di gioco, neutro e a basso dettaglio. Fuori
  dal tavolo lo sfondo sfuma nel buio (la profondità di campo è ammessa solo qui, 2.1).
- *Serve*: regola 1.1 (oggetti che si potrebbero toccare) e P3 (il contorno non compete
  con il gioco).
- *Alternative considerate*: (a) diorama 3D del deserto attorno alla strada: aggiunge
  mondo non presente nel gioco, costoso, compete con la leggibilità, scartato; (b) tavolo
  da garage in metallo: coerente col tema ma freddo e riflettente, contro la luce calda e
  i materiali opachi di 1.3, scartato; (c) **legno + feltro: scelto**, è il tavolo da
  gioco riconoscibile e mette in risalto l'arte.

### 6.2 Filosofia delle texture

- **Arte ufficiale**: usata così com'è come colore della faccia superiore di tessere,
  segnalini, cruscotti e plance. Nessun filtro, nessuna ri-pittura, nessuna texture di
  dettaglio sovrapposta.
- **Materiali nostri**: **PBR opaco semplificato**: rugosità alta, nessun metallo sulle
  superfici di carta e cartone; i **bordi** di lastre e segnalini mostrano l'anima
  grigio-bruna del cartone fustellato, come nei componenti veri. Il legno del tavolo e il
  feltro hanno una grana leggera, a bassa frequenza.
- *Perché*: un PBR realistico (graffi, riflessi, polvere fotografica) stona con l'arte
  piatta da poster delle tessere; uno stile dipinto richiederebbe di ridisegnare. Il PBR
  opaco semplificato fa "sedere" l'arte sul tavolo senza cambiarla.
- *Design test*: quando un materiale è ambiguo, scegli quello che rende l'arte ufficiale
  identica a com'è stampata, sotto la luce della scena.

### 6.3 Densità degli oggetti

- **Sul tavolo c'è solo ciò che il gioco ha**: le 3 tessere in gioco, il mazzo delle
  tessere, le pile di segnalini pericolo e danno (coperte), i dadi FX, il traguardo
  quando entra in gioco, le figure dei wreck. Cruscotti e plance comandi **non** stanno
  sul tavolo: sono pannelli a schermo (7.1, decisione C1).
- **Nessun oggetto decorativo** (tazze, mappe, carte, snack) né dentro né ai margini del
  tavolo: competerebbero con la lettura (P3) e costerebbero tempo di produzione e
  rendering.
- **Disposizione**: strada al centro; pile e dadi FX in un'area fissa e prevedibile,
  sempre nello stesso posto.
- *Test*: ogni oggetto entro i bordi del tavolo è un componente del gioco.

### 6.4 Racconto ambientale

- **Lasciano traccia solo gli stati delle regole**:
  - le tessere rimosse spariscono dal tavolo (e tornano in fondo al mazzo, girate);
  - i pericoli rivelati restano visibili secondo le regole (Road e Mud trasformano la
    casella, i wreck restano come figure);
  - le pile degli scarti crescono;
  - il banner "Chapter" della tessera dice a che punto della strada si è.
- **Non si aggiungono** segni di frenata, crateri, scie di fumo o sporcizia accumulata:
  sarebbero informazione inventata (Pilastro 1) e rumore visivo (P3).
- *Test*: tutto ciò che si vede sul tavolo corrisponde a uno stato di gioco o all'arte
  ufficiale.

### 6.5 Leggibilità reciproca con i pezzi

Il tavolo (legno e feltro) e la strada stanno ai livelli "cornice" e "fondo" della
gerarchia 3.9: bassa saturazione e basso contrasto rispetto ai pezzi. Il feltro scuro
attorno alla strada fa da passe-partout: separa i bordi delle tessere (dove un'auto che
esce viene eliminata) dal resto del tavolo.

## 7. UI/HUD Visual Direction

### 7.1 Vista artistica

**Diegetico vs schermo: tavolo per la partita, schermo per la gestione.**
- Sul **tavolo 3D** stanno la strada, i pezzi, i segnalini, i dadi FX e le pile: ciò che
  al tavolo vero si vede in mezzo ai giocatori.
- A **schermo**, come pannelli piatti, stanno **cruscotti delle auto e plancia comandi**
  (**decisione C1 dell'utente: solo a schermo**), insieme a banda di turno, registro
  "esito ← causa", tooltip, conferme e menu.
- I pannelli dei cruscotti e della plancia mostrano l'**arte ufficiale** (ripulita come da
  1.4) in vista frontale, senza prospettiva, nella grammatica di forme di 3.8 e nella
  palette inchiostro di 4.4. Restano "componenti del gioco" nell'aspetto, ma sono UI
  nell'uso: leggibili e toccabili a 1024×768.
- *Alternative considerate*: (a) cruscotti come oggetti sul tavolo (massima fedeltà al
  tavolo fisico, ma rombi, pallini e testo delle scansioni illeggibili e non toccabili in
  prospettiva a 1024×768); (b) entrambi, sul tavolo e duplicati a schermo (ridondante).
  Scelta dell'utente: solo a schermo.

**Tipografia**
- *Display* (banner, titoli, vittoria): registro "locandina" dell'arte ufficiale:
  grottesco **condensato pesante**, crema con ombra rossa. Il carattere ufficiale non è
  noto né fornito: si usa **League Gothic** (licenza SIL OFL; **decisione dell'utente**),
  revival di un gothic condensato da manifesto, coerente con il riferimento 3 (9.5). Vale
  anche per il set segnaposto (1.5).
- *Testo* (registro, tooltip, menu): sans umanista ad alta leggibilità, peso regolare e
  semibold.
- *Scala a 1024×768*: display 32-48 px; intestazioni 20-24 px; testo 16 px; **minimo
  assoluto 14 px** (etichette secondarie). Ai risoluzioni maggiori la scala cresce, mai
  sotto questi valori.
- Maiuscolo condensato solo per display e etichette brevi; il testo corrente è in
  maiuscolo/minuscolo.

**Iconografia**
- Icone **al tratto a spessore unico**, derivate dallo stile delle icone MINE/WRECK dei
  segnalini: crema su nero inchiostro nella UI.
- Le forme riservate (3.8) valgono anche per le icone: chevron solo per direzione e
  movimento, triangolo solo per pericolo, bordo strappato solo per danno.
- Ogni icona di stato ha un'etichetta testuale disponibile (tooltip o registro).

**Animazione della UI**
- Secca e meccanica, come lo scatto della manopola del cruscotto: **120-200 ms**, curve
  di accelerazione decise, **niente rimbalzi o elastici**.
- Tutte le animazioni UI rispettano "Atmosfera minima" (2.1) e il budget del turno
  (Pilastro 3).

*Design test della sezione*: quando un elemento di UI è ambiguo, scegli la forma che
somiglia a un componente stampato del gioco ma si legge come un'interfaccia.

### 7.2 Vista UX

- **Adattamento alle interazioni**: l'interazione principale è **assegnare un dado a
  un'auto** (o al coast, o a un comando): con i cruscotti a schermo (C1) avviene su
  pannelli piatti, leggibili e toccabili. Il secondo gesto è **scegliere la casella di
  destinazione** sul tavolo 3D: vedi conflitto C2.
- **Leggibilità per stato**: in pianificazione l'informazione più evidente è ciò che
  serve a decidere (archi frontali, costi del terreno, dadi disponibili, comando usato o
  libero); in risoluzione è **la causa dell'evento in corso** (registro e focus, 2.4).
- **Accessibilità minima**:
  - testo mai sotto 14 px a 1024×768;
  - nessuna informazione affidata al solo colore (4.6);
  - nessun lampeggio (l'indicatore dell'attesa online è lento, 2.4 stato 9);
  - la UI scala da 1024×768 ai monitor grandi;
  - **requisito da decidere in `/ux-design`**: uso completo con la sola tastiera su
    desktop (la piattaforma ha tastiera; niente gamepad).
- **Feedback**: il giocatore sa sempre cosa è successo e perché: ogni evento di
  risoluzione ha una voce "esito ← causa" nel registro (Pilastro 2).

### 7.3 Conflitti tra vista artistica e UX, e decisioni

| # | Conflitto | Posizione arte | Posizione UX | Decisione |
|---|---|---|---|---|
| C1 | Cruscotti e plancia comandi | oggetti sul tavolo fisico (1.1) | a 1024×768 in prospettiva non sono leggibili né toccabili | **Utente: solo a schermo** (7.1) |
| C2 | Caselle di ~35×32 px (stima: 3 tessere da 6 corsie × ~8 caselle a 1024×768), meno sul lato lontano | inquadratura fissa con le 3 tessere sempre visibili (1.3) | sotto il bersaglio touch di riferimento di 44×44 px: il tocco preciso sulla casella non è affidabile su tablet | **Utente: aperto, lo decide `/ux-design`** con il prototipo (opzioni emerse: vista intera con aiuti all'input — prima l'auto, poi solo le caselle legali con aree di tocco allargate e conferma —, oppure un preset di camera ravvicinato durante il movimento) |

### 7.4 Allineamento delle sezioni precedenti

La decisione C1 porta cruscotti e plancia comandi fuori dal tavolo. Dove le sezioni
precedenti li descrivono come oggetti (2.4 stati 6 e 8; 5.2; 6.3), si leggono come
**pannelli UI**: "il cruscotto si chiude" = il pannello della banda si chiude o si
oscura; "cruscotto capovolto" = il pannello dell'auto mostra il lato inoperabile.

**Passaggi tavolo → pannello (definizione unica).** Due componenti attraversano il confine
tra tavolo e schermo; le sezioni che li citano (1.3, 3.3, 3.7) rimandano qui.
1. **Dado movimento**: tiro sul tavolo a inizio round (2.4 stato 3, P2) → all'arresto il
   dado 3D si rimpicciolisce nel punto in cui si è fermato, mentre il suo segnalino-faccia
   compie un breve tragitto da quel punto, proiettato sullo schermo, fino all'area dei dadi
   disponibili del pannello di banda → l'assegnazione avviene sul pannello (2.4 stato 2).
   Il tragitto è continuo: l'occhio segue un solo oggetto, non ne vede sparire uno e
   comparire un altro.
2. **Segnalino danno**: pescata dalla pila coperta sul tavolo → ribaltamento e risoluzione
   sul tavolo accanto all'auto colpita (evento di tavolo, eroe di stato in 3.9) → il
   segnalino si richiude coperto e compie lo stesso tipo di tragitto fino a una casella
   danno del cruscotto di quell'auto nel pannello, dove si vede dal retro (nero con icona
   freno), come nel gioco fisico. La voce "esito ← causa" del registro (7.2) conserva
   sempre quale danno è uscito e perché.

*Regole comuni*: il tragitto segue la scala delle animazioni UI (7.1) ed è saltabile (P3);
saltato o no, lo stato finale è identico. Dall'arrivo il componente esiste in un solo
luogo. Dove arriva il tragitto se il pannello di destinazione è chiuso o compresso lo
decide l'ux-designer in `/ux-design`.

*Domanda aperta (game-designer)*: un segnalino danno già posato coperto si può consultare
anche nella sua faccia dal pannello, per esempio con un tooltip? È una questione di regole
(informazione coperta o pubblica), non d'arte. Finché non è decisa, il pannello mostra il
retro e il registro resta la fonte consultabile.

## 8. Asset Standards

### 8.1 Vista artistica

**Formati**
- **Master**: PNG senza perdita in `assets/licensed/` (fuori da git, mai in un repository
  pubblico).
- **Runtime**: formati decodificati dal browser: PNG (pezzi con trasparenza), JPEG o WebP
  per facce opache. *[giudizio: decodifica del browser, non API three.js]*
- **Modelli 3D**: glTF binario (`.glb`), solo per auto, elicotteri e wreck finali (Tier 3).
  *[non verificato nel riferimento pinnato: il caricatore glTF non è coperto da
  `docs/engine-reference/web/`; da verificare prima dell'adozione]*
- **Geometria procedurale**: tessere, segnalini e dadi sono lastre e cubi generati in codice
  (estrusione del contorno). Nell'MVP quasi nessun file 3D.

**Convenzione dei nomi**: `[categoria]_[nome]_[variante]_[dimensione].[ext]`, kebab-case
dentro i segmenti, coerente con i nomi file del progetto.
- `tile_1a-parking-lot_front_2048.png`
- `hazard_mine_front_512.png`, `hazard_back_512.png`
- `damage_shrapnel_front_512.png`
- `panel_dash-medium-avenger_operable_1024.png`, `panel_command-board_1024.png`
- `die_direction_atlas_1024.png`
- `car_large_white.glb`
- L'**id nel manifest** è il nome senza la dimensione (es. `hazard_mine_front`): il codice
  chiede l'id, il manifest sceglie il livello di risoluzione.

**Livelli di risoluzione**

| Categoria | Desktop | Tablet | Note |
|---|---|---|---|
| Facce delle tessere strada (e traguardo) | 2048 px lato lungo | **1024 px** | **decisione dell'utente**, vedi 8.3 |
| Segnalini pericolo e danno (fronte e retro) | 512 | 512 | in atlante |
| Pannelli cruscotto e plancia comandi (UI, 7.1) | 1024 | 1024 | vista frontale, nessuna prospettiva |
| Facce dei dadi | 256 per faccia (atlante 1024) | 256 | |
| Texture del tavolo (legno, feltro) | 1024 ripetibile | 512 ripetibile | bassa frequenza (6.2) |
| Set segnaposto | stesse misure | stesse misure | 1.5 |

**LOD**: un solo livello (5.4).

**Export**
- Colore in **sRGB** per le texture di colore.
- Alfa **dritta** (non premoltiplicata) per i pezzi ritagliati.
- **Pulizia delle scansioni** secondo 1.4: ritaglio con maschera, raddrizzamento,
  orientamento corretto, nessuna ombra o fondo carta.
- **Pipeline ripetibile** (rischio R4 del concept): il manifest registra sorgente, pagina,
  coordinate di ritaglio, dimensione e id; gli export si rigenerano dal manifest, mai a
  mano.

**Rifacimenti vettoriali delle scansioni** (**decisione dell'utente**): i pezzi scansionati
(segnalini pericolo e danno, cruscotti, plancia comandi) si **rifanno in vettoriale**:
**stesso disegno, nuova esecuzione pulita**.
- È un'eccezione esplicita al perimetro "nessuna ri-illustrazione" di 1.3: vale **solo per
  i pezzi scansionati** e **con approvazione dell'utente asset per asset**.
- Il rifacimento non cambia disegno, testi, icone, proporzioni né colori (campionati
  dall'arte ufficiale, 4.7): *test*: affiancato alla scansione, il rifacimento è lo stesso
  pezzo, solo più nitido.
- I rifacimenti derivano dall'arte ufficiale: **restano materiale licenziato**, stanno in
  `assets/licensed/` e non entrano mai nel repository pubblico (diversamente dal set
  segnaposto di 1.5, che è nostro e aperto).

### 8.2 Vista tecnica

Input: `project.yaml` (engine Web, three.js 0.186.1) e `.claude/docs/technical-preferences.md`
(60 fps, 16,6 ms per frame, 500 draw call per frame come default da misurare, memoria
**[TO BE CONFIGURED]**); riferimento `docs/engine-reference/web/threejs.md`.

- **Draw call** (budget 500/frame, default da misurare): la scena conta circa 60 oggetti
  (3 tessere, fino a 26 segnalini pericolo, 12 auto, 4 elicotteri, 4 wreck, dadi, pile).
  Ampiamente sotto budget; **instancing** per i segnalini, che condividono la geometria.
- **Memoria texture: nessun budget fissato nel progetto.** Stima non compressa, RGBA con
  mipmap (~×1,33):
  - una faccia di tessera 2048×~1560 ≈ 17 MB; 3 tessere in gioco + la successiva
    precaricata ≈ 68 MB;
  - atlante dei segnalini 2048² ≈ 21 MB;
  - totale scena desktop **≈ 90-100 MB**; con le tessere a 1024 sui tablet, la quota delle
    tessere scende a circa un quarto (≈ 17 MB).
  - La **compressione GPU (KTX2/Basis)** **non è verificabile** nel riferimento pinnato:
    da valutare prima di adottarla.
- **Ombre**: una sola luce che proietta ombre; tipo **`PCFShadowMap`** (r186:
  `PCFSoftShadowMap` è rimosso su `WebGLRenderer` e `PCFShadowMap` è ora morbido —
  *[sorgente: threejs.md]*). Dimensione della shadow map da tarare nel prototipo.
- **Materiali e slot**: lastre di tessera 2 slot (arte superiore, bordo di cartone);
  segnalini 3 (fronte, retro, bordo); dadi 1 (atlante); auto segnaposto 1-2. Da r181 i
  materiali PBR rugosi risultano leggermente più chiari *[sorgente: threejs.md]*: incide
  sulla fedeltà dei colori di 1.3, da controllare nel prototipo.
- **Poligoni: nessun budget fissato nel progetto.** Ordine di grandezza atteso *[giudizio]*:
  lastre e segnalini poche centinaia di triangoli; auto segnaposto sotto i 2.000; modelli
  finali (Tier 3) da fissare con un budget prima della produzione.
- **VFX e overdraw**: nessun sistema di particelle nell'MVP; la vignettatura (2.1) è un
  overlay unico a schermo intero, costo trascurabile.
- **Risoluzione di rendering**: `devicePixelRatio` limitato a circa 2; rendering solo
  quando qualcosa cambia (scena per lo più ferma).
- **Caricamento**: l'arte licenziata si carica **a runtime tramite manifest**, mai con
  import statici da `assets/licensed/` (finirebbe nel bundle). Da formalizzare nell'ADR sul
  caricamento degli asset.

### 8.3 Conflitti e decisioni

| # | Conflitto | Standard ideale | Standard vincolato | Decisione |
|---|---|---|---|---|
| K1 | Memoria texture su tablet senza budget e senza compressione verificata | tessere 2048 su ogni dispositivo (massima nitidezza) | tessere 1024 sui tablet (circa ¼ della memoria per le tessere, un po' meno nitide) | **Utente: 2048 desktop, 1024 tablet**. Da confermare con la misura su tablet reale nel prototipo M0 |
| K2 | Scansioni di bassa qualità contro il perimetro "nessuna ri-illustrazione" (1.3, 1.4) | pezzi nitidi | solo pulizia delle scansioni esistenti | **Utente: rifacimento vettoriale**, stesso disegno, approvazione asset per asset (8.1) |

### 8.4 Non valutabile / da fissare

- Budget di memoria texture e di poligoni: **non fissati** nel progetto; da impostare con
  `/project-settings` dopo la misura sul tablet di riferimento.
- Compressione GPU e caricatore glTF: non coperti dal riferimento pinnato.
- Profilo "tablet": come il gioco riconosce un tablet (risoluzione, input, memoria) è una
  decisione tecnica da prendere nell'architettura, non qui.

## 9. Reference Direction

### 9.1 Principio: un solo stile, molte tecniche

L'utente ha fissato che **l'unico riferimento visivo è l'arte ufficiale di Thunder Road:
Vendetta**. Quindi:

- **Il riferimento #0 è l'autorità.** Gli altri non sono riferimenti di stile ma **fonti di
  una tecnica di presentazione ciascuno** (come si illumina un tavolo, come si mostra un
  dado che arriva a un risultato già noto, come si compone un titolo, come una forma porta
  un significato).
- **Da ciascuno si prende un solo elemento, nominato**: mai "l'atmosfera generale".
- **Nessun riferimento introduce un tratto, una pittura, un'illustrazione o un mondo
  nuovi.** Se applicarlo richiede di disegnare qualcosa che non c'è nell'arte ufficiale,
  l'applicazione è sbagliata (1.3, 6.1).
- **Ordine di arbitraggio**: arte ufficiale (#0) → regola visiva 1.1 (vince la
  leggibilità) → riferimenti 1-4. Un riferimento che contraddice #0 o 1.1 perde.
- **Ogni riferimento punta in una direzione diversa** (9.7).

### 9.2 Riferimento #0 — L'arte ufficiale di Thunder Road: Vendetta (autorità)

- **Fonte**: tessere strada, segnalini pericolo e danno, cruscotti, plancia comandi, banner
  "Chapter", icone stampate, colori delle bande (`assets/licensed/`, `reference/rulebook/`).
- **Decide senza appello**: palette (4.1, campionata qui, 4.7); forme (3.1, 3.8); registro
  tipografico display (7.1); stile delle icone (7.1); il mondo (6.1).
- **Uso**: si **monta**, non si interpreta (1.3). Unica rielaborazione: il rifacimento
  vettoriale dei pezzi scansionati, stesso disegno, approvato asset per asset (8.1).
- **Perché è #0**: il progetto è un porting fedele (Pilastro 1); una seconda fonte di stile
  di pari grado produrrebbe un gioco "ispirato a" e non il gioco.
- **Prova di subordinazione** (vale per tutti i riferimenti seguenti): si toglie
  mentalmente il riferimento dal risultato; se resta qualcosa che non appartiene all'arte
  ufficiale (un colore, un tratto, un ornamento), il riferimento è stato copiato invece che
  usato.

### 9.3 Riferimento 1 — Fotografia still-life di prodotto: sorgente morbida singola e rimbalzo

**Direzione**: luce e materia del tavolo (1.3, 2.1, 6.2). Tocca la scena 3D, mai la UI.

**Si prende**: lo **schema a una sorgente**. Una luce principale ampia e diffusa, alta e
laterale (indicativamente 35-50° sopra il piano, di tre quarti rispetto alla camera) e un
rimbalzo chiaro sul lato opposto al posto di una seconda luce: il lato in ombra conserva il
dettaglio, le ombre restano brevi e morbide. La luce radente "accende" il **bordo del
cartone fustellato**: lo spessore si legge per il gradino di luminanza tra faccia e bordo,
non per un contorno disegnato (P1). Regola compositiva: **un'ombra sola, nella stessa
direzione per tutti gli oggetti** (contro la doppia ombra delle scansioni, 1.4).
In three.js: la sorgente morbida è la luce principale con ombra, il rimbalzo è la luce di
riempimento senza ombra.

*Perché*: è il mestiere che risolve lo stesso problema nostro, far sembrare vero un
oggetto stampato **senza alterarne i colori di stampa**.

**Si evita**: profondità di campo sul piano di gioco (2.1); oggetti di scena (6.3);
inquadrature eroiche strette, dal basso o di sbieco (la camera è fissa, 1.3: si prende la
luce, non l'inquadratura); lucidità da plastificazione (1.3, eccetto l'olio); bilanciamento
del bianco "moody".

**Subordinazione a #0**: la fotografia decide *come cade la luce*, mai *che colore ha
l'oggetto*; se la luce fa perdere contrasto alla palette, si corregge la luce.

*Incertezza*: nessun fotografo o catalogo specifico è citato (attribuzione non sicura): il
riferimento è il genere tecnico. Se esistono foto ufficiali dei componenti di TR:V,
diventano il campione preferito di questo riferimento.

### 9.4 Riferimento 2 — *Baldur's Gate 3* (Larian Studios): la sequenza del tiro di dado

**Direzione**: tempo e causalità del dado (P2, Pilastro 2, 3.7). Tocca la UI, mai la luce.

**Si prende**: la **struttura del tiro in tre battute**: (1) prima del lancio si vede
**contro cosa** si tira (la soglia); (2) il dado rotola e si ferma; (3) il risultato
compare **scomposto nelle sue cause** (valore, modificatori, confronto, esito). Per noi:
prima del tiro la UI mostra la condizione (il rombo di soglia, 3.8); il dado 3D si ferma
sulla faccia già decisa dallo stato (P2); subito accanto, nella UI inchiostro, la
miniatura della faccia e la riga "esito ← causa" (7.2; contenuto a cura di game-designer e
ux-designer).

**Si evita**: dado in primo piano a schermo (da noi rotola **sul tavolo**, con la stessa
luce di tutto il resto; a schermo va solo la scomposizione); ornamento fantasy (cornici
dorate, rune, bagliori, particelle); suspense allungata (rallentamenti, quasi-cadute: contro
P2 e Pilastro 3); il layout a soglia unica (da noi un evento può avere più dadi in catena:
si prende "una causa per riga").

**Subordinazione a #0**: facce, colori e simboli dei dadi vengono da arte e regolamento
ufficiali; il riferimento detta solo **l'ordine in cui si mostrano le informazioni**.

**Clausola di verifica** (**decisione dell'utente: si tiene con verifica**): la sequenza è
descritta a memoria. Prima di usarla come modello vincolante, l'ux-designer la verifica di
persona (o su video). Se l'osservazione la smentisce, resta comunque valido il principio
delle tre battute come regola nostra.

### 9.5 Riferimento 3 — Manifesti tipografici in caratteri di legno (es. Hatch Show Print, Nashville)

**Direzione**: composizione del testo display, registro "locandina" (2.4 stati 1 e 7; 7.1).

**Si prende**: le **regole compositive**, non l'aspetto: un solo elemento dominante per
composizione (es. "VITTORIA" o il nome della banda); gerarchia fatta solo di corpo e peso,
dentro un'unica famiglia condensata; righe giustificate a blocco sulla larghezza del
banner, interlinea stretta, poco vuoto interno; pochi inchiostri piatti (al massimo 2-3:
la terna inchiostro più il rosso dell'ombra del titolo ufficiale).

*Perché*: il grottesco condensato pesante dell'arte ufficiale appartiene, a giudizio
formale, alla famiglia dei gothic condensati nati come caratteri da manifesto; questa
tradizione insegna a comporlo perché si legga a colpo d'occhio (1.1 applicata al testo).

**Si evita**: texture di stampa sul testo UI (grana, inchiostro irregolare, registro
sfalsato); illustrazioni xilografiche, motivi western o country, stelle e cornici; più
caratteri accostati (una famiglia condensata per il display, una sans umanista per il
testo, 7.1); testo corrente in maiuscolo.

**Subordinazione a #0**: carattere, colore (crema con ombra rossa) e terminazione a punta
vengono dal banner "Chapter" ufficiale; il riferimento decide solo impaginazione e
gerarchia dei titoli che l'arte ufficiale non contiene (menu, vittoria, fine round).
*Prova*: accanto al banner "Chapter" ufficiale, il nostro titolo sembra della stessa mano.

*Incertezza*: il carattere ufficiale non è noto (7.1); la parentela con i gothic in legno
è un giudizio formale. Hatch Show Print è citata come esempio noto della tradizione, senza
alcun legame affermato con Restoration Games.

### 9.6 Riferimento 4 — Segnaletica stradale britannica di Jock Kinneir e Margaret Calvert (anni '60)

**Direzione**: semantica delle forme e leggibilità a colpo d'occhio (3.1, 3.8, 4.2, 4.6).

**Si prende**: il **metodo** di un sistema in cui la forma esterna dice la categoria del
messaggio prima del contenuto:
1. **una forma, una categoria, senza eccezioni decorative**: conferma e rende difendibile
   l'elenco delle forme riservate (3.8);
2. **prima la forma, poi il pittogramma, poi il testo**: per noi sagoma del segnalino →
   icona → tooltip; è la difesa dei due rossi (3.3, 4.6) organizzata come gerarchia;
3. **la prova di leggibilità alla distanza reale**, non alla scrivania: per noi a 1024×768
   sulla casella più lontana dalla camera (5.4), con un'occhiata breve.

*Perché*: risolve lo stesso problema di 1.1 in un contesto più severo; il triangolo come
avvertimento coincide con il triangolo pericolo dell'arte ufficiale, quindi il metodo non
importa una convenzione estranea.

**Si evita**: la loro tabella delle forme (il loro cerchio = "ordine"; il nostro cerchio
come oggetto è riservato all'elicottero, 3.6): si prende il principio, non le
assegnazioni; i colori della segnaletica (blu, verdi: si scontrerebbero con le bande,
4.3); il motivo "cartello stradale" nella UI e il carattere Transport; pittogrammi
ridisegnati nel loro stile (le icone seguono MINE/WRECK, 7.1).

**Subordinazione a #0**: il riferimento fornisce un **metodo di verifica**, non un elemento
visibile. Se uno screenshot ricorda "la segnaletica inglese", è stato copiato.

*Incertezza*: il sistema è descritto per come è noto nella storia del graphic design; la
regola 3 è nostra, ispirata al loro scopo, non una ricostruzione del loro metodo di prova.

### 9.7 Matrice: una direzione per riferimento

| # | Fonte | Leva | Si prende | Non si prende mai |
|---|---|---|---|---|
| 0 | Arte ufficiale TR:V | tutto ciò che si vede | palette, forme, tipo display, icone, mondo | (autorità: si monta, non si interpreta) |
| 1 | Still-life di prodotto, sorgente morbida + rimbalzo | luce e materia | schema a una luce, ombra unica, bordo del cartone acceso dalla luce radente | profondità di campo, oggetti di scena, inquadrature eroiche, lucidità |
| 2 | *Baldur's Gate 3*, sequenza del tiro | tempo e causalità del dado | soglia prima, dado, risultato scomposto in cause | dado a schermo, ornamento fantasy, suspense allungata |
| 3 | Manifesti in caratteri di legno | composizione del testo display | un elemento dominante, gerarchia di corpo e peso, blocco giustificato, pochi inchiostri | texture di stampa, xilografie, motivi western, caratteri misti |
| 4 | Segnaletica Kinneir/Calvert | semantica delle forme, prova di leggibilità | forma = categoria, ordine forma → icona → testo, prova alla distanza reale | loro assegnazioni, loro colori, motivo cartello, Transport |

Nessuna riga condivide la leva di un'altra: l'1 tocca la scena 3D e mai la UI; il 2, il 3 e
il 4 la UI e mai la luce; il 2 governa il *tempo*, il 3 il *testo*, il 4 la *forma*.

### 9.8 Anti-riferimenti dichiarati

Il tema (strada, auto armate, deserto) richiama fonti che **non** vanno usate, nemmeno come
tecnica:
- **Cinema post-apocalittico automobilistico** (la serie *Mad Max* in testa): colore
  virato, polvere volumetrica, fuoco e fumo. Contraddice 2.1, 5.3 e 6.4.
- **Altri giochi da tavolo illustrati sullo stesso tema**: porterebbero un secondo stile
  illustrativo accanto a #0.
- **Diorami e fotografia tilt-shift "in miniatura"**: si basano sulla profondità di campo,
  vietata sul piano di gioco (2.1).

### 9.9 Prove della sezione

- **Prova del nome**: si deve poter dire in una frase *quale* regola del riferimento si sta
  applicando ("un'ombra sola nella stessa direzione", "un elemento dominante per banner").
  Se si riesce solo a dire "sembra X", è una copia.
- **Prova della rimozione** (9.2): tolto il riferimento, ogni colore, tratto o ornamento
  estraneo all'arte ufficiale si toglie.

### 9.10 Non valutabile

- **Foto ufficiali dei componenti TR:V**: non viste; se esistono sostituiscono il genere
  generico del riferimento 1.
- **Sequenza del tiro in *Baldur's Gate 3***: da verificare (9.4).
- **Carattere display ufficiale**: ignoto (7.1).
- **Riferimento per i segnalini 3D con spessore** (**decisione dell'utente: nessuno**):
  bastano la luce del riferimento 1 e l'arte #0; la resa si verifica sui render del
  prototipo M0.
- **Efficacia reale delle tecniche** con camera, luce e arte del prototipo: si verifica
  solo sugli screenshot di M0.
