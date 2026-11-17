# Espansione: The Big Rig and the Final Five

> **Stato**: preparazione (2026-11-17)
> **Regole**: `rulebook/TRV-BRaFF_Rulebook.pdf` (8 pagine), trascritte in `data/trv/big_rig_final_five.json`
> **Sorgenti grafiche**: `assets/sorgenti/TRV 02 All Expansions/Big Rig.docx` e `Fast Five.docx`
> **Vedi anche**: `espansioni-regole.md` e `espansioni-componenti.md` (il riassunto di tutte le
> espansioni); questa nota è il piano di lavoro di questa.

## Cosa aggiunge

Due nuove **crew**, scelte al posto di una crew di auto (p. 3). Si possono usare insieme o
separate, con qualsiasi crew del gioco base. Non usano capisquadra né potenziamenti di Choppe
Shoppe, ma possono stare nella stessa partita con crew che li usano.

### The Big Rig (pp. 4-6)
- **Un solo veicolo in tre sezioni** (posteriore, centrale, motrice) agganciate. Si muove come
  un treno: la motrice avanza, le altre sezioni occupano le caselle che lascia.
- **Turno**: un dado su un comando di una sezione, dove ogni sezione riceve un solo dado per
  round. Il valore del dado sono le mosse; poi si attiva il comando, si muove e si spara
  dall'arco **frontale o posteriore** (3 caselle dietro).
- **Hydraulic Steering**: al primo turno di ogni round un dado va sulla motrice. Il suo valore
  è quante volte nel round il Big Rig può cambiare corsia avanti a sinistra o a destra, e
  scende di 1 a ogni cambio. Senza, va solo dritto.
- **Nove comandi** (tre per sezione). Riparazione (dado 3) è su ogni sezione e non si può
  colpire; gli altri accettano qualsiasi dado: Hazard Dispenser, Targeting Computer,
  Traction Drive, Attacco aereo, Missile Launcher, Cow Catcher.
- **Danni**: chi spara sceglie il comando prima di tirare; un colpo lo copre con un danno
  minore e il comando non si attiva più (il dado lo muove soltanto). Il Big Rig è eliminato
  con 6 danni minori, o se tutte e tre le sezioni cadono dalla tessera posteriore.
- **Massive, Sturdy, Dependable, Solid**: non viene mai spostato né fermato dagli effetti, non
  muore nelle caselle invalicabili né sull'elicottero. Al loro posto prende un danno minore e
  la casella diventa **fuoristrada** (segnalino nuovo). Conta solo la casella in cui entra la
  motrice. Non prende mai fuoco (Carnage).
- **Slam**: chi lo urta va sopra la sezione; solo dado direzione, si muove sempre l'altro
  veicolo, nessun ritiro.
- La sua eliminazione fa aggiungere subito il traguardo.

### The Final Five (p. 7)
- **Cinque moto**, veicoli piccoli, ognuna con un **segno** (due righe, X, V, cerchio, onda)
  uguale a quello del suo cruscotto.
- **Turno**: due dadi su due moto, che muovono e sparano una dopo l'altra. Una volta per round
  si può dare invece un dado a una moto e uno alla plancia comandi (solo Attacco aereo
  qualsiasi, Nitro 1-2, Riparazione 6).
- **Inerzia** fino a 4 volte invece di 2.
- **Drift naturale**: attraversano tutti i veicoli senza slam; lo slam avviene solo se
  finiscono nella stessa casella. Le moto non si impilano, si affiancano.
- **Slam**: solo dado direzione, si muove sempre la moto; tra due moto proprie sceglie il
  giocatore.
- **Danno**: un danno minore e la moto diventa inoperabile (girata all'indietro, cruscotto
  capovolto). Non pescano mai il segnalino ON FIRE! di Carnage.

### In comune
- **15 segnalini danno minore** (10 per il Big Rig, 5 per le moto): riempiono uno slot e
  nient'altro. Quando finiscono si usa un segnalino danno coperto senza effetto.
- **8 segnalini fuoristrada**.
- **Due elicotteri** (rosso per il Big Rig, giallo per le moto).

## Cosa cambia nel motore

Le regole sono nuove in quasi ogni sistema. Il motore oggi ha "un veicolo, una casella",
dadi da 1 a 6 e un dado per turno.

1. **Veicolo a più caselle** (Big Rig): posizione per sezione, movimento a treno, arco
   posteriore, sezione colpita come veicolo grande, slam sulla sezione, uscita dal fondo solo
   con tutte le sezioni sulla tessera posteriore.
2. **Danno sui comandi** (Big Rig) e **danno minore** (tutti), anche per le auto colpite dal
   Missile Launcher.
3. **Cambio di terreno** in fuoristrada (Sturdy, Dependable, fuoco).
4. **Turni diversi per crew**: un dado per sezione (Big Rig), due dadi per turno (moto),
   più il dado fisso di Hydraulic Steering a inizio round.
5. **Moto**: drift naturale, affiancamento nello slam, inerzia fino a 4, inoperabile
   capovolta.
6. **Dadi personalizzati**: facce dei dadi movimento per crew.

## Nuove miniature (3D)

| Pezzo | Note |
|---|---|
| Big Rig: motrice, sezione centrale, sezione posteriore | Tre modelli agganciati che seguono il percorso della motrice, rossi |
| 5 moto | Gialle, ciascuna col suo segno ben visibile da sopra |
| Elicottero rosso e giallo | Il modello attuale, nel colore della crew |
| Segnalino fuoristrada | Tessera sabbia a chevron, come nel regolamento |
| Segnalino danno minore | La croce nera con la spia rossa |

Le auto del gioco base sono file `.glb` (`assets/base/modelli`). Per i nuovi pezzi serve
decidere da dove vengono i modelli.

## Nuove interfacce

- **Big Rig**: la **striscia** del giocatore diventa la motrice (Hydraulic Steering, col dado
  che scende a ogni cambio di corsia) più la plancia a tre sezioni con nove comandi. Ogni
  comando ha il suo slot dado e la sua "X" su cui cade il danno minore. Mentre si spara al Big
  Rig serve la scelta del comando bersaglio.
- **Final Five**: plancia comandi a tre comandi più cinque cruscotti stretti col segno della
  moto, il retro quando è inoperabile e due dadi da assegnare per turno. L'inerzia ha quattro
  segni.
- **Icone dei comandi nuovi**, nello stile delle icone già integrate: Hydraulic Steering,
  Hazard Dispenser, Targeting Computer, Traction Drive, Missile Launcher, Cow Catcher.
- La nuova interfaccia generale che l'utente sta disegnando decide la forma; questa parte
  aspetta quella.

## Asset estratti

Ritagliati dalle scansioni di Big Rig.docx da `tools/art/save_big_rig_assets.py`, in
`assets/big_rig/` (WebP con trasparenza), nel pannello admin alla voce Big Rig and the Final Five.

| Pezzo | File | Stato |
|---|---|---|
| Plancia motrice (Hydraulic Steering) | `plance/motrice.webp` | Intera |
| Sezione anteriore | `plance/sezione_front.webp` | Manca una striscia del bordo sinistro |
| Sezione centrale | `plance/sezione_mid.webp` | Intera |
| Sezione posteriore | `plance/sezione_rear.webp` | Intera, dall'immagine del regolamento (p. 6): bassa risoluzione, da rifare in vettoriale |
| Plancia comandi Final Five | `plance/comandi_final_five.webp` | Intera |
| 5 cruscotti moto, fronte | `plance/cruscotto_<segno>.webp` | Interi |
| Retro dei cruscotti | `plance/cruscotto_retro_{circle,v}.webp` | Solo cerchio e V |
| Segnalino danno minore | `segnalini/danno_minore.webp` | Intero |
| Big Rig visto dall'alto | `icone/big_rig_alto.webp` | Render piccolo (78 px), riferimento per il 3D |
| Dadi Big Rig e Final Five | — | Mancano: solo nella foto del regolamento |
| Segnalini fuoristrada | — | Mancano: solo nella foto del regolamento |

**Ordine dei comandi** (decisione dell'utente, 2026-11-17): segue il regolamento (p. 6), da
sinistra a destra posteriore, centrale, anteriore, motrice; nella sezione anteriore Missile
Launcher, Repair, Cow Catcher, e il rombo ANY della motrice a sinistra. Le scansioni stampate
hanno l'ordine opposto: valgono solo come riferimento grafico, e la versione vettoriale segue il
regolamento. Lo stesso ordine è quello di `sections` in `data/trv/big_rig_final_five.json`.

## Domande aperte

Sono nel campo `_missing` di `data/trv/big_rig_final_five.json`:
1. Le facce dei 4 dadi del Big Rig (la guida print-and-play dice 1, 1, 1, 2, 2, 3).
2. Le facce dei 6 dadi delle moto (dado normale da 1 a 6?).
3. L'ordine e i nomi dei segni delle moto.
4. La grafica dei segnalini fuoristrada.
5. I retro dei cruscotti due righe, X, onda.
6. Da dove vengono i modelli 3D di Big Rig e moto.

C'è anche un caso già risolto: la FAQ ufficiale sul Big Rig contro il Quake di Carnage, in
`data/trv/carnage.json`, `_rulings.faq_big_rig_quake`.

## Ordine di lavoro proposto

1. **Asset**: ritagliare plance, cruscotti e segnalino danno minore dalle scansioni e
   aggiungerli al pannello admin (non dipende dalla nuova interfaccia).
2. **Miniature**: Big Rig in tre sezioni e moto, viste sul tavolo 3D.
3. **Motore, Final Five** (più vicina alle auto): due dadi per turno, drift, slam, danno
   minore, con test.
4. **Motore, Big Rig**: veicolo a tre caselle, sezioni e comandi, danno sui comandi,
   fuoristrada, con test.
5. **Interfacce** delle due crew, sulla nuova interfaccia generale.
