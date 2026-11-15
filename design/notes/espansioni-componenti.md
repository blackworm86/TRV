# Espansioni: manifesto dei componenti

Inventario di ciò che c'è in `assets/licensed/TRV 02 All Expansions/` (cartella locale, fuori da
git), letto il 2026-11-16 dalle immagini estratte in `assets/licensed/_derived/expansions/`.
Per ogni componente: da quale file viene, quanti pezzi si vedono, e cosa fa, **riassunto in parole
nostre**. Il testo ufficiale resta sulle carte e nei regolamenti (`reference/rulebook/`), che sono
l'unica autorità: questo documento serve a progettare i dati, non a sostituirli.

Compagno di [espansioni-regole.md](espansioni-regole.md), che riassume i tre regolamenti.

**Avvertenze sulla fonte**

- I file sono scansioni "print and play" dei componenti fisici, non file dell'editore. Le
  quantità qui sotto sono quelle **visibili nelle scansioni**: dove il regolamento dà un numero
  diverso lo segnalo.
- Lettura fatta su viste ridotte a 1/5: nomi e testi delle carte sono leggibili, le icone piccole
  no. I punti dubbi sono in fondo, in "Da verificare".
- Il pacchetto *German Engineering* è fuori ambito: vedi la sezione in fondo.

## File sorgente

| File | Contenuto | Estratto in `_derived/expansions/` |
|---|---|---|
| `TRV v2.pdf` | 16 fogli con i fronti di tutte le carte | `trv_v2/` |
| `Character Boards.docx` | plance dei capisquadra (Choppe Shoppe) | `character_boards/` |
| `Big Rig.docx` | plance del Big Rig e delle moto, segnalini, guide dei dadi | `big_rig/` |
| `Fast Five.docx` | segnalini sostitutivi delle moto (non ci sono le miniature) | `fast_five/` |
| `Danger Tiles.pdf` | segnalini pericolo delle espansioni, fronte e retro | `danger_tiles/` |
| `Custom Tiles.pdf` | segnalini danno nuovi | `custom_tiles/` |
| `Fire Tile.pdf` | segnalini "in fiamme" | `fire_tile/` |
| `Road Tiles v2.pdf` | tessere strada 6a–10b | `../road_v2/` (10 facce) |
| `Mini Euro 93.pdf`, `Standard Backs 93.pdf` | dorsi delle carte, due formati | non estratti |

## Parte 2 — Big Rig and the Final Five

### Big Rig

| Componente | Pezzi visti | Cosa fa |
|---|---|---|
| Plancia della cabina | 1 | Ospita il dado dello **sterzo idraulico** (qualsiasi valore): il valore è il numero di cambi di corsia del round. |
| Plancia delle sezioni | 1, a due facce | Tre sezioni (posteriore, centrale, anteriore), ognuna "veicolo grande", con tre comandi e una casella dado ciascuno. Le caselle Riparazione chiedono un 3, le altre qualsiasi valore. |
| Segnalino danno minore | 1 disegno (a croce) | Copre il comando colpito di una sezione. Nessun effetto proprio: occupa lo slot. |
| Guida del dado movimento | solo nelle note del pacchetto | Sostituto con un d6: 1-3 vale 1, 4-5 vale 2, 6 vale 3. |

Comandi letti sulla plancia delle sezioni:

| Comando | Cosa fa |
|---|---|
| Dispensa pericoli | Dopo il movimento posa un pericolo coperto in una casella dell'arco posteriore. |
| Computer di puntamento | In questo turno si può ritirare il dado sparo. |
| Trazione | In questo turno il Big Rig può usare il dado strada. |
| Attacco aereo | Come nel gioco base: elicottero in una casella vuota, poi spara. |
| Lanciamissili | Dopo il movimento un tiro di sparo: danno minore a ogni veicolo colpito nella casella due passi avanti o adiacente a quella. |
| Respingente | La prima volta che entra in una casella con un pericolo o un'auto: il pericolo si toglie, l'auto viene spostata avanti-sinistra o avanti-destra dal suo padrone. |
| Riparazione (una per sezione) | Toglie un danno da quella sezione. |

### Final Five (moto)

| Componente | Pezzi visti | Cosa fa |
|---|---|---|
| Plancia comando delle moto | 1 | Tre comandi: Attacco aereo (qualsiasi valore), Nitro (1-2: movimenti in più pari al dado), Riparazione (6: toglie un danno da una moto). |
| Dashboard delle moto | 5 | Veicolo piccolo. Casella dado (qualsiasi valore), casella "fine turno", casella inerzia (+1). Ognuna ha un simbolo diverso per riconoscere la moto: croce, cerchio, freccia, due righe, riga ondulata. |
| Retro della dashboard | 5 | Faccia "fuori uso", con la spia del motore: la moto ci finisce al primo danno minore. |
| Segnalini moto | in `fast_five/` | Pedine piatte al posto delle miniature. |

## Parte 3 — Carnage at Devil's Run

| Componente | Pezzi visti | Cosa fa |
|---|---|---|
| Tessere strada 6a–10b | 10 facce | Cinque tessere a due facce con i terreni nuovi (melma, vetro, rampa, fuoco, sale). Le griglie non sono ancora state rilevate. |
| Segnalino danno "In fiamme" | 1 disegno | Mette un segnalino fuoco sulla dashboard; poi sta coperto nello slot come un danno. |
| Segnalino danno "Effetto continuo" | 1 disegno | Fa pescare una carta effetto continuo, che resta sotto il danno finché non è riparato. |
| Segnalino "in fiamme" | 3 in scansione (12 da regolamento) | Anello a forma di fiamma sulla dashboard: prima di muovere si tira il dado fuoco. Non conta come danno. |
| Guida del dado fuoco | 1 (sviluppo del cubo) | Sei facce: una elimina il veicolo, due spengono il fuoco, tre danno movimenti in più (un +1 e due +2). |
| Carte effetto continuo | 21 (11 tipi) | Vedi tabella. |

Pericoli nuovi (in `Danger Tiles.pdf`, fronte nero o illustrato, retro col triangolo):

| Pericolo | Cosa fa |
|---|---|
| Fuoco | La casella diventa terreno fuoco: chi entra prende fuoco. |
| Rampa | La casella diventa una rampa: si entra solo da dietro e si salta. |
| Vetro del deserto | La casella diventa vetro: chi entra scivola di una casella. |
| Trappola (relitto con filo spinato) | Tiro di sparo contro chi la rivela; resta come casella invalicabile. |
| Verme delle sabbie | Elimina il veicolo più arretrato, poi si scarta. |
| Terremoto | Dado direzione: tutti i veicoli su strada si spostano insieme, poi si scarta. |

Carte effetto continuo (rosse; tutte in 2 copie tranne Cracked Flywheel, 1 copia):

| Carta | Cosa fa all'auto danneggiata |
|---|---|
| Shattered Windshield | Se va fuori uso, è eliminata. |
| Bald Tires | Quando il dado direzione la sposta, si sposta di una casella in più. |
| Loose Wiring | Prima di muoversi: dado direzione e una casella in quella direzione. |
| Faulty Airbag | Se entra in una casella con un pericolo coperto è eliminata; il pericolo non si gira. |
| Cracked Flywheel | Deve essere la prima auto mossa in ogni round, se possibile. |
| Bent Frame | Se un'altra auto la urta, si muove lei, senza tirare il dado slam. |
| Nitro Leak | Il dado assegnato diventa 6; se è coinvolta in uno slam è eliminata. |
| Exposed Hardware | Chi le spara può ritirare il dado sparo. |
| Dead Alternator | Se un'altra auto esce dalla tessera di testa, questa è eliminata. |
| Lost Tools | Si ripara solo con un'altra propria auto adiacente. |
| Transmission Failure | Prima di muoversi il dado diventa 3, senza movimenti aggiuntivi. |

## Parte 4 — Choppe Shoppe

### Plance dei capisquadra

Ogni plancia sostituisce la plancia comando: un potere speciale in alto (senza dado), quattro
comandi con i loro valori, e in fondo il numero di segnalini comando. Una stella al posto del
valore indica un comando attivabile solo con un segnalino.

Nelle scansioni le plance sono **11**; il regolamento ne dichiara 10.

| Caposquadra | Segnalini | Potere speciale | Comandi (valore) |
|---|---|---|---|
| Ms. Betty, the Tinkerer | 2 | Un potenziamento in più dopo la scelta; l'auto grande può averne due. | Attacco aereo (qualsiasi), Nitro (1-2), Riparazione (1-3), Tinker (5-6: scarta un potenziamento e ne pesca uno nuovo per quell'auto) |
| Bumpo the Clown, the Bumpmeister | 0 | Se la sua auto verrebbe mossa in uno slam, può ritirare il dado direzione. | Attacco aereo (qualsiasi), Nitro (1-2), Riparazione (6), Bump! (6: nel primo slam del turno solo dado direzione e si muove l'altra auto) |
| Abigail, the Street Sergeant | 1 | Colpo automatico se un'altra sua auto funzionante è adiacente al bersaglio. | Attacco aereo (qualsiasi), Nitro (1-3), Drift (3-4), Riparazione (5) |
| Asha, the Road Mistress | 3 | Ignora gli effetti dei danni (si mettono coperti). | Riparazione (1), Nitro (2-3), Drift (3-4), Attacco aereo (5-6) |
| Emberco, the Firestarter | 2 | Ignora la faccia "eliminato" del dado fuoco. | Show Time (qualsiasi: dà fuoco a una propria auto), Attacco aereo (qualsiasi), Flamethrower (5-6: se colpisce, dà fuoco anche al bersaglio), Riparazione (6) |
| Vince Vamp, the Nitromancer | 1 | Quando colpisce un veicolo su strada, toglie un danno da una propria auto. | Attacco aereo (qualsiasi), Nitro (1-2), Drift (2-4), Pain Transfer (6: sposta un danno coperto da una propria auto a un'altra) |
| Cruft, the Scrap Merchant | 0 | Entrando su un pericolo coperto guadagna un segnalino comando, poi lo gira. | Attacco aereo (qualsiasi), Nitro (2-3), Drift (5), Riparazione (segnalino) |
| Cris Crass, the Fastest of the Fast | 2 | Un dado movimento da 6 assegnato a un'auto vale 7. | Attacco aereo (qualsiasi), Nitro (1-4), Need for Speed (4-5: tutti i dadi non assegnati prendono il valore di questo), Riparazione (segnalino) |
| Machine Gun Joe, Esq., the Bullet King | 2 | Può ritirare il dado sparo. | Attacco aereo (qualsiasi), Nitro (1), Drift (2-5), Riparazione (6) |
| Madame Boudreaux, the Prophet | 2 | A inizio round guarda un pericolo coperto. | Attacco aereo (qualsiasi), Nitro (1-3), Riparazione (6), Called Shot (6: in questo turno colpisce automaticamente) |
| Wong Lei Hong, the Marksman | 3 | Può sparare a un bersaglio a due caselle. | Attacco aereo (qualsiasi), Nitro (1-2), Drift (2-4), Riparazione (6) |

### Carte potenziamento (27, una per auto)

| Carta | Cosa fa |
|---|---|
| Grappling Hook | Dopo aver colpito un'auto e risolto il danno, può scambiarsi di posto con lei. |
| Snowplow | Entrando su un relitto o un veicolo fuori uso lo sposta in una casella vuota adiacente e prosegue. |
| Big Red Button | Quando va fuori uso può eliminarsi, eliminando anche auto ed elicotteri adiacenti. |
| Armor Plating | Il risultato "qualsiasi" del dado sparo contro di lei è un mancato. |
| Onboard Computer | Ignora gli effetti dei suoi danni (coperti). |
| Ghost Mode | Con Drift guadagna 2 movimenti. |
| Smoke Screen | Non le si può sparare dalla casella direttamente dietro. |
| Skull Shift Knob | Non deve usare tutti i movimenti. |
| Heavy Machine Gun | Può ritirare il dado sparo. |
| Rail Gun | Spara fino a tre caselle dritto davanti. |
| Oil Dispenser | Dopo il movimento posa una chiazza d'olio in una casella vuota adiacente (3 volte a partita). |
| Roll Cage | Se uno slam la spingerebbe contro un'altra auto, va invece in una casella vuota adiacente. |
| Crumple Zones | Quando prende un danno ne pesca due e ne sceglie uno. |
| Sandbags | Negli slam che la coinvolgono gli avversari non possono ritirare i dadi. |
| Deep Treads | Il fango vale come strada. |
| Heavy Frame | Regge un danno in più prima di andare fuori uso. |
| Spoiler | Il dado strada vale sempre 2. |
| Anti-Aircraft Radar | Se finisce il turno sotto un elicottero può spostarsi in una casella vuota adiacente. |
| Stability Control | Se uno slam la muoverebbe, può ritirare il dado direzione. |
| Punt Gun | Spara fino a due caselle di distanza. |
| Tank Treads | Con un dado da 3 o meno non rivela i pericoli coperti che attraversa; rivela solo quello su cui si ferma. |
| Off-Road Suspension | Se parte su strada usa il dado strada comunque si muova. |
| Rear Guns | Spara in qualunque casella adiacente. |
| Boost Switch | Un movimento in più. |
| Assault Bumper | In uno slam, l'auto che sposta va una casella più in là. |
| Stealth Technology | Non le si può sparare se c'è un altro bersaglio possibile. |
| Mine Dispenser | Dopo il movimento posa una mina in una casella vuota adiacente (3 volte a partita). |

### Segnalini

| Componente | Pezzi visti | Cosa fa |
|---|---|---|
| Mina | 1 disegno (3 da regolamento) | Pericolo posato da Mine Dispenser. L'effetto non è nei file letti. |
| Chiazza d'olio | 1 disegno (3 da regolamento) | Pericolo posato da Oil Dispenser. L'effetto non è nei file letti. |
| Segnalino comando | non trovato nelle scansioni | Attiva un comando senza dado (15 da regolamento). |

## Extra Ammo

*Extra Ammo* è un set di cinque mini espansioni indipendenti: Bonus Commands, One Shots,
Bounties, Road Conditions, Advanced Airstrike. Non ha un regolamento a parte: ogni mazzo contiene
una carta **RULES** con le regole di quella mini espansione, riassunta qui sotto in testa a ogni
tabella. (Confermato dal proprietario del progetto il 2026-11-16.)

### Comandi bonus (8 carte + regole)

Una carta a testa a inizio partita: è un comando in più, attivabile con un dado del valore
indicato.

| Carta | Valore | Cosa fa |
|---|---|---|
| Tire Spikes | 5-6 | In questo turno, l'auto che sposti con uno slam prende un danno se finisce in una casella vuota. |
| Rocket Fuel | qualsiasi | Al posto del dado strada usi il valore di questo dado; quei movimenti sono solo dritti in avanti. |
| Rapid Reload | 6 | Al prossimo sparo del turno puoi fare un secondo attacco contro un bersaglio diverso. |
| Positraction | qualsiasi | In questo turno il fango vale come strada. |
| Torque Booster | qualsiasi | Ritiri tutti i dadi non ancora assegnati. |
| Nav System | 3-6 | La prima volta che entri su un pericolo coperto nel turno, lo sposti in una casella vuota adiacente invece di rivelarlo. |
| Hands Free | 5-6 | Tiri il dado direzione e ti muovi in quella direzione, fino a tante caselle quanto il dado assegnato. |
| Targeting AI | 3-4 | Se in questo turno colpisci un'auto, scegli tu il danno dalla riserva. |

### Colpi unici — One Shots (6 carte + regole + 1 bianca)

Una carta coperta a testa; si gioca nel momento che indica e poi esce dal gioco.

| Carta | Cosa fa |
|---|---|
| Guided Missile | Quando spari: colpo automatico. |
| AI Danger Avoidance | Quando un tuo veicolo entrerebbe in una casella invalicabile: va in una adiacente. |
| Flux Capacitor | Dopo il tiro di inizio round: ritiri tutti i tuoi dadi. |
| Radar Array | A inizio turno: guardi due pericoli coperti. |
| Camouflage Coating | Quando un tuo veicolo prenderebbe un danno: non lo prende. |
| Grapeshot | Dopo aver sparato: secondo colpo sullo stesso bersaglio, se è ancora nell'arco. |

### Taglie — Bounties (8 carte + regole + 2 bianche)

Una carta coperta a testa: quando l'obiettivo è raggiunto si gioca, si prende la ricompensa e la
carta esce dal gioco.

| Carta | Obiettivo | Ricompensa |
|---|---|---|
| Down and Dirty | Iniziare il turno senza veicoli su strada | Guardare tutti i pericoli coperti di una tessera |
| Pinball Wizard | Due slam nel proprio turno | Mettere un dado movimento non usato sul valore voluto |
| Slow and Steady | Finire il round senza veicoli davanti a quelli avversari | Muovere ogni proprio veicolo fino a 3 caselle, solo in caselle vuote |
| Hit and Run | Mettere fuori uso un veicolo sparando | Mettere un dado movimento non usato sul valore voluto |
| Trash Collector | Entrare in due caselle con pericoli in un turno | Togliere un danno da un proprio veicolo |
| Frontrunner | Iniziare il turno con due veicoli in testa (anche a pari merito) | Togliere un danno da un proprio veicolo |
| Death from Above | Eliminare un veicolo con l'elicottero | Piazzare l'elicottero e sparare |
| Rubbing is Racing | Un veicolo viene eliminato nel proprio turno | Sparare con un proprio veicolo |

### Condizioni della strada (8 carte + regole)

Quando si posa una tessera le si mette accanto una carta scoperta: la regola vale su quella
tessera. A inizio partita: una sulla tessera centrale e una su quella di testa, non sulla prima.

| Carta | Cosa fa sulla tessera |
|---|---|
| Icy | Chi è spostato dal dado direzione va una casella più in là. |
| Marauders | A fine turno, se il veicolo mosso è in testa su questa tessera, gli sparano. Non agli elicotteri. |
| Blockaded | Dopo aver risolto un pericolo coperto, se ne posa un altro coperto in una casella vuota. |
| Guardrails | Chi uscirebbe dal lato va in una casella adiacente. |
| Tremors | A inizio round: dado direzione, tutti i veicoli (non gli elicotteri) si spostano di una casella. |
| Windy | Non ci si possono piazzare elicotteri. |
| Torrential Downpour | Chi entra nel fango perde i movimenti rimasti. |
| Sandstorm | Si spara solo ai veicoli direttamente davanti. |

### Attacchi aerei avanzati (10 carte + regole)

Una carta coperta a testa; si gioca nel momento che indica e poi esce dal gioco.

| Carta | Cosa fa |
|---|---|
| Dual Guns | L'elicottero manca: ritira il dado sparo. |
| Care Package | L'elicottero lascia una casella: ci resta un pericolo coperto. |
| Strafing Run | Dopo lo sparo: l'elicottero va in una casella vuota qualsiasi. |
| Discerning Pilot | Un tuo veicolo finirebbe sotto il tuo elicottero: sposti l'elicottero invece di perdere il veicolo. |
| Air to Air Missile | Al piazzamento: può sparare a un elicottero avversario; con un colpo "medio" lo elimina. |
| Low Flying | Al piazzamento: si posa su un pericolo scoperto e lo scarta. |
| Scouting Mission | Al piazzamento: guardi tutti i pericoli adiacenti. |
| Trick Shot | Al piazzamento: può sparare in qualunque casella adiacente. |
| Target Practice | L'elicottero colpisce un'auto: peschi due danni e scegli quale applicare. |
| Bag of Wrenches | Al piazzamento: toglie un danno da un veicolo adiacente. |

## German Engineering — fuori ambito

**Per ora non la includiamo** (decisione del proprietario del progetto, 2026-11-16). Resta solo
la descrizione di ciò che c'è nei file, 72 carte in tedesco.

Quattro mazzi da 18 carte, uno per colore (verde, azzurro, arancione, bianco). Ogni carta ha un
valore da 1 a 6 (tre carte per valore) e un'icona bersaglio (L, M, M-S o "qualsiasi") che ricorda
le facce del dado sparo. **Non ho il regolamento di questo pacchetto**: sembra sostituire i dadi
con carte, ma come si usano non è scritto in nessun file letto.

## Cosa risolve rispetto a `espansioni-regole.md`

- **Nitro 1-4**: è la plancia di Cris Crass, non un errore del regolamento.
- I testi di potenziamenti, capisquadra ed effetti continui ci sono tutti.
- Le facce del dado fuoco e la conversione del dado del Big Rig sono nelle guide del pacchetto.

## Da verificare

- **Dado fuoco**: facce lette da un'immagine piccola; ricontrollare a piena risoluzione e con il
  dado vero.
- **Dado del Big Rig**: la conversione viene dalle note di chi ha preparato le scansioni, non dal
  regolamento.
- **Plancia delle sezioni del Big Rig**: la scansione è tagliata. Non è chiaro in quale sezione
  stiano Computer di puntamento e Dispensa pericoli, né quali comandi siano bersagliabili.
  `espansioni-regole.md` mette il Computer di puntamento nella sezione anteriore: da ricontrollare.
- **11 plance capisquadra** contro le 10 del regolamento: una potrebbe essere promozionale.
- **Mina e chiazza d'olio**: l'effetto non è nei file letti.
- **Segnalini comando** e **danni minori delle Final Five**: non trovati tra le scansioni.
- **Un retro di pericolo arancione con una chiave inglese**: non so a quale mazzo appartenga.
- **Nav System**: sulla carta non è chiaro se si sposta il pericolo o il veicolo; ho scritto il
  pericolo.
- **Quantità**: pericoli e danni nuovi compaiono una volta per disegno; i numeri veri per tipo
  non si ricavano dalle scansioni.
- **Extra Ammo**: le uniche regole sono le carte RULES, molto brevi. I casi che non coprono
  (per esempio l'ordine tra più carte giocate nello stesso momento) vanno chiesti.
- **Griglie delle tessere 6a–10b**: da rilevare come per le tessere base.
