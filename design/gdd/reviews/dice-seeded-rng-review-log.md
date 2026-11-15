# Review Log — Dice & Seeded RNG (`design/gdd/dice-seeded-rng.md`)

## Review — 2026-11-15 — Verdict: NEEDS REVISION
Review mode: full · Workflow: full
Scope signal: M
Specialists: game-designer, systems-designer, qa-lead, network-programmer, lead-programmer, creative-director (senior)
Blocking items: 8 | Recommended: 7
Summary: La struttura regge: 8/8 sezioni, regole verificate sul regolamento (p. 5 e p. 9), aritmetica e chi-quadro corretti, registro coerente. Mancavano un requisito di sicurezza (con un generatore a stato piccolo i risultati pubblici rivelano lo stato, quindi dadi futuri e ordine delle pile online) e il contratto con #1 (id, granularità degli eventi, oscuramento verso i client). Nessuna riprogettazione: requisiti e contratti da fissare, algoritmo e API negli ADR A/B/C.
Prior verdict resolved: First review
Decisioni dell'utente: limiti di ritiro nei moduli (non un budget in #2); soglia chi-quadro p = 1e-4 per tutto il progetto; seed non validi rifiutati; un evento per gruppo di dadi.
Revisioni applicate nella stessa sessione: tutti gli 8 punti bloccanti e le raccomandazioni (Status del GDD → In Review). Il riesame decide l'approvazione.
Findings:
- [BLOCKING] Core Rules: RNG-4 + RNG-11 non reggono con un generatore a stato piccolo (mulberry32): requisito di imprevedibilità mancante → nuova RNG-15
- [BLOCKING] Core Rules / Formulas: RNG-9 e F3 dichiarano 1/m! esatto; con 32 bit di stato è impossibile per m ≥ 13
- [BLOCKING] Core Rules: nessuna regola di oscuramento per eventi, replay e riconnessione; seed proposti dal client non rifiutati
- [BLOCKING] Dependencies: "A monte: nessuno" contraddice la tabella Interactions (#1 ospita stato ed eventi)
- [BLOCKING] Core Rules: chi crea i record di tiro, gli id e lo stato Sostituito non era specificato; granularità degli eventi ambigua
- [BLOCKING] Core Rules: RNG-12 era una regola di comportamento, non un contratto applicabile
- [BLOCKING] Formulas: F1 non sicura in JavaScript (2^32, operatori bitwise), n senza limite superiore
- [BLOCKING] Acceptance Criteria: tipi errati, criteri con più WHEN, seed e soglie fragili, AC-03/08/20/21 non verificabili, criteri mancanti
- [RECOMMENDED] Player Fantasy / Cross-References: citare p. 5 e p. 9; la scena di Tony è una variante illustrativa
- [RECOMMENDED] Core Rules: schema dello stato serializzato; azioni duplicate idempotenti
- [RECOMMENDED] Edge Cases: tipo RngError
- [RECOMMENDED] Formulas: F3 chiamate vs estrazioni grezze; F2 conteggio 0..n
- [RECOMMENDED] Edge Cases: precondizione della parità del setup (2+ giocatori, n ≥ 2)
- [RECOMMENDED] Core Rules / UI Requirements: richiedente e regola nei ritiri; vecchio e nuovo risultato mostrati insieme
- [RECOMMENDED] Player Fantasy: hot seat a fiducia; messaggio neutro di RNG-12; seed rivelato a fine partita (OQ-6)
Receipt note: il GDD è stato modificato dopo la revisione, quindi non è timbrato di proposito: il prossimo /design-review lo vede NEW e fa un riesame completo.
Reviewed-Content-Hash: design/registry/entities.yaml 3c1506456f98afa8502acce8c6d3d6812cb6569e
Reviewed-Content-Hash: .claude/skills/design-review/SKILL.md 4dcc8b81162613c757144532f1b72708ab3ba27f
Reviewed-Content-Hash: design/gdd/game-concept.md 87ef9bcd1a6e706a7bae90b742ce1261e541389b
Reviewed-Content-Hash: design/gdd/systems-index.md 2dde6bace8cf5c50e11f35279bdcbce17108d6b4

## Review — 2026-11-15 — Verdict: NEEDS REVISION
Review mode: full · Workflow: full
Scope signal: L
Specialists: game-designer, systems-designer, qa-lead, network-programmer, lead-programmer, security-engineer, creative-director (senior)
Blocking items: 9 | Recommended: 11
Summary: L'architettura regge (nucleo puro, flusso unico, un evento per gruppo, proiezione per giocatore) e gli 8 bloccanti della prima review erano risolti. I requisiti erano però scritti male o troppo larghi: seed trattato come numero (≤ 53 bit) contro i 128 bit richiesti, alternativa a flussi separati che ammetteva un generatore invertibile, log2(m_max!) riferito allo stato invece che all'entropia del seed, atomicità e informazione nascosta derivata non specificate, criteri non costruibili. Correzione dei requisiti, non riprogettazione.
Prior verdict resolved: Yes — gli 8 bloccanti della prima review risultano affrontati
Decisioni dell'utente: D1 commit-reveal del seed online come requisito di #27; D2 solo seed di 256 bit anche nei test (default raccomandato); D3a M_MAX_PILA da verificare sul regolamento (OQ-7); D3b uniformità computazionale ammessa oltre 46 elementi; D4 host del server non deciso (OQ-8); D5 RNG-14 rinominata "deviazione dall'informazione nascosta del tavolo" (dicitura del creative-director).
Revisioni applicate nella stessa sessione: tutti i 9 bloccanti e le raccomandazioni; nuove RNG-16 (atomicità) e RNG-17 (richiesta di tiro); criteri riscritti (59); registro uniform_shuffle aggiornato. Status del GDD: In Review. Il riesame decide l'approvazione.
Findings:
- [BLOCKING] Core Rules RNG-2 / Edge Cases / AC-16, 21, 22: seed descritto come Number (max 53 bit), incompatibile con l'entropia di RNG-15
- [BLOCKING] Core Rules RNG-15: l'alternativa "flussi separati" ammetteva un generatore invertibile per i dadi pubblici
- [BLOCKING] Core Rules RNG-9 / Formulas F3 / registro: requisito log2(m_max!) riferito allo stato e non all'entropia del seed; m_max senza valore
- [BLOCKING] Core Rules RNG-4: atomicità e consumo delle estrazioni non specificati (azioni rifiutate o duplicate, gruppo tutto-o-niente)
- [BLOCKING] Core Rules RNG-11: id, posizioni e ordine derivati dalle pile nascoste non protetti
- [BLOCKING] Core Rules RNG-12: l'anteprima si fermava solo davanti al caso, non davanti all'informazione nascosta
- [BLOCKING] Core Rules RNG-10 / RNG-12: contenuto della richiesta di tiro non fissato, ma necessario ai GDD a valle
- [BLOCKING] Overview / Summary / Player Fantasy: promesse di verificabilità e di "garanzia piena" oltre quanto il sistema garantisce
- [BLOCKING] Acceptance Criteria: AC-02 tipo e percorso, AC-12b non costruibile in #2, AC-16 non valido come test, AC-03 legato allo strumento di lint, AC-21/22 sul seed numerico
- [RECOMMENDED] Acceptance Criteria: AC-04 tautologico, AC-07 ambiguo, AC-08/15/25 con più WHEN, AC-19 non riproducibile, AC-20 senza stato malformato, AC-13 solo m = 3
- [RECOMMENDED] Acceptance Criteria: procedura di fallback dei 20 seed non operativa
- [RECOMMENDED] Edge Cases: RngError per n non valido (NaN, Infinity, "6", 6n) e per sorgente esaurita
- [RECOMMENDED] Edge Cases: save-scumming presentato come chiuso, mentre permette di esplorare rami alternativi
- [RECOMMENDED] Core Rules RNG-3 / States: lo stato completo "inviato dal server" e la ripresa senza validazione
- [RECOMMENDED] Core Rules RNG-2: entropia da un solo modulo nominato, fail-closed; seed dato non raggiungibile dalla rete; rivincita con seed nuovo
- [RECOMMENDED] Core Rules RNG-8: esempi normativi dei moduli e ritiro senza riferimento di regola
- [RECOMMENDED] Core Rules RNG-14: da presentare come deviazione dall'informazione nascosta del tavolo
- [RECOMMENDED] Dependencies: contratti rinviati senza destinatario registrato
- [RECOMMENDED] UI Requirements: indicatore "il percorso prosegue" nell'anteprima interrotta
- [RECOMMENDED] Cross-References: src/game/rules.ts (mulberry32) è un prototipo che viola RNG-3 e RNG-15
Receipt note: il GDD e il registro sono stati modificati dopo la revisione. Il GDD non è timbrato di proposito: il prossimo /design-review lo vede NEW e fa un riesame completo. Il registro è timbrato nella versione già corretta.
Reviewed-Content-Hash: design/registry/entities.yaml 7f5b73bb55d3fd70d3a039ac2b7fe0e0af0f3cb2
Reviewed-Content-Hash: .claude/skills/design-review/SKILL.md 4dcc8b81162613c757144532f1b72708ab3ba27f
Reviewed-Content-Hash: design/gdd/game-concept.md 87ef9bcd1a6e706a7bae90b742ce1261e541389b
Reviewed-Content-Hash: design/gdd/systems-index.md 4195c2426ed276bf5cfac27548efc18a7336f6ed
