# 📋 Richieste e Interfaccia Selettori Engine per la UI (`UI_REQUESTS.md`)

> Questo documento elenca i selettori, i tipi e gli helper del motore di gioco (`src/engine/*`) utilizzati dall'interfaccia grafica (`src/ui/*`) e dal layer di rete P2P (`src/network/*`).
> Per garantire compilazione autonoma durante lo sviluppo in parallelo tra **Agent ENGINE** e **Agent UI**, tutti gli helper sono esposti e adattati tramite `src/network/engineAdapter.ts`.

---

## 1. Selettori di Stato e Privacy P2P (`getPublicStateFor`)
- **`getPublicStateFor(state: GameState, viewerPlayerId: string): GameState`**
  - Filtra `GameState` prima dell'invio via WebRTC / BroadcastChannel a uno specifico client (`viewerPlayerId`):
    - **Mano coperta altrui (`p.hand`)**: oscurata con carte segnaposto coperte (`faceDown`), mantenendo invariato `p.hand.length` così la UI mostra il numero di carte in mano agli avversari (`🃏 N in mano`) senza rivelarne l'identità.
    - **Bustine e pool di draft altrui (`p.unopenedPacks`, `p.selectedStarterIds`)**: oscurati durante `PACK_OPENING` per i titolari scelti.
    - **Obiettivo coperto altrui (`p.objective`, `p.objectiveCandidates`)**: oscurato se `state.config.objectiveVisibility === 'SECRET'` e l'avversario non è stato spiato da `viewerPlayerId` tramite *Il Ficcanaso* (`viewer.modifiers.revealedObjectivePlayerIds`).

## 2. Validazione Azioni Client (`validateClientAction`)
- **`validateClientAction(state: GameState, action: GameAction, senderPlayerId: string): { valid: boolean; reason?: string }`**
  - Verifica lato Host che un client possa inviare solo azioni legittime per il proprio `playerId` e nella fase/turno corretti.

## 3. Selettori per il Tavolo di Gioco e la Mano a Ventaglio
- **`canPlayCardRightNow(state, player, card)`** (già in `src/engine/gameEngine.ts`):
  - Restituisce `canPlayStandard`, `canPlayNoComboAlt`, `standardCost`, `altCost`, `blockedByOwner`, `requiredCombos`.
- **`isCardBlockedByTable(state, card)`** (già in `src/engine/gameEngine.ts`):
  - Restituisce `{ blocked: boolean; ownerName?: string }` secondo la regola GDD dei **Personaggi Doppi**.
- **`calculateCashInTokens(dice, bonusTokens, highFacesMode)`** (già in `src/engine/dice.ts`):
  - Calcola la resa esatta dell'azione **Incassa** (`1 + dadi 5/6 + bonus passivi`).
- **`evaluateObjective(playedCards, objective, requiredTeamSize)`** (già in `src/engine/objectives.ts`):
  - Valuta progresso e carte eventualmente incompatibili con l'Obiettivo del giocatore.

## 4. Calcolo Budget Matematico nell'Editor Carte (`estimateCardBudget`)
- **`estimateCardBudget(card: CardData): { targetBudget: number; estimatedValue: number; status: 'SOTTO_BUDGET' | 'BILANCIATA' | 'SOPRA_BUDGET'; note: string }`**
  - Calcola il budget teorico GDD (`costo - 1` gettoni) e lo confronta con la stima parametrica del modello effetto (`Quando entra` = 1×, `Finché è in gioco` = 2.5×).
