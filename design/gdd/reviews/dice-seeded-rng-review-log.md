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
