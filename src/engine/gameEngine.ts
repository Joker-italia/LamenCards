import {
  DEFAULT_CARDS,
  DEFAULT_COMBO_TABLE,
  DEFAULT_GAME_CONFIG,
  DEFAULT_OBJECTIVES,
  EFFECT_MODEL_CATALOG,
} from '../data/defaultData';
import {
  calculateCashInTokens,
  canDiceSatisfyCardCost,
  COMBO_LABELS_IT,
  evaluateDiceCombos,
  flipDieOppositeFace,
  rollSingleDie,
} from './dice';
import { evaluateObjective } from './objectives';
import {
  DEFAULT_RNG_SEED,
  hashSeed,
  nextDeterministicId,
  shuffleWithRng,
} from './rng';
import {
  ActionValidationResult,
  CardData,
  ComputedPlayerModifiers,
  DiceComboId,
  EffectTemplateId,
  GameAction,
  GameConfig,
  GameState,
  MoveLogEntry,
  PendingChoice,
  PendingChoiceOption,
  PlayableCardInfo,
  PlayerState,
  PublicEffectDiceRoll,
} from './types';

export { EFFECT_MODEL_CATALOG };

function cloneState(state: GameState): GameState {
  return {
    ...state,
    config: {
      ...state.config,
      costCombinationsTable: { ...state.config.costCombinationsTable },
      comboTable: state.config.comboTable
        ? { ...state.config.comboTable }
        : { ...state.config.costCombinationsTable },
    },
    catalog: state.catalog,
    objectivesDeck: state.objectivesDeck,
    players: state.players.map((p) => ({
      ...p,
      unopenedPacks: p.unopenedPacks.map((pk) => [...pk]),
      pulledPool: [...p.pulledPool],
      selectedStarterIds: [...p.selectedStarterIds],
      selectedReserveIds: [...p.selectedReserveIds],
      hand: [...p.hand],
      played: [...p.played],
      objectiveCandidates: [...p.objectiveCandidates],
      modifiers: {
        ...p.modifiers,
        repayDebtsNextTurn: p.modifiers.repayDebtsNextTurn.map((d) => ({ ...d })),
        revealedObjectivePlayerIds: [...p.modifiers.revealedObjectivePlayerIds],
      },
    })),
    market: [...state.market],
    dice: [...state.dice],
    keptDice: [...state.keptDice],
    pendingChoice: state.pendingChoice
      ? {
          ...state.pendingChoice,
          options: [...state.pendingChoice.options],
          eligibleTargetPlayerIds: state.pendingChoice.eligibleTargetPlayerIds
            ? [...state.pendingChoice.eligibleTargetPlayerIds]
            : undefined,
          eligibleHandCardIds: state.pendingChoice.eligibleHandCardIds
            ? [...state.pendingChoice.eligibleHandCardIds]
            : undefined,
          eligibleMarketCardIds: state.pendingChoice.eligibleMarketCardIds
            ? [...state.pendingChoice.eligibleMarketCardIds]
            : undefined,
          eligiblePlayedCards: state.pendingChoice.eligiblePlayedCards
            ? [...state.pendingChoice.eligiblePlayedCards]
            : undefined,
        }
      : null,
    pendingChoicesQueue: state.pendingChoicesQueue ? [...state.pendingChoicesQueue] : [],
    pendingPassLeftSelections: state.pendingPassLeftSelections
      ? { ...state.pendingPassLeftSelections }
      : undefined,
    lastEffectDiceRolls: state.lastEffectDiceRolls ? [...state.lastEffectDiceRolls] : [],
    pendingTradeOffer: state.pendingTradeOffer ? { ...state.pendingTradeOffer } : null,
    pendingDraftTrades: state.pendingDraftTrades.map((t) => ({ ...t })),
    actionLog: [...state.actionLog],
  };
}

function makeId(state: GameState, prefix = 'id'): string {
  return nextDeterministicId(state, prefix);
}

/**
 * Normalizza e mantiene sincronizzati tutti gli alias di `GameConfig` (Step 3 + retrocompatibilità UI).
 */
export function normalizeGameConfig(
  partial?: Partial<GameConfig>,
  base: GameConfig = DEFAULT_GAME_CONFIG
): GameConfig {
  const merged: GameConfig = {
    ...base,
    ...partial,
  };

  // extraPaidRoll <-> paidExtraRollEnabled
  if (partial?.extraPaidRoll !== undefined) {
    merged.paidExtraRollEnabled = Boolean(partial.extraPaidRoll);
  }
  merged.extraPaidRoll = Boolean(merged.paidExtraRollEnabled);

  // cashInMode <-> cashInHighFaces
  if (partial?.cashInMode !== undefined) {
    merged.cashInHighFaces =
      partial.cashInMode === 'SIX_ONLY' ? 'ONLY_SIX' : 'FIVE_AND_SIX';
  }
  merged.cashInMode =
    merged.cashInHighFaces === 'ONLY_SIX' || merged.cashInHighFaces === 'SIX_ONLY'
      ? 'SIX_ONLY'
      : 'FIVE_AND_SIX';

  // comboTable <-> costCombinationsTable
  if (partial?.comboTable !== undefined) {
    merged.costCombinationsTable = JSON.parse(JSON.stringify(partial.comboTable));
  } else if (partial?.costCombinationsTable !== undefined) {
    merged.costCombinationsTable = JSON.parse(JSON.stringify(partial.costCombinationsTable));
  } else if (!merged.costCombinationsTable) {
    merged.costCombinationsTable = JSON.parse(JSON.stringify(DEFAULT_COMBO_TABLE));
  }
  merged.comboTable = JSON.parse(JSON.stringify(merged.costCombinationsTable));

  // marketSwapPrice <-> marketSwapCost
  if (partial?.marketSwapPrice !== undefined) {
    merged.marketSwapCost = Math.max(0, Number(partial.marketSwapPrice));
  } else if (partial?.marketSwapCost !== undefined) {
    merged.marketSwapCost = Math.max(0, Number(partial.marketSwapCost));
  }
  merged.marketSwapPrice = merged.marketSwapCost;

  // marketSwapConsumesAction & marketSwapTiming
  if (partial?.marketSwapConsumesAction !== undefined) {
    merged.marketSwapConsumesAction = Boolean(partial.marketSwapConsumesAction);
  } else if (partial?.marketSwapTiming === 'REPLACES_MAIN_ACTION') {
    merged.marketSwapConsumesAction = true;
  } else if (merged.marketSwapConsumesAction === undefined) {
    merged.marketSwapConsumesAction = merged.marketSwapTiming === 'REPLACES_MAIN_ACTION';
  }

  // tradeRequiresCardBack <-> tradeRequiresCardSwap
  if (partial?.tradeRequiresCardBack !== undefined) {
    merged.tradeRequiresCardSwap = Boolean(partial.tradeRequiresCardBack);
  }
  merged.tradeRequiresCardBack = Boolean(merged.tradeRequiresCardSwap);

  // allowMultipleVersionsSamePerson <-> !uniquePersonPerTeam
  if (partial?.allowMultipleVersionsSamePerson !== undefined) {
    merged.uniquePersonPerTeam = !partial.allowMultipleVersionsSamePerson;
  }
  merged.allowMultipleVersionsSamePerson = !merged.uniquePersonPerTeam;

  // blockScope <-> blockAllVersionsOfSamePersonInPlay
  if (partial?.blockScope !== undefined) {
    merged.blockAllVersionsOfSamePersonInPlay = partial.blockScope === 'SAME_PERSON';
  }
  merged.blockScope = merged.blockAllVersionsOfSamePersonInPlay ? 'SAME_PERSON' : 'SAME_CARD';

  // objectiveHidden <-> objectiveVisibility
  if (partial?.objectiveHidden !== undefined) {
    merged.objectiveVisibility = partial.objectiveHidden ? 'SECRET' : 'PUBLIC';
  }
  merged.objectiveHidden = merged.objectiveVisibility === 'SECRET';

  // objectiveChangePolicy <-> onObjectiveMismatch
  if (partial?.objectiveChangePolicy !== undefined) {
    merged.onObjectiveMismatch = partial.objectiveChangePolicy;
  }
  merged.objectiveChangePolicy = merged.onObjectiveMismatch;

  if (!merged.richestTiePolicy) {
    merged.richestTiePolicy = 'FIRST_CLOCKWISE';
  }

  return merged;
}

function addLog(
  state: GameState,
  playerId: string,
  playerName: string,
  actionType: string,
  message: string,
  explicitTimestamp?: number
) {
  const id = makeId(state, 'log');
  const entry: MoveLogEntry = {
    id,
    turnNumber: state.turnNumber,
    timestamp: explicitTimestamp ?? state.nextIdCounter,
    playerId,
    playerName,
    actionType,
    message,
  };
  state.actionLog.unshift(entry);
  if (state.actionLog.length > 250) {
    state.actionLog.length = 250;
  }
}

function recordEffectDiceRoll(
  state: GameState,
  cardName: string,
  sourcePlayerId: string,
  rolls: Array<{ playerId: string; playerName: string; dice: number[] }>,
  summary: string
) {
  if (!state.lastEffectDiceRolls) {
    state.lastEffectDiceRolls = [];
  }
  state.lastEffectDiceRolls.unshift({
    id: makeId(state, 'efroll'),
    turnNumber: state.turnNumber,
    cardName,
    sourcePlayerId,
    rolls,
    summary,
  });
  if (state.lastEffectDiceRolls.length > 20) {
    state.lastEffectDiceRolls.length = 20;
  }
}

export function getCardIdentityKey(card: CardData): string {
  return (card.baseCardId || card.name).trim().toLowerCase();
}

/**
 * Calcola tutti i modificatori passivi `WHILE_IN_PLAY` di un giocatore basandosi esclusivamente
 * sui modelli di effetto (`EffectModel`) delle carte giocate, mai sul nome della carta.
 */
export function getActiveModifiers(
  player: PlayerState,
  enableEffects = true
): ComputedPlayerModifiers {
  const result: ComputedPlayerModifiers = {
    protectedFromBuyAndBounce: false,
    hasFlipDieOpposite: false,
    costDiscount: 0,
    comboTierDiscount: 0,
    cashInBonus: 0,
    turnStartGainTokens: 0,
    turnStartStealFromRichest: 0,
    onOtherPlayGainToken: [],
    leftNeighborCashInBonus: [],
  };

  if (!enableEffects || !player || !player.played) {
    return result;
  }

  for (const card of player.played) {
    const model = card.effectModel;
    if (!model || model.timing !== 'WHILE_IN_PLAY') continue;

    const val = model.params?.amount ?? model.value ?? 1;
    const secVal =
      model.params?.maxTriggersPerRound ??
      model.params?.secondaryAmount ??
      model.secondaryValue ??
      2;

    switch (model.templateId) {
      case 'PROTECT_FROM_BUY_AND_BOUNCE':
        result.protectedFromBuyAndBounce = true;
        break;
      case 'FLIP_DIE_OPPOSITE_ONCE_PER_TURN':
        result.hasFlipDieOpposite = true;
        break;
      case 'DISCOUNT_COST_AND_COMBO_TIER':
        result.costDiscount += val;
        result.comboTierDiscount += val;
        break;
      case 'CASH_IN_BONUS':
        result.cashInBonus += val;
        break;
      case 'TURN_START_GAIN_TOKENS':
        result.turnStartGainTokens += model.params?.amount ?? model.value ?? 2;
        break;
      case 'TURN_START_STEAL_FROM_RICHEST':
        result.turnStartStealFromRichest += val;
        break;
      case 'ON_OTHER_PLAY_GAIN_TOKEN':
        result.onOtherPlayGainToken.push({
          cardName: card.name,
          gain: val,
          maxPerRound: secVal,
        });
        break;
      case 'LEFT_NEIGHBOR_CASH_IN_BONUS':
        result.leftNeighborCashInBonus.push({
          cardName: card.name,
          bonus: val,
        });
        break;
      default:
        break;
    }
  }

  return result;
}

/**
 * Regola GDD "Personaggi doppi":
 * Lo stesso personaggio può essere nella squadra di più giocatori, ma in gioco ne entra uno solo:
 * il primo che lo gioca lo blocca per tutti gli altri. Se torna in mano, si sblocca.
 */
export function isCardBlockedByTable(
  state: GameState,
  card: CardData
): { blocked: boolean; ownerName?: string } {
  if (!state.config.blockDuplicateCardsInPlay) {
    return { blocked: false };
  }

  const targetCardKey = getCardIdentityKey(card);
  const targetPersonKey = card.personName.trim().toLowerCase();
  const blockSamePerson =
    state.config.blockAllVersionsOfSamePersonInPlay ||
    state.config.blockScope === 'SAME_PERSON';

  for (const p of state.players) {
    for (const playedCard of p.played) {
      if (getCardIdentityKey(playedCard) === targetCardKey) {
        return { blocked: true, ownerName: p.name };
      }
      if (
        blockSamePerson &&
        playedCard.personName.trim().toLowerCase() === targetPersonKey
      ) {
        return { blocked: true, ownerName: p.name };
      }
    }
  }

  return { blocked: false };
}

/**
 *Verifica se una carta creerebbe un doppione illegale nella squadra (mano + carte giocate) di un giocatore.
 */
export function wouldCreateDuplicateInTeam(
  player: PlayerState,
  candidateCard: CardData,
  config: GameConfig,
  excludingCardIds: string[] = []
): boolean {
  const existingCards = [
    ...player.played,
    ...player.hand.filter((c) => !excludingCardIds.includes(c.id)),
  ];
  const candidateKey = getCardIdentityKey(candidateCard);
  const candidatePerson = candidateCard.personName.trim().toLowerCase();
  const forbidSamePerson =
    config.uniquePersonPerTeam || config.allowMultipleVersionsSamePerson === false;

  for (const c of existingCards) {
    if (getCardIdentityKey(c) === candidateKey) return true;
    if (forbidSamePerson && c.personName.trim().toLowerCase() === candidatePerson) {
      return true;
    }
  }
  return false;
}

/** @deprecated Usa `getActiveModifiers(player, enableEffects).protectedFromBuyAndBounce` */
export function isPlayerProtectedByPiumone(player: PlayerState, enableEffects = true): boolean {
  return getActiveModifiers(player, enableEffects).protectedFromBuyAndBounce;
}

/** @deprecated Usa `getActiveModifiers(player, enableEffects).hasFlipDieOpposite` */
export function hasLuckyDieInPlay(player: PlayerState, enableEffects = true): boolean {
  return getActiveModifiers(player, enableEffects).hasFlipDieOpposite;
}

/** @deprecated Usa `getActiveModifiers(player, enableEffects).costDiscount` */
export function getLoSponsorDiscount(player: PlayerState, enableEffects = true): number {
  return getActiveModifiers(player, enableEffects).costDiscount;
}

export function getEffectiveCardTokenCost(
  player: PlayerState,
  card: CardData,
  enableEffects: boolean,
  useNoComboAlternateCost = false
): number {
  const altBase =
    card.effectModel.params?.alternateCost ??
    card.effectModel. params?.amount ??
    card.effectModel.value ??
    3;
  const base =
    useNoComboAlternateCost && card.effectModel.templateId === 'NO_COMBO_ALTERNATE_COST'
      ? altBase
      : card.cost;
  const activeMods = getActiveModifiers(player, enableEffects);
  const oneShotDiscount = enableEffects ? player.modifiers.nextCardDiscount || 0 : 0;
  return Math.max(0, base - activeMods.costDiscount - oneShotDiscount);
}

export function canPlayCardRightNow(
  state: GameState,
  player: PlayerState,
  card: CardData
): {
  canPlayStandard: boolean;
  canPlayNoComboAlt: boolean;
  standardCost: number;
  altCost: number;
  blockedByOwner?: string;
  requiredCombos: ReturnType<typeof canDiceSatisfyCardCost>['requiredCombos'];
  effectiveTier: number;
  reason?: string;
} {
  const blockCheck = isCardBlockedByTable(state, card);
  const activeMods = getActiveModifiers(player, state.config.enableCardEffects);
  const sponsorOffset = -activeMods.comboTierDiscount;
  const isTripActive = state.invertComboTableUntilPlayerId !== null;

  const comboCheck = canDiceSatisfyCardCost(
    state.dice,
    card.cost,
    state.config,
    sponsorOffset,
    isTripActive
  );

  const standardCost = getEffectiveCardTokenCost(
    player,
    card,
    state.config.enableCardEffects,
    false
  );
  const altCost = getEffectiveCardTokenCost(
    player,
    card,
    state.config.enableCardEffects,
    true
  );

  if (state.pendingChoice !== null) {
    return {
      canPlayStandard: false,
      canPlayNoComboAlt: false,
      standardCost,
      altCost,
      requiredCombos: comboCheck.requiredCombos,
      effectiveTier: comboCheck.effectiveTier,
      reason: 'Completa prima la scelta in sospeso.',
    };
  }

  if (blockCheck.blocked) {
    return {
      canPlayStandard: false,
      canPlayNoComboAlt: false,
      standardCost,
      altCost,
      blockedByOwner: blockCheck.ownerName,
      requiredCombos: comboCheck.requiredCombos,
      effectiveTier: comboCheck.effectiveTier,
      reason: `Carta bloccata: già giocata da ${blockCheck.ownerName}.`,
    };
  }

  if (player.modifiers.forbidPlayNextTurn) {
    return {
      canPlayStandard: false,
      canPlayNoComboAlt: false,
      standardCost,
      altCost,
      requiredCombos: comboCheck.requiredCombos,
      effectiveTier: comboCheck.effectiveTier,
      reason: 'Effetto "La Chiamata Persa": in questo turno non puoi scegliere Gioca.',
    };
  }

  // Se il giocatore ha giocato "After Party", può giocare una seconda carta senza combinazione di dadi pagando i gettoni
  if (player.modifiers.canPlayExtraCardWithoutCombo) {
    const enoughTokens = player.tokens >= standardCost;
    return {
      canPlayStandard: enoughTokens,
      canPlayNoComboAlt: false,
      standardCost,
      altCost,
      requiredCombos: comboCheck.requiredCombos,
      effectiveTier: comboCheck.effectiveTier,
      reason: enoughTokens ? undefined : `Gettoni insufficienti (servono ${standardCost}).`,
    };
  }

  if (state.mainActionTaken) {
    return {
      canPlayStandard: false,
      canPlayNoComboAlt: false,
      standardCost,
      altCost,
      requiredCombos: comboCheck.requiredCombos,
      effectiveTier: comboCheck.effectiveTier,
      reason: 'Azione principale del turno già effettuata.',
    };
  }

  const canPlayStandard = player.tokens >= standardCost && comboCheck.satisfied;
  const canPlayNoComboAlt =
    state.config.enableCardEffects &&
    card.effectModel.templateId === 'NO_COMBO_ALTERNATE_COST' &&
    player.tokens >= altCost;

  let reason: string | undefined;
  if (!canPlayStandard && !canPlayNoComboAlt) {
    if (player.tokens < standardCost) {
      reason = `Gettoni insufficienti (${player.tokens}/${standardCost}).`;
    } else if (!comboCheck.satisfied) {
      reason = `Combinazione dadi richiesta non soddisfatta (${comboCheck.requiredCombos
        .map((c) => COMBO_LABELS_IT[c])
        .join(' / ')}).`;
    }
  }

  return {
    canPlayStandard,
    canPlayNoComboAlt,
    standardCost,
    altCost,
    requiredCombos: comboCheck.requiredCombos,
    effectiveTier: comboCheck.effectiveTier,
    reason,
  };
}

export function createInitialGameState(
  roomCode = 'LAMEN',
  customCatalog?: CardData[],
  customConfig?: Partial<GameConfig>,
  explicitSeed?: number
): GameState {
  const config = normalizeGameConfig(customConfig, DEFAULT_GAME_CONFIG);
  const seed = explicitSeed ?? config.seed ?? hashSeed(roomCode || DEFAULT_RNG_SEED);
  const normalizedSeed = hashSeed(seed);

  return {
    roomCode,
    phase: 'LOBBY',
    config,
    catalog: customCatalog ? [...customCatalog] : [...DEFAULT_CARDS],
    objectivesDeck: [...DEFAULT_OBJECTIVES],
    rngSeed: normalizedSeed,
    rngState: normalizedSeed,
    nextIdCounter: 0,
    players: [],
    market: [],
    turnNumber: 1,
    currentPlayerIndex: 0,
    turnStep: 'ROLLING',
    dice: [1, 2, 3, 4, 5],
    keptDice: [false, false, false, false, false],
    rollsLeft: config.maxRollsPerTurn,
    hasUsedMarketThisTurn: false,
    hasMadeTradeOfferThisTurn: false,
    mainActionTaken: false,
    othersFourDiceUntilPlayerId: null,
    invertComboTableUntilPlayerId: null,
    pendingChoice: null,
    pendingChoicesQueue: [],
    pendingPassLeftSelections: undefined,
    lastEffectDiceRolls: [],
    pendingTradeOffer: null,
    pendingDraftTrades: [],
    winnerPlayerId: null,
    actionLog: [],
  };
}

/**
 * Regola GDD p.2 "1. Bustine":
 * Ogni bustina da 5 carte contiene 1 carta per classe (Dormienti, Utenti, Festaioli, Scrocconi)
 * più 1 carta jolly di classe a caso, che può essere rara o olografica (PROMO).
 * Così ognuno ha almeno 2 carte per classe.
 */
export function generateBoosterPack(
  state: GameState,
  catalog: CardData[],
  count: number,
  packSeed: number
): CardData[] {
  const mainClasses = ['Dormienti', 'Utenti', 'Festaioli', 'Scrocconi'];
  const pickedTemplates: CardData[] = [];
  const usedBaseIds = new Set<string>();

  for (const cls of mainClasses) {
    if (pickedTemplates.length >= count) break;
    const pool = shuffleWithRng(
      catalog.filter((c) => c.cardClass === cls),
      state
    );
    if (pool.length > 0) {
      pickedTemplates.push(pool[0]);
      usedBaseIds.add(getCardIdentityKey(pool[0]));
    }
  }

  // Carte jolly rimanenti (non duplicate nella stessa bustina)
  const remainingPool = shuffleWithRng(
    catalog.filter((c) => !usedBaseIds.has(getCardIdentityKey(c))),
    state
  );
  const fullShuffled = shuffleWithRng(catalog, state);

  while (pickedTemplates.length < count && fullShuffled.length > 0) {
    const candidate =
      remainingPool.shift() || fullShuffled[pickedTemplates.length % fullShuffled.length];
    pickedTemplates.push(candidate);
  }

  return pickedTemplates.map((template, i) => {
    const seq = makeId(state, 'c');
    return {
      ...template,
      baseCardId: template.baseCardId || template.id,
      id: `${template.baseCardId || template.id}-pk${packSeed}-${i}-${seq}`,
    };
  });
}

function getPassiveCashInBonus(player: PlayerState, enableEffects: boolean): number {
  return getActiveModifiers(player, enableEffects).cashInBonus;
}

function checkWinner(state: GameState): string | null {
  for (const player of state.players) {
    const evalResult = evaluateObjective(
      player.played,
      player.objective,
      state.config.teamSize
    );
    if (evalResult.satisfied) {
      return player.id;
    }
  }
  return null;
}

function finalizeVictoryIfReady(state: GameState) {
  if (state.phase !== 'PLAYING' || state.pendingChoice !== null) return;
  const winnerId = checkWinner(state);
  if (winnerId) {
    state.winnerPlayerId = winnerId;
    state.phase = 'GAME_OVER';
    const winner = state.players.find((p) => p.id === winnerId)!;
    addLog(
      state,
      winner.id,
      winner.name,
      'VICTORY',
      `🏆 ${winner.name} ha tutte e ${state.config.teamSize} le carte in gioco e rispetta l'Obiettivo "${winner.objective?.title}": VINCE LA PARTITA!`
    );
  }
}

function enqueuePendingChoices(state: GameState, choices: PendingChoice[]) {
  if (choices.length === 0) return;
  if (!state.pendingChoicesQueue) {
    state.pendingChoicesQueue = [];
  }
  state.pendingChoicesQueue.push(...choices);
  if (!state.pendingChoice) {
    state.pendingChoice = state.pendingChoicesQueue.shift() || null;
  }
}

function advancePendingChoiceQueue(state: GameState) {
  if (!state.pendingChoicesQueue) {
    state.pendingChoicesQueue = [];
  }
  state.pendingChoice = state.pendingChoicesQueue.shift() || null;
}

function getClockwiseOpponents(state: GameState, fromPlayerId: string): PlayerState[] {
  const idx = state.players.findIndex((p) => p.id === fromPlayerId);
  if (idx === -1) return state.players.filter((p) => p.id !== fromPlayerId);
  const result: PlayerState[] = [];
  for (let offset = 1; offset < state.players.length; offset++) {
    const p = state.players[(idx + offset) % state.players.length];
    if (p.id !== fromPlayerId) result.push(p);
  }
  return result;
}

function getClockwiseAllPlayers(state: GameState, fromPlayerId: string): PlayerState[] {
  const idx = state.players.findIndex((p) => p.id === fromPlayerId);
  if (idx === -1) return [...state.players];
  const result: PlayerState[] = [];
  for (let offset = 0; offset < state.players.length; offset++) {
    result.push(state.players[(idx + offset) % state.players.length]);
  }
  return result;
}

function setupTurnForPlayer(state: GameState, playerIndex: number, depth = 0) {
  state.currentPlayerIndex = playerIndex;
  const activePlayer = state.players[playerIndex];
  if (!activePlayer) return;

  // Scadenza effetti globali di 1 giro ("Sonno Contagioso" e "Il Trip") quando il turno torna a chi li ha lanciati
  if (state.othersFourDiceUntilPlayerId === activePlayer.id) {
    state.othersFourDiceUntilPlayerId = null;
    addLog(
      state,
      activePlayer.id,
      activePlayer.name,
      'EFFECT_EXPIRED',
      'L’effetto di "Sonno Contagioso" è terminato: tutti tornano a tirare 5 dadi!'
    );
  }

  if (state.invertComboTableUntilPlayerId === activePlayer.id) {
    state.invertComboTableUntilPlayerId = null;
    addLog(
      state,
      activePlayer.id,
      activePlayer.name,
      'EFFECT_EXPIRED',
      'L’effetto de "Il Trip" è terminato: la tabella delle combinazioni torna normale!'
    );
  }

  // Se il giocatore deve saltare il turno per "Il Letargo"
  if (activePlayer.modifiers.skipNextTurn && depth < state.players.length) {
    activePlayer.modifiers.skipNextTurn = false;
    addLog(
      state,
      activePlayer.id,
      activePlayer.name,
      'SKIP_TURN',
      `💤 ${activePlayer.name} salta il turno per l'effetto de "Il Letargo"!`
    );
    const nextIdx = (playerIndex + 1) % state.players.length;
    if (nextIdx === 0) state.turnNumber += 1;
    setupTurnForPlayer(state, nextIdx, depth + 1);
    return;
  }

  // Reset contatore "Anima della Festa" a inizio giro del proprietario
  activePlayer.modifiers.animaFestaTriggersThisRound = 0;
  activePlayer.modifiers.usedLuckyDieFlipThisTurn = false;
  activePlayer.modifiers.canPlayExtraCardWithoutCombo = false;

  // Pagamento debiti di "Mi Presti 2 Euro?"
  if (activePlayer.modifiers.repayDebtsNextTurn.length > 0) {
    for (const debt of activePlayer.modifiers.repayDebtsNextTurn) {
      const creditor = state.players.find((p) => p.id === debt.toPlayerId);
      if (creditor && activePlayer.tokens > 0) {
        const paid = Math.min(activePlayer.tokens, debt.amount);
        activePlayer.tokens -= paid;
        creditor.tokens += paid;
        addLog(
          state,
          activePlayer.id,
          activePlayer.name,
          'REPAY_DEBT',
          `${activePlayer.name} restituisce ${paid} gettone a ${creditor.name} ("Mi Presti 2 Euro?").`
        );
      }
    }
    activePlayer.modifiers.repayDebtsNextTurn = [];
  }

  // Effetti passivi "All'inizio di ogni tuo turno" tramite modello generico
  if (state.config.enableCardEffects) {
    for (const c of activePlayer.played) {
      if (c.effectModel.timing === 'WHILE_IN_PLAY') {
        const val = c.effectModel.params?.amount ?? c.effectModel.value ?? 1;
        if (c.effectModel.templateId === 'TURN_START_GAIN_TOKENS') {
          const gain = c.effectModel.params?.amount ?? c.effectModel.value ?? 2;
          activePlayer.tokens += gain;
          addLog(
            state,
            activePlayer.id,
            activePlayer.name,
            'EFFECT',
            `Effetto "${c.name}": ${activePlayer.name} riceve +${gain} gettoni a inizio turno.`
          );
        } else if (c.effectModel.templateId === 'TURN_START_STEAL_FROM_RICHEST') {
          const clockwiseOpponents = getClockwiseOpponents(state, activePlayer.id).filter(
            (p) => p.tokens > 0
          );
          if (clockwiseOpponents.length > 0) {
            const maxTokens = Math.max(...clockwiseOpponents.map((p) => p.tokens));
            const tiedRichest = clockwiseOpponents.filter((p) => p.tokens === maxTokens);

            if (tiedRichest.length > 1 && state.config.richestTiePolicy === 'CHOOSE') {
              const choice: PendingChoice = {
                id: makeId(state, 'choice'),
                type: 'CHOOSE_RICHEST_TIE',
                playerId: activePlayer.id,
                sourcePlayerId: activePlayer.id,
                sourceCardId: c.id,
                sourceCardName: c.name,
                templateId: 'TURN_START_STEAL_FROM_RICHEST',
                promptText: `${c.name}: scegli a quale dei giocatori più ricchi (${maxTokens} gettoni) rubare ${val} gettone.`,
                publicMessage: `${activePlayer.name} sta scegliendo da chi riscuotere "${c.name}".`,
                options: tiedRichest.map((opp) => ({
                  id: opp.id,
                  label: `${opp.name} (${opp.tokens} 🪙)`,
                  targetPlayerId: opp.id,
                })),
                eligibleTargetPlayerIds: tiedRichest.map((opp) => opp.id),
                tokenAmount: val,
              };
              enqueuePendingChoices(state, [choice]);
            } else {
              const richest = tiedRichest[0];
              const stealAmount = Math.min(richest.tokens, val);
              richest.tokens -= stealAmount;
              activePlayer.tokens += stealAmount;
              addLog(
                state,
                activePlayer.id,
                activePlayer.name,
                'EFFECT',
                `Effetto "${c.name}": ${activePlayer.name} ruba ${stealAmount} gettone a ${richest.name} (il più ricco)!`
              );
            }
          }
        }
      }
    }
  }

  // Calcolo numero di dadi per questo turno (4 se "Sonno Contagioso" attivo o penalità "Giro di Shot")
  const hasGlobal4Dice =
    state.othersFourDiceUntilPlayerId !== null &&
    state.othersFourDiceUntilPlayerId !== activePlayer.id;
  const diceCount =
    activePlayer.modifiers.diceCountOverrideNextTurn !== null
      ? activePlayer.modifiers.diceCountOverrideNextTurn
      : hasGlobal4Dice
      ? 4
      : 5;
  activePlayer.modifiers.diceCountOverrideNextTurn = null;

  state.dice = Array.from({ length: diceCount }, () => rollSingleDie(state));
  state.keptDice = Array.from({ length: diceCount }, () => false);

  const maxRolls =
    activePlayer.modifiers.maxRollsOverrideNextTurn !== null
      ? activePlayer.modifiers.maxRollsOverrideNextTurn
      : state.config.maxRollsPerTurn;

  activePlayer.modifiers.maxRollsOverrideNextTurn = null;
  state.rollsLeft = Math.max(0, maxRolls - 1);
  state.turnStep = state.rollsLeft > 0 ? 'ROLLING' : 'ACTION_DECISION';
  state.hasUsedMarketThisTurn = false;
  state.hasMadeTradeOfferThisTurn = false;
  state.mainActionTaken = false;
  state.pendingTradeOffer = null;
}

/**
 *Verifica se lo scambio col Mercato è consentito nell'attuale fase del turno secondo `marketSwapTiming`.
 */
function isMarketSwapAllowedInCurrentTiming(
  state: GameState,
  activePlayer: PlayerState
): { allowed: boolean; reason?: string } {
  const hasFreeSwap =
    activePlayer.modifiers.freeMarketSwapsCount > 0 ||
    (state.pendingChoice?.type === 'FREE_MARKET_SWAP' &&
      state.pendingChoice.playerId === activePlayer.id);

  if (hasFreeSwap) {
    return { allowed: true };
  }

  if (state.hasUsedMarketThisTurn) {
    return { allowed: false, reason: 'Hai già utilizzato il Mercato in questo turno.' };
  }

  const consumesAction =
    Boolean(state.config.marketSwapConsumesAction) ||
    state.config.marketSwapTiming === 'REPLACES_MAIN_ACTION';

  if (consumesAction && state.mainActionTaken) {
    return {
      allowed: false,
      reason: "Lo scambio col Mercato sostituisce l'azione principale, che è già stata effettuata.",
    };
  }

  switch (state.config.marketSwapTiming) {
    case 'BEFORE_ROLL': {
      if (state.mainActionTaken || state.turnStep !== 'ROLLING') {
        return {
          allowed: false,
          reason: 'Secondo le regole attive puoi scambiare col Mercato solo nella fase di lancio dadi.',
        };
      }
      return { allowed: true };
    }
    case 'AFTER_ACTION': {
      if (!state.mainActionTaken && state.turnStep !== 'POST_ACTION') {
        return {
          allowed: false,
          reason: "Secondo le regole attive puoi scambiare col Mercato solo dopo l'azione principale.",
        };
      }
      return { allowed: true };
    }
    case 'REPLACES_MAIN_ACTION': {
      if (state.mainActionTaken) {
        return {
          allowed: false,
          reason: "Hai già svolto l'azione principale del turno.",
        };
      }
      return { allowed: true };
    }
    case 'ANYTIME_IN_TURN':
    case 'FREE_IN_TURN':
    default:
      return { allowed: true };
  }
}

/**
 * Validazione autoritativa di qualsiasi `GameAction` (Step 3 Task 7).
 * Restituisce `{ ok: true }` oppure `{ ok: false, reason: string }`.
 */
export function validateAction(
  state: GameState,
  action: GameAction,
  actorPlayerId?: string
): ActionValidationResult {
  if (!action || typeof action.type !== 'string') {
    return { ok: false, reason: 'Azione mancante o malformata.' };
  }

  const hostPlayer = state.players.find((p) => p.isHost);
  const isActorHost = !actorPlayerId || (hostPlayer && hostPlayer.id === actorPlayerId);

  // Controllo identità attore se fornito
  if (actorPlayerId) {
    if ('playerId' in action && action.playerId && action.playerId !== actorPlayerId) {
      const targetPlayer = state.players.find((p) => p.id === action.playerId);
      if (!(isActorHost && targetPlayer?.isBot)) {
        return { ok: false, reason: 'Non puoi eseguire azioni a nome di un altro giocatore.' };
      }
    }
    if ('fromPlayerId' in action && action.fromPlayerId !== actorPlayerId) {
      const fromPlayer = state.players.find((p) => p.id === action.fromPlayerId);
      if (!(isActorHost && fromPlayer?.isBot)) {
        return { ok: false, reason: "Il mittente dell'offerta non corrisponde al giocatore." };
      }
    }
  }

  switch (action.type) {
    case 'UPDATE_CONFIG':
    case 'UPDATE_CATALOG':
    case 'RESET_TO_LOBBY': {
      if (!isActorHost) {
        return { ok: false, reason: "Solo l'Host può modificare la configurazione o resettare la stanza." };
      }
      return { ok: true };
    }

    case 'ADD_PLAYER': {
      if (state.phase !== 'LOBBY') {
        return { ok: false, reason: 'Non è possibile aggiungere giocatori a partita iniziata.' };
      }
      if (state.players.some((p) => p.id === action.id)) {
        return { ok: false, reason: 'Giocatore già presente nella stanza.' };
      }
      if (state.players.length >= state.config.maxPlayers) {
        return { ok: false, reason: `Numero massimo di giocatori raggiunto (${state.config.maxPlayers}).` };
      }
      return { ok: true };
    }

    case 'REMOVE_PLAYER': {
      if (!state.players.some((p) => p.id === action.playerId)) {
        return { ok: false, reason: 'Giocatore non trovato.' };
      }
      return { ok: true };
    }

    case 'START_PACK_OPENING': {
      if (!isActorHost) {
        return { ok: false, reason: "Solo l'Host può avviare lo spacchettamento." };
      }
      const minRequired = state.config.allow2PlayersTestMode ? 2 : state.config.minPlayers;
      if (state.players.length < minRequired) {
        return { ok: false, reason: `Servono almeno ${minRequired} giocatori per iniziare.` };
      }
      return { ok: true };
    }

    case 'OPEN_NEXT_PACK': {
      if (state.phase !== 'PACK_OPENING') {
        return { ok: false, reason: 'Non siamo nella fase di apertura bustine.' };
      }
      const player = state.players.find((p) => p.id === action.playerId);
      if (!player || player.unopenedPacks.length === 0) {
        return { ok: false, reason: 'Nessuna bustina da aprire.' };
      }
      return { ok: true };
    }

    case 'TOGGLE_DRAFT_SELECTION': {
      if (state.phase !== 'PACK_OPENING') {
        return { ok: false, reason: 'Non siamo nella fase di draft.' };
      }
      const player = state.players.find((p) => p.id === action.playerId);
      if (!player || player.draftReady) {
        return { ok: false, reason: 'Squadra già confermata o giocatore non valido.' };
      }
      const card = player.pulledPool.find((c) => c.id === action.cardId);
      if (!card) {
        return { ok: false, reason: 'Carta non presente nel pool pescato.' };
      }
      if (action.role === 'STARTER' && !player.selectedStarterIds.includes(card.id)) {
        if (player.selectedStarterIds.length >= state.config.teamSize) {
          return { ok: false, reason: `Hai già selezionato ${state.config.teamSize} titolari.` };
        }
        const cardKey = getCardIdentityKey(card);
        const alreadyHasSameCard = player.selectedStarterIds.some((id) => {
          const existing = player.pulledPool.find((c) => c.id === id);
          return existing && getCardIdentityKey(existing) === cardKey;
        });
        if (alreadyHasSameCard) {
          return { ok: false, reason: 'Non puoi avere due copie della stessa carta in squadra.' };
        }
        const forbidSamePerson =
          state.config.uniquePersonPerTeam ||
          state.config.allowMultipleVersionsSamePerson === false;
        if (forbidSamePerson) {
          const alreadyHasPerson = player.selectedStarterIds.some((id) => {
            const existing = player.pulledPool.find((c) => c.id === id);
            return existing && existing.personName.toLowerCase() === card.personName.toLowerCase();
          });
          if (alreadyHasPerson) {
            return { ok: false, reason: 'Non puoi avere più versioni della stessa persona in squadra.' };
          }
        }
      } else if (action.role === 'RESERVE' && !player.selectedReserveIds.includes(card.id)) {
        if (player.selectedReserveIds.length >= state.config.reserveSize) {
          return { ok: false, reason: `Hai già selezionato ${state.config.reserveSize} riserve.` };
        }
      }
      return { ok: true };
    }

    case 'AUTO_SELECT_DRAFT': {
      if (state.phase !== 'PACK_OPENING') {
        return { ok: false, reason: 'Non siamo nella fase di draft.' };
      }
      const player = state.players.find((p) => p.id === action.playerId);
      if (!player) return { ok: false, reason: 'Giocatore non trovato.' };
      return { ok: true };
    }

    case 'PROPOSE_DRAFT_TRADE': {
      if (state.phase !== 'PACK_OPENING') {
        return { ok: false, reason: 'Gli scambi pre-partita sono possibili solo durante il draft.' };
      }
      const fromP = state.players.find((p) => p.id === action.fromPlayerId);
      const toP = state.players.find((p) => p.id === action.toPlayerId);
      if (!fromP || !toP || fromP.id === toP.id) {
        return { ok: false, reason: 'Giocatori non validi per lo scambio.' };
      }
      if (!fromP.pulledPool.some((c) => c.id === action.fromCardId)) {
        return { ok: false, reason: 'Carta offerta non trovata.' };
      }
      if (!toP.pulledPool.some((c) => c.id === action.toCardId)) {
        return { ok: false, reason: 'Carta richiesta non trovata.' };
      }
      return { ok: true };
    }

    case 'ACCEPT_DRAFT_TRADE':
    case 'REJECT_DRAFT_TRADE': {
      if (state.phase !== 'PACK_OPENING') {
        return { ok: false, reason: 'Non siamo nella fase di draft.' };
      }
      const offer = state.pendingDraftTrades.find((t) => t.id === action.tradeId);
      if (!offer) {
        return { ok: false, reason: 'Offerta di scambio non trovata.' };
      }
      return { ok: true };
    }

    case 'CONFIRM_DRAFT_TEAM': {
      if (state.phase !== 'PACK_OPENING') {
        return { ok: false, reason: 'Non siamo nella fase di draft.' };
      }
      const player = state.players.find((p) => p.id === action.playerId);
      if (!player) return { ok: false, reason: 'Giocatore non trovato.' };
      if (
        player.selectedStarterIds.length !== state.config.teamSize ||
        player.selectedReserveIds.length !== state.config.reserveSize
      ) {
        return {
          ok: false,
          reason: `Devi selezionare esattamente ${state.config.teamSize} titolari e ${state.config.reserveSize} riserve.`,
        };
      }
      return { ok: true };
    }

    case 'PICK_OBJECTIVE': {
      if (state.phase !== 'OBJECTIVE_PICK') {
        return { ok: false, reason: 'Non siamo nella fase di scelta Obiettivo.' };
      }
      const player = state.players.find((p) => p.id === action.playerId);
      if (!player) return { ok: false, reason: 'Giocatore non trovato.' };
      if (!player.objectiveCandidates.some((o) => o.id === action.objectiveId)) {
        return { ok: false, reason: 'Obiettivo non presente tra quelli pescati.' };
      }
      return { ok: true };
    }

    case 'RESOLVE_PENDING_CHOICE': {
      if (state.phase !== 'PLAYING' || !state.pendingChoice) {
        return { ok: false, reason: 'Nessuna scelta in sospeso da risolvere.' };
      }
      const choice = state.pendingChoice;
      if (choice.playerId !== action.playerId) {
        return { ok: false, reason: 'Non spetta a te risolvere questa scelta.' };
      }
      if (action.choiceId && action.choiceId !== choice.id) {
        return { ok: false, reason: 'ID della scelta non corrispondente.' };
      }
      const choosingPlayer = state.players.find((p) => p.id === choice.playerId);
      if (!choosingPlayer) {
        return { ok: false, reason: 'Giocatore non trovato.' };
      }

      switch (choice.type) {
        case 'CHOOSE_TARGET_PLAYER':
        case 'CHOOSE_RICHEST_TIE': {
          const targetId =
            action.targetPlayerId ||
            choice.options.find((o) => o.id === action.optionId)?.targetPlayerId;
          if (!targetId || !choice.eligibleTargetPlayerIds?.includes(targetId)) {
            return { ok: false, reason: 'Giocatore bersaglio non valido.' };
          }
          return { ok: true };
        }
        case 'CHOOSE_TARGET_PLAYED_CARD': {
          const opt = choice.options.find((o) => o.id === action.optionId);
          const targetPlayedCardId = action.targetPlayedCardId || opt?.targetPlayedCardId;
          if (
            !targetPlayedCardId ||
            !choice.eligiblePlayedCards?.some((e) => e.card.id === targetPlayedCardId)
          ) {
            return { ok: false, reason: 'Carta in gioco selezionata non valida.' };
          }
          return { ok: true };
        }
        case 'GIORGIO_SWAP_CHOICE': {
          const opt = choice.options.find((o) => o.id === action.optionId);
          const ownCardId = action.cardId || opt?.cardId || choosingPlayer.hand[0]?.id;
          const targetId =
            action.targetPlayerId || opt?.targetPlayerId || choice.eligibleTargetPlayerIds?.[0];
          if (!ownCardId || !choosingPlayer.hand.some((c) => c.id === ownCardId)) {
            return { ok: false, reason: 'Carta della tua mano non valida.' };
          }
          if (!targetId || !choice.eligibleTargetPlayerIds?.includes(targetId)) {
            return { ok: false, reason: 'Avversario bersaglio non valido per lo scambio.' };
          }
          return { ok: true };
        }
        case 'PASS_CARD_LEFT': {
          const opt = choice.options.find((o) => o.id === action.optionId);
          const cardId = action.cardId || opt?.cardId;
          if (!cardId || !choosingPlayer.hand.some((c) => c.id === cardId)) {
            return { ok: false, reason: 'Seleziona una carta valida dalla tua mano da passare a sinistra.' };
          }
          return { ok: true };
        }
        case 'PAY_TOKEN_OR_FOUR_DICE': {
          const opt = choice.options.find((o) => o.id === action.optionId);
          const decision = action.decision || opt?.decision;
          if (decision !== 'PAY_TOKEN' && decision !== 'FOUR_DICE') {
            return { ok: false, reason: 'Decisione non valida: scegli se pagare 1 gettone o tirare 4 dadi.' };
          }
          const reqTokens = choice.tokenAmount ?? 1;
          if (decision === 'PAY_TOKEN' && choosingPlayer.tokens < reqTokens) {
            return { ok: false, reason: 'Non hai abbastanza gettoni per pagare.' };
          }
          return { ok: true };
        }
        case 'FREE_MARKET_SWAP': {
          const opt = choice.options.find((o) => o.id === action.optionId);
          const decision = action.decision || opt?.decision;
          if (decision === 'SKIP') {
            return { ok: true };
          }
          const handCardId = action.cardId || opt?.cardId;
          const marketCardId = action.marketCardId || opt?.marketCardId;
          const handCard = choosingPlayer.hand.find((c) => c.id === handCardId);
          const marketCard = state.market.find((c) => c.id === marketCardId);
          if (!handCard || !marketCard) {
            return { ok: false, reason: 'Seleziona una carta dalla mano e una dal Mercato (oppure passa).' };
          }
          if (wouldCreateDuplicateInTeam(choosingPlayer, marketCard, state.config, [handCard.id])) {
            return { ok: false, reason: 'Non puoi prendere una carta che hai già nella tua squadra.' };
          }
          return { ok: true };
        }
        default:
          return { ok: false, reason: 'Tipo di scelta non riconosciuto.' };
      }
    }

    default:
      break;
  }

  // Tutte le azioni successive richiedono `state.phase === 'PLAYING'`
  if (state.phase !== 'PLAYING') {
    return { ok: false, reason: 'La partita non è nella fase di gioco attiva.' };
  }

  const activePlayer = state.players[state.currentPlayerIndex];
  if (!activePlayer) {
    return { ok: false, reason: 'Giocatore di turno non trovato.' };
  }

  // Se c'è una pendingChoice diversa da FREE_MARKET_SWAP opzionale dello stesso giocatore, blocca le altre mosse
  if (state.pendingChoice) {
    const isSamePlayerFreeMarket =
      state.pendingChoice.type === 'FREE_MARKET_SWAP' &&
      state.pendingChoice.playerId === activePlayer.id &&
      (action.type === 'MARKET_SWAP' || action.type === 'END_TURN');
    if (!isSamePlayerFreeMarket) {
      return {
        ok: false,
        reason: `In attesa della scelta di ${
          state.players.find((p) => p.id === state.pendingChoice?.playerId)?.name || 'un giocatore'
        }.`,
      };
    }
  }

  switch (action.type) {
    case 'TOGGLE_KEEP_DIE': {
      if (activePlayer.id !== action.playerId) {
        return { ok: false, reason: 'Non è il tuo turno.' };
      }
      if (state.turnStep !== 'ROLLING' || state.mainActionTaken) {
        return { ok: false, reason: 'Puoi bloccare o sbloccare i dadi solo durante la fase di lancio.' };
      }
      if (action.dieIndex < 0 || action.dieIndex >= state.keptDice.length) {
        return { ok: false, reason: 'Indice del dado non valido.' };
      }
      return { ok: true };
    }

    case 'ROLL_DICE': {
      if (activePlayer.id !== action.playerId) {
        return { ok: false, reason: 'Non è il tuo turno.' };
      }
      if (state.turnStep !== 'ROLLING' || state.mainActionTaken) {
        return { ok: false, reason: 'Hai già confermato i dadi o completato la fase di tiro.' };
      }
      if (state.rollsLeft <= 0) {
        return { ok: false, reason: 'Non hai più tiri disponibili in questo turno.' };
      }
      return { ok: true };
    }

    case 'BUY_EXTRA_ROLL': {
      if (activePlayer.id !== action.playerId) {
        return { ok: false, reason: 'Non è il tuo turno.' };
      }
      const extraEnabled = Boolean(
        state.config.paidExtraRollEnabled || state.config.extraPaidRoll
      );
      if (!extraEnabled) {
        return { ok: false, reason: 'La regola del 4° tiro extra a pagamento non è attiva.' };
      }
      if (state.mainActionTaken || state.turnStep === 'POST_ACTION') {
        return { ok: false, reason: "Non puoi comprare un tiro extra dopo l'azione principale." };
      }
      if (activePlayer.tokens < state.config.paidExtraRollCost) {
        return { ok: false, reason: 'Gettoni insufficienti per comprare il tiro extra.' };
      }
      return { ok: true };
    }

    case 'FLIP_DIE_OPPOSITE': {
      if (activePlayer.id !== action.playerId) {
        return { ok: false, reason: 'Non è il tuo turno.' };
      }
      if (state.mainActionTaken || state.turnStep === 'POST_ACTION') {
        return { ok: false, reason: "Non puoi girare un dado dopo l'azione principale." };
      }
      if (!getActiveModifiers(activePlayer, state.config.enableCardEffects).hasFlipDieOpposite) {
        return { ok: false, reason: 'Non hai una carta in gioco che permette di girare un dado.' };
      }
      if (activePlayer.modifiers.usedLuckyDieFlipThisTurn) {
        return { ok: false, reason: 'Hai già usato questo effetto in questo turno.' };
      }
      if (action.dieIndex < 0 || action.dieIndex >= state.dice.length) {
        return { ok: false, reason: 'Indice del dado non valido.' };
      }
      return { ok: true };
    }

    case 'CONFIRM_DICE_ROLL': {
      if (activePlayer.id !== action.playerId) {
        return { ok: false, reason: 'Non è il tuo turno.' };
      }
      if (state.turnStep !== 'ROLLING' || state.mainActionTaken) {
        return { ok: false, reason: 'I dadi sono già stati confermati.' };
      }
      return { ok: true };
    }

    case 'CASH_IN_DICE': {
      if (activePlayer.id !== action.playerId) {
        return { ok: false, reason: 'Non è il tuo turno.' };
      }
      if (state.mainActionTaken || state.turnStep === 'POST_ACTION') {
        return { ok: false, reason: "Hai già svolto l'azione principale del turno." };
      }
      return { ok: true };
    }

    case 'PLAY_CARD': {
      if (activePlayer.id !== action.playerId) {
        return { ok: false, reason: 'Non è il tuo turno.' };
      }
      const card = activePlayer.hand.find((c) => c.id === action.cardId);
      if (!card) {
        return { ok: false, reason: 'Carta non presente nella tua mano.' };
      }
      const playability = canPlayCardRightNow(state, activePlayer, card);
      const useAltNoCombo = Boolean(
        action.useNoComboAlternateCost && playability.canPlayNoComboAlt
      );
      if (!useAltNoCombo && !playability.canPlayStandard) {
        return {
          ok: false,
          reason: playability.reason || 'Non puoi giocare questa carta ora.',
        };
      }
      return { ok: true };
    }

    case 'MARKET_SWAP': {
      if (activePlayer.id !== action.playerId) {
        return { ok: false, reason: 'Non è il tuo turno.' };
      }
      const timingCheck = isMarketSwapAllowedInCurrentTiming(state, activePlayer);
      if (!timingCheck.allowed) {
        return { ok: false, reason: timingCheck.reason || 'Scambio col Mercato non consentito ora.' };
      }
      const hasFreeSwap =
        activePlayer.modifiers.freeMarketSwapsCount > 0 ||
        (state.pendingChoice?.type === 'FREE_MARKET_SWAP' &&
          state.pendingChoice.playerId === activePlayer.id);
      const swapCost = hasFreeSwap
        ? 0
        : state.config.marketSwapPrice ?? state.config.marketSwapCost;
      if (activePlayer.tokens < swapCost) {
        return { ok: false, reason: `Gettoni insufficienti per il Mercato (servono ${swapCost}).` };
      }
      const handCard = activePlayer.hand.find((c) => c.id === action.handCardId);
      const marketCard = state.market.find((c) => c.id === action.marketCardId);
      if (!handCard || !marketCard) {
        return { ok: false, reason: 'Carta della mano o del Mercato non trovata.' };
      }
      if (wouldCreateDuplicateInTeam(activePlayer, marketCard, state.config, [handCard.id])) {
        return {
          ok: false,
          reason: 'Non puoi avere due copie della stessa carta (o persona) nella tua squadra.',
        };
      }
      return { ok: true };
    }

    case 'OFFER_PLAYER_TRADE': {
      if (activePlayer.id !== action.fromPlayerId) {
        return { ok: false, reason: 'Puoi fare un’offerta di acquisto solo nel tuo turno.' };
      }
      if (state.hasMadeTradeOfferThisTurn) {
        return { ok: false, reason: 'Puoi fare al massimo 1 offerta di acquisto per turno.' };
      }
      if (state.pendingTradeOffer !== null) {
        return { ok: false, reason: "C'è già un'offerta di trattativa in attesa di risposta." };
      }
      if (activePlayer.played.length >= state.config.teamSize - 1) {
        return {
          ok: false,
          reason: 'Chi è a una carta dalla vittoria non può comprare carte dagli avversari.',
        };
      }
      if (action.offeredTokens < 1 || activePlayer.tokens < action.offeredTokens) {
        return { ok: false, reason: "Gettoni insufficienti per l'offerta." };
      }
      const targetPlayer = state.players.find((p) => p.id === action.toPlayerId);
      if (!targetPlayer || targetPlayer.id === activePlayer.id || targetPlayer.hand.length === 0) {
        return { ok: false, reason: 'Giocatore destinatario non valido o senza carte non giocate.' };
      }
      // Vietato comprare carte già giocate
      if (
        action.targetCardId &&
        targetPlayer.played.some((c) => c.id === action.targetCardId)
      ) {
        return { ok: false, reason: 'Le carte già giocate non si possono comprare.' };
      }
      if (
        getActiveModifiers(targetPlayer, state.config.enableCardEffects).protectedFromBuyAndBounce
      ) {
        return {
          ok: false,
          reason: `${targetPlayer.name} è protetto da un effetto in gioco: non puoi comprargli carte.`,
        };
      }
      const requiresCardBack = Boolean(
        state.config.tradeRequiresCardBack ?? state.config.tradeRequiresCardSwap
      );
      if (requiresCardBack) {
        if (
          !action.offeredSwapCardId ||
          !activePlayer.hand.some((c) => c.id === action.offeredSwapCardId)
        ) {
          return {
            ok: false,
            reason: 'Devi selezionare una tua carta non giocata da cedere in cambio.',
          };
        }
      }
      return { ok: true };
    }

    case 'RESPOND_PLAYER_TRADE': {
      const offer = state.pendingTradeOffer;
      if (!offer || offer.status !== 'PENDING') {
        return { ok: false, reason: 'Nessuna offerta di trattativa in sospeso.' };
      }
      if (actorPlayerId && actorPlayerId !== offer.toPlayerId) {
        const seller = state.players.find((p) => p.id === offer.toPlayerId);
        if (!(isActorHost && seller?.isBot)) {
          return { ok: false, reason: "Solo il destinatario dell'offerta può rispondere." };
        }
      }
      return { ok: true };
    }

    case 'RETURN_MISMATCHED_CARD_TO_HAND': {
      const player = state.players.find((p) => p.id === action.playerId);
      const policy = state.config.objectiveChangePolicy ?? state.config.onObjectiveMismatch;
      if (!player || policy !== 'ALLOW_RETURN_TO_HAND') {
        return { ok: false, reason: 'Non è consentito riprendere in mano carte giocate.' };
      }
      if (!player.played.some((c) => c.id === action.playedCardId)) {
        return { ok: false, reason: 'Carta non trovata tra quelle in gioco.' };
      }
      return { ok: true };
    }

    case 'END_TURN': {
      if (activePlayer.id !== action.playerId) {
        return { ok: false, reason: 'Non è il tuo turno.' };
      }
      return { ok: true };
    }

    default:
      return { ok: false, reason: 'Tipo di azione sconosciuto.' };
  }
}

export function applyGameAction(prevState: GameState, action: GameAction): GameState {
  const validation = validateAction(prevState, action);
  if (!validation.ok) {
    return prevState;
  }

  const state = cloneState(prevState);

  switch (action.type) {
    case 'UPDATE_CONFIG': {
      state.config = normalizeGameConfig(action.config, state.config);
      if (action.config.seed !== undefined) {
        state.rngSeed = hashSeed(action.config.seed);
        state.rngState = state.rngSeed;
      }
      return state;
    }

    case 'UPDATE_CATALOG': {
      state.catalog = [...action.catalog];
      return state;
    }

    case 'ADD_PLAYER': {
      const newPlayer: PlayerState = {
        id: action.id,
        name: action.name.trim() || `Amico ${state.players.length + 1}`,
        isHost: Boolean(action.isHost),
        isBot: Boolean(action.isBot),
        connected: true,
        tokens: state.config.startingTokens,
        unopenedPacks: [],
        pulledPool: [],
        selectedStarterIds: [],
        selectedReserveIds: [],
        draftReady: false,
        hand: [],
        played: [],
        objectiveCandidates: [],
        objective: null,
        modifiers: createCleanModifiers(),
      };
      state.players.push(newPlayer);
      addLog(
        state,
        newPlayer.id,
        newPlayer.name,
        'JOIN',
        `${newPlayer.name} è entrato nella stanza.`,
        action.timestamp
      );
      return state;
    }

    case 'REMOVE_PLAYER': {
      state.players = state.players.filter((p) => p.id !== action.playerId);
      return state;
    }

    case 'START_PACK_OPENING': {
      state.phase = 'PACK_OPENING';
      state.market = [];
      state.pendingDraftTrades = [];
      state.pendingChoice = null;
      state.pendingChoicesQueue = [];

      state.players.forEach((player, pIdx) => {
        const packs: CardData[][] = [];
        for (let k = 0; k < state.config.packsPerPlayer; k++) {
          packs.push(
            generateBoosterPack(
              state,
              state.catalog,
              state.config.cardsPerPack,
              pIdx * 10 + k + 1
            )
          );
        }
        player.unopenedPacks = packs;
        player.pulledPool = [];
        player.selectedStarterIds = [];
        player.selectedReserveIds = [];
        player.draftReady = false;
        player.hand = [];
        player.played = [];
        player.tokens = state.config.startingTokens;
        player.modifiers = createCleanModifiers();

        if (player.isBot) {
          player.pulledPool = packs.flat();
          player.unopenedPacks = [];
          autoPickDraftForPlayer(player, state.config);
          player.draftReady = true;
        }
      });

      addLog(
        state,
        'system',
        'Tavolo',
        'START_DRAFT',
        `Inizia il Draft! Ogni giocatore apre ${state.config.packsPerPlayer} bustine da ${state.config.cardsPerPack} carte (1 per classe + 1 jolly).`,
        action.timestamp
      );
      return state;
    }

    case 'OPEN_NEXT_PACK': {
      const player = state.players.find((p) => p.id === action.playerId)!;
      const nextPack = player.unopenedPacks.shift()!;
      player.pulledPool.push(...nextPack);
      addLog(
        state,
        player.id,
        player.name,
        'PACK_OPEN',
        `${player.name} ha aperto una bustina (${nextPack.length} carte)!`,
        action.timestamp
      );
      return state;
    }

    case 'TOGGLE_DRAFT_SELECTION': {
      const player = state.players.find((p) => p.id === action.playerId)!;
      const card = player.pulledPool.find((c) => c.id === action.cardId)!;

      if (action.role === 'STARTER') {
        if (player.selectedStarterIds.includes(card.id)) {
          player.selectedStarterIds = player.selectedStarterIds.filter((id) => id !== card.id);
          return state;
        }
        player.selectedReserveIds = player.selectedReserveIds.filter((id) => id !== card.id);
        player.selectedStarterIds.push(card.id);
      } else {
        if (player.selectedReserveIds.includes(card.id)) {
          player.selectedReserveIds = player.selectedReserveIds.filter((id) => id !== card.id);
          return state;
        }
        player.selectedStarterIds = player.selectedStarterIds.filter((id) => id !== card.id);
        player.selectedReserveIds.push(card.id);
      }
      return state;
    }

    case 'AUTO_SELECT_DRAFT': {
      const player = state.players.find((p) => p.id === action.playerId)!;
      while (player.unopenedPacks.length > 0) {
        player.pulledPool.push(...player.unopenedPacks.shift()!);
      }
      autoPickDraftForPlayer(player, state.config);
      return state;
    }

    case 'PROPOSE_DRAFT_TRADE': {
      state.pendingDraftTrades.push({
        id: makeId(state, 'dtrade'),
        fromPlayerId: action.fromPlayerId,
        toPlayerId: action.toPlayerId,
        fromCardId: action.fromCardId,
        toCardId: action.toCardId,
      });
      return state;
    }

    case 'ACCEPT_DRAFT_TRADE': {
      const idx = state.pendingDraftTrades.findIndex((t) => t.id === action.tradeId);
      const offer = state.pendingDraftTrades[idx];
      state.pendingDraftTrades.splice(idx, 1);

      const fromP = state.players.find((p) => p.id === offer.fromPlayerId)!;
      const toP = state.players.find((p) => p.id === offer.toPlayerId)!;

      const c1Idx = fromP.pulledPool.findIndex((c) => c.id === offer.fromCardId);
      const c2Idx = toP.pulledPool.findIndex((c) => c.id === offer.toCardId);
      if (c1Idx === -1 || c2Idx === -1) return state;

      const [card1] = fromP.pulledPool.splice(c1Idx, 1);
      const [card2] = toP.pulledPool.splice(c2Idx, 1);
      fromP.pulledPool.push(card2);
      toP.pulledPool.push(card1);

      fromP.selectedStarterIds = fromP.selectedStarterIds.filter((id) => id !== card1.id);
      fromP.selectedReserveIds = fromP.selectedReserveIds.filter((id) => id !== card1.id);
      toP.selectedStarterIds = toP.selectedStarterIds.filter((id) => id !== card2.id);
      toP.selectedReserveIds = toP.selectedReserveIds.filter((id) => id !== card2.id);

      addLog(
        state,
        fromP.id,
        fromP.name,
        'DRAFT_TRADE',
        `Scambio pre-partita: ${fromP.name} ha scambiato "${card1.name}" con "${card2.name}" di ${toP.name}!`,
        action.timestamp
      );
      return state;
    }

    case 'REJECT_DRAFT_TRADE': {
      state.pendingDraftTrades = state.pendingDraftTrades.filter((t) => t.id !== action.tradeId);
      return state;
    }

    case 'CONFIRM_DRAFT_TEAM': {
      const player = state.players.find((p) => p.id === action.playerId)!;
      player.draftReady = true;
      addLog(
        state,
        player.id,
        player.name,
        'TEAM_READY',
        `${player.name} ha confermato i ${state.config.teamSize} titolari e le ${state.config.reserveSize} riserve (le altre carte tornano in collezione).`,
        action.timestamp
      );

      if (state.players.every((p) => p.draftReady)) {
        state.market = [];
        const objDeck = shuffleWithRng(state.objectivesDeck, state);

        state.players.forEach((p, idx) => {
          p.hand = p.pulledPool.filter((c) => p.selectedStarterIds.includes(c.id));
          const reserves = p.pulledPool.filter((c) => p.selectedReserveIds.includes(c.id));
          state.market.push(...reserves);

          const c1 = objDeck[(idx * 2) % objDeck.length];
          const c2 = objDeck[(idx * 2 + 1) % objDeck.length];
          p.objectiveCandidates = [c1, c2];
          p.objective = p.isBot ? selectBestObjectiveForBot(p.hand, [c1, c2], state.config.teamSize) : null;
        });

        state.phase = 'OBJECTIVE_PICK';
        addLog(
          state,
          'system',
          'Tavolo',
          'PHASE_OBJECTIVE',
          `Squadre confermate e ${state.market.length} riserve nel Mercato! Ognuno pesca 2 carte Obiettivo e ne tiene 1 coperta.`,
          action.timestamp
        );

        if (state.players.every((p) => p.objective !== null)) {
          state.phase = 'PLAYING';
          state.turnNumber = 1;
          setupTurnForPlayer(state, 0);
        }
      }
      return state;
    }

    case 'PICK_OBJECTIVE': {
      const player = state.players.find((p) => p.id === action.playerId)!;
      const chosen = player.objectiveCandidates.find((o) => o.id === action.objectiveId)!;

      player.objective = chosen;
      addLog(
        state,
        player.id,
        player.name,
        'OBJECTIVE_PICKED',
        state.config.objectiveVisibility === 'PUBLIC'
          ? `${player.name} ha scelto l'Obiettivo: "${chosen.title}".`
          : `${player.name} ha scelto il suo Obiettivo coperto.`,
        action.timestamp
      );

      if (state.phase === 'OBJECTIVE_PICK' && state.players.every((p) => p.objective !== null)) {
        state.phase = 'PLAYING';
        state.turnNumber = 1;
        setupTurnForPlayer(state, 0);
        addLog(
          state,
          state.players[0].id,
          state.players[0].name,
          'GAME_START',
          `La partita ha inizio! È il turno di ${state.players[0].name}.`,
          action.timestamp
        );
      }
      return state;
    }

    case 'TOGGLE_KEEP_DIE': {
      state.keptDice[action.dieIndex] = !state.keptDice[action.dieIndex];
      return state;
    }

    case 'ROLL_DICE': {
      const activePlayer = state.players[state.currentPlayerIndex];
      state.dice = state.dice.map((val, idx) =>
        state.keptDice[idx] ? val : rollSingleDie(state)
      );
      state.rollsLeft -= 1;

      const canBuyExtra =
        Boolean(state.config.paidExtraRollEnabled || state.config.extraPaidRoll) &&
        activePlayer.tokens >= state.config.paidExtraRollCost;

      if (state.rollsLeft <= 0 && !canBuyExtra) {
        state.turnStep = 'ACTION_DECISION';
      }

      addLog(
        state,
        activePlayer.id,
        activePlayer.name,
        'ROLL',
        `${activePlayer.name} ha ritirato i dadi: [${state.dice.join(', ')}] (${state.rollsLeft} tiri rimasti).`,
        action.timestamp
      );
      return state;
    }

    case 'BUY_EXTRA_ROLL': {
      const activePlayer = state.players[state.currentPlayerIndex];
      activePlayer.tokens -= state.config.paidExtraRollCost;
      state.rollsLeft += 1;
      state.turnStep = 'ROLLING';
      addLog(
        state,
        activePlayer.id,
        activePlayer.name,
        'EXTRA_ROLL',
        `${activePlayer.name} ha pagato ${state.config.paidExtraRollCost} gettone per un 4° tiro extra!`,
        action.timestamp
      );
      return state;
    }

    case 'FLIP_DIE_OPPOSITE': {
      const activePlayer = state.players[state.currentPlayerIndex];
      const oldVal = state.dice[action.dieIndex];
      const newVal = flipDieOppositeFace(oldVal);
      state.dice[action.dieIndex] = newVal;
      state.keptDice[action.dieIndex] = true;
      activePlayer.modifiers.usedLuckyDieFlipThisTurn = true;

      addLog(
        state,
        activePlayer.id,
        activePlayer.name,
        'LUCKY_DIE_FLIP',
        `Effetto "Il Dado Fortunato": ${activePlayer.name} gira il dado #${action.dieIndex + 1} sulla faccia opposta (${oldVal} ↔ ${newVal})!`,
        action.timestamp
      );
      return state;
    }

    case 'CONFIRM_DICE_ROLL': {
      const activePlayer = state.players[state.currentPlayerIndex];
      state.rollsLeft = 0;
      state.turnStep = 'ACTION_DECISION';
      addLog(
        state,
        activePlayer.id,
        activePlayer.name,
        'CONFIRM_DICE',
        `${activePlayer.name} conferma i dadi: [${state.dice.join(', ')}].`,
        action.timestamp
      );
      return state;
    }

    case 'CASH_IN_DICE': {
      const activePlayer = state.players[state.currentPlayerIndex];
      const passiveBonus = getPassiveCashInBonus(activePlayer, state.config.enableCardEffects);
      const gained = calculateCashInTokens(
        state.dice,
        passiveBonus,
        state.config.cashInMode || state.config.cashInHighFaces
      );
      activePlayer.tokens += gained;
      state.mainActionTaken = true;
      state.rollsLeft = 0;
      activePlayer.modifiers.forbidPlayNextTurn = false;
      state.turnStep = 'POST_ACTION';

      addLog(
        state,
        activePlayer.id,
        activePlayer.name,
        'CASH_IN',
        `${activePlayer.name} sceglie INCASSA coi dadi [${state.dice.join(', ')}] e prende +${gained} gettoni (totale: ${activePlayer.tokens}).`,
        action.timestamp
      );

      // Effetto passivo "Il Parassita" (LEFT_NEIGHBOR_CASH_IN_BONUS):
      // Quando il giocatore alla tua sinistra sceglie Incassa, prendi 1 gettone dalla scorta.
      if (state.config.enableCardEffects && state.players.length >= 2) {
        const rightNeighborIndex =
          (state.currentPlayerIndex - 1 + state.players.length) % state.players.length;
        const rightNeighbor = state.players[rightNeighborIndex];
        const neighborMods = getActiveModifiers(rightNeighbor, state.config.enableCardEffects);
        for (const item of neighborMods.leftNeighborCashInBonus) {
          rightNeighbor.tokens += item.bonus;
          addLog(
            state,
            rightNeighbor.id,
            rightNeighbor.name,
            'EFFECT',
            `Effetto "${item.cardName}": ${rightNeighbor.name} prende +${item.bonus} gettone perché il vicino a sinistra (${activePlayer.name}) ha scelto Incassa!`,
            action.timestamp
          );
        }
      }

      return state;
    }

    case 'PLAY_CARD': {
      const activePlayer = state.players[state.currentPlayerIndex];
      const cardIdx = activePlayer.hand.findIndex((c) => c.id === action.cardId);
      const card = activePlayer.hand[cardIdx];

      const playability = canPlayCardRightNow(state, activePlayer, card);
      const useAltNoCombo = Boolean(action.useNoComboAlternateCost && playability.canPlayNoComboAlt);

      const costToPay = useAltNoCombo ? playability.altCost : playability.standardCost;
      activePlayer.tokens -= costToPay;
      activePlayer.modifiers.nextCardDiscount = 0;

      const usedAfterPartyFreeCombo = activePlayer.modifiers.canPlayExtraCardWithoutCombo;
      activePlayer.modifiers.canPlayExtraCardWithoutCombo = false;

      activePlayer.hand.splice(cardIdx, 1);
      activePlayer.played.push(card);
      state.mainActionTaken = true;
      state.rollsLeft = 0;
      state.turnStep = 'POST_ACTION';

      addLog(
        state,
        activePlayer.id,
        activePlayer.name,
        'PLAY_CARD',
        useAltNoCombo
          ? `${activePlayer.name} GIOCA "${card.name}" pagando ${costToPay} gettoni senza combinazione di dadi.`
          : usedAfterPartyFreeCombo
          ? `${activePlayer.name} GIOCA "${card.name}" (2ª carta con After Party, ${costToPay} gettoni senza combinazione)!`
          : `${activePlayer.name} GIOCA "${card.name}" (${card.cardClass}, costo ${costToPay} gettoni, combinazione ${playability.requiredCombos.map((c) => COMBO_LABELS_IT[c]).join(' / ')}).`,
        action.timestamp
      );

      // Effetto passivo "Anima della Festa" (ON_OTHER_PLAY_GAIN_TOKEN) degli altri giocatori
      if (state.config.enableCardEffects) {
        for (const other of state.players) {
          if (other.id === activePlayer.id) continue;
          const otherMods = getActiveModifiers(other, state.config.enableCardEffects);
          for (const entry of otherMods.onOtherPlayGainToken) {
            if (other.modifiers.animaFestaTriggersThisRound < entry.maxPerRound) {
              other.tokens += entry.gain;
              other.modifiers.animaFestaTriggersThisRound += 1;
              addLog(
                state,
                other.id,
                other.name,
                'EFFECT',
                `Effetto "${entry.cardName}": ${other.name} guadagna +${entry.gain} gettone (${other.modifiers.animaFestaTriggersThisRound}/${entry.maxPerRound} in questo giro)!`,
                action.timestamp
              );
            }
          }
        }
      }

      // Applica l'effetto della carta giocata
      if (state.config.enableCardEffects) {
        applyCardEffectOnPlay(state, activePlayer, card, action);
      }

      finalizeVictoryIfReady(state);
      return state;
    }

    case 'RESOLVE_PENDING_CHOICE': {
      resolvePendingChoiceAction(state, action);
      finalizeVictoryIfReady(state);
      return state;
    }

    case 'MARKET_SWAP': {
      const activePlayer = state.players[state.currentPlayerIndex];
      const isPendingFreeMarket =
        state.pendingChoice?.type === 'FREE_MARKET_SWAP' &&
        state.pendingChoice.playerId === activePlayer.id;
      const hasFreeSwap =
        activePlayer.modifiers.freeMarketSwapsCount > 0 || isPendingFreeMarket;

      const swapCost = hasFreeSwap
        ? 0
        : state.config.marketSwapPrice ?? state.config.marketSwapCost;
      const handIdx = activePlayer.hand.findIndex((c) => c.id === action.handCardId);
      const marketIdx = state.market.findIndex((c) => c.id === action.marketCardId);

      const handCard = activePlayer.hand[handIdx];
      const marketCard = state.market[marketIdx];

      activePlayer.tokens -= swapCost;
      if (hasFreeSwap) {
        if (activePlayer.modifiers.freeMarketSwapsCount > 0) {
          activePlayer.modifiers.freeMarketSwapsCount -= 1;
        }
        if (isPendingFreeMarket) {
          advancePendingChoiceQueue(state);
        }
      } else {
        state.hasUsedMarketThisTurn = true;
      }

      activePlayer.hand[handIdx] = marketCard;
      state.market[marketIdx] = handCard;

      const consumesAction =
        Boolean(state.config.marketSwapConsumesAction) ||
        state.config.marketSwapTiming === 'REPLACES_MAIN_ACTION';

      if (!hasFreeSwap && consumesAction) {
        state.mainActionTaken = true;
        state.rollsLeft = 0;
        state.turnStep = 'POST_ACTION';
      }

      addLog(
        state,
        activePlayer.id,
        activePlayer.name,
        'MARKET_SWAP',
        `${activePlayer.name} scambia col Mercato: prende "${marketCard.name}" e lascia "${handCard.name}" (${swapCost === 0 ? 'GRATIS' : `-${swapCost} gettoni`}).`,
        action.timestamp
      );
      return state;
    }

    case 'OFFER_PLAYER_TRADE': {
      const activePlayer = state.players[state.currentPlayerIndex];
      const targetPlayer = state.players.find((p) => p.id === action.toPlayerId)!;

      state.hasMadeTradeOfferThisTurn = true;
      state.pendingTradeOffer = {
        id: makeId(state, 'offer'),
        fromPlayerId: activePlayer.id,
        toPlayerId: targetPlayer.id,
        offeredTokens: action.offeredTokens,
        offeredSwapCardId: action.offeredSwapCardId || '',
        targetCardId: action.targetCardId,
        status: 'PENDING',
      };

      const requiresCardBack = Boolean(
        state.config.tradeRequiresCardBack ?? state.config.tradeRequiresCardSwap
      );

      addLog(
        state,
        activePlayer.id,
        activePlayer.name,
        'TRADE_OFFER',
        requiresCardBack
          ? `${activePlayer.name} offre ${action.offeredTokens} gettoni (+ 1 carta in cambio) a ${targetPlayer.name} per comprare una carta non giocata.`
          : `${activePlayer.name} offre ${action.offeredTokens} gettoni a ${targetPlayer.name} per comprare una carta non giocata.`,
        action.timestamp
      );

      if (targetPlayer.isBot) {
        const shouldAccept = action.offeredTokens >= 2 && targetPlayer.hand.length > 0;
        return applyGameAction(state, {
          type: 'RESPOND_PLAYER_TRADE',
          playerId: targetPlayer.id,
          accept: shouldAccept,
          chosenTargetCardId: targetPlayer.hand[0]?.id,
          timestamp: action.timestamp,
        });
      }

      return state;
    }

    case 'RESPOND_PLAYER_TRADE': {
      const offer = state.pendingTradeOffer!;
      const buyer = state.players.find((p) => p.id === offer.fromPlayerId);
      const seller = state.players.find((p) => p.id === offer.toPlayerId);
      state.pendingTradeOffer = null;

      if (!buyer || !seller) return state;

      if (!action.accept) {
        addLog(
          state,
          seller.id,
          seller.name,
          'TRADE_REJECTED',
          `${seller.name} ha rifiutato l'offerta di ${buyer.name}.`,
          action.timestamp
        );
        return state;
      }

      const requiresCardBack = Boolean(
        state.config.tradeRequiresCardBack ?? state.config.tradeRequiresCardSwap
      );
      const targetCardId = action.chosenTargetCardId || offer.targetCardId || seller.hand[0]?.id;
      const sellerCardIdx = seller.hand.findIndex((c) => c.id === targetCardId);

      if (sellerCardIdx === -1 || buyer.tokens < offer.offeredTokens) {
        return state;
      }

      const sellerCard = seller.hand[sellerCardIdx];

      if (requiresCardBack) {
        const buyerCardIdx = buyer.hand.findIndex((c) => c.id === offer.offeredSwapCardId);
        if (buyerCardIdx === -1) return state;
        const buyerCard = buyer.hand[buyerCardIdx];

        if (
          wouldCreateDuplicateInTeam(buyer, sellerCard, state.config, [buyerCard.id]) ||
          wouldCreateDuplicateInTeam(seller, buyerCard, state.config, [sellerCard.id])
        ) {
          addLog(
            state,
            seller.id,
            seller.name,
            'TRADE_CANCELLED',
            `Lo scambio tra ${buyer.name} e ${seller.name} è stato annullato perché avrebbe creato una carta doppia in squadra.`,
            action.timestamp
          );
          return state;
        }

        buyer.hand.splice(buyerCardIdx, 1);
        seller.hand.splice(sellerCardIdx, 1);
        buyer.hand.push(sellerCard);
        seller.hand.push(buyerCard);
      } else {
        if (wouldCreateDuplicateInTeam(buyer, sellerCard, state.config)) {
          return state;
        }
        seller.hand.splice(sellerCardIdx, 1);
        buyer.hand.push(sellerCard);
      }

      buyer.tokens -= offer.offeredTokens;
      seller.tokens += offer.offeredTokens;

      addLog(
        state,
        seller.id,
        seller.name,
        'TRADE_ACCEPTED',
        requiresCardBack
          ? `Affare fatto! ${seller.name} accetta ${offer.offeredTokens} gettoni da ${buyer.name} e scambia una carta coperta.`
          : `Affare fatto! ${seller.name} vende una carta non giocata a ${buyer.name} per ${offer.offeredTokens} gettoni.`,
        action.timestamp
      );
      return state;
    }

    case 'RETURN_MISMATCHED_CARD_TO_HAND': {
      const player = state.players.find((p) => p.id === action.playerId)!;
      const idx = player.played.findIndex((c) => c.id === action.playedCardId);
      const [card] = player.played.splice(idx, 1);
      player.hand.push(card);

      addLog(
        state,
        player.id,
        player.name,
        'RETURN_MISMATCH',
        `${player.name} ha ripreso in mano "${card.name}" perché incompatibile col proprio Obiettivo.`,
        action.timestamp
      );
      return state;
    }

    case 'END_TURN': {
      const activePlayer = state.players[state.currentPlayerIndex];
      if (
        state.pendingChoice?.type === 'FREE_MARKET_SWAP' &&
        state.pendingChoice.playerId === activePlayer.id
      ) {
        advancePendingChoiceQueue(state);
      }

      activePlayer.modifiers.forbidPlayNextTurn = false;
      activePlayer.modifiers.canPlayExtraCardWithoutCombo = false;

      const winnerId = checkWinner(state);
      if (winnerId) {
        state.winnerPlayerId = winnerId;
        state.phase = 'GAME_OVER';
        return state;
      }

      const nextIndex = (state.currentPlayerIndex + 1) % state.players.length;
      if (nextIndex === 0) {
        state.turnNumber += 1;
      }
      setupTurnForPlayer(state, nextIndex);
      return state;
    }

    case 'RESET_TO_LOBBY': {
      state.phase = 'LOBBY';
      state.winnerPlayerId = null;
      state.market = [];
      state.pendingTradeOffer = null;
      state.pendingDraftTrades = [];
      state.pendingChoice = null;
      state.pendingChoicesQueue = [];
      state.pendingPassLeftSelections = undefined;
      state.othersFourDiceUntilPlayerId = null;
      state.invertComboTableUntilPlayerId = null;
      state.players.forEach((p) => {
        p.draftReady = false;
        p.unopenedPacks = [];
        p.pulledPool = [];
        p.selectedStarterIds = [];
        p.selectedReserveIds = [];
        p.hand = [];
        p.played = [];
        p.objective = null;
        p.objectiveCandidates = [];
        p.tokens = state.config.startingTokens;
        p.modifiers = createCleanModifiers();
      });
      return state;
    }

    default:
      return state;
  }
}

function createCleanModifiers(): PlayerState['modifiers'] {
  return {
    nextCardDiscount: 0,
    freeMarketSwapsCount: 0,
    canPlayExtraCardWithoutCombo: false,
    maxRollsOverrideNextTurn: null,
    diceCountOverrideNextTurn: null,
    skipNextTurn: false,
    forbidPlayNextTurn: false,
    usedLuckyDieFlipThisTurn: false,
    animaFestaTriggersThisRound: 0,
    repayDebtsNextTurn: [],
    revealedObjectivePlayerIds: [],
  };
}

function selectBestObjectiveForBot(
  hand: CardData[],
  candidates: GameState['objectivesDeck'],
  teamSize: number
) {
  if (candidates.length === 0) return null;
  for (const cand of candidates) {
    const evalRes = evaluateObjective(hand, cand, teamSize);
    if (evalRes.satisfied) return cand;
  }
  return candidates[0];
}

function autoPickDraftForPlayer(player: PlayerState, config: GameConfig) {
  player.selectedStarterIds = [];
  player.selectedReserveIds = [];
  const usedCardKeys = new Set<string>();
  const usedPersonNames = new Set<string>();
  const usedClasses = new Set<string>();
  const usedEffectTypes = new Set<string>();
  const forbidSamePerson =
    config.uniquePersonPerTeam || config.allowMultipleVersionsSamePerson === false;

  // Passo 1: cerca di coprire 4 classi diverse e i 3 tipi di effetto nei 4 titolari
  const sortedPool = [...player.pulledPool].sort((a, b) => {
    const aPromo = a.rarity === 'PROMO' ? 1 : 0;
    const bPromo = b.rarity === 'PROMO' ? 1 : 0;
    return aPromo - bPromo || a.cost - b.cost;
  });

  for (const card of sortedPool) {
    if (player.selectedStarterIds.length >= config.teamSize) break;
    const cKey = getCardIdentityKey(card);
    const pKey = card.personName.toLowerCase();
    if (usedCardKeys.has(cKey)) continue;
    if (forbidSamePerson && usedPersonNames.has(pKey)) continue;
    if (usedClasses.has(card.cardClass) && usedClasses.size < 4) continue;
    if (usedEffectTypes.has(card.effectType) && usedEffectTypes.size < 3 && sortedPool.some(
      (other) => !usedCardKeys.has(getCardIdentityKey(other)) && other.cardClass === card.cardClass && !usedEffectTypes.has(other.effectType)
    )) {
      continue;
    }

    player.selectedStarterIds.push(card.id);
    usedCardKeys.add(cKey);
    usedPersonNames.add(pKey);
    usedClasses.add(card.cardClass);
    usedEffectTypes.add(card.effectType);
  }

  // Passo 2: completa i titolari e le 2 riserve
  for (const card of player.pulledPool) {
    const cKey = getCardIdentityKey(card);
    const pKey = card.personName.toLowerCase();

    if (
      player.selectedStarterIds.length < config.teamSize &&
      !player.selectedStarterIds.includes(card.id)
    ) {
      if (usedCardKeys.has(cKey)) continue;
      if (forbidSamePerson && usedPersonNames.has(pKey)) continue;
      player.selectedStarterIds.push(card.id);
      usedCardKeys.add(cKey);
      usedPersonNames.add(pKey);
    } else if (
      player.selectedReserveIds.length < config.reserveSize &&
      !player.selectedStarterIds.includes(card.id) &&
      !player.selectedReserveIds.includes(card.id)
    ) {
      player.selectedReserveIds.push(card.id);
    }
  }

  for (const card of player.pulledPool) {
    if (
      player.selectedStarterIds.length < config.teamSize &&
      !player.selectedStarterIds.includes(card.id) &&
      !player.selectedReserveIds.includes(card.id)
    ) {
      const cKey = getCardIdentityKey(card);
      if (!usedCardKeys.has(cKey)) {
        player.selectedStarterIds.push(card.id);
        usedCardKeys.add(cKey);
      }
    } else if (
      player.selectedReserveIds.length < config.reserveSize &&
      !player.selectedStarterIds.includes(card.id) &&
      !player.selectedReserveIds.includes(card.id)
    ) {
      player.selectedReserveIds.push(card.id);
    }
  }
}

/**
 * Esegue l'effetto su un giocatore bersaglio specifico per i modelli `Ostacolo` a bersaglio singolo.
 */
function executeTargetPlayerEffect(
  state: GameState,
  sourcePlayer: PlayerState,
  targetPlayer: PlayerState,
  cardName: string,
  templateId: EffectTemplateId,
  val: number,
  secVal: number
) {
  switch (templateId) {
    case 'SET_TARGET_NEXT_ROLLS': {
      targetPlayer.modifiers.maxRollsOverrideNextTurn = val;
      addLog(
        state,
        sourcePlayer.id,
        sourcePlayer.name,
        'EFFECT',
        `Effetto "${cardName}": ${targetPlayer.name} tirerà i dadi solo ${val} volte nel suo prossimo turno!`
      );
      break;
    }

    case 'SKIP_TARGET_NEXT_TURN': {
      targetPlayer.modifiers.skipNextTurn = true;
      addLog(
        state,
        sourcePlayer.id,
        sourcePlayer.name,
        'EFFECT',
        `Effetto "${cardName}": ${targetPlayer.name} salterà il suo prossimo turno!`
      );
      break;
    }

    case 'LOSE_TARGET_TOKENS': {
      const lost = Math.min(targetPlayer.tokens, val);
      targetPlayer.tokens -= lost;
      addLog(
        state,
        sourcePlayer.id,
        sourcePlayer.name,
        'EFFECT',
        `Effetto "${cardName}": ${targetPlayer.name} perde ${lost} gettone/i nella scorta.`
      );
      break;
    }

    case 'FORBID_TARGET_PLAY_NEXT_TURN': {
      targetPlayer.modifiers.forbidPlayNextTurn = true;
      addLog(
        state,
        sourcePlayer.id,
        sourcePlayer.name,
        'EFFECT',
        `Effetto "${cardName}": nel suo prossimo turno ${targetPlayer.name} non potrà scegliere Gioca (solo Incassa)!`
      );
      break;
    }

    case 'STEAL_TOKENS': {
      const stolen = Math.min(targetPlayer.tokens, val);
      targetPlayer.tokens -= stolen;
      sourcePlayer.tokens += stolen;
      addLog(
        state,
        sourcePlayer.id,
        sourcePlayer.name,
        'EFFECT',
        `Effetto "${cardName}": ${sourcePlayer.name} ruba ${stolen} gettone/i a ${targetPlayer.name}!`
      );
      break;
    }

    case 'BORROW_TOKENS_REPAY_NEXT_TURN': {
      const taken = Math.min(targetPlayer.tokens, val);
      targetPlayer.tokens -= taken;
      sourcePlayer.tokens += taken;
      if (taken > 0) {
        sourcePlayer.modifiers.repayDebtsNextTurn.push({
          toPlayerId: targetPlayer.id,
          amount: secVal,
        });
      }
      addLog(
        state,
        sourcePlayer.id,
        sourcePlayer.name,
        'EFFECT',
        `Effetto "${cardName}": ${sourcePlayer.name} prende ${taken} gettoni da ${targetPlayer.name} (ne restituirà ${secVal} al prossimo turno).`
      );
      break;
    }

    case 'PEEK_OBJECTIVE_AND_STEAL': {
      const stolen = Math.min(targetPlayer.tokens, val);
      targetPlayer.tokens -= stolen;
      sourcePlayer.tokens += stolen;
      if (!sourcePlayer.modifiers.revealedObjectivePlayerIds.includes(targetPlayer.id)) {
        sourcePlayer.modifiers.revealedObjectivePlayerIds.push(targetPlayer.id);
      }
      addLog(
        state,
        sourcePlayer.id,
        sourcePlayer.name,
        'EFFECT',
        `Effetto "${cardName}": ${sourcePlayer.name} spia l'Obiettivo di ${targetPlayer.name} e gli ruba ${stolen} gettone!`
      );
      break;
    }

    default:
      break;
  }
}

function enqueueTargetPlayerChoiceOrExecute(
  state: GameState,
  activePlayer: PlayerState,
  card: CardData,
  explicitTargetPlayerId: string | undefined,
  val: number,
  secVal: number
) {
  const opponents = getClockwiseOpponents(state, activePlayer.id);
  if (opponents.length === 0) return;

  if (explicitTargetPlayerId) {
    const target = opponents.find((p) => p.id === explicitTargetPlayerId);
    if (target) {
      executeTargetPlayerEffect(
        state,
        activePlayer,
        target,
        card.name,
        card.effectModel.templateId,
        val,
        secVal
      );
      return;
    }
  }

  if (opponents.length === 1) {
    executeTargetPlayerEffect(
      state,
      activePlayer,
      opponents[0],
      card.name,
      card.effectModel.templateId,
      val,
      secVal
    );
    return;
  }

  const choice: PendingChoice = {
    id: makeId(state, 'choice'),
    type: 'CHOOSE_TARGET_PLAYER',
    playerId: activePlayer.id,
    sourcePlayerId: activePlayer.id,
    sourceCardId: card.id,
    sourceCardName: card.name,
    templateId: card.effectModel.templateId,
    promptText: `${card.name}: scegli il giocatore bersaglio dell'effetto.`,
    publicMessage: `${activePlayer.name} sta scegliendo il bersaglio per "${card.name}".`,
    options: opponents.map((opp) => ({
      id: opp.id,
      label: `${opp.name} (${opp.tokens} 🪙, ${opp.played.length}/${state.config.teamSize} in gioco)`,
      targetPlayerId: opp.id,
    })),
    eligibleTargetPlayerIds: opponents.map((opp) => opp.id),
    tokenAmount: val,
    secondaryAmount: secVal,
  };
  enqueuePendingChoices(state, [choice]);
}

function performGiorgioSwap(
  state: GameState,
  sourcePlayer: PlayerState,
  targetPlayer: PlayerState,
  ownCardId: string,
  cardName: string
) {
  const ownIdx = sourcePlayer.hand.findIndex((c) => c.id === ownCardId);
  if (ownIdx === -1 || targetPlayer.hand.length === 0) return;
  const ownCard = sourcePlayer.hand[ownIdx];

  // Trova una carta nella mano dell'avversario che non crei doppioni illegali
  let oppIdx = targetPlayer.hand.findIndex(
    (oppCard) =>
      !wouldCreateDuplicateInTeam(sourcePlayer, oppCard, state.config, [ownCard.id]) &&
      !wouldCreateDuplicateInTeam(targetPlayer, ownCard, state.config, [oppCard.id])
  );
  if (oppIdx === -1) {
    oppIdx = 0;
  }

  const [removedOwn] = sourcePlayer.hand.splice(ownIdx, 1);
  const [removedOpp] = targetPlayer.hand.splice(oppIdx, 1);
  sourcePlayer.hand.push(removedOpp);
  targetPlayer.hand.push(removedOwn);

  addLog(
    state,
    sourcePlayer.id,
    sourcePlayer.name,
    'EFFECT',
    `Effetto "${cardName}": dado = 6! ${sourcePlayer.name} scambia una carta non giocata con ${targetPlayer.name}!`
  );
}

function buildFreeMarketSwapChoice(
  state: GameState,
  player: PlayerState,
  sourcePlayer: PlayerState,
  card: CardData
): PendingChoice {
  const options: PendingChoiceOption[] = [];
  for (const hCard of player.hand) {
    for (const mCard of state.market) {
      if (!wouldCreateDuplicateInTeam(player, mCard, state.config, [hCard.id])) {
        options.push({
          id: `swap-${hCard.id}-${mCard.id}`,
          label: `Dai "${hCard.name}" → Prendi "${mCard.name}"`,
          cardId: hCard.id,
          marketCardId: mCard.id,
        });
      }
    }
  }
  options.push({
    id: 'SKIP',
    label: 'Non scambiare (Passa)',
    decision: 'SKIP',
  });

  return {
    id: makeId(state, 'choice'),
    type: 'FREE_MARKET_SWAP',
    playerId: player.id,
    sourcePlayerId: sourcePlayer.id,
    sourceCardId: card.id,
    sourceCardName: card.name,
    templateId: card.effectModel.templateId,
    promptText: `${card.name}: scegli una tua carta non giocata da scambiare GRATIS con una del Mercato (oppure passa).`,
    publicMessage: `${player.name} sta scegliendo se scambiare gratis una carta col Mercato ("${card.name}").`,
    options,
    eligibleHandCardIds: player.hand.map((c) => c.id),
    eligibleMarketCardIds: state.market.map((c) => c.id),
  };
}

function applyCardEffectOnPlay(
  state: GameState,
  activePlayer: PlayerState,
  card: CardData,
  action: Extract<GameAction, { type: 'PLAY_CARD' }>
) {
  const model = card.effectModel;
  const val = model.params?.amount ?? model.params?.maxCardCost ?? model.value ?? 1;
  const secVal =
    model.params?.secondaryAmount ??
    model.params?.maxTriggersPerRound ??
    model.secondaryValue ??
    1;
  const clockwiseOpponents = getClockwiseOpponents(state, activePlayer.id);

  switch (model.templateId) {
    case 'GAIN_TOKENS': {
      activePlayer.tokens += val;
      addLog(
        state,
        activePlayer.id,
        activePlayer.name,
        'EFFECT',
        `Effetto "${card.name}": ${activePlayer.name} prende +${val} gettone/i.`
      );
      break;
    }

    case 'SET_TARGET_NEXT_ROLLS':
    case 'SKIP_TARGET_NEXT_TURN':
    case 'LOSE_TARGET_TOKENS':
    case 'FORBID_TARGET_PLAY_NEXT_TURN':
    case 'STEAL_TOKENS':
    case 'BORROW_TOKENS_REPAY_NEXT_TURN':
    case 'PEEK_OBJECTIVE_AND_STEAL': {
      enqueueTargetPlayerChoiceOrExecute(
        state,
        activePlayer,
        card,
        action.targetPlayerId,
        val,
        secVal
      );
      break;
    }

    case 'GAIN_TOKENS_AND_NEXT_ROLLS': {
      activePlayer.tokens += val;
      activePlayer.modifiers.maxRollsOverrideNextTurn = secVal;
      addLog(
        state,
        activePlayer.id,
        activePlayer.name,
        'EFFECT',
        `Effetto "${card.name}": ${activePlayer.name} prende +${val} gettone e nel prossimo turno potrà tirare ${secVal} volte!`
      );
      break;
    }

    case 'OTHERS_FOUR_DICE_ONE_ROUND': {
      state.othersFourDiceUntilPlayerId = activePlayer.id;
      addLog(
        state,
        activePlayer.id,
        activePlayer.name,
        'EFFECT',
        `Effetto "${card.name}": fino al prossimo turno di ${activePlayer.name}, tutti gli altri tirano con 4 dadi!`
      );
      break;
    }

    case 'GAMBLE_DICE_SWAP': {
      const gambleRoll = rollSingleDie(state);
      recordEffectDiceRoll(
        state,
        card.name,
        activePlayer.id,
        [{ playerId: activePlayer.id, playerName: activePlayer.name, dice: [gambleRoll] }],
        `${activePlayer.name} tira ${gambleRoll}`
      );

      if (gambleRoll <= 2) {
        const lost = Math.min(activePlayer.tokens, val);
        activePlayer.tokens -= lost;
        addLog(
          state,
          activePlayer.id,
          activePlayer.name,
          'EFFECT',
          `Effetto "${card.name}": dado = ${gambleRoll} (1–2)! ${activePlayer.name} perde ${lost} gettoni.`
        );
      } else if (gambleRoll === 6) {
        const eligibleOpponents = clockwiseOpponents.filter(
          (opp) =>
            opp.hand.length > 0 &&
            !getActiveModifiers(opp, state.config.enableCardEffects).protectedFromBuyAndBounce
        );

        if (activePlayer.hand.length === 0 || eligibleOpponents.length === 0) {
          addLog(
            state,
            activePlayer.id,
            activePlayer.name,
            'EFFECT',
            `Effetto "${card.name}": dado = 6, ma nessuno scambio possibile.`
          );
          break;
        }

        const explicitTarget = eligibleOpponents.find((o) => o.id === action.targetPlayerId);
        const explicitOwnCard = activePlayer.hand.find((c) => c.id === action.handCardId);

        if (explicitTarget && (explicitOwnCard || activePlayer.hand.length === 1)) {
          performGiorgioSwap(
            state,
            activePlayer,
            explicitTarget,
            (explicitOwnCard || activePlayer.hand[0]).id,
            card.name
          );
        } else {
          const options: PendingChoiceOption[] = [];
          for (const hCard of activePlayer.hand) {
            for (const opp of eligibleOpponents) {
              options.push({
                id: `giorgio-${hCard.id}-${opp.id}`,
                label: `Dai "${hCard.name}" ↔ Scambia con ${opp.name}`,
                cardId: hCard.id,
                targetPlayerId: opp.id,
              });
            }
          }
          const choice: PendingChoice = {
            id: makeId(state, 'choice'),
            type: 'GIORGIO_SWAP_CHOICE',
            playerId: activePlayer.id,
            sourcePlayerId: activePlayer.id,
            sourceCardId: card.id,
            sourceCardName: card.name,
            templateId: 'GAMBLE_DICE_SWAP',
            promptText: `${card.name} (Dado = 6!): scegli quale tua carta non giocata scambiare e con quale avversario.`,
            publicMessage: `Dado = 6! ${activePlayer.name} sta scegliendo con chi scambiare una carta ("${card.name}").`,
            options,
            eligibleHandCardIds: activePlayer.hand.map((c) => c.id),
            eligibleTargetPlayerIds: eligibleOpponents.map((o) => o.id),
          };
          enqueuePendingChoices(state, [choice]);
        }
      } else {
        addLog(
          state,
          activePlayer.id,
          activePlayer.name,
          'EFFECT',
          `Effetto "${card.name}": dado = ${gambleRoll} (nessun malus e nessuno scambio).`
        );
      }
      break;
    }

    case 'ROLL_2D6_JACKPOT_TOKENS': {
      const d1 = rollSingleDie(state);
      const d2 = rollSingleDie(state);
      const sum = d1 + d2;
      const reward = sum === 6 || sum === 7 ? val : secVal;
      activePlayer.tokens += reward;

      recordEffectDiceRoll(
        state,
        card.name,
        activePlayer.id,
        [{ playerId: activePlayer.id, playerName: activePlayer.name, dice: [d1, d2] }],
        `${activePlayer.name} tira ${d1}+${d2}=${sum} (+${reward} 🪙)`
      );

      addLog(
        state,
        activePlayer.id,
        activePlayer.name,
        'EFFECT',
        `Effetto "${card.name}": 2 dadi = ${d1} + ${d2} = ${sum}! ${activePlayer.name} prende +${reward} gettoni.`
      );
      break;
    }

    case 'ALL_ROLL_LOWEST_LOSES_TOKENS': {
      const rolls = state.players.map((p) => ({
        player: p,
        roll: rollSingleDie(state),
      }));
      const minRoll = Math.min(...rolls.map((r) => r.roll));
      const losers = rolls.filter((r) => r.roll === minRoll);
      for (const l of losers) {
        const lost = Math.min(l.player.tokens, val);
        l.player.tokens -= lost;
      }
      const summary = rolls.map((r) => `${r.player.name}:${r.roll}`).join(', ');
      recordEffectDiceRoll(
        state,
        card.name,
        activePlayer.id,
        rolls.map((r) => ({
          playerId: r.player.id,
          playerName: r.player.name,
          dice: [r.roll],
        })),
        summary
      );
      addLog(
        state,
        activePlayer.id,
        activePlayer.name,
        'EFFECT',
        `Effetto "${card.name}" [${summary}]: minimo ${minRoll} → ${losers.map((l) => l.player.name).join(', ')} perde ${val} gettoni!`
      );
      break;
    }

    case 'PASS_UNPLAYED_LEFT': {
      const orderedPlayers = getClockwiseAllPlayers(state, activePlayer.id).filter(
        (p) => p.hand.length > 0
      );
      if (orderedPlayers.length >= 2) {
        state.pendingPassLeftSelections = {};
        const choices: PendingChoice[] = orderedPlayers.map((p, idx) => {
          const leftReceiver = orderedPlayers[(idx + 1) % orderedPlayers.length];
          return {
            id: makeId(state, 'choice'),
            type: 'PASS_CARD_LEFT',
            playerId: p.id,
            sourcePlayerId: activePlayer.id,
            sourceCardId: card.id,
            sourceCardName: card.name,
            templateId: 'PASS_UNPLAYED_LEFT',
            promptText: `${card.name}: scegli una tua carta non giocata da passare a ${leftReceiver.name} (alla tua sinistra).`,
            publicMessage: `Sfattonata Collettiva: in attesa che ${p.name} scelga la carta da passare a sinistra.`,
            options: p.hand.map((c) => ({
              id: c.id,
              label: `${c.name} (${c.cardClass}, costo ${c.cost})`,
              cardId: c.id,
            })),
            eligibleHandCardIds: p.hand.map((c) => c.id),
          };
        });
        enqueuePendingChoices(state, choices);
      }
      break;
    }

    case 'INVERT_COMBO_TABLE_ONE_ROUND': {
      state.invertComboTableUntilPlayerId = activePlayer.id;
      addLog(
        state,
        activePlayer.id,
        activePlayer.name,
        'EFFECT',
        `Effetto "${card.name}": fino al prossimo turno di ${activePlayer.name}, le combinazioni dei costi 2↔6 e 3↔5 sono invertite!`
      );
      break;
    }

    case 'ALL_GAIN_TOKENS_SELF_MORE': {
      for (const p of state.players) {
        if (p.id === activePlayer.id) {
          p.tokens += val;
        } else {
          p.tokens += secVal;
        }
      }
      addLog(
        state,
        activePlayer.id,
        activePlayer.name,
        'EFFECT',
        `Effetto "${card.name}": ${activePlayer.name} prende +${val} gettoni e tutti gli altri +${secVal}!`
      );
      break;
    }

    case 'GAIN_TOKENS_AND_FREE_MARKET': {
      activePlayer.tokens += val;
      activePlayer.modifiers.freeMarketSwapsCount += 1;
      addLog(
        state,
        activePlayer.id,
        activePlayer.name,
        'EFFECT',
        `Effetto "${card.name}": ${activePlayer.name} prende +${val} gettone e il suo prossimo scambio col Mercato è GRATIS!`
      );
      break;
    }

    case 'OTHERS_PAY_TOKEN_OR_4_DICE': {
      const choices: PendingChoice[] = [];
      for (const opp of clockwiseOpponents) {
        const options: PendingChoiceOption[] = [];
        if (opp.tokens >= val) {
          options.push({
            id: 'PAY_TOKEN',
            label: `Dai ${val} gettone a ${activePlayer.name}`,
            decision: 'PAY_TOKEN',
          });
        }
        options.push({
          id: 'FOUR_DICE',
          label: 'Tira con 4 dadi nel tuo prossimo turno',
          decision: 'FOUR_DICE',
        });

        choices.push({
          id: makeId(state, 'choice'),
          type: 'PAY_TOKEN_OR_FOUR_DICE',
          playerId: opp.id,
          sourcePlayerId: activePlayer.id,
          sourceCardId: card.id,
          sourceCardName: card.name,
          templateId: 'OTHERS_PAY_TOKEN_OR_4_DICE',
          promptText: `${card.name}: scegli se dare ${val} gettone a ${activePlayer.name} oppure tirare con 4 dadi nel tuo prossimo turno.`,
          publicMessage: `Giro di Shot: ${opp.name} sta scegliendo se dare ${val} gettone a ${activePlayer.name} o tirare con 4 dadi.`,
          options,
          tokenAmount: val,
        });
      }
      enqueuePendingChoices(state, choices);
      break;
    }

    case 'ALL_FREE_MARKET_SWAP': {
      const ordered = getClockwiseAllPlayers(state, activePlayer.id);
      const choices: PendingChoice[] = [];
      for (const p of ordered) {
        p.modifiers.freeMarketSwapsCount += 1;
        if (p.hand.length > 0 && state.market.length > 0) {
          choices.push(buildFreeMarketSwapChoice(state, p, activePlayer, card));
        }
      }
      addLog(
        state,
        activePlayer.id,
        activePlayer.name,
        'EFFECT',
        `Effetto "${card.name}": a partire da ${activePlayer.name}, ogni giocatore può scambiare gratis una carta col Mercato!`
      );
      enqueuePendingChoices(state, choices);
      break;
    }

    case 'PLAY_EXTRA_CARD_NO_COMBO': {
      activePlayer.modifiers.canPlayExtraCardWithoutCombo = true;
      addLog(
        state,
        activePlayer.id,
        activePlayer.name,
        'EFFECT',
        `Effetto "${card.name}": ${activePlayer.name} può giocare subito un'altra carta pagando solo i gettoni (senza combinazione di dadi)!`
      );
      break;
    }

    case 'FREE_IMMEDIATE_MARKET_SWAP': {
      activePlayer.modifiers.freeMarketSwapsCount += 1;
      if (activePlayer.hand.length > 0 && state.market.length > 0) {
        enqueuePendingChoices(state, [
          buildFreeMarketSwapChoice(state, activePlayer, activePlayer, card),
        ]);
      }
      addLog(
        state,
        activePlayer.id,
        activePlayer.name,
        'EFFECT',
        `Effetto "${card.name}": ${activePlayer.name} può scambiare subito GRATIS una carta col Mercato!`
      );
      break;
    }

    case 'RETURN_PLAYED_CARD': {
      const maxCost = model.params?.maxCardCost ?? model.params?.amount ?? model.value ?? 4;

      if (action.targetPlayerId) {
        const targetPlayer = clockwiseOpponents.find((p) => p.id === action.targetPlayerId);
        if (!targetPlayer) break;

        if (
          getActiveModifiers(targetPlayer, state.config.enableCardEffects).protectedFromBuyAndBounce
        ) {
          addLog(
            state,
            activePlayer.id,
            activePlayer.name,
            'PROTECTED',
            `${targetPlayer.name} ha una protezione attiva ("Il Piumone"): le sue carte giocate sono protette dallo sfratto!`
          );
          break;
        }

        const eligible = targetPlayer.played.filter((c) => c.cost <= maxCost);
        if (eligible.length === 0) {
          addLog(
            state,
            activePlayer.id,
            activePlayer.name,
            'EFFECT',
            `Effetto "${card.name}": ${targetPlayer.name} non ha carte in gioco di costo ${maxCost} o meno.`
          );
          break;
        }

        const explicitCard = eligible.find((c) => c.id === action.targetPlayedCardId);
        if (explicitCard || eligible.length === 1) {
          const cardToReturn = explicitCard || eligible[0];
          targetPlayer.played = targetPlayer.played.filter((c) => c.id !== cardToReturn.id);
          targetPlayer.hand.push(cardToReturn);
          addLog(
            state,
            activePlayer.id,
            activePlayer.name,
            'EFFECT',
            `Effetto "${card.name}": "${cardToReturn.name}" di ${targetPlayer.name} torna in mano (ed eventuali copie bloccate si sbloccano)!`
          );
          break;
        }

        // Più carte eleggibili del bersaglio: chiedi quale rimandare in mano
        const choice: PendingChoice = {
          id: makeId(state, 'choice'),
          type: 'CHOOSE_TARGET_PLAYED_CARD',
          playerId: activePlayer.id,
          sourcePlayerId: activePlayer.id,
          sourceCardId: card.id,
          sourceCardName: card.name,
          templateId: 'RETURN_PLAYED_CARD',
          promptText: `${card.name}: scegli quale carta giocata di ${targetPlayer.name} (costo ≤ ${maxCost}) rimandare in mano.`,
          publicMessage: `${activePlayer.name} sta scegliendo quale carta rimandare in mano con "${card.name}".`,
          options: eligible.map((c) => ({
            id: c.id,
            label: `${targetPlayer.name}: "${c.name}" (costo ${c.cost})`,
            targetPlayerId: targetPlayer.id,
            targetPlayedCardId: c.id,
          })),
          eligiblePlayedCards: eligible.map((c) => ({
            playerId: targetPlayer.id,
            playerName: targetPlayer.name,
            card: c,
          })),
          maxCardCost: maxCost,
        };
        enqueuePendingChoices(state, [choice]);
        break;
      }

      // Nessun targetPlayerId esplicito: raccogli tutte le carte eleggibili degli avversari non protetti
      const allEligible: Array<{ playerId: string; playerName: string; card: CardData }> = [];
      for (const opp of clockwiseOpponents) {
        if (getActiveModifiers(opp, state.config.enableCardEffects).protectedFromBuyAndBounce) {
          continue;
        }
        for (const c of opp.played) {
          if (c.cost <= maxCost) {
            allEligible.push({ playerId: opp.id, playerName: opp.name, card: c });
          }
        }
      }

      if (allEligible.length === 0) {
        addLog(
          state,
          activePlayer.id,
          activePlayer.name,
          'EFFECT',
          `Effetto "${card.name}": nessuna carta in gioco avversaria di costo ${maxCost} o meno può essere rimandata in mano.`
        );
        break;
      }

      const choice: PendingChoice = {
        id: makeId(state, 'choice'),
        type: 'CHOOSE_TARGET_PLAYED_CARD',
        playerId: activePlayer.id,
        sourcePlayerId: activePlayer.id,
        sourceCardId: card.id,
        sourceCardName: card.name,
        templateId: 'RETURN_PLAYED_CARD',
        promptText: `${card.name}: scegli quale carta giocata (costo ≤ ${maxCost}) rimandare in mano al proprietario.`,
        publicMessage: `${activePlayer.name} sta scegliendo quale carta rimandare in mano con "${card.name}".`,
        options: allEligible.map((entry) => ({
          id: entry.card.id,
          label: `${entry.playerName}: "${entry.card.name}" (costo ${entry.card.cost})`,
          targetPlayerId: entry.playerId,
          targetPlayedCardId: entry.card.id,
        })),
        eligiblePlayedCards: allEligible,
        maxCardCost: maxCost,
      };
      enqueuePendingChoices(state, [choice]);
      break;
    }

    default:
      break;
  }
}

function resolvePendingChoiceAction(
  state: GameState,
  action: Extract<GameAction, { type: 'RESOLVE_PENDING_CHOICE' }>
) {
  const choice = state.pendingChoice;
  if (!choice) return;

  const choosingPlayer = state.players.find((p) => p.id === choice.playerId);
  const sourcePlayer = state.players.find((p) => p.id === choice.sourcePlayerId);
  if (!choosingPlayer || !sourcePlayer) {
    advancePendingChoiceQueue(state);
    return;
  }

  const opt = choice.options.find((o) => o.id === action.optionId);

  switch (choice.type) {
    case 'CHOOSE_TARGET_PLAYER': {
      const targetId = action.targetPlayerId || opt?.targetPlayerId;
      const targetPlayer = state.players.find((p) => p.id === targetId);
      if (targetPlayer) {
        executeTargetPlayerEffect(
          state,
          sourcePlayer,
          targetPlayer,
          choice.sourceCardName,
          choice.templateId,
          choice.tokenAmount ?? 1,
          choice.secondaryAmount ?? 1
        );
      }
      advancePendingChoiceQueue(state);
      break;
    }

    case 'CHOOSE_RICHEST_TIE': {
      const targetId = action.targetPlayerId || opt?.targetPlayerId;
      const targetPlayer = state.players.find((p) => p.id === targetId);
      const val = choice.tokenAmount ?? 1;
      if (targetPlayer) {
        const stolen = Math.min(targetPlayer.tokens, val);
        targetPlayer.tokens -= stolen;
        sourcePlayer.tokens += stolen;
        addLog(
          state,
          sourcePlayer.id,
          sourcePlayer.name,
          'EFFECT',
          `Effetto "${choice.sourceCardName}": ${sourcePlayer.name} ruba ${stolen} gettone a ${targetPlayer.name}!`
        );
      }
      advancePendingChoiceQueue(state);
      break;
    }

    case 'CHOOSE_TARGET_PLAYED_CARD': {
      const targetPlayedCardId = action.targetPlayedCardId || opt?.targetPlayedCardId;
      const entry = choice.eligiblePlayedCards?.find((e) => e.card.id === targetPlayedCardId);
      if (entry) {
        const targetPlayer = state.players.find((p) => p.id === entry.playerId);
        if (targetPlayer) {
          const cardToReturn = targetPlayer.played.find((c) => c.id === entry.card.id);
          if (cardToReturn) {
            targetPlayer.played = targetPlayer.played.filter((c) => c.id !== cardToReturn.id);
            targetPlayer.hand.push(cardToReturn);
            addLog(
              state,
              sourcePlayer.id,
              sourcePlayer.name,
              'EFFECT',
              `Effetto "${choice.sourceCardName}": "${cardToReturn.name}" di ${targetPlayer.name} torna in mano (ed eventuali copie bloccate si sbloccano)!`
            );
          }
        }
      }
      advancePendingChoiceQueue(state);
      break;
    }

    case 'GIORGIO_SWAP_CHOICE': {
      const ownCardId = action.cardId || opt?.cardId || choosingPlayer.hand[0]?.id;
      const targetId =
        action.targetPlayerId || opt?.targetPlayerId || choice.eligibleTargetPlayerIds?.[0];
      const targetPlayer = state.players.find((p) => p.id === targetId);
      if (ownCardId && targetPlayer) {
        performGiorgioSwap(state, choosingPlayer, targetPlayer, ownCardId, choice.sourceCardName);
      }
      advancePendingChoiceQueue(state);
      break;
    }

    case 'PASS_CARD_LEFT': {
      const cardId = action.cardId || opt?.cardId;
      if (!state.pendingPassLeftSelections) {
        state.pendingPassLeftSelections = {};
      }
      if (cardId) {
        state.pendingPassLeftSelections[choosingPlayer.id] = cardId;
      }

      const morePassChoicesInQueue = state.pendingChoicesQueue?.some(
        (c) => c.type === 'PASS_CARD_LEFT' && c.sourceCardId === choice.sourceCardId
      );

      advancePendingChoiceQueue(state);

      if (!morePassChoicesInQueue) {
        // Tutti i giocatori hanno scelto: esegui il passaggio simultaneo a sinistra!
        const selections = state.pendingPassLeftSelections || {};
        const participants = getClockwiseAllPlayers(state, sourcePlayer.id).filter(
          (p) => selections[p.id] && p.hand.some((c) => c.id === selections[p.id])
        );

        if (participants.length >= 2) {
          const extractedCards = participants.map((p) => {
            const cIdx = p.hand.findIndex((c) => c.id === selections[p.id]);
            const [removed] = p.hand.splice(cIdx, 1);
            return removed;
          });

          for (let i = 0; i < participants.length; i++) {
            const receiver = participants[(i + 1) % participants.length];
            receiver.hand.push(extractedCards[i]);
          }

          addLog(
            state,
            sourcePlayer.id,
            sourcePlayer.name,
            'EFFECT',
            `Effetto "${choice.sourceCardName}": ogni giocatore ha passato una carta non giocata al giocatore alla sua sinistra!`
          );
        }
        state.pendingPassLeftSelections = undefined;
      }
      break;
    }

    case 'PAY_TOKEN_OR_FOUR_DICE': {
      const decision = action.decision || opt?.decision || 'FOUR_DICE';
      const reqTokens = choice.tokenAmount ?? 1;
      if (decision === 'PAY_TOKEN' && choosingPlayer.tokens >= reqTokens) {
        choosingPlayer.tokens -= reqTokens;
        sourcePlayer.tokens += reqTokens;
        addLog(
          state,
          choosingPlayer.id,
          choosingPlayer.name,
          'EFFECT',
          `Effetto "${choice.sourceCardName}": ${choosingPlayer.name} sceglie di dare ${reqTokens} gettone a ${sourcePlayer.name}.`
        );
      } else {
        choosingPlayer.modifiers.diceCountOverrideNextTurn = 4;
        addLog(
          state,
          choosingPlayer.id,
          choosingPlayer.name,
          'EFFECT',
          `Effetto "${choice.sourceCardName}": ${choosingPlayer.name} sceglie di tirare con 4 dadi nel suo prossimo turno.`
        );
      }
      advancePendingChoiceQueue(state);
      break;
    }

    case 'FREE_MARKET_SWAP': {
      const decision = action.decision || opt?.decision;
      if (decision === 'SKIP') {
        if (choosingPlayer.modifiers.freeMarketSwapsCount > 0) {
          choosingPlayer.modifiers.freeMarketSwapsCount -= 1;
        }
        addLog(
          state,
          choosingPlayer.id,
          choosingPlayer.name,
          'EFFECT',
          `${choosingPlayer.name} sceglie di non scambiare col Mercato ("${choice.sourceCardName}").`
        );
        advancePendingChoiceQueue(state);
        break;
      }

      const handCardId = action.cardId || opt?.cardId;
      const marketCardId = action.marketCardId || opt?.marketCardId;
      const handIdx = choosingPlayer.hand.findIndex((c) => c.id === handCardId);
      const marketIdx = state.market.findIndex((c) => c.id === marketCardId);

      if (handIdx !== -1 && marketIdx !== -1) {
        const handCard = choosingPlayer.hand[handIdx];
        const marketCard = state.market[marketIdx];
        choosingPlayer.hand[handIdx] = marketCard;
        state.market[marketIdx] = handCard;
        if (choosingPlayer.modifiers.freeMarketSwapsCount > 0) {
          choosingPlayer.modifiers.freeMarketSwapsCount -= 1;
        }
        addLog(
          state,
          choosingPlayer.id,
          choosingPlayer.name,
          'MARKET_SWAP',
          `Effetto "${choice.sourceCardName}": ${choosingPlayer.name} scambia GRATIS "${handCard.name}" con "${marketCard.name}" del Mercato!`
        );
      }
      advancePendingChoiceQueue(state);
      break;
    }

    default:
      advancePendingChoiceQueue(state);
      break;
  }
}

// ============================================================================
// SELETTORI PUBBLICI PER LA UI E IL LAYER DI RETE P2P (Step 3 Task 8)
// ============================================================================

function createMaskedHandCard(ownerId: string, index: number): CardData {
  return {
    id: `hidden-${ownerId}-${index}`,
    baseCardId: `hidden-${ownerId}-${index}`,
    setNumber: 0,
    personName: 'Segreto',
    name: 'Carta Coperta',
    version: 'Mano Avversario',
    cardClass: 'Dormienti',
    rarity: 'Comune',
    cost: 2,
    effectType: 'Aiuto',
    effectText: 'Carta coperta in mano all’avversario.',
    effectModel: {
      templateId: 'NONE',
      timing: 'PASSIVE_NONE',
    },
  };
}

/**
 * Restituisce lo stato filtrato per `viewerPlayerId` (Step 3 Task 8).
 * Nei turni altrui e per tutti gli avversari:
 * - mostra solo il numero di carte in mano (`handCount` e carte segnaposto mascherate in `hand`), ma MAI quali carte sono;
 * - mostra carte scoperte giocate sul tavolo, gettoni, dadi correnti (`dice`, `keptDice`, `rollsLeft`, `turnStep`), Mercato, offerte di trattativa (senza rivelare la carta coperta scambiata) e dadi lanciati per effetti (`lastEffectDiceRolls`);
 * - mostra l'obiettivo altrui SOLO se `objectiveVisibility === 'PUBLIC'` (`objectiveHidden === false`) o se svelato a `viewerPlayerId` tramite "Il Ficcanaso" (`revealedObjectivePlayerIds`);
 * - oscura sempre `unopenedPacks`, `pulledPool`, `selectedStarterIds`, `selectedReserveIds` e `objectiveCandidates` degli altri giocatori.
 */
export function getPublicStateFor(state: GameState, viewerPlayerId: string): GameState {
  const cloned = cloneState(state);

  const viewer = cloned.players.find((p) => p.id === viewerPlayerId);
  const revealedIds = viewer?.modifiers?.revealedObjectivePlayerIds || [];
  const isPublicObjectives =
    cloned.config.objectiveVisibility === 'PUBLIC' || cloned.config.objectiveHidden === false;
  const isGameOver = cloned.phase === 'GAME_OVER';

  cloned.players = cloned.players.map((p: PlayerState) => {
    const handCount = p.hand.length;
    if (p.id === viewerPlayerId) {
      return {
        ...p,
        handCount,
      };
    }

    const canSeeObjective = isGameOver || isPublicObjectives || revealedIds.includes(p.id);

    return {
      ...p,
      handCount,
      unopenedPacks: p.unopenedPacks.map((pack, pkIdx) =>
        pack.map((_, cIdx) => createMaskedHandCard(`${p.id}-pk${pkIdx}`, cIdx))
      ),
      pulledPool: [],
      selectedStarterIds: [],
      selectedReserveIds: [],
      hand: isGameOver ? p.hand : p.hand.map((_, idx) => createMaskedHandCard(p.id, idx)),
      objectiveCandidates: [],
      objective: canSeeObjective ? p.objective : null,
      modifiers: {
        ...p.modifiers,
        revealedObjectivePlayerIds: [],
      },
    };
  });

  // Oscura la carta coperta offerta in trattativa se il viewer non è l'offerente
  if (cloned.pendingTradeOffer && cloned.pendingTradeOffer.fromPlayerId !== viewerPlayerId) {
    cloned.pendingTradeOffer = {
      ...cloned.pendingTradeOffer,
      offeredSwapCardId: cloned.pendingTradeOffer.offeredSwapCardId ? 'hidden-swap-card' : '',
      targetCardId: undefined,
    };
  }

  // Oscura le opzioni segrete delle scelte in sospeso se il viewer non è il giocatore che deve scegliere
  if (cloned.pendingChoice && cloned.pendingChoice.playerId !== viewerPlayerId) {
    const secretChoiceTypes: Array<PendingChoice['type']> = [
      'PASS_CARD_LEFT',
      'GIORGIO_SWAP_CHOICE',
      'FREE_MARKET_SWAP',
    ];
    if (secretChoiceTypes.includes(cloned.pendingChoice.type)) {
      cloned.pendingChoice = {
        ...cloned.pendingChoice,
        options: [],
        eligibleHandCardIds: [],
      };
    }
  }

  if (cloned.pendingChoicesQueue) {
    cloned.pendingChoicesQueue = cloned.pendingChoicesQueue.map((c) =>
      c.playerId === viewerPlayerId
        ? c
        : {
            ...c,
            options: [],
            eligibleHandCardIds: [],
          }
    );
  }

  cloned.pendingPassLeftSelections = undefined;

  return cloned;
}

/**
 * Restituisce la `PendingChoice` attualmente richiesta a `playerId`, oppure `null`.
 */
export function getPendingChoiceFor(state: GameState, playerId: string): PendingChoice | null {
  if (!state.pendingChoice || state.pendingChoice.playerId !== playerId) {
    return null;
  }
  return state.pendingChoice;
}

/**
 * Calcola il costo effettivo in gettoni di una carta per `playerId`.
 */
export function getEffectiveCost(
  state: GameState,
  playerId: string,
  cardId: string,
  useNoComboAlternateCost = false
): number {
  const player = state.players.find((p) => p.id === playerId);
  const card =
    player?.hand.find((c) => c.id === cardId) ||
    state.market.find((c) => c.id === cardId) ||
    state.catalog.find((c) => c.id === cardId);
  if (!card) return 0;
  if (!player) return card.cost;
  return getEffectiveCardTokenCost(
    player,
    card,
    state.config.enableCardEffects,
    useNoComboAlternateCost
  );
}

/**
 * Restituisce la combinazione di dadi richiesta e il livello effettivo per una carta (o costo base).
 */
export function getRequiredCombo(
  state: GameState,
  playerId: string,
  cardOrCost: CardData | string | number
): { requiredCombos: DiceComboId[]; effectiveTier: number; satisfied: boolean } {
  const player = state.players.find((p) => p.id === playerId);
  let baseCost = 2;
  if (typeof cardOrCost === 'number') {
    baseCost = cardOrCost;
  } else if (typeof cardOrCost === 'string') {
    const found =
      player?.hand.find((c) => c.id === cardOrCost) ||
      state.market.find((c) => c.id === cardOrCost) ||
      state.catalog.find((c) => c.id === cardOrCost);
    baseCost = found?.cost ?? 2;
  } else if (cardOrCost && typeof cardOrCost === 'object') {
    baseCost = cardOrCost.cost;
  }

  const activeMods = player
    ? getActiveModifiers(player, state.config.enableCardEffects)
    : { comboTierDiscount: 0 };
  const sponsorOffset = -activeMods.comboTierDiscount;
  const isTripActive = state.invertComboTableUntilPlayerId !== null;

  return canDiceSatisfyCardCost(
    state.dice,
    baseCost,
    state.config,
    sponsorOffset,
    isTripActive
  );
}

/**
 * Restituisce lo stato di giocabilità dettagliato per ciascuna carta nella mano di `playerId`,
 * incluso il motivo per cui una carta non è eventualmente giocabile.
 */
export function getPlayableCards(state: GameState, playerId: string): PlayableCardInfo[] {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return [];

  const isPlayersTurn =
    state.phase === 'PLAYING' &&
    state.players[state.currentPlayerIndex]?.id === playerId;

  return player.hand.map((card) => {
    const check = canPlayCardRightNow(state, player, card);
    const playable =
      isPlayersTurn && (check.canPlayStandard || check.canPlayNoComboAlt);
    return {
      card,
      playable,
      canPlayStandard: isPlayersTurn && check.canPlayStandard,
      canPlayNoComboAlt: isPlayersTurn && check.canPlayNoComboAlt,
      effectiveCost: check.standardCost,
      altCost: check.altCost,
      requiredCombos: check.requiredCombos,
      effectiveTier: check.effectiveTier,
      blocked: Boolean(check.blockedByOwner),
      blockedByOwner: check.blockedByOwner,
      reason: isPlayersTurn ? check.reason : 'Non è il tuo turno.',
    };
  });
}

/**
 * Restituisce tutte le `GameAction` legali che `playerId` può compiere nello stato attuale.
 * Usato sia dalla UI sia dai bot del simulatore.
 */
export function getLegalActions(state: GameState, playerId: string): GameAction[] {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return [];

  const actions: GameAction[] = [];

  if (state.phase === 'PACK_OPENING') {
    if (player.unopenedPacks.length > 0) {
      actions.push({ type: 'OPEN_NEXT_PACK', playerId });
    }
    if (!player.draftReady) {
      actions.push({ type: 'AUTO_SELECT_DRAFT', playerId });
      if (
        player.selectedStarterIds.length === state.config.teamSize &&
        player.selectedReserveIds.length === state.config.reserveSize
      ) {
        actions.push({ type: 'CONFIRM_DRAFT_TEAM', playerId });
      }
    }
    return actions;
  }

  if (state.phase === 'OBJECTIVE_PICK') {
    if (!player.objective) {
      for (const cand of player.objectiveCandidates) {
        actions.push({ type: 'PICK_OBJECTIVE', playerId, objectiveId: cand.id });
      }
    }
    return actions;
  }

  if (state.phase !== 'PLAYING') {
    return actions;
  }

  // 1. Se c'è un'offerta di trattativa diretta a questo giocatore
  if (
    state.pendingTradeOffer &&
    state.pendingTradeOffer.status === 'PENDING' &&
    state.pendingTradeOffer.toPlayerId === playerId
  ) {
    for (const hCard of player.hand) {
      actions.push({
        type: 'RESPOND_PLAYER_TRADE',
        playerId,
        accept: true,
        chosenTargetCardId: hCard.id,
      });
    }
    actions.push({
      type: 'RESPOND_PLAYER_TRADE',
      playerId,
      accept: false,
    });
    return actions;
  }

  // 2. Se c'è una scelta interattiva (`pendingChoice`) in sospeso
  if (state.pendingChoice) {
    if (state.pendingChoice.playerId !== playerId) {
      return [];
    }
    const choice = state.pendingChoice;
    for (const opt of choice.options) {
      actions.push({
        type: 'RESOLVE_PENDING_CHOICE',
        playerId,
        choiceId: choice.id,
        optionId: opt.id,
        targetPlayerId: opt.targetPlayerId,
        cardId: opt.cardId,
        marketCardId: opt.marketCardId,
        targetPlayedCardId: opt.targetPlayedCardId,
        decision: opt.decision,
      });
    }
    return actions;
  }

  // 3. Azioni del giocatore attivo nel proprio turno
  const activePlayer = state.players[state.currentPlayerIndex];
  if (!activePlayer || activePlayer.id !== playerId) {
    return [];
  }

  if (state.turnStep === 'ROLLING' && !state.mainActionTaken) {
    if (state.rollsLeft > 0) {
      actions.push({ type: 'ROLL_DICE', playerId });
      for (let i = 0; i < state.dice.length; i++) {
        actions.push({ type: 'TOGGLE_KEEP_DIE', playerId, dieIndex: i });
      }
    } else if (
      (state.config.paidExtraRollEnabled || state.config.extraPaidRoll) &&
      player.tokens >= state.config.paidExtraRollCost
    ) {
      actions.push({ type: 'BUY_EXTRA_ROLL', playerId });
    }
    actions.push({ type: 'CONFIRM_DICE_ROLL', playerId });
  }

  // Il Dado Fortunato (utilizzabile prima dell'azione principale in ROLLING o ACTION_DECISION)
  if (
    !state.mainActionTaken &&
    getActiveModifiers(player, state.config.enableCardEffects).hasFlipDieOpposite &&
    !player.modifiers.usedLuckyDieFlipThisTurn
  ) {
    for (let i = 0; i < state.dice.length; i++) {
      actions.push({ type: 'FLIP_DIE_OPPOSITE', playerId, dieIndex: i });
    }
  }

  // Giocare carte o Incassare (in ACTION_DECISION o ROLLING, oppure 2ª carta con After Party in POST_ACTION)
  const playableCards = getPlayableCards(state, playerId);
  for (const info of playableCards) {
    if (info.canPlayStandard) {
      actions.push({
        type: 'PLAY_CARD',
        playerId,
        cardId: info.card.id,
        useNoComboAlternateCost: false,
      });
    }
    if (info.canPlayNoComboAlt) {
      actions.push({
        type: 'PLAY_CARD',
        playerId,
        cardId: info.card.id,
        useNoComboAlternateCost: true,
      });
    }
  }

  if (!state.mainActionTaken) {
    actions.push({ type: 'CASH_IN_DICE', playerId });
  }

  // Scambio col Mercato se consentito dal timing
  const marketTiming = isMarketSwapAllowedInCurrentTiming(state, player);
  const swapCost =
    player.modifiers.freeMarketSwapsCount > 0
      ? 0
      : state.config.marketSwapPrice ?? state.config.marketSwapCost;
  if (marketTiming.allowed && player.tokens >= swapCost && state.market.length > 0) {
    for (const hCard of player.hand) {
      for (const mCard of state.market) {
        if (!wouldCreateDuplicateInTeam(player, mCard, state.config, [hCard.id])) {
          actions.push({
            type: 'MARKET_SWAP',
            playerId,
            handCardId: hCard.id,
            marketCardId: mCard.id,
          });
        }
      }
    }
  }

  // Chiusura turno
  if (state.mainActionTaken || state.turnStep === 'POST_ACTION') {
    actions.push({ type: 'END_TURN', playerId });
  }

  return actions;
}

// ============================================================================
// STIMA STATICA DEL BUDGET DEGLI EFFETTI (GDD §5 - Step 4 Task 6 & UI Editor)
// ============================================================================

export interface CardBudgetEvaluation {
  cardId: string;
  cardName: string;
  cardClass: string;
  cost: number;
  targetBudget: number;
  estimatedValue: number;
  diff: number;
  withinBudget: boolean;
  status: 'SOTTO_BUDGET' | 'BILANCIATA' | 'SOPRA_BUDGET';
  note: string;
}

/**
 * Stima il valore in gettoni dell'effetto di una carta secondo le Linee Guida Matematiche del GDD (§5):
 * - Unità di misura: 1 gettone (1 turno ≈ 4,5 gettoni)
 * - Budget ideale per costo: `costo - 1` gettoni (Costo 2->1, 3->2, 4->3, 5->4, 6->5)
 * - Finché è in gioco: contato come ~2,5 usi medi
 */
export function estimateCardBudget(card: CardData): CardBudgetEvaluation {
  const targetBudget = Math.max(1, card.cost - 1);
  const tpl: EffectTemplateId = card.effectModel.templateId;
  const val = card.effectModel.params?.amount ?? card.effectModel.value ?? 1;
  const sec =
    card.effectModel.params?.secondaryAmount ??
    card.effectModel.params?.maxTriggersPerRound ??
    card.effectModel.secondaryValue ??
    1;

  let estimated = 1;

  switch (tpl) {
    case 'NONE':
      estimated = 0;
      break;
    case 'GAIN_TOKENS':
      estimated = val * 1;
      break;
    case 'STEAL_TOKENS':
      estimated = val * 1.5;
      break;
    case 'LOSE_TARGET_TOKENS':
      estimated = val * 1;
      break;
    case 'SET_TARGET_NEXT_ROLLS':
      estimated = Math.max(0.5, (3 - val) * 1);
      break;
    case 'GAIN_TOKENS_AND_NEXT_ROLLS':
      estimated = val + Math.max(0, sec - 3) * 1;
      break;
    case 'PROTECT_FROM_BUY_AND_BOUNCE':
      estimated = 2.0;
      break;
    case 'CASH_IN_BONUS':
      estimated = val * 2.5;
      break;
    case 'OTHERS_FOUR_DICE_ONE_ROUND':
      estimated = 3.0;
      break;
    case 'SKIP_TARGET_NEXT_TURN':
      estimated = 4.5;
      break;
    case 'TURN_START_GAIN_TOKENS':
      estimated = (card.effectModel.params?.amount ?? card.effectModel.value ?? 2) * 2.5;
      break;
    case 'GAMBLE_DICE_SWAP':
      estimated = 1.0;
      break;
    case 'ROLL_2D6_JACKPOT_TOKENS':
      estimated = (11 / 36) * val + (25 / 36) * sec;
      break;
    case 'ALL_ROLL_LOWEST_LOSES_TOKENS':
      estimated = val * 1.1;
      break;
    case 'FLIP_DIE_OPPOSITE_ONCE_PER_TURN':
      estimated = 3.0;
      break;
    case 'PASS_UNPLAYED_LEFT':
      estimated = 3.0;
      break;
    case 'FORBID_TARGET_PLAY_NEXT_TURN':
      estimated = 4.0;
      break;
    case 'INVERT_COMBO_TABLE_ONE_ROUND':
      estimated = 5.0;
      break;
    case 'ALL_GAIN_TOKENS_SELF_MORE':
      estimated = Math.max(0.5, val - sec * 0.5);
      break;
    case 'NO_COMBO_ALTERNATE_COST':
      estimated = 1.0;
      break;
    case 'GAIN_TOKENS_AND_FREE_MARKET':
      estimated = val + 1.0;
      break;
    case 'OTHERS_PAY_TOKEN_OR_4_DICE':
      estimated = 2.2;
      break;
    case 'ON_OTHER_PLAY_GAIN_TOKEN':
      estimated = 3.0;
      break;
    case 'ALL_FREE_MARKET_SWAP':
      estimated = 3.0;
      break;
    case 'PLAY_EXTRA_CARD_NO_COMBO':
      estimated = 4.2;
      break;
    case 'DISCOUNT_COST_AND_COMBO_TIER':
      estimated = val * 5.0;
      break;
    case 'BORROW_TOKENS_REPAY_NEXT_TURN':
      estimated = val * 1.2 - sec * 0.8;
      break;
    case 'FREE_IMMEDIATE_MARKET_SWAP':
      estimated = 2.0;
      break;
    case 'LEFT_NEIGHBOR_CASH_IN_BONUS':
      estimated = val * 2.8;
      break;
    case 'PEEK_OBJECTIVE_AND_STEAL':
      estimated = val * 1.5 + 1.5;
      break;
    case 'RETURN_PLAYED_CARD':
      estimated = Math.min(5, val) * 0.85 + 0.5;
      break;
    case 'TURN_START_STEAL_FROM_RICHEST':
      estimated = val * 1.5 * 2.8;
      break;
    default:
      estimated = targetBudget;
  }

  const rounded = Number(estimated.toFixed(1));
  const diff = Number((rounded - targetBudget).toFixed(1));
  const withinBudget = Math.abs(diff) <= 0.7;

  if (diff > 0.7) {
    return {
      cardId: card.id,
      cardName: card.name,
      cardClass: card.cardClass,
      cost: card.cost,
      targetBudget,
      estimatedValue: rounded,
      diff,
      withinBudget,
      status: 'SOPRA_BUDGET',
      note: `Stima ~${rounded} 🪙 vs budget GDD ${targetBudget} 🪙 (molto forte, tieni d'occhio nei test!)`,
    };
  }
  if (diff < -0.7) {
    return {
      cardId: card.id,
      cardName: card.name,
      cardClass: card.cardClass,
      cost: card.cost,
      targetBudget,
      estimatedValue: rounded,
      diff,
      withinBudget,
      status: 'SOTTO_BUDGET',
      note: `Stima ~${rounded} 🪙 vs budget GDD ${targetBudget} 🪙 (effetto leggero, puoi potenziarlo)`,
    };
  }
  return {
    cardId: card.id,
    cardName: card.name,
    cardClass: card.cardClass,
    cost: card.cost,
    targetBudget,
    estimatedValue: rounded,
    diff,
    withinBudget,
    status: 'BILANCIATA',
    note: `Stima ~${rounded} 🪙 perfettamente in linea col budget GDD (${targetBudget} 🪙)`,
  };
}

export function evaluateCatalogBudget(catalog: CardData[] = DEFAULT_CARDS): CardBudgetEvaluation[] {
  return catalog.map((c) => estimateCardBudget(c));
}
