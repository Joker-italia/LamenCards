# 🧠 ENGINE — Step 4/4: Simulatore headless e report di bilanciamento

## Contesto
Sei l'**agent ENGINE** di LAMENCARDS. Engine completo, deterministico e testato (step 1–3). Leggi `KNOWLEDGE.md` §5 (budget effetti) e §7 (watchlist). Lavori in `src/engine/**`, `scripts/**`, `docs/**`.

## Obiettivo
Poter simulare **migliaia di partite** da riga di comando (e dalla UI) per rispondere alle domande di bilanciamento del GDD con numeri.

## Compiti
1. **Bot migliori** in `botSimulator.ts`: almeno 2 strategie selezionabili (`RANDOM` legale, `GREEDY` che tiene i dadi verso la combinazione della carta più conveniente, valuta Incassa vs Gioca e persegue l'obiettivo). I bot devono usare **solo** `getLegalActions` + `applyGameAction` (rispettando le fasi `TurnStep` e le stesse regole degli umani) e risolvere le `pendingChoice`.
2. **Simulazione pura e veloce:** `runSimulation({ games, players: 3..6, seed, config, botStrategy, catalog })` senza dipendenze dal DOM, eseguibile anche in un Web Worker (la UI lo userà).
3. **CLI:** `scripts/simulate.ts` eseguibile con `npx tsx scripts/simulate.ts --games 5000 --players 4 --seed 42 [--config path.json]` (aggiungi `tsx` come devDependency e lo script npm `"simulate"`). Output: riepilogo a console + `docs/reports/sim-<data>-<players>p.md` e `.json`.
4. **Metriche del report:**
   - durata partita (turni e round: media, mediana, p90) per 3, 4, 5, 6 giocatori;
   - frequenza di vittoria per posizione di turno (vantaggio del primo giocatore);
   - probabilità reale di ogni combinazione in 3 tiri con 5 e 4 dadi (confronta con la tabella GDD: 100/77/59/37/29% e 31%/10% con 4 dadi);
   - per ogni carta: win-rate quando è in squadra, quanto spesso viene giocata, turno medio in cui viene giocata;
   - per ogni obiettivo: win-rate;
   - Incassa: gettoni medi (atteso ≈ 4,5);
   - frequenza dei blocchi da personaggi doppi.
5. **Watchlist automatica:** sezione del report che evidenzia *Il Letargo*, *After Party*, effetti che scalano coi giocatori (*Giro di Shot*, *Anima della Festa*, *Offro Io*) confrontando 3 vs 6 giocatori, e confronto `cashInMode` `FIVE_AND_SIX` vs `SIX_ONLY`.
6. **Budget check statico:** funzione che stima il valore in gettoni di ogni effetto (tabella §5) e lo confronta col budget `costo − 1`, segnalando le carte fuori budget.

## Vincoli
- Il simulatore non deve cambiare regole: se una metrica suggerisce una modifica, scrivila come **proposta** nel report, non applicarla.
- Determinismo: stesso seed ⇒ stesso report.
- **Lavora in loop continuo:** testa lo script CLI, i test unitari e la build finché tutto non funziona senza errori.

## Definizione di "fatto"
- [ ] `npm run simulate -- --games 5000 --players 4` termina in tempi ragionevoli (< 1 min)
- [ ] Report Markdown + JSON generati con tutte le metriche e la watchlist
- [ ] API `runSimulation` esportata in `index.ts` e annunciata in `CHANGELOG_ENGINE.md` per il pannello UI
- [ ] `npm test` e `npm run build` verdi
