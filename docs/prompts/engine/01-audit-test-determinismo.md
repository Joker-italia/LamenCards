# 🧠 ENGINE — Step 1/4: Audit, test e determinismo

## Contesto
Sei l'**agent ENGINE** di LAMENCARDS. Leggi prima `AI_PROMPT.md` e `KNOWLEDGE.md` (fonte di verità = GDD). Lavori **solo** in `src/engine/**`, `src/data/**`, `scripts/**` e nei test. Non toccare la UI: un altro agent ci lavora in parallelo.

File esistenti: `types.ts`, `dice.ts`, `objectives.ts`, `gameEngine.ts` (~57 KB, `createInitialGameState`, `applyGameAction`), `botSimulator.ts`, `src/data/defaultData.ts`.

## Obiettivo
Rendere l'engine **verificabile e deterministico** prima di aggiungere altro.

## Compiti
1. **Audit vs GDD:** confronta `KNOWLEDGE.md` con il codice e produci `docs/ENGINE_AUDIT.md` con una tabella `Regola | Stato (OK / Mancante / Diversa dal GDD / Inventata) | File:riga | Nota`. Copri: draft 2×5 (1 per classe + 1 jolly), 4 titolari + 2 riserve, gettoni iniziali, obiettivi (pesca 2 tieni 1), tiro 3 volte con dadi tenuti, divisione del turno in fasi (`ROLLING` → `ACTION_DECISION` → `POST_ACTION`), tabella costo→combinazione, Incassa, blocco personaggi doppi, condizione di vittoria, tutte le 32 carte.
2. **RNG iniettabile e con seed:** elimina ogni `Math.random()` dall'engine. Crea `src/engine/rng.ts` (es. mulberry32) e salva il seed / stato RNG dentro `GameState`, così `applyGameAction(stato, azione)` è **pura**: stesso stato + stessa azione ⇒ stesso risultato. Niente `Date.now()` dentro la logica (i timestamp del log possono arrivare dall'azione).
3. **API pubblica:** crea `src/engine/index.ts` che riesporta solo ciò che la UI deve usare. Documenta in testa al file cosa è pubblico.
4. **Test:** aggiungi `vitest` come devDependency e lo script `"test": "vitest run"`. Scrivi test per:
   - `evaluateDiceCombos` / `canDiceSatisfyCardCost` (tutte e 5 le combinazioni, casi limite: Full vs Doppia coppia, Poker conta come Coppia?, Scala 1-2-3-4 e 3-4-5-6);
   - `calculateCashInTokens` (opzione 5–6 e opzione solo 6);
   - draft: composizione delle bustine;
   - determinismo: stessa partita con stesso seed giocata due volte ⇒ stato identico (deep equal).
5. **Non correggere ancora le regole sbagliate** trovate nell'audit, salvo bug banali: segnale nel report, verranno sistemate negli step 2–3.

## Vincoli
- Non inventare regole. Casi non coperti dal GDD → elencali in fondo a `ENGINE_AUDIT.md` come **"Domande per il team"**.
- Non rompere le firme usate dalla UI; se devi cambiarle, annotalo in `docs/CHANGELOG_ENGINE.md`.
- **Lavora in loop continuo:** esegui test e build a ogni modifica e continua a iterare finché tutti i punti qui sotto non sono completati e l'app compila e gira senza errori.

## Definizione di "fatto"
- [ ] `docs/ENGINE_AUDIT.md` completo
- [ ] Nessun `Math.random` in `src/engine/**`
- [ ] `npm test` verde, `npm run build` senza errori
- [ ] `src/engine/index.ts` creato
