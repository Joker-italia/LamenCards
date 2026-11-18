import { DEFAULT_CARDS, DEFAULT_GAME_CONFIG, DEFAULT_OBJECTIVES } from '../data/defaultData';
import {
  calculateCashInTokens,
  evaluateDiceCombos,
  flipDieOppositeFace,
} from './dice';
import {
  applyGameAction,
  CardBudgetEvaluation,
  createInitialGameState,
  evaluateCatalogBudget,
  getActiveModifiers,
  getCardIdentityKey,
  getLegalActions,
  getPlayableCards,
   getRequiredCombo,
  isCardBlockedByTable,
  normalizeGameConfig,
  wouldCreateDuplicateInTeam,
} from './gameEngine';
import { evaluateObjective } from './objectives';
import {
  DEFAULT_RNG_SEED,
  hashSeed,
  nextRngInt,
  RngStateHolder,
  rollDieFromRng,
} from './rng';
import {
  CardData,
  DiceComboId,
  GameAction,
  GameConfig,
  GameState,
  PlayerState,
} from './types';

export type BotStrategy = 'RANDOM' | 'GREEDY';

/**
 * Calcola quali dadi conviene tenere (array di booleani) per perseguire una specifica combinazione.
 */
export function computeOptimalKeepMaskForCombo(
  dice: number[],
  targetCombo: DiceComboId | 'CASH_IN',
  highFacesOnlySix = false
): boolean[] {
  const n = dice.length;
  if (n === 0) return [];

  if (targetCombo === 'CASH_IN') {
    return dice.map((d) => (highFacesOnlySix ? d === 6 : d === 5 || d === 6));
  }

  const achieved = evaluateDiceCombos(dice);
  if (achieved.includes(targetCombo)) {
    return dice.map(() => true);
  }

  const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  for (const d of dice) {
    if (d >= 1 && d <= 6) counts[d] = (counts[d] || 0) + 1;
  }

  switch (targetCombo) {
    case 'ONE_PAIR': {
      // Tieni i dadi della faccia più frequente (o il dado più alto se tutti distinti)
      let bestFace = 6;
      let bestCount = 0;
      for (let f = 6; f >= 1; f--) {
        if (counts[f] > bestCount) {
          bestCount = counts[f];
          bestFace = f;
        }
      }
      return dice.map((d) => d === bestFace);
    }

    case 'TWO_PAIR': {
      // Se ci sono facce con >= 2 dadi, tienine fino a 2 per ciascuna faccia accoppiata
      const pairedFaces = [6, 5, 4, 3, 2, 1].filter((f) => counts[f] >= 2);
      if (pairedFaces.length > 0) {
        const keptPerFace: Record<number, number> = {};
        return dice.map((d) => {
          if (!pairedFaces.includes(d)) return false;
          const used = keptPerFace[d] || 0;
          if (used < 2) {
            keptPerFace[d] = used + 1;
            return true;
          }
          return false;
        });
      }
      // Altrimenti tieni 1 solo dado (il più alto)
      const maxVal = Math.max(...dice);
      let keptOne = false;
      return dice.map((d) => {
        if (!keptOne && d === maxVal) {
          keptOne = true;
          return true;
        }
        return false;
      });
    }

    case 'STRAIGHT_4':
    case 'STRAIGHT_5': {
      const windows =
        targetCombo === 'STRAIGHT_5'
          ? [
              [1, 2, 3, 4, 5],
              [2, 3, 4, 5, 6],
            ]
          : [
              [2, 3, 4, 5], // Preferita a parità perché aperta su entrambi i lati
              [1, 2, 3, 4],
              [3, 4, 5, 6],
            ];

      let bestWindow = windows[0];
      let bestHits = -1;
      for (const w of windows) {
        const hits = w.filter((face) => counts[face] > 0).length;
        if (hits > bestHits) {
          bestHits = hits;
          bestWindow = w;
        }
      }

      const keptFaces = new Set<number>();
      return dice.map((d) => {
        if (bestWindow.includes(d) && !keptFaces.has(d)) {
          keptFaces.add(d);
          return true;
        }
        return false;
      });
    }

    case 'FULL_HOUSE': {
      const multiFaces = [6, 5, 4, 3, 2, 1].filter((f) => counts[f] >= 2);
      if (multiFaces.length > 0) {
        const keptCountByFace: Record<number, number> = {};
        return dice.map((d) => {
          if (!multiFaces.includes(d)) return false;
          const used = keptCountByFace[d] || 0;
          // Se abbiamo 4 dadi uguali e nessun'altra coppia, tienine 3 e ritira 2 per cercare la coppia (o il 5° uguale)
          if (used < 3) {
            keptCountByFace[d] = used + 1;
            return true;
          }
          return false;
        });
      }
      const maxVal = Math.max(...dice);
      let keptOne = false;
      return dice.map((d) => {
        if (!keptOne && d === maxVal) {
          keptOne = true;
          return true;
        }
        return false;
      });
    }

    case 'THREE_OF_A_KIND':
    case 'FOUR_OF_A_KIND':
    case 'FIVE_OF_A_KIND':
    default: {
      let bestFace = 6;
      let bestCount = 0;
      for (let f = 6; f >= 1; f--) {
        if (counts[f] > bestCount) {
          bestCount = counts[f];
          bestFace = f;
        }
      }
      return dice.map((d) => d === bestFace);
    }
  }
}

/**
 * Calcola un punteggio di progresso (0..100) di un insieme di carte rispetto all'Obiettivo del giocatore.
 */
function scoreTeamForObjective(
  cards: CardData[],
  objective: PlayerState['objective'],
  teamSize = 4
): number {
  if (!objective) return 100;
  if (evaluateObjective(cards, objective, teamSize).satisfied) return 100;

  switch (objective.ruleType) {
    case 'MIN_DISTINCT_CLASSES': {
      const distinct = new Set(cards.map((c) => c.cardClass)).size;
      return Math.min(99, distinct * 24);
    }
    case 'MIN_SAME_CLASS': {
      const counts: Record<string, number> = {};
      for (const c of cards) {
        counts[c.cardClass] = (counts[c.cardClass] || 0) + 1;
      }
      const cur = objective.targetClass
        ? counts[objective.targetClass] || 0
        : Math.max(0, ...Object.values(counts));
      return Math.min(99, (cur / Math.max(1, objective.targetNumber)) * 90);
    }
    case 'MIN_TOTAL_COST': {
      const total = cards.reduce((s, c) => s + c.cost, 0);
      return Math.min(99, (total / Math.max(1, objective.targetNumber)) * 90);
    }
    case 'FORBID_COST': {
      const bad = cards.filter((c) => c.cost === objective.targetNumber).length;
      return Math.max(0, 95 - bad * 35);
    }
    case 'ALL_EFFECT_TYPES': {
      const types = new Set(cards.map((c) => c.effectType)).size;
      return Math.min(99, types * 32);
    }
    case 'MAX_RARITY_COUNT': {
      const targetRarity = objective.targetRarity || 'PROMO';
      const matching = cards.filter((c) => c.rarity === targetRarity).length;
      const excess = Math.max(0, matching - objective.targetNumber);
      return Math.max(0, 95 - excess * 40);
    }
    default:
      return 50;
  }
}

/**
 *Verifica se aggiungere `candidate` alle carte giocate mantiene realizzabile l'Obiettivo del giocatore.
 */
function isCardCompatibleWithObjective(
  player: PlayerState,
  candidate: CardData,
  teamSize: number
): boolean {
  if (!player.objective) return true;
  const obj = player.objective;
  const projectedPlayed = [...player.played, candidate];
  const evalAfter = evaluateObjective(projectedPlayed, obj, teamSize);

  if (evalAfter.mismatchedCardIds.length > 0) {
    return false;
  }

  // Se sarebbe l'ultima carta della squadra, deve soddisfare l'obiettivo completo
  if (projectedPlayed.length >= teamSize) {
    return evalAfter.satisfied;
  }

  return true;
}

/**
 * Risolve una `pendingChoice` usando esclusivamente `getLegalActions` + `applyGameAction`.
 */
function resolveBotPendingChoice(state: GameState, strategy: BotStrategy): GameState {
  const choice = state.pendingChoice;
  if (!choice) return state;

  const legal = getLegalActions(state, choice.playerId).filter(
    (a): a is Extract<GameAction, { type: 'RESOLVE_PENDING_CHOICE' }> =>
      a.type === 'RESOLVE_PENDING_CHOICE'
  );
  if (legal.length === 0) return state;

  if (strategy === 'RANDOM') {
    const idx = nextRngInt(state, 0, legal.length - 1);
    return applyGameAction(state, legal[idx]);
  }

  const choosingPlayer = state.players.find((p) => p.id === choice.playerId);

  switch (choice.type) {
    case 'CHOOSE_TARGET_PLAYER':
    case 'CHOOSE_RICHEST_TIE': {
      // Scegli l'avversario con più carte in gioco (e a parità più gettoni)
      let bestAction = legal[0];
      let bestScore = -1;
      for (const act of legal) {
        const opp = state.players.find((p) => p.id === act.targetPlayerId);
        if (opp) {
          const score = opp.played.length * 100 + opp.tokens;
          if (score > bestScore) {
            bestScore = score;
            bestAction = act;
          }
        }
      }
      return applyGameAction(state, bestAction);
    }

    case 'CHOOSE_TARGET_PLAYED_CARD': {
      // Rimanda in mano la carta di costo più alto appartenente all'avversario più vicino alla vittoria
      let bestAction = legal[0];
      let bestScore = -1;
      for (const act of legal) {
        const entry = choice.eligiblePlayedCards?.find(
          (e) => e.card.id === act.targetPlayedCardId
        );
        const opp = state.players.find((p) => p.id === entry?.playerId);
        if (entry && opp) {
          const score = opp.played.length * 20 + entry.card.cost * 5;
          if (score > bestScore) {
            bestScore = score;
            bestAction = act;
          }
        }
      }
      return applyGameAction(state, bestAction);
    }

    case 'PAY_TOKEN_OR_FOUR_DICE': {
      const payAct = legal.find((a) => a.decision === 'PAY_TOKEN');
      const fourDiceAct = legal.find((a) => a.decision === 'FOUR_DICE');
      if (choosingPlayer && payAct && choosingPlayer.tokens >= 5) {
        const hasHighCostCard = choosingPlayer.hand.some((c) => c.cost >= 4);
        if (hasHighCostCard) {
          return applyGameAction(state, payAct);
        }
      }
      return applyGameAction(state, fourDiceAct || legal[0]);
    }

    case 'PASS_CARD_LEFT': {
      if (!choosingPlayer) return applyGameAction(state, legal[0]);
      // Passa preferibilmente una carta bloccata o incompatibile con l'obiettivo, o di costo più basso
      let bestAction = legal[0];
      let bestPriority = -100;
      for (const act of legal) {
        const card = choosingPlayer.hand.find((c) => c.id === act.cardId);
        if (!card) continue;
        const blocked = isCardBlockedByTable(state, card).blocked;
        const compatible = isCardCompatibleWithObjective(
          choosingPlayer,
          card,
          state.config.teamSize
        );
        const priority = (blocked ? 50 : 0) + (!compatible ? 40 : 0) + (6 - card.cost);
        if (priority > bestPriority) {
          bestPriority = priority;
          bestAction = act;
        }
      }
      return applyGameAction(state, bestAction);
    }

    case 'FREE_MARKET_SWAP': {
      if (!choosingPlayer) return applyGameAction(state, legal[0]);
      const skipAction = legal.find((a) => a.decision === 'SKIP');

      // Cerca se c'è in mano una carta bloccata o incompatibile con l'obiettivo
      for (const act of legal) {
        if (act.decision === 'SKIP') continue;
        const hCard = choosingPlayer.hand.find((c) => c.id === act.cardId);
        const mCard = state.market.find((c) => c.id === act.marketCardId);
        if (!hCard || !mCard) continue;

        const hBlocked = isCardBlockedByTable(state, hCard).blocked;
        const mBlocked = isCardBlockedByTable(state, mCard).blocked;
        const hCompat = isCardCompatibleWithObjective(
          choosingPlayer,
          hCard,
          state.config.teamSize
        );
        const mCompat = isCardCompatibleWithObjective(
          choosingPlayer,
          mCard,
          state.config.teamSize
        );

        if ((hBlocked || !hCompat) && !mBlocked && mCompat) {
          return applyGameAction(state, act);
        }
      }

      return applyGameAction(state, skipAction || legal[0]);
    }

    case 'GIORGIO_SWAP_CHOICE':
    default: {
      return applyGameAction(state, legal[0]);
    }
  }
}

/**
 * Esegue una singola mossa logica per il Bot usando esclusivamente `getLegalActions` + `applyGameAction`.
 */
export function executeBotTurnStep(
  state: GameState,
  strategy: BotStrategy = 'GREEDY'
): GameState {
  if (state.phase === 'PACK_OPENING') {
    for (const p of state.players) {
      if (!p.isBot) continue;
      const legal = getLegalActions(state, p.id);
      if (legal.length > 0) {
        return applyGameAction(state, legal[0]);
      }
    }
    return state;
  }

  if (state.phase === 'OBJECTIVE_PICK') {
    for (const p of state.players) {
      if (!p.isBot || p.objective) continue;
      const legal = getLegalActions(state, p.id);
      if (legal.length > 0) {
        return applyGameAction(state, legal[0]);
      }
    }
    return state;
  }

  if (state.phase !== 'PLAYING') return state;

  // 1. Se c'è una scelta interattiva in sospeso (`pendingChoice`), risolvila
  if (state.pendingChoice) {
    const chooser = state.players.find((p) => p.id === state.pendingChoice?.playerId);
    if (chooser && chooser.isBot) {
      return resolveBotPendingChoice(state, strategy);
    }
    return state;
  }

  // 2. Se c'è un'offerta di trattativa pendente rivolta a un bot
  if (state.pendingTradeOffer && state.pendingTradeOffer.status === 'PENDING') {
    const seller = state.players.find((p) => p.id === state.pendingTradeOffer?.toPlayerId);
    if (seller && seller.isBot) {
      const legal = getLegalActions(state, seller.id);
      if (legal.length > 0) {
        return applyGameAction(state, legal[0]);
      }
    }
  }

  const activePlayer = state.players[state.currentPlayerIndex];
  if (!activePlayer || !activePlayer.isBot) return state;

  const legalActions = getLegalActions(state, activePlayer.id);
  if (legalActions.length === 0) return state;

  // Strategia RANDOM legale: sceglie un'azione legale evitando loop infiniti di TOGGLE_KEEP_DIE
  if (strategy === 'RANDOM') {
    const nonToggle = legalActions.filter((a) => a.type !== 'TOGGLE_KEEP_DIE');
    const pool = nonToggle.length > 0 ? nonToggle : legalActions;
    const idx = nextRngInt(state, 0, pool.length - 1);
    return applyGameAction(state, pool[idx]);
  }

  // ==================== STRATEGIA GREEDY ====================

  // A. Se ha una carta giocata che viola direttamente l'Obiettivo (es. FORBID_COST o MAX_RARITY_COUNT), riprendila in mano
  if (activePlayer.objective) {
    const evalPlayed = evaluateObjective(
      activePlayer.played,
      activePlayer.objective,
      state.config.teamSize
    );
    if (
      evalPlayed.mismatchedCardIds.length > 0 &&
      (state.config.objectiveChangePolicy ?? state.config.onObjectiveMismatch) ===
        'ALLOW_RETURN_TO_HAND'
    ) {
      return applyGameAction(state, {
        type: 'RETURN_MISMATCHED_CARD_TO_HAND',
        playerId: activePlayer.id,
        playedCardId: evalPlayed.mismatchedCardIds[0],
      });
    }
  }

  // B. Se ha in mano una carta bloccata dal tavolo o può migliorare la compatibilità con l'Obiettivo, scambiala col Mercato
  const marketSwaps = legalActions.filter(
    (a): a is Extract<GameAction, { type: 'MARKET_SWAP' }> => a.type === 'MARKET_SWAP'
  );
  if (marketSwaps.length > 0) {
    const fullTeamProjected = [...activePlayer.played, ...activePlayer.hand];
    const currentObjScore = scoreTeamForObjective(
      fullTeamProjected,
      activePlayer.objective,
      state.config.teamSize
    );

    let bestSwap: Extract<GameAction, { type: 'MARKET_SWAP' }> | null = null;
    let bestSwapGain = 0;

    for (const swapAct of marketSwaps) {
      const hCard = activePlayer.hand.find((c) => c.id === swapAct.handCardId);
      const mCard = state.market.find((c) => c.id === swapAct.marketCardId);
      if (!hCard || !mCard) continue;

      const hBlocked = isCardBlockedByTable(state, hCard).blocked;
      const mBlocked = isCardBlockedByTable(state, mCard).blocked;
      if (mBlocked) continue;

      const afterSwapTeam = [
        ...activePlayer.played,
        ...activePlayer.hand.filter((c) => c.id !== hCard.id),
        mCard,
      ];
      const afterObjScore = scoreTeamForObjective(
        afterSwapTeam,
        activePlayer.objective,
        state.config.teamSize
      );

      const gain = (hBlocked ? 40 : 0) + (afterObjScore - currentObjScore);
      if (gain > bestSwapGain) {
        bestSwapGain = gain;
        bestSwap = swapAct;
      }
    }

    if (bestSwap && bestSwapGain > 0) {
      return applyGameAction(state, bestSwap);
    }
  }

  // C. Controlla se può usare "Il Dado Fortunato" (`FLIP_DIE_OPPOSITE`) per sbloccare subito una carta giocabile
  const flipActions = legalActions.filter(
    (a): a is Extract<GameAction, { type: 'FLIP_DIE_OPPOSITE' }> =>
      a.type === 'FLIP_DIE_OPPOSITE'
  );
  const currentPlayActions = legalActions.filter(
    (a): a is Extract<GameAction, { type: 'PLAY_CARD' }> => a.type === 'PLAY_CARD'
  );

  if (flipActions.length > 0 && currentPlayActions.length === 0) {
    for (const flipAct of flipActions) {
      const testDice = [...state.dice];
      testDice[flipAct.dieIndex] = flipDieOppositeFace(testDice[flipAct.dieIndex]);
      const testState: GameState = { ...state, dice: testDice };
      const unlocked = getPlayableCards(testState, activePlayer.id).some(
        (info) =>
          info.playable &&
          isCardCompatibleWithObjective(activePlayer, info.card, state.config.teamSize)
      );
      if (unlocked) {
        return applyGameAction(state, flipAct);
      }
    }
  }

  // D. Se esiste almeno una carta giocabile compatibile con l'Obiettivo, giocala!
  const compatiblePlayActions = currentPlayActions.filter((act) => {
    const card = activePlayer.hand.find((c) => c.id === act.cardId);
    return card
      ? isCardCompatibleWithObjective(activePlayer, card, state.config.teamSize)
      : false;
  });

  if (compatiblePlayActions.length > 0) {
    // Se siamo ancora in ROLLING, possiamo confermare i dadi oppure giocare direttamente
    compatiblePlayActions.sort((a, b) => {
      const ca = activePlayer.hand.find((c) => c.id === a.cardId)!;
      const cb = activePlayer.hand.find((c) => c.id === b.cardId)!;
      // Preferisci After Party se hai abbastanza gettoni per una seconda carta, altrimenti costo più alto
      if (ca.effectModel.templateId === 'PLAY_EXTRA_CARD_NO_COMBO') return -1;
      if (cb.effectModel.templateId === 'PLAY_EXTRA_CARD_NO_COMBO') return 1;
      return cb.cost - ca.cost;
    });

    const chosenAct = compatiblePlayActions[0];
    const opponents = state.players
      .filter((p) => p.id !== activePlayer.id)
      .sort((a, b) => b.played.length - a.played.length || b.tokens - a.tokens);

    return applyGameAction(state, {
      ...chosenAct,
      targetPlayerId: opponents[0]?.id,
    });
  }

  // E. Se siamo in ROLLING e abbiamo ancora tiri (`rollsLeft > 0`), tieni i dadi verso l'obiettivo migliore e ritira
  const rollAction = legalActions.find((a) => a.type === 'ROLL_DICE');
  if (rollAction && state.turnStep === 'ROLLING' && state.rollsLeft > 0) {
    // Trova la carta in mano non bloccata e compatibile che il bot può permettersi in gettoni
    const affordableCards = activePlayer.hand
      .filter(
        (c) =>
          !isCardBlockedByTable(state, c).blocked &&
          isCardCompatibleWithObjective(activePlayer, c, state.config.teamSize) &&
          activePlayer.tokens >=
            Math.max(
              0,
              c.cost -
                getActiveModifiers(activePlayer, state.config.enableCardEffects).costDiscount
            )
      )
      .sort((a, b) => b.cost - a.cost);

    let targetCombo: DiceComboId | 'CASH_IN' = 'CASH_IN';
    if (affordableCards.length > 0) {
      const req = getRequiredCombo(state, activePlayer.id, affordableCards[0]);
      targetCombo = req.requiredCombos[0] || 'ONE_PAIR';
    }

    const isSixOnly =
      state.config.cashInMode === 'SIX_ONLY' ||
      state.config.cashInHighFaces === 'ONLY_SIX' ||
      state.config.cashInHighFaces === 'SIX_ONLY';
    const desiredKeep = computeOptimalKeepMaskForCombo(state.dice, targetCombo, isSixOnly);

    let working = state;
    for (let i = 0; i < working.dice.length; i++) {
      if (working.keptDice[i] !== desiredKeep[i]) {
        working = applyGameAction(working, {
          type: 'TOGGLE_KEEP_DIE',
          playerId: activePlayer.id,
          dieIndex: i,
        });
      }
    }
    return applyGameAction(working, rollAction);
  }

  // F. Se siamo in ROLLING e non abbiamo più tiri (o non vogliamo tirare), conferma i dadi (`CONFIRM_DICE_ROLL`)
  const confirmRollAction = legalActions.find((a) => a.type === 'CONFIRM_DICE_ROLL');
  if (confirmRollAction && state.turnStep === 'ROLLING') {
    return applyGameAction(state, confirmRollAction);
  }

  // G. Prima di fare INCASSA, se ha Il Dado Fortunato inutilizzato e può girare un 1 o 2 in 6 o 5, fallo!
  if (flipActions.length > 0 && !state.mainActionTaken) {
    const isSixOnly =
      state.config.cashInMode === 'SIX_ONLY' ||
      state.config.cashInHighFaces === 'ONLY_SIX' ||
      state.config.cashInHighFaces === 'SIX_ONLY';
    const goodFlip = flipActions.find((fa) => {
      const face = state.dice[fa.dieIndex];
      return isSixOnly ? face === 1 : face === 1 || face === 2;
    });
    if (goodFlip) {
      return applyGameAction(state, goodFlip);
    }
  }

  // H. Scegli INCASSA (`CASH_IN_DICE`) se l'azione principale non è ancora stata presa
  const cashInAction = legalActions.find((a) => a.type === 'CASH_IN_DICE');
  if (cashInAction) {
    return applyGameAction(state, cashInAction);
  }

  // I. Chiudi il turno (`END_TURN`)
  const endTurnAction = legalActions.find((a) => a.type === 'END_TURN');
  if (endTurnAction) {
    return applyGameAction(state, endTurnAction);
  }

  return applyGameAction(state, legalActions[0]);
}

// ============================================================================
// SIMULATORE HEADLESS & STATISTICHE DI BILANCIAMENTO (Step 4)
// ============================================================================

export interface SimulationCardStat {
  cardId?: string;
  cardName: string;
  cardClass: string;
  cost: number;
  timesDraftedInTeam?: number;
  winsWhenInTeam?: number;
  winRateWhenInTeamPercent?: number;
  timesPlayed: number;
  playRateWhenInTeamPercent?: number;
  winsWhenInPlayedTeam: number;
  winRatePercent: number;
  averageTurnPlayed?: number;
}

export interface SimulationObjectiveStat {
  objectiveId: string;
  title: string;
  ruleType: string;
  timesPicked: number;
  wins: number;
  winRatePercent: number;
}

export interface DiceComboProbabilityStat {
  cost: number;
  comboId: DiceComboId;
  comboLabel: string;
  gddExpected5DicePercent: number;
  simulated5DicePercent: number;
  gddExpected4DicePercent: number | null;
  simulated4DicePercent: number;
}

export interface DurationDistribution {
  mean: number;
  median: number;
  p90: number;
  min: number;
  max: number;
}

export interface DuplicateBlockMetrics {
  gamesWithSharedStarterCopyPercent: number;
  averageBlockedHandsPerGame: number;
  gamesWithAtLeastOneActiveBlockPercent: number;
}

export interface WatchlistComparisonEntry {
  cardName: string;
  cost: number;
  winRate3pPercent?: number;
  winRate4pPercent?: number;
  winRate6pPercent?: number;
  averageTurnPlayed?: number;
  alertLevel: 'OK' | 'OSSERVAZIONE' | 'DOMINANTE';
  comment: string;
}

export interface SimulationReport {
  gamesSimulated: number;
  playerCount: number;
  seed?: number;
  botStrategy?: BotStrategy;
  averageRounds: number;
  averageTurns?: number;
  roundsDistribution?: DurationDistribution;
  turnsDistribution?: DurationDistribution;
  estimatedMinutesPerGame: number;
  seatWinRatesPercent?: number[]; // Indice 0 = primo giocatore, ecc.
  firstPlayerAdvantageDeltaPercent?: number;
  averageCashInTokens?: number;
  totalCashInActions?: number;
  duplicateBlockMetrics?: DuplicateBlockMetrics;
  diceComboProbabilities?: DiceComboProbabilityStat[];
  cardStats: SimulationCardStat[];
  objectiveStats?: SimulationObjectiveStat[];
  budgetEvaluations?: CardBudgetEvaluation[];
  watchlist?: WatchlistComparisonEntry[];
}

export interface RunSimulationOptions {
  games?: number;
  players?: number;
  seed?: number;
  config?: Partial<GameConfig>;
  botStrategy?: BotStrategy;
  catalog?: CardData[];
  includeDiceMonteCarlo?: boolean;
  diceTrials?: number;
}

function computePercentiles(values: number[]): DurationDistribution {
  if (values.length === 0) {
    return { mean: 0, median: 0, p90: 0, min: 0, max: 0 };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  const mean = Number((sum / sorted.length).toFixed(1));
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0
      ? Number(((sorted[mid - 1] + sorted[mid]) / 2).toFixed(1))
      : sorted[mid];
  const p90Idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.9));
  const p90 = sorted[p90Idx];
  return {
    mean,
    median,
    p90,
    min: sorted[0],
    max: sorted[sorted.length - 1],
  };
}

/**
 * Simula la probabilità reale in 3 tiri di ciascuna combinazione con 5 e 4 dadi
 * giocando specificamente per quella combinazione (confronto con tabella GDD §3).
 */
export function simulateDiceComboProbabilities(
  trials = 10000,
  seed = DEFAULT_RNG_SEED
): DiceComboProbabilityStat[] {
  const rng: RngStateHolder = { rngState: hashSeed(seed) };

  const targets: Array<{
    cost: number;
    comboId: DiceComboId;
    gdd5: number;
    gdd4: number | null;
  }> = [
    { cost: 2, comboId: 'ONE_PAIR', gdd5: 100, gdd4: null },
    { cost: 3, comboId: 'TWO_PAIR', gdd5: 77, gdd4: null },
    { cost: 4, comboId: 'STRAIGHT_4', gdd5: 59, gdd4: 31 },
    { cost: 5, comboId: 'FULL_HOUSE', gdd5: 37, gdd4: null },
    { cost: 6, comboId: 'FOUR_OF_A_KIND', gdd5: 29, gdd4: 10 },
  ];

  const labels: Record<DiceComboId, string> = {
    ONE_PAIR: 'Una coppia',
    TWO_PAIR: 'Doppia coppia',
    THREE_OF_A_KIND: 'Tris',
    STRAIGHT_4: 'Scala di 4',
    FULL_HOUSE: 'Full',
    FOUR_OF_A_KIND: 'Poker',
    STRAIGHT_5: 'Scala di 5',
    FIVE_OF_A_KIND: '5 Dadi Uguali',
  };

  function runForDiceCount(comboId: DiceComboId, diceCount: number): number {
    let hits = 0;
    for (let t = 0; t < trials; t++) {
      let dice = Array.from({ length: diceCount }, () => rollDieFromRng(rng));
      if (evaluateDiceCombos(dice).includes(comboId)) {
        hits++;
        continue;
      }
      for (let roll = 2; roll <= 3; roll++) {
        const keepMask = computeOptimalKeepMaskForCombo(dice, comboId);
        dice = dice.map((val, idx) => (keepMask[idx] ? val : rollDieFromRng(rng)));
        if (evaluateDiceCombos(dice).includes(comboId)) {
          hits++;
          break;
        }
      }
    }
    return Number(((hits / Math.max(1, trials)) * 100).toFixed(1));
  }

  return targets.map((t) => ({
    cost: t.cost,
    comboId: t.comboId,
    comboLabel: labels[t.comboId],
    gddExpected5DicePercent: t.gdd5,
    simulated5DicePercent: runForDiceCount(t.comboId, 5),
    gddExpected4DicePercent: t.gdd4,
    simulated4DicePercent: runForDiceCount(t.comboId, 4),
  }));
}

/**
 * Funzione principale di simulazione headless e pura (Step 4 Task 2).
 * Eseguibile sia da CLI (`scripts/simulate.ts`) sia da Web Worker nella UI.
 */
export function runSimulation(options: RunSimulationOptions = {}): SimulationReport {
  const numGames = Math.max(1, options.games ?? 100);
  const playerCount = Math.min(6, Math.max(2, options.players ?? 4));
  const baseSeed = hashSeed(options.seed ?? 42);
  const botStrategy: BotStrategy = options.botStrategy ?? 'GREEDY';
  const catalog = options.catalog && options.catalog.length > 0 ? options.catalog : DEFAULT_CARDS;
  const config = normalizeGameConfig(options.config, DEFAULT_GAME_CONFIG);

  const roundsList: number[] = [];
  const turnsList: number[] = [];
  const seatWins = Array.from({ length: playerCount }, () => 0);

  let totalCashInSum = 0;
  let totalCashInCount = 0;
  let gamesWithSharedCopy = 0;
  let gamesWithActiveBlock = 0;
  let totalBlockedHandsInstances = 0;

  const cardTracker: Record<
    string,
    {
      cardId: string;
      cardName: string;
      cardClass: string;
      cost: number;
      draftedInTeam: number;
      winsWhenInTeam: number;
      timesPlayed: number;
      winsWhenPlayed: number;
      turnPlayedSum: number;
    }
  > = {};

  for (const c of catalog) {
    cardTracker[c.name] = {
      cardId: c.id,
      cardName: c.name,
      cardClass: c.cardClass,
      cost: c.cost,
      draftedInTeam: 0,
      winsWhenInTeam: 0,
      timesPlayed: 0,
      winsWhenPlayed: 0,
      turnPlayedSum: 0,
    };
  }

  const objTracker: Record<
    string,
    {
      objectiveId: string;
      title: string;
      ruleType: string;
      timesPicked: number;
      wins: number;
    }
  > = {};
  for (const obj of DEFAULT_OBJECTIVES) {
    objTracker[obj.id] = {
      objectiveId: obj.id,
      title: obj.title,
      ruleType: obj.ruleType,
      timesPicked: 0,
      wins: 0,
    };
  }

  for (let g = 0; g < numGames; g++) {
    const gameSeed = hashSeed(baseSeed + g * 9973);
    let state = createInitialGameState(`SIM-${g}`, catalog, config, gameSeed);

    for (let p = 0; p < playerCount; p++) {
      state = applyGameAction(state, {
        type: 'ADD_PLAYER',
        id: `bot-${p}`,
        name: `Bot ${p + 1}`,
        isBot: true,
        isHost: p === 0,
      });
    }

    state = applyGameAction(state, { type: 'START_PACK_OPENING' });

    for (const p of state.players) {
      state = applyGameAction(state, { type: 'CONFIRM_DRAFT_TEAM', playerId: p.id });
    }

    // Statistiche di sovrapposizione carte nelle squadre iniziali
    const initialStarterKeyCounts: Record<string, number> = {};
    const initialStartersByPlayer: Record<string, Set<string>> = {};

    for (const p of state.players) {
      initialStartersByPlayer[p.id] = new Set();
      for (const c of p.hand) {
        const key = getCardIdentityKey(c);
        initialStarterKeyCounts[key] = (initialStarterKeyCounts[key] || 0) + 1;
        initialStartersByPlayer[p.id].add(c.name);
      }
      if (p.objective && objTracker[p.objective.id]) {
        objTracker[p.objective.id].timesPicked += 1;
      }
    }

    if (Object.values(initialStarterKeyCounts).some((cnt) => cnt >= 2)) {
      gamesWithSharedCopy += 1;
    }

    const playedTurnByPlayerCard = new Map<string, number>();
    let totalIndividualTurns = 0;
    let lastPlayerIdx = -1;
    let hadActiveBlockInThisGame = false;

    let safetySteps = 0;
    const maxSteps = 500;

    while (state.phase === 'PLAYING' && safetySteps < maxSteps) {
      if (state.currentPlayerIndex !== lastPlayerIdx && state.pendingChoice === null) {
        totalIndividualTurns += 1;
        lastPlayerIdx = state.currentPlayerIndex;

        const currP = state.players[state.currentPlayerIndex];
        if (currP) {
          const blockedInHandCount = currP.hand.filter(
            (c) => isCardBlockedByTable(state, c).blocked
          ).length;
          if (blockedInHandCount > 0) {
            totalBlockedHandsInstances += blockedInHandCount;
            hadActiveBlockInThisGame = true;
          }
        }
      }

      const prevLogTopId = state.actionLog[0]?.id;
      const prevTokens = state.players[state.currentPlayerIndex]?.tokens ?? 0;

      state = executeBotTurnStep(state, botStrategy);
      safetySteps++;

      const newTopLog = state.actionLog[0];
      if (newTopLog && newTopLog.id !== prevLogTopId) {
        if (newTopLog.actionType === 'CASH_IN') {
          const currentP = state.players.find((p) => p.id === newTopLog.playerId);
          if (currentP) {
            const delta = Math.max(1, currentP.tokens - prevTokens);
            totalCashInSum += delta;
            totalCashInCount += 1;
          }
        }
      }

      for (const p of state.players) {
        for (const c of p.hand) {
          initialStartersByPlayer[p.id].add(c.name);
        }
        for (const c of p.played) {
          initialStartersByPlayer[p.id].add(c.name);
          const mapKey = `${p.id}::${c.id}`;
          if (!playedTurnByPlayerCard.has(mapKey)) {
            playedTurnByPlayerCard.set(mapKey, state.turnNumber);
          }
        }
      }
    }

    for (const p of state.players) {
      for (const cName of initialStartersByPlayer[p.id] || []) {
        if (cardTracker[cName]) {
          cardTracker[cName].draftedInTeam += 1;
        }
      }
    }

    if (hadActiveBlockInThisGame) {
      gamesWithActiveBlock += 1;
    }

    roundsList.push(state.turnNumber);
    turnsList.push(Math.max(1, totalIndividualTurns));

    const winnerIdx = state.players.findIndex((p) => p.id === state.winnerPlayerId);
    if (winnerIdx !== -1) {
      seatWins[winnerIdx] += 1;
    }

    for (const p of state.players) {
      const isWinner = state.winnerPlayerId === p.id;
      if (isWinner) {
        if (p.objective && objTracker[p.objective.id]) {
          objTracker[p.objective.id].wins += 1;
        }
        for (const cName of initialStartersByPlayer[p.id] || []) {
          if (cardTracker[cName]) {
            cardTracker[cName].winsWhenInTeam += 1;
          }
        }
      }

      const seenInPlayed = new Set<string>();
      for (const c of p.played) {
        if (seenInPlayed.has(c.name)) continue;
        seenInPlayed.add(c.name);
        const entry = cardTracker[c.name];
        if (entry) {
          entry.timesPlayed += 1;
          if (isWinner) {
            entry.winsWhenPlayed += 1;
          }
          const tPlayed = playedTurnByPlayerCard.get(`${p.id}::${c.id}`) ?? state.turnNumber;
          entry.turnPlayedSum += tPlayed;
        }
      }
    }
  }

  const roundsDist = computePercentiles(roundsList);
  const turnsDist = computePercentiles(turnsList);
  // Stima durata reale al tavolo tra umani (~55s per turno singolo inclusi dadi, scelte e trattative)
  const estimatedMinutesPerGame = Number((turnsDist.mean * 0.9).toFixed(1));

  const seatWinRatesPercent = seatWins.map((w) =>
    Number(((w / numGames) * 100).toFixed(1))
  );
  const expectedFairWinRate = 100 / playerCount;
  const firstPlayerAdvantageDeltaPercent = Number(
    (seatWinRatesPercent[0] - expectedFairWinRate).toFixed(1)
  );

  const cardStats: SimulationCardStat[] = Object.values(cardTracker).map((item) => {
    const winRateWhenPlayed =
      item.timesPlayed > 0
        ? Number(((item.winsWhenPlayed / item.timesPlayed) * 100).toFixed(1))
        : 0;
    const winRateWhenInTeam =
      item.draftedInTeam > 0
        ? Number(((item.winsWhenInTeam / item.draftedInTeam) * 100).toFixed(1))
        : 0;
    const playRateWhenInTeam =
      item.draftedInTeam > 0
        ? Number(((item.timesPlayed / item.draftedInTeam) * 100).toFixed(1))
        : 0;
    const avgTurn =
      item.timesPlayed > 0
        ? Number((item.turnPlayedSum / item.timesPlayed).toFixed(1))
        : 0;

    return {
      cardId: item.cardId,
      cardName: item.cardName,
      cardClass: item.cardClass,
      cost: item.cost,
      timesDraftedInTeam: item.draftedInTeam,
      winsWhenInTeam: item.winsWhenInTeam,
      winRateWhenInTeamPercent: winRateWhenInTeam,
      timesPlayed: item.timesPlayed,
      playRateWhenInTeamPercent: playRateWhenInTeam,
      winsWhenInPlayedTeam: item.winsWhenPlayed,
      winRatePercent: Math.round(winRateWhenPlayed),
      averageTurnPlayed: avgTurn,
    };
  });

  cardStats.sort((a, b) => b.winRatePercent - a.winRatePercent || b.timesPlayed - a.timesPlayed);

  const objectiveStats: SimulationObjectiveStat[] = Object.values(objTracker).map((o) => ({
    objectiveId: o.objectiveId,
    title: o.title,
    ruleType: o.ruleType,
    timesPicked: o.timesPicked,
    wins: o.wins,
    winRatePercent:
      o.timesPicked > 0 ? Number(((o.wins / o.timesPicked) * 100).toFixed(1)) : 0,
  }));

  objectiveStats.sort((a, b) => b.winRatePercent - a.winRatePercent);

  const diceComboProbabilities =
    options.includeDiceMonteCarlo !== false
      ? simulateDiceComboProbabilities(options.diceTrials ?? 5000, baseSeed)
      : [];

  const budgetEvaluations = evaluateCatalogBudget(catalog);

  const watchlistNames = [
    'Il Letargo',
    'After Party',
    'Giro di Shot',
    'Anima della Festa',
    'Offro Io',
  ];
  const watchlist: WatchlistComparisonEntry[] = watchlistNames.map((wName) => {
    const stat = cardStats.find((c) => c.cardName === wName);
    const wr = stat?.winRatePercent ?? 0;
    const expected = Math.round(100 / playerCount);
    const alertLevel: WatchlistComparisonEntry['alertLevel'] =
      wr >= expected + 15
        ? 'DOMINANTE'
        : wr >= expected + 8 || wr <= expected - 10
        ? 'OSSERVAZIONE'
        : 'OK';

    return {
      cardName: wName,
      cost: stat?.cost ?? 0,
      winRate4pPercent: wr,
      averageTurnPlayed: stat?.averageTurnPlayed ?? 0,
      alertLevel,
      comment: `Win-rate giocata: ${wr}% (atteso ~${expected}% in ${playerCount} giocatori), giocata in media al giro ${stat?.averageTurnPlayed ?? '-'}.`,
    };
  });

  return {
    gamesSimulated: numGames,
    playerCount,
    seed: baseSeed,
    botStrategy,
    averageRounds: roundsDist.mean,
    averageTurns: turnsDist.mean,
    roundsDistribution: roundsDist,
    turnsDistribution: turnsDist,
    estimatedMinutesPerGame,
    seatWinRatesPercent,
    firstPlayerAdvantageDeltaPercent,
    averageCashInTokens:
      totalCashInCount > 0 ? Number((totalCashInSum / totalCashInCount).toFixed(2)) : 0,
    totalCashInActions: totalCashInCount,
    duplicateBlockMetrics: {
      gamesWithSharedStarterCopyPercent: Number(
        ((gamesWithSharedCopy / numGames) * 100).toFixed(1)
      ),
      averageBlockedHandsPerGame: Number(
        (totalBlockedHandsInstances / numGames).toFixed(2)
      ),
      gamesWithAtLeastOneActiveBlockPercent: Number(
        ((gamesWithActiveBlock / numGames) * 100).toFixed(1)
      ),
    },
    diceComboProbabilities,
    cardStats,
    objectiveStats,
    budgetEvaluations,
    watchlist,
  };
}

/**
 * Wrapper retrocompatibile usato da `RulesConfigModal.tsx`.
 */
export function runMonteCarloSimulation(
  catalog: CardData[],
  config: GameConfig,
  numGames = 100,
  playerCount = 4,
  seed = 42,
  botStrategy: BotStrategy = 'GREEDY'
): SimulationReport {
  return runSimulation({
    games: numGames,
    players: playerCount,
    seed,
    config,
    botStrategy,
    catalog,
    includeDiceMonteCarlo: false,
  });
}
