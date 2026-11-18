# 🧠 ENGINE — Step 3/4: Mercato, trattative, fasi del turno, visibilità pubblica e validazione

## Contesto
Sei l'**agent ENGINE** di LAMENCARDS. Step 1–2 completati (test, RNG con seed, 32 effetti). Leggi `KNOWLEDGE.md` §3, §4, §7. Lavori solo in `src/engine/**`, `src/data/**`, test.

## Obiettivo
Completare le regole di contorno, strutturare in modo netto le **fasi del turno** e la **visibilità pubblica/privata dello stato** (così nei turni altrui si vede solo ciò che è giusto), rendere **configurabile tutto ciò che il GDD lascia aperto**, e dare alla UI e alla rete un engine **autoritativo**.

## Compiti
1. **Fasi del turno esplicite (`TurnStep`):**
   - Scandisci chiaramente il turno del giocatore attivo in fasi distinte per guidare la UI:
     - `ROLLING`: fase di lancio dei dadi (fino a 3 tiri, blocco/sblocco dadi, eventuale uso de *Il Dado Fortunato* o tiro extra). Include un'azione `CONFIRM_DICE_ROLL` (o passaggio automatico a `ACTION_DECISION` quando `rollsLeft === 0`) per passare esplicitamente dalla schermata di lancio dadi alla scelta delle carte/azioni;
     - `ACTION_DECISION`: dadi confermati, il giocatore sceglie tra **Gioca** (una carta dalla mano) o **Incassa** (gettoni dai dadi);
     - `POST_ACTION`: dopo l'azione principale, eventuali azioni facoltative ancora disponibili (trattativa, scambio Mercato se non consuma azione, seconda carta con *After Party*) e chiusura turno (`END_TURN`).
2. **Mercato:** riserve al centro scoperte; scambio di una carta non giocata con una del Mercato pagando gettoni. Opzioni in `GameConfig`: `marketSwapPrice`, `marketSwapTiming` (`BEFORE_ROLL` | `AFTER_ACTION` | `ANYTIME_IN_TURN`), `marketSwapConsumesAction` (bool).
3. **Trattativa:** max 1 offerta per turno; vietata a chi è a 1 carta dalla vittoria; vietato comprare carte già giocate; la carta protetta da *Il Piumone* non è acquistabile. Opzione `tradeRequiresCardBack` (il venditore riceve una carta non giocata in cambio — "da confermare" nel GDD). Gestisci accetta/rifiuta come `pendingTradeOffer` (visibile pubblicamente nei dettagli non segreti: chi offre a chi e quanti gettoni).
4. **Personaggi doppi:** niente due copie della stessa carta nella stessa squadra; il primo che gioca una carta la blocca per tutti; si sblocca se torna in mano. Opzioni: `blockScope` (`SAME_CARD` | `SAME_PERSON`), `allowMultipleVersionsSamePerson` (bool).
5. **Obiettivi:** verifica i 6 esempi del GDD con `evaluateObjective`; opzioni `objectiveHidden` (coperto/scoperto) e `objectiveChangePolicy`. Vittoria = 4 carte in gioco **e** obiettivo rispettato, controllata nel momento corretto.
6. **Regole "in forse"** come opzioni (default = proposta del GDD): `startingTokens: 3`, `extraPaidRoll` (4° tiro a 1 gettone, default `false`), `cashInMode` (`FIVE_AND_SIX` | `SIX_ONLY`), `comboTable` (tabella costo→combinazione modificabile).
7. **Validazione autoritativa:** crea `validateAction(state, action, actorPlayerId): { ok: true } | { ok: false, reason: string }` e fai sì che `applyGameAction` non modifichi lo stato se l'azione è illegale (turno sbagliato, fase del turno sbagliata, gettoni insufficienti, combinazione non soddisfatta, carta bloccata…). Serve all'Host per scartare messaggi P2P non validi.
8. **Visibilità e Selettori per la UI** (in `index.ts`):
   - `getPublicStateFor(state, viewerPlayerId)`: **fondamentale per i turni degli altri giocatori**. Restituisce uno stato filtrato in cui:
     - per gli avversari sono visibili **solo** le informazioni pubbliche: numero di carte in mano (ma **mai** quali carte sono), carte scoperte giocate sul tavolo, gettoni, stato del lancio dadi corrente (`dice`, `keptDice`, `rollsLeft`, `turnStep`), scambi col Mercato, offerte di trattativa (senza rivelare la carta coperta scambiata), dadi lanciati per effetti (*Effetto Ritardo*, *Mariong*, *Giorgio*) e obiettivo **solo** se `objectiveVisibility === 'PUBLIC'` o se svelato a `viewerPlayerId` tramite *Il Ficcanaso* (`revealedObjectivePlayerIds`);
     - bustine non aperte (`unopenedPacks`), pool pescato (`pulledPool`) e `objectiveCandidates` degli altri giocatori sono sempre oscurati;
   - `getLegalActions(state, playerId)`, `getPlayableCards(state, playerId)` con motivo se non giocabile, `getEffectiveCost(state, playerId, cardId)`, `getRequiredCombo(...)`, `getPendingChoiceFor(state, playerId)`.
9. **Test** per ogni regola, per le transizioni di `TurnStep` e per `getPublicStateFor` (verifica che nessuna carta in mano o obiettivo segreto altrui trapeli nello stato filtrato).

## Vincoli
- Default sempre uguali alla proposta del GDD. Nessuna regola nuova: dubbi → "Domande per il team" in `ENGINE_AUDIT.md`.
- Aggiorna `data/game_config.template.json` con tutte le nuove opzioni e una descrizione.
- Annuncia selettori, fasi `TurnStep`, `getPublicStateFor` e `validateAction` in `docs/CHANGELOG_ENGINE.md` (l'agent UI li userà nello step 3).
- **Lavora in loop continuo:** continua a sviluppare, testare e correggere finché tutti i test e la build non passano e l'app gira senza errori.

## Definizione di "fatto"
- [ ] Tutte le regole §3–§4 del GDD e le fasi `TurnStep` implementate e testate
- [ ] `getPublicStateFor` garantisce che nei turni altrui trapelino solo le informazioni pubbliche corrette
- [ ] Tutti i punti §7 "da definire" presenti come opzioni in `GameConfig` e nel template JSON
- [ ] `validateAction` + selettori esportati e documentati
- [ ] `npm test` e `npm run build` verdi
