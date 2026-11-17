import {
  applyGameAction,
  canPlayCardRightNow,
  createInitialGameState,
  isCardBlockedByTable,
} from './gameEngine';
import { CardData, GameConfig, GameState } from './types';

/**
 * Esegue una singola mossa logica per il Bot attualmente di turno.
 */
export function executeBotTurnStep(state: GameState): GameState {
  if (state.phase !== 'PLAYING') return state;
  const activePlayer = state.players[state.currentPlayerIndex];
  if (!activePlayer || !activePlayer.isBot) return state;

  // Se il Bot ha una carta bloccata in mano (perché un altro giocatore l'ha già giocata) e può scambiarla col Mercato, la cambia!
  const blockedInHand = activePlayer.hand.find((c) => isCardBlockedByTable(state, c).blocked);
  const canSwapMarket =
    (activePlayer.modifiers.freeMarketSwapsCount > 0 ||
      (!state.hasUsedMarketThisTurn && activePlayer.tokens >= state.config.marketSwapCost)) &&
    state.market.length > 0;

  if (blockedInHand && canSwapMarket) {
    const unblockedMarketCard = state.market.find(
      (mc) => !isCardBlockedByTable(state, mc).blocked
    );
    if (unblockedMarketCard) {
      return applyGameAction(state, {
        type: 'MARKET_SWAP',
        playerId: activePlayer.id,
        handCardId: blockedInHand.id,
        marketCardId: unblockedMarketCard.id,
      });
    }
  }

  // Controlla se esiste almeno una carta giocabile in mano
  const playableEntries = activePlayer.hand
    .map((card) => ({
      card,
      check: canPlayCardRightNow(state, activePlayer, card),
    }))
    .filter((entry) => entry.check.canPlayStandard || entry.check.canPlayNoComboAlt);

  // 1. Se può giocare subito una carta (preferendo quella di costo più alto), la gioca!
  if (playableEntries.length > 0) {
    playableEntries.sort((a, b) => b.card.cost - a.card.cost);
    const chosen = playableEntries[0];
    const opponents = state.players.filter((p) => p.id !== activePlayer.id);
    opponents.sort((a, b) => b.played.length - a.played.length);
    const targetPlayer = opponents[0];

    let nextState = applyGameAction(state, {
      type: 'PLAY_CARD',
      playerId: activePlayer.id,
      cardId: chosen.card.id,
      targetPlayerId: targetPlayer?.id,
      useNoComboAlternateCost: !chosen.check.canPlayStandard && chosen.check.canPlayNoComboAlt,
    });

    // Se ha attivo After Party (2ª carta giocabile subito senza combinazione), lascia che il prossimo step giochi la 2ª carta
    const updatedActive = nextState.players[nextState.currentPlayerIndex];
    if (
      nextState.phase === 'PLAYING' &&
      (!updatedActive || !updatedActive.modifiers.canPlayExtraCardWithoutCombo)
    ) {
      nextState = applyGameAction(nextState, {
        type: 'END_TURN',
        playerId: activePlayer.id,
      });
    }
    return nextState;
  }

  // 2. Se ha ancora tiri di dadi disponibili, tiene i dadi ripetuti o alti (5-6) e ritira
  if (!state.mainActionTaken && state.rollsLeft > 0) {
    let working = state;
    const freq: Record<number, number> = {};
    for (const d of working.dice) {
      freq[d] = (freq[d] || 0) + 1;
    }

    working.dice.forEach((d, idx) => {
      const shouldKeep = freq[d] >= 2 || d >= 5;
      if (working.keptDice[idx] !== shouldKeep) {
        working = applyGameAction(working, {
          type: 'TOGGLE_KEEP_DIE',
          playerId: activePlayer.id,
          dieIndex: idx,
        });
      }
    });

    return applyGameAction(working, {
      type: 'ROLL_DICE',
      playerId: activePlayer.id,
    });
  }

  // 3. Se i tiri sono finiti e non può giocare una carta, sceglie INCASSA e chiude il turno
  if (!state.mainActionTaken) {
    let nextState = applyGameAction(state, {
      type: 'CASH_IN_DICE',
      playerId: activePlayer.id,
    });
    nextState = applyGameAction(nextState, {
      type: 'END_TURN',
      playerId: activePlayer.id,
    });
    return nextState;
  }

  return applyGameAction(state, {
    type: 'END_TURN',
    playerId: activePlayer.id,
  });
}

export interface SimulationCardStat {
  cardName: string;
  cardClass: string;
  cost: number;
  timesPlayed: number;
  winsWhenInPlayedTeam: number;
  winRatePercent: number;
}

export interface SimulationReport {
  gamesSimulated: number;
  playerCount: number;
  averageRounds: number;
  estimatedMinutesPerGame: number;
  cardStats: SimulationCardStat[];
}

export function runMonteCarloSimulation(
  catalog: CardData[],
  config: GameConfig,
  numGames = 100,
  playerCount = 4
): SimulationReport {
  let totalRounds = 0;
  const playedCountByName: Record<string, number> = {};
  const winCountByName: Record<string, number> = {};
  const metaByName: Record<string, { cardClass: string; cost: number }> = {};

  for (const c of catalog) {
    playedCountByName[c.name] = 0;
    winCountByName[c.name] = 0;
    metaByName[c.name] = { cardClass: c.cardClass, cost: c.cost };
  }

  for (let g = 0; g < numGames; g++) {
    let state = createInitialGameState(`SIM-${g}`, catalog, config);

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

    let safetySteps = 0;
    const maxSteps = 500;
    while (state.phase === 'PLAYING' && safetySteps < maxSteps) {
      state = executeBotTurnStep(state);
      safetySteps++;
    }

    totalRounds += state.turnNumber;

    for (const p of state.players) {
      const isWinner = state.winnerPlayerId === p.id;
      for (const c of p.played) {
        playedCountByName[c.name] = (playedCountByName[c.name] || 0) + 1;
        if (isWinner) {
          winCountByName[c.name] = (winCountByName[c.name] || 0) + 1;
        }
      }
    }
  }

  const avgRounds = Number((totalRounds / Math.max(1, numGames)).toFixed(1));
  const estimatedMinutesPerGame = Number((avgRounds * 0.45 * (playerCount / 4)).toFixed(1));

  const cardStats: SimulationCardStat[] = Object.keys(metaByName).map((name) => {
    const played = playedCountByName[name] || 0;
    const wins = winCountByName[name] || 0;
    return {
      cardName: name,
      cardClass: metaByName[name].cardClass,
      cost: metaByName[name].cost,
      timesPlayed: played,
      winsWhenInPlayedTeam: wins,
      winRatePercent: played > 0 ? Math.round((wins / played) * 100) : 0,
    };
  });

  cardStats.sort((a, b) => b.winRatePercent - a.winRatePercent);

  return {
    gamesSimulated: numGames,
    playerCount,
    averageRounds: avgRounds,
    estimatedMinutesPerGame,
    cardStats,
  };
}
