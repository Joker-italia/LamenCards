import { DEFAULT_CARDS, DEFAULT_GAME_CONFIG, DEFAULT_OBJECTIVES } from '../data/defaultData';
import {
  calculateCashInTokens,
  canDiceSatisfyCardCost,
  COMBO_LABELS_IT,
  rollSingleDie,
} from './dice';
import { evaluateObjective } from './objectives';
import {
  CardData,
  GameAction,
  GameConfig,
  GameState,
  MoveLogEntry,
  ObjectiveCard,
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
    globalFourDiceUntilPlayerId: null,
    pendingTradeOffer: null,
    pendingDraftTrades: [],
    winnerPlayerId: null,
    actionLog: [],
  };
}

function generateBoosterPack(catalog: CardData[], count: number, packIndex: number): CardData[] {
  const shuffled = shuffleArray(catalog);
  const pack: CardData[] = [];
  for (let i = 0; i < count; i++) {
    const template = shuffled[i % shuffled.length];
    pack.push({
      ...template,
      id: `${template.id}-p${packIndex}-${i}-${Math.random().toString(36).substring(2, 6)}`,
    });
  }
  return pack;
}

function getEffectiveCardTokenCost(player: PlayerState, card: CardData): number {
  const discount = player.modifiers.nextCardDiscount || 0;
  return Math.max(0, card.cost - discount);
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

function recalculateOngoingBossModifiers(state: GameState) {
  for (const p of state.players) {
    if (p.modifiers.bossSourceCardId) {
      const stillInPlay = state.players.some((owner) =>
        owner.played.some((c) => c.id === p.modifiers.bossSourceCardId)
      );
      if (!stillInPlay) {
        p.modifiers.comboTierOffsetFromBoss = 0;
        p.modifiers.bossSourceCardId = undefined;
      }
    }
  }
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

function setupTurnForPlayer(state: GameState, playerIndex: number) {
  state.currentPlayerIndex = playerIndex;
  const activePlayer = state.players[playerIndex];

  // Se il giro di "Quello sul divano" (4 dadi per tutti fino al tuo prossimo turno) è tornato al proprietario, scade
  if (state.globalFourDiceUntilPlayerId === activePlayer.id) {
    state.globalFourDiceUntilPlayerId = null;
    addLog(
      state,
      activePlayer.id,
      activePlayer.name,
      'EFFECT_EXPIRED',
      'L’effetto globale dei 4 dadi è terminato: si torna a 5 dadi!'
    );
  }

  const diceCount = state.globalFourDiceUntilPlayerId ? 4 : 5;
  state.dice = Array.from({ length: diceCount }, () => rollSingleDie());
  state.keptDice = Array.from({ length: diceCount }, () => false);

  const maxRolls =
    activePlayer.modifiers.maxRollsOverrideNextTurn !== null
      ? activePlayer.modifiers.maxRollsOverrideNextTurn
      : state.config.maxRollsPerTurn;

  activePlayer.modifiers.maxRollsOverrideNextTurn = null;
  // Il primo lancio avviene all'inizio del turno o cliccando Tira: lasciamo maxRolls - 1 ritiri dopo il primo tiro automatico
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
        modifiers: {
          nextCardDiscount: 0,
          hasJokerDieNextRoll: false,
          maxRollsOverrideNextTurn: null,
          comboTierOffsetFromBoss: 0,
        },
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

        // Se è un Bot, apre subito le bustine e sceglie squadra + riserve
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
        `Inizia lo spacchettamento! Ogni giocatore ha ${state.config.packsPerPlayer} bustine da ${state.config.cardsPerPack} carte.`
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
        // Rimuovi eventuale selezione come riserva
        player.selectedReserveIds = player.selectedReserveIds.filter((id) => id !== card.id);

        if (player.selectedStarterIds.length >= state.config.teamSize) return state;

        // Controllo regola unicità persona in squadra
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
        `${player.name} ha confermato i 4 titolari e le 2 riserve.`
      );

      // Se tutti i giocatori hanno confermato la squadra, popoliamo mano + Mercato e passiamo alla pesca dei 2 Obiettivi
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
          `Squadre pronte e ${state.market.length} riserve nel Mercato! Ogni giocatore pesca 2 carte Obiettivo e ne sceglie 1.`
        );

        // Se per caso sono tutti bot, avvia subito la partita
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
          : `${player.name} ha scelto il suo Obiettivo segreto.`
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
        `${activePlayer.name} ha pagato ${state.config.paidExtraRollCost} gettone per un tiro extra!`
      );
      return state;
    }

    case 'SET_JOKER_DIE_VALUE': {
      const activePlayer = state.players[state.currentPlayerIndex];
      if (!activePlayer || activePlayer.id !== action.playerId) return state;
      if (!activePlayer.modifiers.hasJokerDieNextRoll) return state;
      if (action.value < 1 || action.value > 6) return state;
      if (action.dieIndex < 0 || action.dieIndex >= state.dice.length) return state;

      state.dice[action.dieIndex] = action.value;
      state.keptDice[action.dieIndex] = true;
      activePlayer.modifiers.hasJokerDieNextRoll = false;
      addLog(
        state,
        activePlayer.id,
        activePlayer.name,
        'JOKER_DIE',
        `${activePlayer.name} ha usato il Dado Jolly impostando il dado #${action.dieIndex + 1} sul valore ${action.value}!`
      );
      return state;
    }

    case 'CASH_IN_DICE': {
      const activePlayer = state.players[state.currentPlayerIndex];
      if (!activePlayer || activePlayer.id !== action.playerId) return state;
      if (state.mainActionTaken) return state;

      const passiveBonus = getPassiveCashInBonus(activePlayer, state.config.enableCardEffects);
      const gained = calculateCashInTokens(state.dice, passiveBonus);
      activePlayer.tokens += gained;
      state.mainActionTaken = true;
      state.turnStep = 'POST_ACTION';

      addLog(
        state,
        activePlayer.id,
        activePlayer.name,
        'CASH_IN',
        `${activePlayer.name} sceglie INCASSA coi dadi [${state.dice.join(', ')}] e guadagna +${gained} gettoni (totale: ${activePlayer.tokens}).`
      );
      return state;
    }

    case 'PLAY_CARD': {
      const activePlayer = state.players[state.currentPlayerIndex];
      if (!activePlayer || activePlayer.id !== action.playerId) return state;
      if (state.mainActionTaken) return state;

      const cardIdx = activePlayer.hand.findIndex((c) => c.id === action.cardId);
      if (cardIdx === -1) return state;
      const card = activePlayer.hand[cardIdx];

      const effectiveCost = getEffectiveCardTokenCost(activePlayer, card);
      if (activePlayer.tokens < effectiveCost) return state;

      const comboCheck = canDiceSatisfyCardCost(
        state.dice,
        card.cost,
        state.config,
        activePlayer.modifiers.comboTierOffsetFromBoss
      );
      if (!comboCheck.satisfied) return state;

      // Paga i gettoni e metti la carta scoperta in gioco
      activePlayer.tokens -= effectiveCost;
      activePlayer.modifiers.nextCardDiscount = 0;
      activePlayer.hand.splice(cardIdx, 1);
      activePlayer.played.push(card);
      state.mainActionTaken = true;
      state.turnStep = 'POST_ACTION';

      addLog(
        state,
        activePlayer.id,
        activePlayer.name,
        'PLAY_CARD',
        `${activePlayer.name} GIOCA "${card.name}" (${card.cardClass}, costo ${effectiveCost} gettoni, combinazione ${comboCheck.requiredCombos.map((c) => COMBO_LABELS_IT[c]).join(' / ')}).`
      );

      // Applica il modello dell'effetto se attivo
      if (state.config.enableCardEffects) {
        applyCardEffectOnPlay(state, activePlayer, card, action);
      }

      recalculateOngoingBossModifiers(state);

      // Verifica se il giocatore ha vinto (4 carte in gioco + Obiettivo rispettato)
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
      if (state.hasUsedMarketThisTurn) return state;
      if (
        state.config.marketSwapTiming === 'REPLACES_MAIN_ACTION' &&
        state.mainActionTaken
      ) {
        return state;
      }
      if (activePlayer.tokens < state.config.marketSwapCost) return state;

      const handIdx = activePlayer.hand.findIndex((c) => c.id === action.handCardId);
      const marketIdx = state.market.findIndex((c) => c.id === action.marketCardId);
      if (handIdx === -1 || marketIdx === -1) return state;

      const handCard = activePlayer.hand[handIdx];
      const marketCard = state.market[marketIdx];

      // Verifica regola unicità persona in squadra (tra mano + giocate)
      if (state.config.uniquePersonPerTeam) {
        const otherTeamCards = [
          ...activePlayer.played,
          ...activePlayer.hand.filter((c) => c.id !== handCard.id),
        ];
        const duplicatePerson = otherTeamCards.some(
          (c) => c.personName.toLowerCase() === marketCard.personName.toLowerCase()
        );
        if (duplicatePerson) return state;
      }

      activePlayer.tokens -= state.config.marketSwapCost;
      activePlayer.hand[handIdx] = marketCard;
      state.market[marketIdx] = handCard;
      state.hasUsedMarketThisTurn = true;

      if (state.config.marketSwapTiming === 'REPLACES_MAIN_ACTION') {
        state.mainActionTaken = true;
        state.turnStep = 'POST_ACTION';
      }

      addLog(
        state,
        activePlayer.id,
        activePlayer.name,
        'MARKET_SWAP',
        `${activePlayer.name} ha scambiato una carta col Mercato prendendo "${marketCard.name}" e lasciando "${handCard.name}" (-${state.config.marketSwapCost} gettoni).`
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

      // Se il destinatario è un Bot, valuta e risponde subito
      if (targetPlayer.isBot) {
        const shouldAccept = action.offeredTokens >= 2 && targetPlayer.hand.length > 0;
        if (shouldAccept) {
          return applyGameAction(state, {
            type: 'RESPOND_PLAYER_TRADE',
            accept: true,
            chosenTargetCardId: targetPlayer.hand[0].id,
          });
        } else {
          return applyGameAction(state, {
            type: 'RESPOND_PLAYER_TRADE',
            accept: false,
          });
        }
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
      recalculateOngoingBossModifiers(state);

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
      state.globalFourDiceUntilPlayerId = null;
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
      });
      return state;
    }

    default:
      return state;
  }
}

function autoPickDraftForPlayer(player: PlayerState, config: GameConfig) {
  player.selectedStarterIds = [];
  player.selectedReserveIds = [];
  const usedNames = new Set<string>();

  for (const card of player.pulledPool) {
    if (player.selectedStarterIds.length < config.teamSize) {
      if (config.uniquePersonPerTeam && usedNames.has(card.personName.toLowerCase())) {
        continue;
      }
      player.selectedStarterIds.push(card.id);
      usedNames.add(card.personName.toLowerCase());
    } else if (player.selectedReserveIds.length < config.reserveSize) {
      player.selectedReserveIds.push(card.id);
    }
  }

  // Fallback se ci fossero troppi doppioni dello stesso personaggio
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
        `Effetto "${card.name}": ${activePlayer.name} guadagna +${val} gettoni.`
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
          `Effetto "${card.name}": ${activePlayer.name} ruba ${stolen} gettoni a ${targetPlayer.name}!`
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
      } else if (gambleRoll === 6 && targetPlayer && activePlayer.hand.length > 0 && targetPlayer.hand.length > 0) {
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
          `Effetto "${card.name}": dado = ${gambleRoll} (nessuna penalità e nessuno scambio).`
        );
      }
      break;
    }

    case 'REDUCE_ALL_DICE': {
      state.globalFourDiceUntilPlayerId = activePlayer.id;
      addLog(
        state,
        activePlayer.id,
        activePlayer.name,
        'EFFECT',
        `Effetto "${card.name}": fino al prossimo turno di ${activePlayer.name}, tutti tirano con 4 dadi invece di 5!`
      );
      break;
    }

    case 'REDUCE_TARGET_ROLLS': {
      if (targetPlayer) {
        targetPlayer.modifiers.maxRollsOverrideNextTurn = val;
        addLog(
          state,
          activePlayer.id,
          activePlayer.name,
          'EFFECT',
          `Effetto "${card.name}": ${targetPlayer.name} potrà tirare i dadi solo ${val} volte nel suo prossimo turno!`
        );
      }
      break;
    }

    case 'GRANT_JOKER_DIE': {
      activePlayer.modifiers.hasJokerDieNextRoll = true;
      addLog(
        state,
        activePlayer.id,
        activePlayer.name,
        'EFFECT',
        `Effetto "${card.name}": ${activePlayer.name} ottiene 1 Dado Jolly per il suo prossimo tiro!`
      );
      break;
    }

    case 'ALL_REDRAW_OBJECTIVE': {
      const shuffledObjs = shuffleArray(state.objectivesDeck);
      state.players.forEach((p, idx) => {
        const newObj: ObjectiveCard =
          shuffledObjs.find((o) => o.id !== p.objective?.id) ||
          shuffledObjs[idx % shuffledObjs.length];
        if (newObj && p.objective) {
          p.objectiveCandidates = [p.objective, newObj];
        }
      });
      addLog(
        state,
        activePlayer.id,
        activePlayer.name,
        'EFFECT',
        `Effetto "${card.name}": ogni giocatore ha pescato un nuovo Obiettivo e può scegliere se cambiarlo!`
      );
      break;
    }

    case 'NEXT_CARD_DISCOUNT': {
      activePlayer.modifiers.nextCardDiscount += val;
      addLog(
        state,
        activePlayer.id,
        activePlayer.name,
        'EFFECT',
        `Effetto "${card.name}": la prossima carta di ${activePlayer.name} costerà ${val} gettoni in meno!`
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

    case 'RETURN_PLAYED_CARD': {
      if (targetPlayer) {
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
            `Effetto "${card.name}": "${cardToReturn.name}" di ${targetPlayer.name} è stata rimandata in mano!`
          );
        }
      }
      break;
    }

    case 'SHIFT_TARGET_COMBO_TIER': {
      if (targetPlayer) {
        targetPlayer.modifiers.comboTierOffsetFromBoss = val;
        targetPlayer.modifiers.bossSourceCardId = card.id;
        addLog(
          state,
          activePlayer.id,
          activePlayer.name,
          'EFFECT',
          `Effetto "${card.name}": finché è in gioco, le carte di ${targetPlayer.name} richiedono la combinazione del costo superiore!`
        );
      }
      break;
    }

    default:
      break;
  }
}
