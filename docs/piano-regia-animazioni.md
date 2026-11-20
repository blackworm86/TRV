# Piano: regia e animazioni

Richiesta dell'utente (2026-11-20): "Animazione e Regia: scrivi un piano per migliorare inquadrature,
animazioni ecc". Costruisce sul director attuale ([camera-director.md](../design/gdd/camera-director.md))
e sui veicoli a pezzi ([piano-integrazione-veicoli.md](piano-integrazione-veicoli.md)). Solo
presentazione: le regole non cambiano.

## Dove siamo (2026-11-20)

- **Regia.** Una ripresa per scena, scelta col voto tra le candidate di `director.shots`. Stacchi solo tra
  le scene. Elicotteri nascosti se coprono. Il verme ha una ripresa sua. Il replay istantaneo usa
  ancora le sue inquadrature.
- **Ritmo.** Velocità normale riportata a 1 (era 0.6), attesa massima del tavolo fermo 4 s. Nei test
  Playwright la velocità è "veloce", salvo i test che guardano le animazioni.
- **Veicoli.** Auto S, M, L e Big Rig montati dai pezzi: ruote che sterzano, sospensioni, torretta che
  ruota, canna che si alza, bossoli espulsi. Il Big Rig si muove a treno.
- **Effetti.** Raffiche con traccianti, bagliore, fumo e bossoli. Detriti, scintille, polvere, relitti a
  pezzi, caduta nel pit, fiamme.

## Problemi visti

1. La camera è ferma dentro la scena. Manca il movimento che accompagna l'azione: carrellata sulla guida,
   avvicinamento sull'impatto.
2. Gli stacchi sono secchi o con la stessa dissolvenza per tutto. Non c'è una grammatica: quando tagliare,
   quando seguire, quando allargare.
3. Rocce e veicoli che coprono vengono evitati cambiando candidata, mai sfumati: a volte vince una ripresa
   brutta.
4. Le animazioni dei veicoli sono generiche. Uno slam, una spinta e un salto hanno lo stesso "peso" su
   un'auto piccola e su una grande.
5. Non c'è anticipazione: l'azione parte senza un attimo di preparazione (frenata prima dello slam,
   compressione prima del salto).
6. L'equipaggio non c'è: i veicoli si muovono da soli.
7. Il replay istantaneo non passa dal director.

## Principi

- **Leggibilità prima dello spettacolo.** Ogni ripresa deve far capire la regola appena applicata: chi,
  dove, con che risultato.
- **Breve.** Ogni miglioramento non deve allungare il turno; la velocità "veloce" deve restare veloce.
- **Dati, non codice.** Tempi, angoli e pesi vanno in `presentation_base.json`.
- **Provato sul banco prima che in gioco.** Ogni scena ha una registrazione di prova giudicata
  dall'utente.

## Fasi

Ogni fase si chiude con una registrazione o uno screenshot, che l'utente giudica.

### R1 — Grammatica degli stacchi

- Tre modi di passare da una scena alla successiva:
  - **taglio** se il soggetto cambia;
  - **raccordo** (la camera scorre) se il nuovo soggetto è vicino;
  - **allargo** se la scena riguarda più veicoli.
- Una tabella in `director.transitions`: per ogni coppia di tipi di scena, quale modo usare.
- Una ripresa che segue un'altra dello stesso tipo cambia lato o altezza, per non sembrare ferma.

### R2 — Camera viva dentro la scena

- **Guida:** carrellata laterale che accompagna il veicolo e lo anticipa di mezzo spazio.
- **Sparo:** sopra la spalla di chi spara, poi spostamento verso il bersaglio quando arrivano i colpi.
- **Slam:** breve avvicinamento all'impatto, con un piccolo scossone della camera (spegnibile con
  "effetti").
- **Salto:** dal basso al decollo, poi la camera segue la parabola.
- **Eliminazione:** giro lento attorno al relitto (come l'incendio oggi).
- Ogni movimento è descritto come un percorso della camera (inizio, fine, curva) nelle candidate di
  `director.shots`. Si ricalcola sui soggetti a ogni fotogramma, come oggi.

### R3 — Ostacoli sfumati

- Rocce, veicoli ed elicotteri tra camera e soggetto diventano semitrasparenti finché dura la ripresa.
- Il voto smette di penalizzare un ostacolo che si può sfumare: vincono le riprese "d'autore".

### R4 — Peso e anticipazione dei veicoli

- **Massa per taglia** (S, M, L, Big Rig) nei dati del movimento. Determina:
  - quanto il veicolo rolla e beccheggia;
  - quanto va lontano in una spinta;
  - quanto rimbalza all'atterraggio.
- **Anticipazione:**
  - frenata e abbassamento del muso prima dello slam;
  - compressione delle sospensioni prima del salto;
  - leggera derapata in curva.
- **Reazione:**
  - il veicolo colpito sobbalza dal lato del colpo;
  - chi subisce lo slam slitta con le ruote di traverso.

### R5 — Equipaggi

- Il **pilota della moto** fa da banco prova: un pupazzetto a pezzi che si piega, derapa, impenna e
  salta con la moto, e spara con la mitragliatrice o con l'uzi nella mano sinistra (vedi sotto).
- Poi, se l'utente vuole, piloti e mitraglieri delle auto, che si girano verso il bersaglio.

### R6 — Replay istantaneo dal director

- Il replay riusa le scene e il voto, con candidate "da replay": più basse, più vicine, al rallentatore.

### R7 — Taratura del ritmo

- Misurare quanto dura in media un turno a velocità normale e veloce, prima e dopo ogni fase.
- Obiettivo indicativo, da confermare con l'utente: un turno tipico sotto i 20 s a velocità normale.

## Ordine proposto

1. **R4 e R5** (peso, anticipazione, pilota della moto): rendono vivo ciò che si vede da vicino, e la moto
   è il lavoro in corso.
2. **R2** (camera viva): mette in mostra R4 e R5.
3. **R1** (grammatica degli stacchi).
4. **R3** (ostacoli sfumati).
5. **R6** (replay).
6. **R7** (taratura) dopo ogni fase.

## Il pilota della moto (avvio, 2026-11-20)

- **Modelli separati:**
  - la moto: telaio e ruote;
  - il pilota: un pupazzetto a pezzi (busto, testa, braccia, avambracci, gambe);
  - le armi: una piccola mitragliatrice montata sulla moto, oppure un'uzi nella mano sinistra.
- **Il pilota segue il movimento:**
  - in piega si inclina più della moto, verso l'interno;
  - in derapata il busto guarda la direzione di marcia;
  - in impennata si sposta in avanti;
  - nel salto si alza sui pedali e assorbe l'atterraggio piegando le gambe.
- **Lo sparo:**
  - con la mitragliatrice montata, il pilota resta chino;
  - con l'uzi, alza il braccio sinistro verso il bersaglio; i bossoli escono dall'arma.
- **Più moto e più piloti:** ogni moto e ogni pilota ha la sua scheda di montaggio (come le auto). Le
  combinazioni si scelgono nei dati.
