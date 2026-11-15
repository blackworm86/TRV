# Espansioni: appunti di lettura dei regolamenti

Riassunto, in parole nostre, dei tre regolamenti delle espansioni di *Thunder Road: Vendetta*
letti il 2026-11-15. **Non è una fonte di regole**: l'autorità resta il regolamento ufficiale in
`reference/rulebook/` (cartella locale, fuori da git). Qui c'è quello che serve per progettare
l'estensione del motore, e l'elenco di ciò che i regolamenti non dicono.

Lettura fatta sul solo testo dei PDF: icone, facce dei dadi e illustrazioni non sono state lette.

| Parte | Espansione | File |
|---|---|---|
| 2 | Big Rig and the Final Five | `TRV-BRaFF_Rulebook.pdf` |
| 3 | Carnage at Devil's Run | `TRV-CDR_Rulebook.pdf` |
| 4 | Choppe Shoppe | `TRV-CS_Rulebook.pdf` |

## Parte 2 — Big Rig and the Final Five

Due squadre nuove, giocabili insieme o separate, anche contro le squadre di auto del gioco base.
Nessuna delle due usa capisquadra o potenziamenti di Choppe Shoppe, ma può giocare nella stessa
partita con chi li usa.

### Componenti

- Big Rig: miniatura in tre parti, plancia delle sezioni, plancia della cabina, 4 dadi movimento
  propri, un elicottero.
- Final Five: 5 moto, una plancia comando, 5 dashboard, 6 dadi movimento, un elicottero.
- 15 segnalini danno minore (10 al Big Rig, 5 alle Final Five), 8 segnalini fuoristrada.

### Danno minore

Entrambe le squadre prendono danni minori al posto dei segnalini danno del gioco base. Un danno
minore non ha effetto: occupa solo uno slot. Si ripara come gli altri. Se finiscono, si usa un
segnalino danno coperto senza effetto.

### Big Rig

- **Un solo veicolo** in tre sezioni (posteriore, centrale, anteriore), che si muove come un
  treno: ogni sezione entra nella casella lasciata da quella davanti.
- **Turno**: assegna un dado a un comando di una sezione, attiva quel comando, muovi, spara
  dall'arco frontale oppure da quello posteriore.
- **Sterzo idraulico**: al primo turno di ogni round, prima di tutto, un dado va sullo sterzo
  della cabina. Il suo valore è il numero di cambi di corsia (avanti-sinistra o avanti-destra)
  disponibili nel round; ogni cambio lo riduce di 1. Senza sterzo il Big Rig va solo dritto.
- **Movimento**: i movimenti del turno sono il valore del dado assegnato alla sezione, qualunque
  sezione sia. Non si può riusare una sezione già usata nel round. Si può assegnare un dado a un
  comando danneggiato: muove soltanto. Le riparazioni chiedono un dado di valore 3.
- **Dado strada**: non lo usa, salvo con il comando Trazione.
- **Arco posteriore**: le tre caselle dietro la sezione posteriore. Serve per sparare e per
  posare pericoli.
- **Interazioni** (conta solo la sezione anteriore per tessera e terreno):
  - effetti che lo sposterebbero o fermerebbero: non succede; prende un danno minore su un
    comando a sua scelta e la casella diventa fuoristrada;
  - casella invalicabile: non è eliminato; danno minore e la casella diventa fuoristrada;
  - una sezione finisce il turno su un elicottero: danno minore, l'elicottero torna al padrone;
  - fuoco (con Carnage): non prende mai fuoco; danno minore e la casella diventa fuoristrada.
- **Slam**: i veicoli che lo urtano si mettono sopra la sezione. Si tira solo il dado direzione,
  si muove sempre l'altro veicolo, nessuno può ritirare.
- **Essere colpiti**: ogni sezione vale come un veicolo grande a sé. Chi spara sceglie il
  comando bersaglio prima di tirare; due comandi per sezione sono bersagliabili, Riparazione no,
  e nemmeno un comando già danneggiato. Il danno minore copre il comando colpito.
- **Eliminazione**: al sesto danno minore, oppure quando tutte le sezioni sono sulla tessera di
  coda e questa viene tolta. Se è eliminato, il giocatore esce e si aggiunge subito il traguardo.
- **Comandi delle sezioni**:
  - posteriore: Dispensa pericoli (dopo il movimento, un pericolo coperto a caso in una casella
    vuota dell'arco posteriore), Riparazione;
  - centrale: Trazione (dado strada in questo turno), Attacco aereo (come nel base), Riparazione;
  - anteriore: Lanciamissili (dopo il movimento, dado sparo: danno minore a ogni veicolo nella
    casella due passi avanti o adiacente a quella, se colpito; non conta come lo sparo del
    turno), Computer di puntamento (ritira lo sparo), Respingente (la prima auto o moto incontrata
    viene spostata avanti-sinistra o avanti-destra dal suo padrone; un relitto lo sposta il Big
    Rig), Riparazione.

### Final Five

Le moto sono veicoli **piccoli** e seguono le regole delle auto, con queste differenze:

- **Assegnazione**: ogni turno due dadi a due moto. Una volta per round, in alternativa: un dado
  a una moto e uno a un comando.
- **Movimento**: con due moto, se ne muove una e spara, poi l'altra.
- **Attraversare**: una moto passa attraverso tutti gli altri veicoli senza slam. Se si ferma
  nella casella di un altro veicolo, lo slam c'è. Le auto non attraversano le moto senza Drift.
- **Slam**: moto e altro veicolo stanno affiancati, non impilati. Solo dado direzione, si muove
  sempre la moto, nessun ritiro. Tra due moto dello stesso giocatore sceglie lui.
- **Danno**: un danno minore mette la moto fuori uso (dashboard girata). Riparabile.
- **Inerzia**: fino a quattro volte per moto, non due.
- **Fuoco** (con Carnage): non pescano mai il danno "in fiamme", ma possono prendere fuoco per
  terreno o altri effetti.

## Parte 3 — Carnage at Devil's Run

### Componenti e preparazione

- 5 tessere strada a due facce, da mescolare alle normali (si parte sempre da 1a o 1b).
- 22 pericoli nuovi e 10 danni nuovi, mescolati nelle pile del base.
- 21 carte effetto continuo, 12 segnalini "in fiamme", un dado fuoco.

### Terreni nuovi

- **Melma tossica**: chi entra si ferma e perde i movimenti rimasti.
- **Vetro del deserto**: chi entra scivola subito di una casella nella direzione in cui andava,
  senza spendere movimenti.
- **Rampa**: si entra solo dalla casella direttamente dietro. Si tira il dado acrobazia e si
  salta dritto di tante caselle ignorando quelle in mezzo; all'atterraggio si perdono i
  movimenti. Entrarci da un'altra casella elimina il veicolo.
- **Fuoco**: chi entra prende fuoco (segnalino sulla dashboard).
- **Piane di sale**: chi entra può usare il dado strada in questo turno, anche se non ha
  percorso solo strada.

### Pericoli nuovi

- Scartati dopo essere stati rivelati:
  - **Terremoto**: dado direzione, tutti i veicoli su strada si spostano di una casella insieme.
  - **Verme delle sabbie**: elimina il veicolo più arretrato; a pari merito, tutti quelli.
- Restano sul tabellone:
  - **Vetro del deserto**, **Rampa**, **Fuoco**: la casella diventa quel terreno.
  - **Trappola**: dado sparo contro chi l'ha rivelata; se colpito è eliminato, altrimenti
    prosegue. Resta come casella invalicabile.

### In fiamme

- Prima di muovere un veicolo in fiamme si tira il dado fuoco. Tre esiti: movimenti in più
  (anche oltre 6, da usare tutti), il fuoco si spegne, oppure il veicolo è eliminato.
- Il segnalino non conta come danno. Se il veicolo va fuori uso, il segnalino si toglie.
- Un veicolo già in fiamme non ne prende un secondo.

### Danni nuovi

- **In fiamme**: segnalino fuoco sulla dashboard, poi il danno va coperto nello slot.
- **Effetto continuo**: si pesca una carta e la si mette scoperta in uno slot danno libero, con
  il danno coperto sopra. Vale finché quel danno non viene riparato; alla riparazione si
  scartano entrambi.

## Parte 4 — Choppe Shoppe

Capisquadra e potenziamenti, usabili insieme o separati, solo dalle squadre di auto.

### Componenti

- 10 plance comando dei capisquadra, 15 segnalini comando, 27 carte potenziamento.
- 6 pericoli (3 mine, 3 chiazze d'olio) per due potenziamenti che li posano.

### Capisquadra

- Preparazione: due plance a caso a testa, se ne tiene una. Sostituisce la plancia comando
  normale. Si prendono tanti segnalini comando quante le stelle in fondo alla plancia.
- **Potere speciale** in cima alla plancia: non richiede un dado.
- **Comandi con icona segnalino** al posto del numero: si attivano solo con un segnalino comando.

### Segnalini comando

- Una volta per turno si può mettere un segnalino su un comando che non ha già un dado o un
  segnalino. Si attiva nella fase Comando, anche in aggiunta al comando attivato con un dado.
- Non si può mettere un segnalino nel turno in cui si usa l'inerzia.
- Su un comando che accetta un intervallo di valori, il segnalino vale il numero più basso.
- A fine round i segnalini usati tornano alla riserva.

### Potenziamenti

- Preparazione a rotazione: 4 carte a testa, se ne sceglie una e si passa il resto a sinistra,
  finché ognuno ne ha 3. Una per auto, assegnate coperte e poi scoperte insieme.
- Il potenziamento vale solo per la sua auto e non si sposta.
- È inattivo finché l'auto è fuori uso; torna attivo alla riparazione.

## Cosa comporta per il progetto

- **Interfaccia del giocatore**: una carta sopra ogni dashboard (potenziamento), una carta
  dentro lo slot danno (effetto continuo), plancia comando del caposquadra più grande, un
  segnalino fuoco sulla dashboard. Le Final Five hanno cinque dashboard, il Big Rig due plance
  proprie e nessuna dashboard.
- **Motore**: veicoli che occupano più caselle (Big Rig), squadre con numero di veicoli e di
  dadi diverso, danni di tipo diverso per squadra, terreni e pericoli come contenuto
  estendibile, più di un comando per turno, effetti legati a una carta finché dura un danno.

## Cosa i regolamenti non dicono

Servono dal proprietario del progetto prima di implementare:

- i testi delle 27 carte potenziamento, delle 10 plance caposquadra e delle 21 carte effetto
  continuo;
- le facce del dado fuoco e dei 4 dadi movimento del Big Rig;
- le griglie delle cinque tessere nuove (terreni, pericoli, numero di giocatori);
- quanti pericoli e danni nuovi di ciascun tipo;
- quali comandi del Big Rig sono bersagliabili (nel testo: due per sezione, segnati da una X).

## Punti da chiarire

- **Nitro** (risolto): Nitro 1-4 è sulla plancia del caposquadra Cris Crass; vedi
  [espansioni-componenti.md](espansioni-componenti.md).
