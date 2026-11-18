# 📜 Changelog & Contratto API Engine (`src/engine`)

> Questo documento traccia tutte le aggiunte, i tipi condivisi, i selettori e le funzionalità esposte dall'**Agent ENGINE** in `src/engine/types.ts`, `src/engine/gameEngine.ts`, `src/engine/botSimulator.ts` e `src/engine/index.ts` per l'**Agent UI** e il layer di rete P2P (`src/network/*`).
> **Garanzia di Retrocompatibilità:** Tutte le firme e proprietà preesistenti usate dalla UI sono state preservate al 100%.

---

## Step 1 — Audit, Determinismo Puro e API Pubblica (`src/engine/index.ts`)

1. **PRNG Deterministico con Seed (`src/engine/rng.ts`):**
   - Eliminati tutti gli usi di `Math.random()` e `Date.now()` da `src/engine/**`.
   - Aggiunti a `GameState` i campi `rngSeed: number`, `rngState: number` e `nextIdCounter: number`.
   - `createInitialGameState(roomCode, customCatalog?, customConfig?, explicitSeed?)` accetta ora un seed opzionale (o legge `config.seed`).
   - `applyGameAction(state, action)` è ora una funzione **100% pura e deterministica**: a parità di stato e azione produce sempre un risultato `deepEqual` identico.
2. **Entry-point Unificato (`src/engine/index.ts`):**
   - Riesporta tutti i tipi, il riduttore, i selettori, le funzioni dadi/obiettivi, il calcolo del budget e il simulatore.

---

## Step 2 — Effetti delle 32 Carte, Modelli Parametrizzati e `pendingChoice`

1. **Catalogo Modelli per l'Editor Carte (`EFFECT_MODEL_CATALOG`):**
   - Esportato `EFFECT_MODEL_CATALOG: EffectModelDefinition[]` da `src/data/defaultData.ts` e `src/engine/index.ts`.
   - Ogni modello espone `templateId`, `label`, `description`, `timing` (`ON_ENTER` | `WHILE_IN_PLAY`), `defaultCategory` (`Aiuto` | `Ostacolo` | `Caos`), `target`, `requiresTargetPlayer` e i metadati dei parametri numerici (`hasPrimaryValue`, `primaryValueLabel`, `hasSecondaryValue`, `secondaryValueLabel`).
2. **Rimozione Logica Cablata per Nome (`getActiveModifiers`):**
   - Nuova funzione `getActiveModifiers(player: PlayerState, enableEffects = true): ComputedPlayerModifiers` che calcola tutti i modificatori passivi `WHILE_IN_PLAY` basandosi esclusivamente su `card.effectModel`.
   - Mantenuti gli alias `isPlayerProtectedByPiumone`, `hasLuckyDieInPlay` e `getLoSponsorDiscount` come wrapper per non rompere la UI esistente.
3. **Scelte Interattive in Sospeso (`state.pendingChoice` e `RESOLVE_PENDING_CHOICE`):**
   - Aggiunto `pendingChoice: PendingChoice | null` in `GameState` (e selettore `getPendingChoiceFor(state, playerId)`).
   - Tipi di scelta supportati (`PendingChoiceType`):
     - `'CHOOSE_TARGET_PLAYER'`: scelta dell'avversario bersaglio per carte `Ostacolo` quando `targetPlayerId` non è pre-specificato in `PLAY_CARD`;
     - `'CHOOSE_TARGET_PLAYED_CARD'`: scelta della carta in gioco (costo ≤ 4) da rimandare in mano con *Lo Sfratto*;
     - `'GIORGIO_SWAP_CHOICE'`: scelta della propria carta in mano e dell'avversario con cui scambiare quando *Giorgio* ottiene `6` sul dado;
     - `'PASS_CARD_LEFT'`: scelta per ogni giocatore della carta non giocata da passare a sinistra con *Sfattonata Collettiva*;
     - `'PAY_TOKEN_OR_FOUR_DICE'`: scelta per ogni avversario se dare `1` gettone o tirare con `4` dadi nel prossimo turno con *Giro di Shot*;
     - `'FREE_MARKET_SWAP'`: scelta dello scambio gratuito col Mercato (o `'SKIP'`) per *Il DJ* (in senso orario a partire da chi l'ha giocato) e *L'Imbucato*;
     - `'CHOOSE_RICHEST_TIE'`: scelta del bersaglio in caso di pareggio per *Il Mantenuto* (quando `config.richestTiePolicy === 'CHOOSE'`).
   - Azione dedicata per risolvere qualsiasi scelta:
     ```ts
     {
       type: 'RESOLVE_PENDING_CHOICE';
       playerId: string;
       choiceId?: string;
       optionId?: string;
       targetPlayerId?: string;
       cardId?: string;
       marketCardId?: string;
       targetPlayedCardId?: string;
       decision?: 'PAY_TOKEN' | 'FOUR_DICE' | 'SKIP';
     }
     ```
   - Durante l'attesa, `pendingChoice.publicMessage` fornisce il messaggio pubblico da mostrare agli altri giocatori al tavolo.
4. **Dadi Lanciati per Effetti (`state.lastEffectDiceRolls`):**
   - I tiri di dado generati da *Giorgio*, *Mariong* ed *Effetto Ritardo* sono salvati in `state.lastEffectDiceRolls: PublicEffectDiceRoll[]` così la UI può mostrarli a tutti i giocatori.

---

## Step 3 — Fasi `TurnStep`, Mercato, Trattative, Validazione e Visibilità Pubblica

1. **Fasi del Turno (`TurnStep` e `CONFIRM_DICE_ROLL`):**
   - `state.turnStep` scandisce il turno in:
     - `'ROLLING'`: lancio e blocco dadi (`ROLL_DICE`, `TOGGLE_KEEP_DIE`, `BUY_EXTRA_ROLL`, `FLIP_DIE_OPPOSITE`). Quando `rollsLeft` arriva a `0` (senza 4° tiro extra disponibile), passa automaticamente a `'ACTION_DECISION'`.
     - Azione `{ type: 'CONFIRM_DICE_ROLL'; playerId: string }`: permette al giocatore di confermare esplicitamente i dadi in qualsiasi momento passando da `'ROLLING'` a `'ACTION_DECISION'`.
     - `'ACTION_DECISION'`: dadi confermati; scelta tra `PLAY_CARD` e `CASH_IN_DICE` (più eventuale `FLIP_DIE_OPPOSITE` se non ancora usato). *(Nota di retrocompatibilità: `PLAY_CARD` e `CASH_IN_DICE` restano accettati anche direttamente da `'ROLLING'` per supportare il pulsante rapido "Incassa Subito")*.
     - `'POST_ACTION'`: dopo l'azione principale; consente eventuale 2ª carta con *After Party*, trattativa (`OFFER_PLAYER_TRADE`), scambio Mercato e `END_TURN`.
2. **Opzioni Configurabili in `GameConfig` (`normalizeGameConfig`):**
   - Tutte le regole "in forse / da definire" del GDD §7 sono sincronizzate con le chiavi esistenti:
     - `startingTokens` (default `3`)
     - `extraPaidRoll` ↔ `paidExtraRollEnabled` (default `false`)
     - `cashInMode` (`'FIVE_AND_SIX' | 'SIX_ONLY'`) ↔ `cashInHighFaces`
     - `comboTable` ↔ `costCombinationsTable`
     - `marketSwapPrice` ↔ `marketSwapCost` (default `1`)
     - `marketSwapTiming` (`'BEFORE_ROLL' | 'AFTER_ACTION' | 'ANYTIME_IN_TURN' | 'FREE_IN_TURN' | 'REPLACES_MAIN_ACTION'`)
     - `marketSwapConsumesAction` (boolean, default `false`)
     - `tradeRequiresCardBack` ↔ `tradeRequiresCardSwap` (default `true`)
     - `blockScope` (`'SAME_CARD' | 'SAME_PERSON'`) ↔ `blockAllVersionsOfSamePersonInPlay`
     - `allowMultipleVersionsSamePerson` ↔ `!uniquePersonPerTeam`
     - `objectiveHidden` ↔ `objectiveVisibility === 'SECRET'`
     - `objectiveChangePolicy` ↔ `onObjectiveMismatch` (`'ALLOW_RETURN_TO_HAND' | 'NONE'`)
     - `richestTiePolicy` (`'FIRST_CLOCKWISE' | 'CHOOSE'`)
3. **Validazione Autoritativa e Selettori UI (`src/engine/index.ts`):**
   - `validateAction(state, action, actorPlayerId?): { ok: true } | { ok: false, reason: string }`
   - `getPublicStateFor(state, viewerPlayerId): GameState` — oscura mani coperte altrui (mantenendo `hand.length` e `handCount` con carte segnaposto coperte), bustine, pool di draft, scelte segrete e obiettivi segreti non spiati con *Il Ficcanaso*.
   - `getLegalActions(state, playerId): GameAction[]`
   - `getPlayableCards(state, playerId): PlayableCardInfo[]`
   - `getEffectiveCost(state, playerId, cardId, useNoComboAlternateCost?): number`
   - `getRequiredCombo(state, playerId, cardOrCost): { requiredCombos, effectiveTier, satisfied }`
   - `getPendingChoiceFor(state, playerId): PendingChoice | null`

---

## Step 4 — Simulatore Headless e Calcolo Budget Effetti

1. **Simulatore Puro Web-Worker Ready (`runSimulation`):**
   - `runSimulation({ games, players, seed, config, botStrategy, catalog, includeDiceMonteCarlo, diceTrials }): SimulationReport`
   - Supporta `botStrategy: 'GREEDY' | 'RANDOM'`.
   - Restituisce distribuzione durata (turni e giri: media, mediana, p90), win-rate per posizione di turno, gettoni medi Incassa, metriche blocco personaggi doppi, probabilità combinazioni 5 e 4 dadi (`simulateDiceComboProbabilities`), statistiche per tutte le 32 carte e per tutti gli obiettivi, watchlist e budget check.
2. **Stima Budget Effetti per l'Editor Carte (`estimateCardBudget` & `evaluateCatalogBudget`):**
   - `estimateCardBudget(card: CardData): CardBudgetEvaluation` confronta la stima parametrica in gettoni con il budget teorico GDD (`costo - 1`) restituendo `targetBudget`, `estimatedValue`, `diff`, `withinBudget`, `status` (`'SOTTO_BUDGET' | 'BILANCIATA' | 'SOPRA_BUDGET'`) e `note`.
