import { canDiceSatisfyCardCost } from './dice';
import { applyGameAction, createInitialGameState } from './gameEngine';
import { CardData, GameConfig, GameState } from './types';

/**
 * Esegue una singola mossa logica per il Bot attualmente di turno.
 */
export function executeBotTurnStep(state: GameState): GameState {
  if (state.phase !== 'PLAYING') return state;
  const activePlayer = state.players[state.currentPlayerIndex];
  if (!activePlayer || !activePlayer.isBot) return state;

  // Controlla se esiste almeno una carta giocabile in mano con i gettoni e dadi attuali
  const playableCards = activePlayer.hand.filter((card) => {
    const cost = Math.max(0, card.cost - (activePlayer.modifiers.nextCardDiscount || 0));
    if (activePlayer.tokens < cost) return false;
    const check = canDiceSatisfyCardCost(
      state.dice,
      card.cost,
      state.config,
      activePlayer.modifiers.comboTierOffsetFromBoss
    );
    return check.satisfied;
  });

  // 1. Se può giocare subito una carta (preferendo quella di costo più alto), la gioca!
  if (!state.mainActionTaken && playableCards.length > 0) {
    playableCards.sort((a, b) => b.cost - a.cost);
    const chosenCard = playableCards[0];
    const opponents = state.players.filter((p) => p.id !== activePlayer.id);
    // Bersaglia chi ha più carte in gioco
    opponents.sort((a, b) => b.played.length - a.played.length);
    const targetPlayer = opponents[0];

    let nextState = applyGameAction(state, {
      type: 'PLAY_CARD',
      playerId: activePlayer.id,
      cardId: chosenCard.id,
      targetPlayerId: targetPlayer?.id,
    });
    if (nextState.phase === 'PLAYING') {
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

/**
 * Simulatore Headless (Punto 2 del GDD):
 * Gioca N partite complete tra Bot per misurare durata media e win-rate delle carte.
 */
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
    let state = createInitialGameState(`SIM-${g}`, catalog, {
      ...config,
      // Durante la simulazione rapida usiamo un obiettivo semplice di completamento squadra o obiettivo pescato
    });

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

    // Se tutti i bot sono pronti in draft, passa a OBJECTIVE_PICK / PLAYING
    for (const p of state.players) {
      state = applyGameAction(state, { type: 'CONFIRM_DRAFT_TEAM', playerId: p.id });
    }

    let safetySteps = 0;
    const maxSteps = 450;
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
  // Stima ~0.45 minuti per giro completo al tavolo reale
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
