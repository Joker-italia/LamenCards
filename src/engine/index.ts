/**
 * ============================================================================
 * 🃏 LAMENCARDS — API PUBBLICA DEL MOTORE DI GIOCO (`src/engine/index.ts`)
 * ============================================================================
 *
 * Questo file definisce il contratto pubblico tra l'Engine (`src/engine/**`)
 * e l'Interfaccia Utente / Rete P2P (`src/ui/**`, `src/network/**`).
 *
 * Tutto ciò che la UI o l'Host P2P devono invocare è esportato da qui:
 *
 * 1. STATO E RIDUTTORE PURO DETERMINISTICO:
 *    - `createInitialGameState(roomCode, customCatalog?, customConfig?, explicitSeed?)`
 *    - `applyGameAction(state, action)` -> funzione pura e deterministica
 *    - `validateAction(state, action, actorPlayerId?)` -> validazione autoritativa
 *    - `normalizeGameConfig(partial?, base?)`
 *
 * 2. VISIBILITÀ PUBBLICA/PRIVATA E SELETTORI PER LA UI:
 *    - `getPublicStateFor(state, viewerPlayerId)` -> filtra mani coperte e obiettivi segreti altrui
 *    - `getLegalActions(state, playerId)` -> elenco di tutte le `GameAction` legali
 *    - `getPlayableCards(state, playerId)` -> giocabilità, costi effettivi e motivi di blocco
 *    - `getEffectiveCost(state, playerId, cardId, useNoComboAlternateCost?)`
 *    - `getRequiredCombo(state, playerId, cardOrCost)`
 *    - `getPendingChoiceFor(state, playerId)` -> scelta interattiva in sospeso per `playerId`
 *    - `getActiveModifiers(player, enableEffects?)` -> modificatori passivi `WHILE_IN_PLAY`
 *    - `canPlayCardRightNow(state, player, card)`
 *    - `isCardBlockedByTable(state, card)`
 *
 * 3. DADI E OBIETTIVI:
 *    - `COMBO_LABELS_IT`, `evaluateDiceCombos`, `calculateCashInTokens`,
 *      `canDiceSatisfyCardCost`, `flipDieOppositeFace`, `rollSingleDie`
 *    - `evaluateObjective`
 *
 * 4. BUDGET EFFETTI, CATALOGO MODELLI E SIMULATORE HEADLESS:
 *    - `EFFECT_MODEL_CATALOG`, `estimateCardBudget`, `evaluateCatalogBudget`
 *    - `executeBotTurnStep`, `runSimulation`, `runMonteCarloSimulation`,
 *      `simulateDiceComboProbabilities`, `computeOptimalKeepMaskForCombo`
 *
 * 5. RNG DETERMINISTICO:
 *    - `hashSeed`, `createSeededRng`, `nextRngFloat`, `nextRngInt`, `shuffleWithRng`
 * ============================================================================
 */

export * from './types';
export {
  COMBO_LABELS_IT,
  rollSingleDie,
  flipDieOppositeFace,
  evaluateDiceCombos,
  calculateCashInTokens,
  canDiceSatisfyCardCost,
} from './dice';
export {
   type ObjectiveEvaluation,
  evaluateObjective,
} from './objectives';
export {
  DEFAULT_RNG_SEED,
  type RngStateHolder,
  type IdCounterHolder,
  hashSeed,
  mulberry32Step,
  nextRngFloat,
  nextRngInt,
  rollDieFromRng,
  shuffleWithRng,
  createSeededRng,
  nextDeterministicId,
} from './rng';
export {
  EFFECT_MODEL_CATALOG,
  normalizeGameConfig,
  getCardIdentityKey,
  getActiveModifiers,
  isCardBlockedByTable,
  wouldCreateDuplicateInTeam,
  isPlayerProtectedByPiumone,
  hasLuckyDieInPlay,
  getLoSponsorDiscount,
  getEffectiveCardTokenCost,
  canPlayCardRightNow,
  createInitialGameState,
  generateBoosterPack,
  validateAction,
  applyGameAction,
  getPublicStateFor,
  getPendingChoiceFor,
  getEffectiveCost,
  getRequiredCombo,
  getPlayableCards,
  getLegalActions,
  type CardBudgetEvaluation,
  estimateCardBudget,
  evaluateCatalogBudget,
} from './gameEngine';
export {
  type BotStrategy,
  type SimulationCardStat,
  type SimulationObjectiveStat,
  type DiceComboProbabilityStat,
  type DurationDistribution,
  type DuplicateBlockMetrics,
  type WatchlistComparisonEntry,
  type SimulationReport,
  type RunSimulationOptions,
  computeOptimalKeepMaskForCombo,
  executeBotTurnStep,
  simulateDiceComboProbabilities,
  runSimulation,
  runMonteCarloSimulation,
} from './botSimulator';
