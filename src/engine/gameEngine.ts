import { DEFAULT_CARDS, DEFAULT_GAME_CONFIG, DEFAULT_OBJECTIVES } from '../data/defaultData';
import {
  calculateCashInTokens,
  canDiceSatisfyCardCost,
  COMBO_LABELS_IT,
  flipDieOppositeFace,
  rollSingleDie,
} from './dice';
import { evaluateObjective } from './objectives';
import {
  CardData,
  GameAction,
  GameConfig,
  GameState,
  MoveLogEntry,
  PlayerState,
} from './types';

function cloneState(state: GameState): GameState {
  return JSON.parse(JSON.stringify(state));
}

function makeId(prefix = 'id'): string {
  return `${prefix}-${Math.random().toString(36).substring(2, 8)}-${Date.now().toString(36).slice(-3)}`;
}

function addLog(
  state: GameState,
  playerId: string,
  playerName: string,
  actionType: string,
  message: string
) {
  const entry: MoveLogEntry = {
    id: makeId('log'),
    turnNumber: state.turnNumber,
    timestamp: Date.now(),
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

function shuffleArray<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function getCardIdentityKey(card: CardData): string {
  return (card.baseCardId || card.name).trim().toLowerCase();
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

  for (const p of state.players) {
    for (const playedCard of p.played) {
      if (getCardIdentityKey(playedCard) === targetCardKey) {
        return { blocked: true, ownerName: p.name };
      }
      if (
        state.config.blockAllVersionsOfSamePersonInPlay &&
        playedCard.personName.trim().toLowerCase() === targetPersonKey
      ) {
        return { blocked: true, ownerName: p.name };
      }
    }
  }

  return { blocked: false };
}

export function isPlayerProtectedByPiumone(player: PlayerState, enableEffects: boolean): boolean {
  if (!enableEffects) return false;
  return player.played.some(
    (c) =>
      c.effectModel.timing === 'WHILE_IN_PLAY' &&
      c.effectModel.templateId === 'PROTECT_FROM_BUY_AND_BOUNCE'
  );
}

export function hasLuckyDieInPlay(player: PlayerState, enableEffects: boolean): boolean {
  if (!enableEffects) return false;
  return player.played.some(
    (c) =>
      c.effectModel.timing === 'WHILE_IN_PLAY' &&
      c.effectModel.templateId === 'FLIP_DIE_OPPOSITE_ONCE_PER_TURN'
  );
}

export function getLoSponsorDiscount(player: PlayerState, enableEffects: boolean): number {
  if (!enableEffects) return 0;
  return player.played.reduce((acc, c) => {
    if (
      c.effectModel.timing === 'WHILE_IN_PLAY' &&
      c.effectModel.templateId === 'DISCOUNT_COST_AND_COMBO_TIER'
    ) {
      return acc + (c.effectModel.value || 1);
    }
    return acc;
  }, 0);
}

export function getEffectiveCardTokenCost(
  player: PlayerState,
  card: CardData,
  enableEffects: boolean,
  useNoComboAlternateCost = false
): number {
  const base =
    useNoComboAlternateCost && card.effectModel.templateId === 'NO_COMBO_ALTERNATE_COST'
      ? card.effectModel.value || 3
      : card.cost;
  const sponsorDiscount = getLoSponsorDiscount(player, enableEffects);
  const oneShotDiscount = enableEffects ? player.modifiers.nextCardDiscount || 0 : 0;
  return Math.max(0, base - sponsorDiscount - oneShotDiscount);
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
} {
  const blockCheck = isCardBlockedByTable(state, card);
  const sponsorOffset = -getLoSponsorDiscount(player, state.config.enableCardEffects);
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

  if (blockCheck.blocked) {
    return {
      canPlayStandard: false,
      canPlayNoComboAlt: false,
      standardCost,
      altCost,
      blockedByOwner: blockCheck.ownerName,
      requiredCombos: comboCheck.requiredCombos,
    };
  }

  if (player.modifiers.forbidPlayNextTurn) {
    return {
      canPlayStandard: false,
      canPlayNoComboAlt: false,
      standardCost,
      altCost,
      requiredCombos: comboCheck.requiredCombos,
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
    };
  }

  if (state.mainActionTaken) {
    return {
      canPlayStandard: false,
      canPlayNoComboAlt: false,
      standardCost,
      altCost,
      requiredCombos: comboCheck.requiredCombos,
    };
  }

  const canPlayStandard = player.tokens >= standardCost && comboCheck.satisfied;
  const canPlayNoComboAlt =
    state.config.enableCardEffects &&
    card.effectModel.templateId === 'NO_COMBO_ALTERNATE_COST' &&
    player.tokens >= altCost;

  return {
    canPlayStandard,
    canPlayNoComboAlt,
    standardCost,
    altCost,
    requiredCombos: comboCheck.requiredCombos,
  };
}

export function createInitialGameState(
  roomCode = 'LAMEN',
  customCatalog?: CardData[],
  customConfig?: Partial<GameConfig>
): GameState {
  const config: GameConfig = {
    ...DEFAULT_GAME_CONFIG,
    ...customConfig,
  };

  return {
    roomCode,
    phase: 'LOBBY',
    config,
    catalog: customCatalog ? [...customCatalog] : [...DEFAULT_CARDS],
    objectivesDeck: [...DEFAULT_OBJECTIVES],
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
function generateBoosterPack(catalog: CardData[], count: number, packSeed: number): CardData[] {
  const mainClasses = ['Dormienti', 'Utenti', 'Festaioli', 'Scrocconi'];
  const pickedTemplates: CardData[] = [];
  const usedBaseIds = new Set<string>();

  for (const cls of mainClasses) {
    if (pickedTemplates.length >= count) break;
    const pool = shuffleArray(catalog.filter((c) => c.cardClass === cls));
    if (pool.length > 0) {
      pickedTemplates.push(pool[0]);
      usedBaseIds.add(getCardIdentityKey(pool[0]));
    }
  }

  // Carte jolly rimanenti (preferibilmente Rara o PROMO se disponibili e non duplicate nella bustina)
  const remainingPool = shuffleArray(
    catalog.filter((c) => !usedBaseIds.has(getCardIdentityKey(c)))
  );
  const fullShuffled = shuffleArray(catalog);

  while (pickedTemplates.length < count) {
    const candidate =
      remainingPool.shift() || fullShuffled[pickedTemplates.length % fullShuffled.length];
    pickedTemplates.push(candidate);
  }

  return pickedTemplates.map((template, i) => ({
    ...template,
    baseCardId: template.baseCardId || template.id,
    id: `${template.baseCardId || template.id}-pk${packSeed}-${i}-${Math.random().toString(36).substring(2, 6)}`,
  }));
}

function getPassiveCashInBonus(player: PlayerState, enableEffects: boolean): number {
  if (!enableEffects) return 0;
  return player.played.reduce((acc, card) => {
    if (
      card.effectModel.timing === 'WHILE_IN_PLAY' &&
      card.effectModel.templateId === 'CASH_IN_BONUS'
    ) {
      return acc + (card.effectModel.value || 1);
    }
    return acc;
  }, 0);
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

function setupTurnForPlayer(state: GameState, playerIndex: number, depth = 0) {
  state.currentPlayerIndex = playerIndex;
  const activePlayer = state.players[playerIndex];

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

  // Effetti passivi "All'inizio di ogni tuo turno" ("Il Dormiente Supremo" e "Il Mantenuto")
  if (state.config.enableCardEffects) {
    for (const c of activePlayer.played) {
      if (c.effectModel.timing === 'WHILE_IN_PLAY') {
        if (c.effectModel.templateId === 'TURN_START_GAIN_TOKENS') {
          const gain = c.effectModel.value || 2;
          activePlayer.tokens += gain;
          addLog(
            state,
            activePlayer.id,
            activePlayer.name,
            'EFFECT',
            `Effetto "${c.name}": ${activePlayer.name} riceve +${gain} gettoni a inizio turno.`
          );
        } else if (c.effectModel.templateId === 'TURN_START_STEAL_FROM_RICHEST') {
          const opponents = state.players.filter((p) => p.id !== activePlayer.id && p.tokens > 0);
          if (opponents.length > 0) {
            opponents.sort((a, b) => b.tokens - a.tokens);
            const richest = opponents[0];
            const stealAmount = Math.min(richest.tokens, c.effectModel.value || 1);
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

  state.dice = Array.from({ length: diceCount }, () => rollSingleDie());
  state.keptDice = Array.from({ length: diceCount }, () => false);

  const maxRolls =
    activePlayer.modifiers.maxRollsOverrideNextTurn !== null
      ? activePlayer.modifiers.maxRollsOverrideNextTurn
      : state.config.maxRollsPerTurn;

  activePlayer.modifiers.maxRollsOverrideNextTurn = null;
  state.rollsLeft = Math.max(0, maxRolls - 1);
  state.turnStep = 'ROLLING';
  state.hasUsedMarketThisTurn = false;
  state.hasMadeTradeOfferThisTurn = false;
  state.mainActionTaken = false;
  state.pendingTradeOffer = null;
}

export function applyGameAction(prevState: GameState, action: GameAction): GameState {
  const state = cloneState(prevState);

  switch (action.type) {
    case 'UPDATE_CONFIG': {
      state.config = {
        ...state.config,
        ...action.config,
      };
      return state;
    }

    case 'UPDATE_CATALOG': {
      state.catalog = [...action.catalog];
      return state;
    }

    case 'ADD_PLAYER': {
      if (state.players.some((p) => p.id === action.id)) return state;
      if (state.players.length >= state.config.maxPlayers) return state;

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
        `${newPlayer.name} è entrato nella stanza.`
      );
      return state;
    }

    case 'REMOVE_PLAYER': {
      state.players = state.players.filter((p) => p.id !== action.playerId);
      return state;
    }

    case 'START_PACK_OPENING': {
      const minRequired = state.config.allow2PlayersTestMode ? 2 : state.config.minPlayers;
      if (state.players.length < minRequired) return state;

      state.phase = 'PACK_OPENING';
      state.market = [];
      state.pendingDraftTrades = [];

      state.players.forEach((player, pIdx) => {
        const packs: CardData[][] = [];
        for (let k = 0; k < state.config.packsPerPlayer; k++) {
          packs.push(
            generateBoosterPack(
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
        `Inizia il Draft! Ogni giocatore apre ${state.config.packsPerPlayer} bustine da ${state.config.cardsPerPack} carte (1 per classe + 1 jolly).`
      );
      return state;
    }

    case 'OPEN_NEXT_PACK': {
      const player = state.players.find((p) => p.id === action.playerId);
      if (!player || player.unopenedPacks.length === 0) return state;

      const nextPack = player.unopenedPacks.shift()!;
      player.pulledPool.push(...nextPack);
      addLog(
        state,
        player.id,
        player.name,
        'PACK_OPEN',
        `${player.name} ha aperto una bustina (${nextPack.length} carte)!`
      );
      return state;
    }

    case 'TOGGLE_DRAFT_SELECTION': {
      const player = state.players.find((p) => p.id === action.playerId);
      if (!player || player.draftReady) return state;

      const card = player.pulledPool.find((c) => c.id === action.cardId);
      if (!card) return state;

      if (action.role === 'STARTER') {
        if (player.selectedStarterIds.includes(card.id)) {
          player.selectedStarterIds = player.selectedStarterIds.filter((id) => id !== card.id);
          return state;
        }
        player.selectedReserveIds = player.selectedReserveIds.filter((id) => id !== card.id);

        if (player.selectedStarterIds.length >= state.config.teamSize) return state;

        // Regola GDD: Nella propria squadra non si possono avere due copie della stessa carta
        const cardKey = getCardIdentityKey(card);
        const alreadyHasSameCard = player.selectedStarterIds.some((id) => {
          const existing = player.pulledPool.find((c) => c.id === id);
          return existing && getCardIdentityKey(existing) === cardKey;
        });
        if (alreadyHasSameCard) return state;

        // Opzione configurabile: una sola versione per persona in squadra
        if (state.config.uniquePersonPerTeam) {
          const alreadyHasPerson = player.selectedStarterIds.some((id) => {
            const existing = player.pulledPool.find((c) => c.id === id);
            return existing && existing.personName.toLowerCase() === card.personName.toLowerCase();
          });
          if (alreadyHasPerson) return state;
        }

        player.selectedStarterIds.push(card.id);
      } else {
        if (player.selectedReserveIds.includes(card.id)) {
          player.selectedReserveIds = player.selectedReserveIds.filter((id) => id !== card.id);
          return state;
        }
        player.selectedStarterIds = player.selectedStarterIds.filter((id) => id !== card.id);
        if (player.selectedReserveIds.length >= state.config.reserveSize) return state;
        player.selectedReserveIds.push(card.id);
      }
      return state;
    }

    case 'AUTO_SELECT_DRAFT': {
      const player = state.players.find((p) => p.id === action.playerId);
      if (!player) return state;
      while (player.unopenedPacks.length > 0) {
        player.pulledPool.push(...player.unopenedPacks.shift()!);
      }
      autoPickDraftForPlayer(player, state.config);
      return state;
    }

    case 'PROPOSE_DRAFT_TRADE': {
      const fromP = state.players.find((p) => p.id === action.fromPlayerId);
      const toP = state.players.find((p) => p.id === action.toPlayerId);
      if (!fromP || !toP) return state;

      state.pendingDraftTrades.push({
        id: makeId('dtrade'),
        fromPlayerId: action.fromPlayerId,
        toPlayerId: action.toPlayerId,
        fromCardId: action.fromCardId,
        toCardId: action.toCardId,
      });
      return state;
    }

    case 'ACCEPT_DRAFT_TRADE': {
      const idx = state.pendingDraftTrades.findIndex((t) => t.id === action.tradeId);
      if (idx === -1) return state;
      const offer = state.pendingDraftTrades[idx];
      state.pendingDraftTrades.splice(idx, 1);

      const fromP = state.players.find((p) => p.id === offer.fromPlayerId);
      const toP = state.players.find((p) => p.id === offer.toPlayerId);
      if (!fromP || !toP) return state;

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
        `Scambio pre-partita: ${fromP.name} ha scambiato "${card1.name}" con "${card2.name}" di ${toP.name}!`
      );
      return state;
    }

    case 'REJECT_DRAFT_TRADE': {
      state.pendingDraftTrades = state.pendingDraftTrades.filter((t) => t.id !== action.tradeId);
      return state;
    }

    case 'CONFIRM_DRAFT_TEAM': {
      const player = state.players.find((p) => p.id === action.playerId);
      if (!player) return state;
      if (
        player.selectedStarterIds.length !== state.config.teamSize ||
        player.selectedReserveIds.length !== state.config.reserveSize
      ) {
        return state;
      }

      player.draftReady = true;
      addLog(
        state,
        player.id,
        player.name,
        'TEAM_READY',
        `${player.name} ha confermato i 4 titolari e le 2 riserve (le altre 4 carte tornano in collezione).`
      );

      if (state.players.every((p) => p.draftReady)) {
        state.market = [];
        const objDeck = shuffleArray(state.objectivesDeck);

        state.players.forEach((p, idx) => {
          p.hand = p.pulledPool.filter((c) => p.selectedStarterIds.includes(c.id));
          const reserves = p.pulledPool.filter((c) => p.selectedReserveIds.includes(c.id));
          state.market.push(...reserves);

          const c1 = objDeck[(idx * 2) % objDeck.length];
          const c2 = objDeck[(idx * 2 + 1) % objDeck.length];
          p.objectiveCandidates = [c1, c2];
          p.objective = p.isBot ? c1 : null;
        });

        state.phase = 'OBJECTIVE_PICK';
        addLog(
          state,
          'system',
          'Tavolo',
          'PHASE_OBJECTIVE',
          `Squadre confermate e ${state.market.length} riserve nel Mercato! Ognuno pesca 2 carte Obiettivo e ne tiene 1 coperta.`
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
      const player = state.players.find((p) => p.id === action.playerId);
      if (!player) return state;
      const chosen = player.objectiveCandidates.find((o) => o.id === action.objectiveId);
      if (!chosen) return state;

      player.objective = chosen;
      addLog(
        state,
        player.id,
        player.name,
        'OBJECTIVE_PICKED',
        state.config.objectiveVisibility === 'PUBLIC'
          ? `${player.name} ha scelto l'Obiettivo: "${chosen.title}".`
          : `${player.name} ha scelto il suo Obiettivo coperto.`
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
          `La partita ha inizio! È il turno di ${state.players[0].name}.`
        );
      }
      return state;
    }

    case 'TOGGLE_KEEP_DIE': {
      const activePlayer = state.players[state.currentPlayerIndex];
      if (!activePlayer || activePlayer.id !== action.playerId) return state;
      if (state.mainActionTaken) return state;
      if (action.dieIndex < 0 || action.dieIndex >= state.keptDice.length) return state;

      state.keptDice[action.dieIndex] = !state.keptDice[action.dieIndex];
      return state;
    }

    case 'ROLL_DICE': {
      const activePlayer = state.players[state.currentPlayerIndex];
      if (!activePlayer || activePlayer.id !== action.playerId) return state;
      if (state.rollsLeft <= 0 || state.mainActionTaken) return state;

      state.dice = state.dice.map((val, idx) =>
        state.keptDice[idx] ? val : rollSingleDie()
      );
      state.rollsLeft -= 1;

      addLog(
        state,
        activePlayer.id,
        activePlayer.name,
        'ROLL',
        `${activePlayer.name} ha ritirato i dadi: [${state.dice.join(', ')}] (${state.rollsLeft} tiri rimasti).`
      );
      return state;
    }

    case 'BUY_EXTRA_ROLL': {
      const activePlayer = state.players[state.currentPlayerIndex];
      if (!activePlayer || activePlayer.id !== action.playerId) return state;
      if (!state.config.paidExtraRollEnabled || state.mainActionTaken) return state;
      if (activePlayer.tokens < state.config.paidExtraRollCost) return state;

      activePlayer.tokens -= state.config.paidExtraRollCost;
      state.rollsLeft += 1;
      addLog(
        state,
        activePlayer.id,
        activePlayer.name,
        'EXTRA_ROLL',
        `${activePlayer.name} ha pagato ${state.config.paidExtraRollCost} gettone per un 4° tiro extra!`
      );
      return state;
    }

    case 'FLIP_DIE_OPPOSITE': {
      const activePlayer = state.players[state.currentPlayerIndex];
      if (!activePlayer || activePlayer.id !== action.playerId) return state;
      if (!hasLuckyDieInPlay(activePlayer, state.config.enableCardEffects)) return state;
      if (activePlayer.modifiers.usedLuckyDieFlipThisTurn) return state;
      if (action.dieIndex < 0 || action.dieIndex >= state.dice.length) return state;

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
        `Effetto "Il Dado Fortunato": ${activePlayer.name} gira il dado #${action.dieIndex + 1} sulla faccia opposta (${oldVal} ↔ ${newVal})!`
      );
      return state;
    }

    case 'CASH_IN_DICE': {
      const activePlayer = state.players[state.currentPlayerIndex];
      if (!activePlayer || activePlayer.id !== action.playerId) return state;
      if (state.mainActionTaken) return state;

      const passiveBonus = getPassiveCashInBonus(activePlayer, state.config.enableCardEffects);
      const gained = calculateCashInTokens(
        state.dice,
        passiveBonus,
        state.config.cashInHighFaces
      );
      activePlayer.tokens += gained;
      state.mainActionTaken = true;
      activePlayer.modifiers.forbidPlayNextTurn = false;
      state.turnStep = 'POST_ACTION';

      addLog(
        state,
        activePlayer.id,
        activePlayer.name,
        'CASH_IN',
        `${activePlayer.name} sceglie INCASSA coi dadi [${state.dice.join(', ')}] e prende +${gained} gettoni (totale: ${activePlayer.tokens}).`
      );

      // Effetto passivo "Il Parassita": quando il giocatore alla tua sinistra sceglie Incassa, prendi 1 gettone dalla scorta
      if (state.config.enableCardEffects && state.players.length >= 2) {
        const rightNeighborIndex =
          (state.currentPlayerIndex - 1 + state.players.length) % state.players.length;
        const rightNeighbor = state.players[rightNeighborIndex];
        // Per rightNeighbor, activePlayer è il giocatore alla sua sinistra!
        for (const c of rightNeighbor.played) {
          if (
            c.effectModel.timing === 'WHILE_IN_PLAY' &&
            c.effectModel.templateId === 'LEFT_NEIGHBOR_CASH_IN_BONUS'
          ) {
            const bonus = c.effectModel.value || 1;
            rightNeighbor.tokens += bonus;
            addLog(
              state,
              rightNeighbor.id,
              rightNeighbor.name,
              'EFFECT',
              `Effetto "${c.name}": ${rightNeighbor.name} prende +${bonus} gettone perché il vicino a sinistra (${activePlayer.name}) ha scelto Incassa!`
            );
          }
        }
      }

      return state;
    }

    case 'PLAY_CARD': {
      const activePlayer = state.players[state.currentPlayerIndex];
      if (!activePlayer || activePlayer.id !== action.playerId) return state;

      const cardIdx = activePlayer.hand.findIndex((c) => c.id === action.cardId);
      if (cardIdx === -1) return state;
      const card = activePlayer.hand[cardIdx];

      const playability = canPlayCardRightNow(state, activePlayer, card);
      const useAltNoCombo = Boolean(action.useNoComboAlternateCost && playability.canPlayNoComboAlt);

      if (!useAltNoCombo && !playability.canPlayStandard) {
        return state;
      }

      const costToPay = useAltNoCombo ? playability.altCost : playability.standardCost;
      activePlayer.tokens -= costToPay;
      activePlayer.modifiers.nextCardDiscount = 0;

      const usedAfterPartyFreeCombo = activePlayer.modifiers.canPlayExtraCardWithoutCombo;
      activePlayer.modifiers.canPlayExtraCardWithoutCombo = false;

      activePlayer.hand.splice(cardIdx, 1);
      activePlayer.played.push(card);
      state.mainActionTaken = true;
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
          : `${activePlayer.name} GIOCA "${card.name}" (${card.cardClass}, costo ${costToPay} gettoni, combinazione ${playability.requiredCombos.map((c) => COMBO_LABELS_IT[c]).join(' / ')}).`
      );

      // Effetto passivo "Anima della Festa" degli altri giocatori: quando un altro giocatore gioca una carta, prendi 1 gettone (max 2 per giro)
      if (state.config.enableCardEffects) {
        for (const other of state.players) {
          if (other.id === activePlayer.id) continue;
          for (const pc of other.played) {
            if (
              pc.effectModel.timing === 'WHILE_IN_PLAY' &&
              pc.effectModel.templateId === 'ON_OTHER_PLAY_GAIN_TOKEN'
            ) {
              const maxPerRound = pc.effectModel.secondaryValue || 2;
              if (other.modifiers.animaFestaTriggersThisRound < maxPerRound) {
                const gain = pc.effectModel.value || 1;
                other.tokens += gain;
                other.modifiers.animaFestaTriggersThisRound += 1;
                addLog(
                  state,
                  other.id,
                  other.name,
                  'EFFECT',
                  `Effetto "${pc.name}": ${other.name} guadagna +${gain} gettone (${other.modifiers.animaFestaTriggersThisRound}/${maxPerRound} in questo giro)!`
                );
              }
            }
          }
        }
      }

      // Applica l'effetto della carta giocata
      if (state.config.enableCardEffects) {
        applyCardEffectOnPlay(state, activePlayer, card, action);
      }

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
      return state;
    }

    case 'MARKET_SWAP': {
      const activePlayer = state.players[state.currentPlayerIndex];
      if (!activePlayer || activePlayer.id !== action.playerId) return state;

      const hasFreeSwap = activePlayer.modifiers.freeMarketSwapsCount > 0;
      if (!hasFreeSwap && state.hasUsedMarketThisTurn) return state;
      if (
        !hasFreeSwap &&
        state.config.marketSwapTiming === 'REPLACES_MAIN_ACTION' &&
        state.mainActionTaken
      ) {
        return state;
      }

      const swapCost = hasFreeSwap ? 0 : state.config.marketSwapCost;
      if (activePlayer.tokens < swapCost) return state;

      const handIdx = activePlayer.hand.findIndex((c) => c.id === action.handCardId);
      const marketIdx = state.market.findIndex((c) => c.id === action.marketCardId);
      if (handIdx === -1 || marketIdx === -1) return state;

      const handCard = activePlayer.hand[handIdx];
      const marketCard = state.market[marketIdx];

      // Regola GDD: Nella propria squadra non si possono avere due copie della stessa carta
      const otherTeamCards = [
        ...activePlayer.played,
        ...activePlayer.hand.filter((c) => c.id !== handCard.id),
      ];
      if (otherTeamCards.some((c) => getCardIdentityKey(c) === getCardIdentityKey(marketCard))) {
        return state;
      }

      if (state.config.uniquePersonPerTeam) {
        const duplicatePerson = otherTeamCards.some(
          (c) => c.personName.toLowerCase() === marketCard.personName.toLowerCase()
        );
        if (duplicatePerson) return state;
      }

      activePlayer.tokens -= swapCost;
      if (hasFreeSwap) {
        activePlayer.modifiers.freeMarketSwapsCount -= 1;
      } else {
        state.hasUsedMarketThisTurn = true;
      }

      activePlayer.hand[handIdx] = marketCard;
      state.market[marketIdx] = handCard;

      if (!hasFreeSwap && state.config.marketSwapTiming === 'REPLACES_MAIN_ACTION') {
        state.mainActionTaken = true;
        state.turnStep = 'POST_ACTION';
      }

      addLog(
        state,
        activePlayer.id,
        activePlayer.name,
        'MARKET_SWAP',
        `${activePlayer.name} scambia col Mercato: prende "${marketCard.name}" e lascia "${handCard.name}" (${swapCost === 0 ? 'GRATIS' : `-${swapCost} gettoni`}).`
      );
      return state;
    }

    case 'OFFER_PLAYER_TRADE': {
      const activePlayer = state.players[state.currentPlayerIndex];
      if (!activePlayer || activePlayer.id !== action.fromPlayerId) return state;
      if (state.hasMadeTradeOfferThisTurn) return state;

      // Regola GDD: Chi è a una carta dalla vittoria non può comprare
      if (activePlayer.played.length >= state.config.teamSize - 1) return state;
      if (activePlayer.tokens < action.offeredTokens || action.offeredTokens < 1) return state;

      const targetPlayer = state.players.find((p) => p.id === action.toPlayerId);
      if (!targetPlayer || targetPlayer.hand.length === 0) return state;

      // Se il bersaglio ha "Il Piumone" in gioco, nessuno può comprargli carte
      if (isPlayerProtectedByPiumone(targetPlayer, state.config.enableCardEffects)) {
        addLog(
          state,
          activePlayer.id,
          activePlayer.name,
          'PROTECTED',
          `${targetPlayer.name} è protetto da "Il Piumone": non è possibile comprargli carte!`
        );
        return state;
      }

      const ownCard = activePlayer.hand.find((c) => c.id === action.offeredSwapCardId);
      if (!ownCard) return state;

      state.hasMadeTradeOfferThisTurn = true;
      state.pendingTradeOffer = {
        id: makeId('offer'),
        fromPlayerId: activePlayer.id,
        toPlayerId: targetPlayer.id,
        offeredTokens: action.offeredTokens,
        offeredSwapCardId: action.offeredSwapCardId,
        targetCardId: action.targetCardId,
        status: 'PENDING',
      };

      addLog(
        state,
        activePlayer.id,
        activePlayer.name,
        'TRADE_OFFER',
        `${activePlayer.name} offre ${action.offeredTokens} gettoni (+ 1 carta in cambio) a ${targetPlayer.name} per comprare una carta non giocata.`
      );

      if (targetPlayer.isBot) {
        const shouldAccept = action.offeredTokens >= 2 && targetPlayer.hand.length > 0;
        return applyGameAction(state, {
          type: 'RESPOND_PLAYER_TRADE',
          accept: shouldAccept,
          chosenTargetCardId: targetPlayer.hand[0]?.id,
        });
      }

      return state;
    }

    case 'RESPOND_PLAYER_TRADE': {
      const offer = state.pendingTradeOffer;
      if (!offer || offer.status !== 'PENDING') return state;

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
          `${seller.name} ha rifiutato l'offerta di ${buyer.name}.`
        );
        return state;
      }

      const buyerCardIdx = buyer.hand.findIndex((c) => c.id === offer.offeredSwapCardId);
      const targetCardId = action.chosenTargetCardId || offer.targetCardId || seller.hand[0]?.id;
      const sellerCardIdx = seller.hand.findIndex((c) => c.id === targetCardId);

      if (buyerCardIdx === -1 || sellerCardIdx === -1 || buyer.tokens < offer.offeredTokens) {
        return state;
      }

      const [buyerCard] = buyer.hand.splice(buyerCardIdx, 1);
      const [sellerCard] = seller.hand.splice(sellerCardIdx, 1);

      buyer.tokens -= offer.offeredTokens;
      seller.tokens += offer.offeredTokens;

      buyer.hand.push(sellerCard);
      seller.hand.push(buyerCard);

      addLog(
        state,
        seller.id,
        seller.name,
        'TRADE_ACCEPTED',
        `Affare fatto! ${seller.name} accetta ${offer.offeredTokens} gettoni da ${buyer.name} e scambia una carta coperta.`
      );
      return state;
    }

    case 'RETURN_MISMATCHED_CARD_TO_HAND': {
      const player = state.players.find((p) => p.id === action.playerId);
      if (!player || state.config.onObjectiveMismatch !== 'ALLOW_RETURN_TO_HAND') return state;

      const idx = player.played.findIndex((c) => c.id === action.playedCardId);
      if (idx === -1) return state;

      const [card] = player.played.splice(idx, 1);
      player.hand.push(card);

      addLog(
        state,
        player.id,
        player.name,
        'RETURN_MISMATCH',
        `${player.name} ha ripreso in mano "${card.name}" perché incompatibile col proprio Obiettivo.`
      );
      return state;
    }

    case 'END_TURN': {
      const activePlayer = state.players[state.currentPlayerIndex];
      if (!activePlayer || activePlayer.id !== action.playerId) return state;

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

function autoPickDraftForPlayer(player: PlayerState, config: GameConfig) {
  player.selectedStarterIds = [];
  player.selectedReserveIds = [];
  const usedCardKeys = new Set<string>();
  const usedPersonNames = new Set<string>();

  for (const card of player.pulledPool) {
    const cKey = getCardIdentityKey(card);
    const pKey = card.personName.toLowerCase();

    if (player.selectedStarterIds.length < config.teamSize) {
      if (usedCardKeys.has(cKey)) continue;
      if (config.uniquePersonPerTeam && usedPersonNames.has(pKey)) continue;
      player.selectedStarterIds.push(card.id);
      usedCardKeys.add(cKey);
      usedPersonNames.add(pKey);
    } else if (player.selectedReserveIds.length < config.reserveSize) {
      player.selectedReserveIds.push(card.id);
    }
  }

  for (const card of player.pulledPool) {
    if (
      player.selectedStarterIds.length < config.teamSize &&
      !player.selectedStarterIds.includes(card.id) &&
      !player.selectedReserveIds.includes(card.id)
    ) {
      player.selectedStarterIds.push(card.id);
    } else if (
      player.selectedReserveIds.length < config.reserveSize &&
      !player.selectedStarterIds.includes(card.id) &&
      !player.selectedReserveIds.includes(card.id)
    ) {
      player.selectedReserveIds.push(card.id);
    }
  }
}

function applyCardEffectOnPlay(
  state: GameState,
  activePlayer: PlayerState,
  card: CardData,
  action: Extract<GameAction, { type: 'PLAY_CARD' }>
) {
  const model = card.effectModel;
  const val = model.value ?? 1;
  const secVal = model.secondaryValue ?? 1;
  const opponents = state.players.filter((p) => p.id !== activePlayer.id);
  const targetPlayer =
    state.players.find((p) => p.id === action.targetPlayerId) || opponents[0];

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

    case 'SET_TARGET_NEXT_ROLLS': {
      if (targetPlayer) {
        targetPlayer.modifiers.maxRollsOverrideNextTurn = val;
        addLog(
          state,
          activePlayer.id,
          activePlayer.name,
          'EFFECT',
          `Effetto "${card.name}": ${targetPlayer.name} tirerà i dadi solo ${val} volte nel suo prossimo turno!`
        );
      }
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

    case 'SKIP_TARGET_NEXT_TURN': {
      if (targetPlayer) {
        targetPlayer.modifiers.skipNextTurn = true;
        addLog(
          state,
          activePlayer.id,
          activePlayer.name,
          'EFFECT',
          `Effetto "${card.name}": ${targetPlayer.name} salterà il suo prossimo turno!`
        );
      }
      break;
    }

    case 'GAMBLE_DICE_SWAP': {
      const gambleRoll = rollSingleDie();
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
      } else if (
        gambleRoll === 6 &&
        targetPlayer &&
        activePlayer.hand.length > 0 &&
        targetPlayer.hand.length > 0
      ) {
        const ownCard = activePlayer.hand.shift()!;
        const oppCard = targetPlayer.hand.shift()!;
        activePlayer.hand.push(oppCard);
        targetPlayer.hand.push(ownCard);
        addLog(
          state,
          activePlayer.id,
          activePlayer.name,
          'EFFECT',
          `Effetto "${card.name}": dado = 6! ${activePlayer.name} scambia una carta non giocata con ${targetPlayer.name}!`
        );
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

    case 'LOSE_TARGET_TOKENS': {
      if (targetPlayer) {
        const lost = Math.min(targetPlayer.tokens, val);
        targetPlayer.tokens -= lost;
        addLog(
          state,
          activePlayer.id,
          activePlayer.name,
          'EFFECT',
          `Effetto "${card.name}": ${targetPlayer.name} perde ${lost} gettone/i nella scorta.`
        );
      }
      break;
    }

    case 'ROLL_2D6_JACKPOT_TOKENS': {
      const d1 = rollSingleDie();
      const d2 = rollSingleDie();
      const sum = d1 + d2;
      const reward = sum === 6 || sum === 7 ? val : secVal;
      activePlayer.tokens += reward;
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
        roll: rollSingleDie(),
      }));
      const minRoll = Math.min(...rolls.map((r) => r.roll));
      const losers = rolls.filter((r) => r.roll === minRoll);
      for (const l of losers) {
        const lost = Math.min(l.player.tokens, val);
        l.player.tokens -= lost;
      }
      const summary = rolls.map((r) => `${r.player.name}:${r.roll}`).join(', ');
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
      const playersWithHand = state.players.filter((p) => p.hand.length > 0);
      if (playersWithHand.length >= 2) {
        const passedCards = playersWithHand.map((p) => p.hand.shift()!);
        for (let i = 0; i < playersWithHand.length; i++) {
          const receiver = playersWithHand[(i + 1) % playersWithHand.length];
          receiver.hand.push(passedCards[i]);
        }
        addLog(
          state,
          activePlayer.id,
          activePlayer.name,
          'EFFECT',
          `Effetto "${card.name}": ogni giocatore ha passato una carta non giocata al giocatore alla sua sinistra!`
        );
      }
      break;
    }

    case 'FORBID_TARGET_PLAY_NEXT_TURN': {
      if (targetPlayer) {
        targetPlayer.modifiers.forbidPlayNextTurn = true;
        addLog(
          state,
          activePlayer.id,
          activePlayer.name,
          'EFFECT',
          `Effetto "${card.name}": nel suo prossimo turno ${targetPlayer.name} non potrà scegliere Gioca (solo Incassa)!`
        );
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
      const paidNames: string[] = [];
      const fourDiceNames: string[] = [];
      for (const opp of opponents) {
        if (opp.tokens >= val) {
          opp.tokens -= val;
          activePlayer.tokens += val;
          paidNames.push(opp.name);
        } else {
          opp.modifiers.diceCountOverrideNextTurn = 4;
          fourDiceNames.push(opp.name);
        }
      }
      addLog(
        state,
        activePlayer.id,
        activePlayer.name,
        'EFFECT',
        `Effetto "${card.name}": ${paidNames.length > 0 ? `${paidNames.join(', ')} dà 1 gettone` : ''} ${fourDiceNames.length > 0 ? `${fourDiceNames.join(', ')} tirerà 4 dadi` : ''}.`
      );
      break;
    }

    case 'ALL_FREE_MARKET_SWAP': {
      for (const p of state.players) {
        p.modifiers.freeMarketSwapsCount += 1;
      }
      addLog(
        state,
        activePlayer.id,
        activePlayer.name,
        'EFFECT',
        `Effetto "${card.name}": ogni giocatore ottiene 1 scambio GRATIS col Mercato!`
      );
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

    case 'STEAL_TOKENS': {
      if (targetPlayer) {
        const stolen = Math.min(targetPlayer.tokens, val);
        targetPlayer.tokens -= stolen;
        activePlayer.tokens += stolen;
        addLog(
          state,
          activePlayer.id,
          activePlayer.name,
          'EFFECT',
          `Effetto "${card.name}": ${activePlayer.name} ruba ${stolen} gettone/i a ${targetPlayer.name}!`
        );
      }
      break;
    }

    case 'BORROW_TOKENS_REPAY_NEXT_TURN': {
      if (targetPlayer) {
        const taken = Math.min(targetPlayer.tokens, val);
        targetPlayer.tokens -= taken;
        activePlayer.tokens += taken;
        if (taken > 0) {
          activePlayer.modifiers.repayDebtsNextTurn.push({
            toPlayerId: targetPlayer.id,
            amount: secVal,
          });
        }
        addLog(
          state,
          activePlayer.id,
          activePlayer.name,
          'EFFECT',
          `Effetto "${card.name}": ${activePlayer.name} prende ${taken} gettoni da ${targetPlayer.name} (ne restituirà ${secVal} al prossimo turno).`
        );
      }
      break;
    }

    case 'FREE_IMMEDIATE_MARKET_SWAP': {
      activePlayer.modifiers.freeMarketSwapsCount += 1;
      addLog(
        state,
        activePlayer.id,
        activePlayer.name,
        'EFFECT',
        `Effetto "${card.name}": ${activePlayer.name} può scambiare subito GRATIS una carta col Mercato!`
      );
      break;
    }

    case 'PEEK_OBJECTIVE_AND_STEAL': {
      if (targetPlayer) {
        const stolen = Math.min(targetPlayer.tokens, val);
        targetPlayer.tokens -= stolen;
        activePlayer.tokens += stolen;
        if (!activePlayer.modifiers.revealedObjectivePlayerIds.includes(targetPlayer.id)) {
          activePlayer.modifiers.revealedObjectivePlayerIds.push(targetPlayer.id);
        }
        addLog(
          state,
          activePlayer.id,
          activePlayer.name,
          'EFFECT',
          `Effetto "${card.name}": ${activePlayer.name} spia l'Obiettivo di ${targetPlayer.name} e gli ruba ${stolen} gettone!`
        );
      }
      break;
    }

    case 'RETURN_PLAYED_CARD': {
      if (targetPlayer) {
        if (isPlayerProtectedByPiumone(targetPlayer, state.config.enableCardEffects)) {
          addLog(
            state,
            activePlayer.id,
            activePlayer.name,
            'PROTECTED',
            `${targetPlayer.name} ha "Il Piumone" in gioco: le sue carte giocate sono protette dallo sfratto!`
          );
          break;
        }
        const eligible = targetPlayer.played.filter((c) => c.cost <= val);
        const cardToReturn =
          eligible.find((c) => c.id === action.targetPlayedCardId) || eligible[0];
        if (cardToReturn) {
          targetPlayer.played = targetPlayer.played.filter((c) => c.id !== cardToReturn.id);
          targetPlayer.hand.push(cardToReturn);
          addLog(
            state,
            activePlayer.id,
            activePlayer.name,
            'EFFECT',
            `Effetto "${card.name}": "${cardToReturn.name}" di ${targetPlayer.name} torna in mano (ed eventuali copie bloccate si sbloccano)!`
          );
        }
      }
      break;
    }

    default:
      break;
  }
}
