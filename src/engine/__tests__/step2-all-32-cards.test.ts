import { describe, expect, it } from 'vitest';
import { DEFAULT_CARDS, DEFAULT_GAME_CONFIG, DEFAULT_OBJECTIVES } from '../../data/defaultData';
import {
  applyGameAction,
  canPlayCardRightNow,
  createInitialGameState,
  getActiveModifiers,
  getPendingChoiceFor,
  isCardBlockedByTable,
} from '../index';
import { CardData, GameState } from '../types';

function getCard(idOrNumber: string | number): CardData {
  const found =
    typeof idOrNumber === 'number'
      ? DEFAULT_CARDS.find((c) => c.setNumber === idOrNumber)
      : DEFAULT_CARDS.find((c) => c.id === idOrNumber);
  if (!found) throw new Error(`Card ${idOrNumber} not found`);
  return JSON.parse(JSON.stringify(found));
}

/**
 * Crea uno stato di test in fase PLAYING con 3 giocatori (`p1`, `p2`, `p3`),
 * `p1` di turno con 20 gettoni e dadi configurabili (di default Poker `[6,6,6,6,6]` che soddisfa qualsiasi combinazione tranne Scala di 4).
 */
function createPlayingTestState(
  seed = 101,
  dice: number[] = [6, 6, 6, 6, 6]
): GameState {
  let state = createInitialGameState('TEST-32', DEFAULT_CARDS, DEFAULT_GAME_CONFIG, seed);
  state = applyGameAction(state, { type: 'ADD_PLAYER', id: 'p1', name: 'Alice', isHost: true });
  state = applyGameAction(state, { type: 'ADD_PLAYER', id: 'p2', name: 'Bob' });
  state = applyGameAction(state, { type: 'ADD_PLAYER', id: 'p3', name: 'Charlie' });

  state.phase = 'PLAYING';
  state.currentPlayerIndex = 0;
  state.turnStep = 'ACTION_DECISION';
  state.dice = [...dice];
  state.keptDice = dice.map(() => false);
  state.rollsLeft = 0;

  state.players.forEach((p, idx) => {
    p.tokens = 10;
    p.objective = DEFAULT_OBJECTIVES[0];
    p.hand = [
      getCard((idx * 4 + 1) % 32 || 1),
      getCard((idx * 4 + 2) % 32 || 2),
      getCard((idx * 4 + 3) % 32 || 3),
    ];
    p.played = [];
  });

  state.market = [getCard(29), getCard(30)];
  return state;
}

describe('Step 2 — Test Puntuali delle 32 Carte tramite Modelli Parametrizzati', () => {
  // ==================== CLASSE 1: DORMIENTI (1-8) ====================

  it('#1 Il Pisolino (Costo 2, GAIN_TOKENS): prende +1 gettone quando entra', () => {
    let state = createPlayingTestState(1, [2, 2, 3, 4, 5]);
    const card = getCard(1);
    state.players[0].hand = [card];
    state.players[0].tokens = 5;

    state = applyGameAction(state, { type: 'PLAY_CARD', playerId: 'p1', cardId: card.id });
    // Paga 2, prende +1 => 4 gettoni
    expect(state.players[0].tokens).toBe(4);
    expect(state.players[0].played).toHaveLength(1);
  });

  it('#2 Russa Forte (Costo 2, SET_TARGET_NEXT_ROLLS): il bersaglio scelto tira solo 2 volte nel prossimo turno (via pendingChoice)', () => {
    let state = createPlayingTestState(2, [2, 2, 1, 3, 5]);
    const card = getCard(2);
    state.players[0].hand = [card];

    // Giocata senza targetPlayerId => apre pendingChoice CHOOSE_TARGET_PLAYER
    state = applyGameAction(state, { type: 'PLAY_CARD', playerId: 'p1', cardId: card.id });
    const choice = getPendingChoiceFor(state, 'p1');
    expect(choice).not.toBeNull();
    expect(choice?.type).toBe('CHOOSE_TARGET_PLAYER');

    state = applyGameAction(state, {
      type: 'RESOLVE_PENDING_CHOICE',
      playerId: 'p1',
      targetPlayerId: 'p2',
    });
    expect(state.players[1].modifiers.maxRollsOverrideNextTurn).toBe(2);

    // Passa il turno a p2: dopo il 1° tiro automatico avrà solo 1 ritiro rimasto (totale 2 tiri)
    state = applyGameAction(state, { type: 'END_TURN', playerId: 'p1' });
    expect(state.currentPlayerIndex).toBe(1);
    expect(state.rollsLeft).toBe(1);
  });

  it('#3 Sveglia alle 7 (Costo 3, GAIN_TOKENS_AND_NEXT_ROLLS): prende +1 gettone e tira 4 volte nel prossimo turno', () => {
    let state = createPlayingTestState(3, [2, 2, 5, 5, 1]);
    const card = getCard(3);
    state.players[0].hand = [card];
    state.players[0].tokens = 5;

    state = applyGameAction(state, { type: 'PLAY_CARD', playerId: 'p1', cardId: card.id });
    expect(state.players[0].tokens).toBe(3); // 5 - 3 + 1
    expect(state.players[0].modifiers.maxRollsOverrideNextTurn).toBe(4);

    // Giro completo fino a tornare a p1
    state = applyGameAction(state, { type: 'END_TURN', playerId: 'p1' });
    state = applyGameAction(state, { type: 'CASH_IN_DICE', playerId: 'p2' });
    state = applyGameAction(state, { type: 'END_TURN', playerId: 'p2' });
    state = applyGameAction(state, { type: 'CASH_IN_DICE', playerId: 'p3' });
    state = applyGameAction(state, { type: 'END_TURN', playerId: 'p3' });

    expect(state.currentPlayerIndex).toBe(0);
    expect(state.rollsLeft).toBe(3); // 1° tiro fatto + 3 ritiri = 4 tiri totali
  });

  it('#4 Il Piumone (Costo 3, PROTECT_FROM_BUY_AND_BOUNCE): protegge da acquisti e da Lo Sfratto finché è in gioco', () => {
    let state = createPlayingTestState(4, [3, 3, 4, 4, 1]);
    const piumone = getCard(4);
    state.players[1].played = [piumone];

    expect(getActiveModifiers(state.players[1]).protectedFromBuyAndBounce).toBe(true);

    // p1 prova a fare un'offerta di acquisto a p2 -> rifiutata da validateAction
    const beforeOffer = JSON.parse(JSON.stringify(state));
    state = applyGameAction(state, {
      type: 'OFFER_PLAYER_TRADE',
      fromPlayerId: 'p1',
      toPlayerId: 'p2',
      offeredTokens: 3,
      offeredSwapCardId: state.players[0].hand[0].id,
    });
    expect(state.pendingTradeOffer).toBeNull();
    expect(state).toEqual(beforeOffer);

    // p1 gioca Lo Sfratto contro p2 -> p2 non perde Il Piumone
    const sfratto = getCard(31);
    state.players[0].hand = [sfratto];
    state.dice = [3, 3, 3, 2, 2]; // Full
    state = applyGameAction(state, {
      type: 'PLAY_CARD',
      playerId: 'p1',
      cardId: sfratto.id,
      targetPlayerId: 'p2',
    });
    expect(state.players[1].played).toHaveLength(1);
    expect(state.players[1].played[0].id).toBe(piumone.id);
  });

  it('#5 Coma sul Divano (Costo 4, CASH_IN_BONUS): dà +1 gettone extra quando scegli Incassa', () => {
    let state = createPlayingTestState(5, [1, 2, 3, 4, 5]);
    const card = getCard(5);
    state.players[0].played = [card];
    state.players[0].tokens = 2;
    state.dice = [5, 6, 1, 2, 2]; // Base 1 + due 5/6 (2) + bonus Coma (1) = 4

    state = applyGameAction(state, { type: 'CASH_IN_DICE', playerId: 'p1' });
    expect(state.players[0].tokens).toBe(6);
  });

  it('#6 Sonno Contagioso (Costo 4, OTHERS_FOUR_DICE_ONE_ROUND): tutti gli altri tirano con 4 dadi fino al tuo prossimo turno', () => {
    let state = createPlayingTestState(6, [1, 2, 3, 4, 6]);
    const card = getCard(6);
    state.players[0].hand = [card];

    state = applyGameAction(state, { type: 'PLAY_CARD', playerId: 'p1', cardId: card.id });
    expect(state.othersFourDiceUntilPlayerId).toBe('p1');

    // Turno di p2 -> 4 dadi
    state = applyGameAction(state, { type: 'END_TURN', playerId: 'p1' });
    expect(state.dice).toHaveLength(4);
    state = applyGameAction(state, { type: 'CASH_IN_DICE', playerId: 'p2' });

    // Turno di p3 -> 4 dadi
    state = applyGameAction(state, { type: 'END_TURN', playerId: 'p2' });
    expect(state.dice).toHaveLength(4);
    state = applyGameAction(state, { type: 'CASH_IN_DICE', playerId: 'p3' });

    // Torna a p1 -> effetto scade e p1 tira 5 dadi
    state = applyGameAction(state, { type: 'END_TURN', playerId: 'p3' });
    expect(state.othersFourDiceUntilPlayerId).toBeNull();
    expect(state.dice).toHaveLength(5);
  });

  it('#7 Il Letargo (Costo 5, SKIP_TARGET_NEXT_TURN): il giocatore scelto salta il prossimo turno', () => {
    let state = createPlayingTestState(7, [4, 4, 4, 2, 2]);
    const card = getCard(7);
    state.players[0].hand = [card];

    state = applyGameAction(state, {
      type: 'PLAY_CARD',
      playerId: 'p1',
      cardId: card.id,
      targetPlayerId: 'p2',
    });
    expect(state.players[1].modifiers.skipNextTurn).toBe(true);

    // Quando p1 chiude il turno, p2 viene saltato e tocca direttamente a p3 (indice 2)!
    state = applyGameAction(state, { type: 'END_TURN', playerId: 'p1' });
    expect(state.currentPlayerIndex).toBe(2);
    expect(state.players[1].modifiers.skipNextTurn).toBe(false);
  });

  it('#8 Il Dormiente Supremo (Costo 6, TURN_START_GAIN_TOKENS): prende +2 gettoni a inizio di ogni proprio turno', () => {
    let state = createPlayingTestState(8, [6, 6, 6, 6, 1]);
    const card = getCard(8);
    state.players[1].played = [card];
    state.players[1].tokens = 3;

    state = applyGameAction(state, { type: 'CASH_IN_DICE', playerId: 'p1' });
    state = applyGameAction(state, { type: 'END_TURN', playerId: 'p1' });

    expect(state.currentPlayerIndex).toBe(1);
    expect(state.players[1].tokens).toBe(5); // 3 + 2 a inizio turno
  });

  // ==================== CLASSE 2: UTENTI (9-16) ====================

  it('#9 Giorgio, abile giocatore di carte (Costo 2, GAMBLE_DICE_SWAP): testa esiti 1-2 (perde 2 gettoni) e 6 (scambia carta via pendingChoice)', () => {
    // Cerchiamo un seed che tiri 1 o 2 e un seed che tiri 6
    let seedLow = 1;
    while (seedLow < 200) {
      let s = createPlayingTestState(seedLow, [2, 2, 3, 4, 5]);
      const card = getCard(9);
      s.players[0].hand = [card, getCard(1)];
      s.players[0].tokens = 6;
      s = applyGameAction(s, { type: 'PLAY_CARD', playerId: 'p1', cardId: card.id });
      const roll = s.lastEffectDiceRolls?.[0]?.rolls[0]?.dice[0];
      if (roll && roll <= 2) {
        expect(s.players[0].tokens).toBe(2); // 6 - 2(costo) - 2(malus) = 2
        break;
      }
      seedLow++;
    }

    let seedSix = 1;
    while (seedSix < 500) {
      let s = createPlayingTestState(seedSix, [2, 2, 3, 4, 5]);
      const card = getCard(9);
      const myExtraCard = getCard(1);
      const oppCard = getCard(25);
      s.players[0].hand = [card, myExtraCard];
      s.players[1].hand = [oppCard];
      s = applyGameAction(s, { type: 'PLAY_CARD', playerId: 'p1', cardId: card.id });
      const roll = s.lastEffectDiceRolls?.[0]?.rolls[0]?.dice[0];
      if (roll === 6) {
        expect(s.pendingChoice?.type).toBe('GIORGIO_SWAP_CHOICE');
        s = applyGameAction(s, {
          type: 'RESOLVE_PENDING_CHOICE',
          playerId: 'p1',
          cardId: myExtraCard.id,
          targetPlayerId: 'p2',
        });
        expect(s.players[0].hand.some((c) => c.id === oppCard.id)).toBe(true);
        expect(s.players[1].hand.some((c) => c.id === myExtraCard.id)).toBe(true);
        break;
      }
      seedSix++;
    }
  });

  it('#10 Dove ho messo le chiavi? (Costo 2, LOSE_TARGET_TOKENS): avversario perde 1 gettone nella scorta (non rubato)', () => {
    let state = createPlayingTestState(10, [2, 2, 3, 4, 5]);
    const card = getCard(10);
    state.players[0].hand = [card];
    state.players[0].tokens = 5;
    state.players[1].tokens = 4;

    state = applyGameAction(state, {
      type: 'PLAY_CARD',
      playerId: 'p1',
      cardId: card.id,
      targetPlayerId: 'p2',
    });
    expect(state.players[0].tokens).toBe(3); // 5 - 2 (non guadagna il gettone perso da p2!)
    expect(state.players[1].tokens).toBe(3); // 4 - 1
  });

  it('#11 Mariong, re delle Aura Battle (Costo 3, ROLL_2D6_JACKPOT_TOKENS): +4 gettoni con somma 6 o 7, altrimenti +1', () => {
    let foundJackpot = false;
    let foundOther = false;
    for (let seed = 1; seed < 200 && (!foundJackpot || !foundOther); seed++) {
      let state = createPlayingTestState(seed, [2, 2, 5, 5, 1]);
      const card = getCard(11);
      state.players[0].hand = [card];
      state.players[0].tokens = 5;
      state = applyGameAction(state, { type: 'PLAY_CARD', playerId: 'p1', cardId: card.id });
      const rolled = state.lastEffectDiceRolls?.[0]?.rolls[0]?.dice || [];
      const sum = rolled[0] + rolled[1];
      if (sum === 6 || sum === 7) {
        expect(state.players[0].tokens).toBe(6); // 5 - 3 + 4 = 6
        foundJackpot = true;
      } else {
        expect(state.players[0].tokens).toBe(3); // 5 - 3 + 1 = 3
        foundOther = true;
      }
    }
    expect(foundJackpot).toBe(true);
    expect(foundOther).toBe(true);
  });

  it('#12 Effetto Ritardo (Costo 3, ALL_ROLL_LOWEST_LOSES_TOKENS): tutti tirano 1 dado, il minimo (e i pareggi) perde 2 gettoni', () => {
    let state = createPlayingTestState(12, [2, 2, 5, 5, 1]);
    const card = getCard(12);
    state.players[0].hand = [card];
    state.players.forEach((p) => (p.tokens = 6));

    state = applyGameAction(state, { type: 'PLAY_CARD', playerId: 'p1', cardId: card.id });
    const effectRoll = state.lastEffectDiceRolls?.[0];
    expect(effectRoll).toBeDefined();
    expect(effectRoll?.rolls).toHaveLength(3);

    const minVal = Math.min(...effectRoll!.rolls.map((r) => r.dice[0]));
    for (const r of effectRoll!.rolls) {
      const p = state.players.find((pl) => pl.id === r.playerId)!;
      const expectedStart = r.playerId === 'p1' ? 3 : 6; // p1 ha pagato 3
      if (r.dice[0] === minVal) {
        expect(p.tokens).toBe(expectedStart - 2);
      } else {
        expect(p.tokens).toBe(expectedStart);
      }
    }
  });

  it('#13 Il Dado Fortunato (Costo 4, FLIP_DIE_OPPOSITE_ONCE_PER_TURN): permette di girare un dado sulla faccia opposta 1 volta per turno', () => {
    let state = createPlayingTestState(13, [1, 3, 4, 5, 2]);
    const card = getCard(13);
    state.players[0].played = [card];
    state.turnStep = 'ROLLING';

    // Gira il dado 0 (1 -> 6)
    state = applyGameAction(state, {
      type: 'FLIP_DIE_OPPOSITE',
      playerId: 'p1',
      dieIndex: 0,
    });
    expect(state.dice[0]).toBe(6);
    expect(state.players[0].modifiers.usedLuckyDieFlipThisTurn).toBe(true);

    // Un secondo tentativo nello stesso turno viene rifiutato
    state = applyGameAction(state, {
      type: 'FLIP_DIE_OPPOSITE',
      playerId: 'p1',
      dieIndex: 1,
    });
    expect(state.dice[1]).toBe(3);
  });

  it('#14 Sfattonata Collettiva (Costo 4, PASS_UNPLAYED_LEFT): ogni giocatore sceglie una carta da passare al giocatore alla sua sinistra', () => {
    let state = createPlayingTestState(14, [1, 2, 3, 4, 6]);
    const card = getCard(14);
    const c1 = getCard(1);
    const c2 = getCard(5);
    const c3 = getCard(17);

    state.players[0].hand = [card, c1];
    state.players[1].hand = [c2];
    state.players[2].hand = [c3];

    state = applyGameAction(state, { type: 'PLAY_CARD', playerId: 'p1', cardId: card.id });

    // Scelta sequenziale: p1 -> p2 -> p3
    expect(state.pendingChoice?.type).toBe('PASS_CARD_LEFT');
    expect(state.pendingChoice?.playerId).toBe('p1');
    state = applyGameAction(state, {
      type: 'RESOLVE_PENDING_CHOICE',
      playerId: 'p1',
      cardId: c1.id,
    });

    expect(state.pendingChoice?.playerId).toBe('p2');
    state = applyGameAction(state, {
      type: 'RESOLVE_PENDING_CHOICE',
      playerId: 'p2',
      cardId: c2.id,
    });

    expect(state.pendingChoice?.playerId).toBe('p3');
    state = applyGameAction(state, {
      type: 'RESOLVE_PENDING_CHOICE',
      playerId: 'p3',
      cardId: c3.id,
    });

    expect(state.pendingChoice).toBeNull();
    // p1 ha passato c1 a p2; p2 ha passato c2 a p3; p3 ha passato c3 a p1
    expect(state.players[1].hand.map((c) => c.id)).toContain(c1.id);
    expect(state.players[2].hand.map((c) => c.id)).toContain(c2.id);
    expect(state.players[0].hand.map((c) => c.id)).toContain(c3.id);
  });

  it('#15 La Chiamata Persa (Costo 5, FORBID_TARGET_PLAY_NEXT_TURN): il bersaglio non può scegliere Gioca nel suo prossimo turno', () => {
    let state = createPlayingTestState(15, [3, 3, 3, 2, 2]);
    const card = getCard(15);
    state.players[0].hand = [card];

    state = applyGameAction(state, {
      type: 'PLAY_CARD',
      playerId: 'p1',
      cardId: card.id,
      targetPlayerId: 'p2',
    });
    expect(state.players[1].modifiers.forbidPlayNextTurn).toBe(true);

    state = applyGameAction(state, { type: 'END_TURN', playerId: 'p1' });
    state.dice = [6, 6, 6, 6, 6];
    const p2Card = state.players[1].hand[0];
    expect(canPlayCardRightNow(state, state.players[1], p2Card).canPlayStandard).toBe(false);

    // p2 può però fare Incassa e al turno dopo il blocco sparisce
    state = applyGameAction(state, { type: 'CASH_IN_DICE', playerId: 'p2' });
    expect(state.players[1].modifiers.forbidPlayNextTurn).toBe(false);
  });

  it('#16 Il Trip (Costo 6, INVERT_COMBO_TABLE_ONE_ROUND): scambia le combinazioni dei costi 2<->6 e 3<->5 fino al tuo prossimo turno', () => {
    let state = createPlayingTestState(16, [5, 5, 5, 5, 1]);
    const trip = getCard(16);
    state.players[0].hand = [trip];

    state = applyGameAction(state, { type: 'PLAY_CARD', playerId: 'p1', cardId: trip.id });
    expect(state.invertComboTableUntilPlayerId).toBe('p1');

    // Passa a p2: con una semplice coppia [2,2,1,3,4], una carta di costo 2 NON basta (chiede Poker!), mentre una di costo 6 sì!
    state = applyGameAction(state, { type: 'END_TURN', playerId: 'p1' });
    state.dice = [2, 2, 1, 3, 4]; // Solo Una coppia
    const cost2Card = getCard(1);
    const cost6Card = getCard(8);
    state.players[1].hand = [cost2Card, cost6Card];
    state.players[1].tokens = 10;

    expect(canPlayCardRightNow(state, state.players[1], cost2Card).canPlayStandard).toBe(false);
    expect(canPlayCardRightNow(state, state.players[1], cost6Card).canPlayStandard).toBe(true);
  });

  // ==================== CLASSE 3: FESTAIOLI (17-24) ====================

  it('#17 Offro Io (Costo 2, ALL_GAIN_TOKENS_SELF_MORE): tu prendi +2 gettoni e tutti gli altri +1', () => {
    let state = createPlayingTestState(17, [2, 2, 3, 4, 5]);
    const card = getCard(17);
    state.players[0].hand = [card];
    state.players[0].tokens = 5;
    state.players[1].tokens = 3;
    state.players[2].tokens = 3;

    state = applyGameAction(state, { type: 'PLAY_CARD', playerId: 'p1', cardId: card.id });
    expect(state.players[0].tokens).toBe(5); // 5 - 2 + 2
    expect(state.players[1].tokens).toBe(4); // 3 + 1
    expect(state.players[2].tokens).toBe(4); // 3 + 1
  });

  it('#18 Il Ritardatario (Costo 2, NO_COMBO_ALTERNATE_COST): giocabile senza combinazione di dadi pagando 3 gettoni', () => {
    let state = createPlayingTestState(18, [1, 2, 4, 5, 6]); // Nessuna coppia né scala di 4!
    const card = getCard(18);
    state.players[0].hand = [card];
    state.players[0].tokens = 5;

    const check = canPlayCardRightNow(state, state.players[0], card);
    expect(check.canPlayStandard).toBe(false);
    expect(check.canPlayNoComboAlt).toBe(true);
    expect(check.altCost).toBe(3);

    state = applyGameAction(state, {
      type: 'PLAY_CARD',
      playerId: 'p1',
      cardId: card.id,
      useNoComboAlternateCost: true,
    });
    expect(state.players[0].tokens).toBe(2); // 5 - 3
    expect(state.players[0].played).toHaveLength(1);
  });

  it('#19 Il PR (Costo 3, GAIN_TOKENS_AND_FREE_MARKET): prende +1 gettone e il prossimo scambio col Mercato è gratis', () => {
    let state = createPlayingTestState(19, [2, 2, 5, 5, 1]);
    const card = getCard(19);
    const extraHandCard = getCard(1);
    state.players[0].hand = [card, extraHandCard];
    state.players[0].tokens = 5;

    state = applyGameAction(state, { type: 'PLAY_CARD', playerId: 'p1', cardId: card.id });
    expect(state.players[0].tokens).toBe(3); // 5 - 3 + 1
    expect(state.players[0].modifiers.freeMarketSwapsCount).toBe(1);

    const marketCard = state.market[0];
    state = applyGameAction(state, {
      type: 'MARKET_SWAP',
      playerId: 'p1',
      handCardId: extraHandCard.id,
      marketCardId: marketCard.id,
    });
    expect(state.players[0].tokens).toBe(3); // Pagato 0!
    expect(state.players[0].modifiers.freeMarketSwapsCount).toBe(0);
  });

  it('#20 Giro di Shot (Costo 3, OTHERS_PAY_TOKEN_OR_4_DICE): ogni altro giocatore sceglie se dare 1 gettone o tirare con 4 dadi', () => {
    let state = createPlayingTestState(20, [2, 2, 5, 5, 1]);
    const card = getCard(20);
    state.players[0].hand = [card];
    state.players[0].tokens = 5;
    state.players[1].tokens = 4;
    state.players[2].tokens = 4;

    state = applyGameAction(state, { type: 'PLAY_CARD', playerId: 'p1', cardId: card.id });

    // p2 sceglie di pagare 1 gettone
    expect(state.pendingChoice?.type).toBe('PAY_TOKEN_OR_FOUR_DICE');
    expect(state.pendingChoice?.playerId).toBe('p2');
    state = applyGameAction(state, {
      type: 'RESOLVE_PENDING_CHOICE',
      playerId: 'p2',
      decision: 'PAY_TOKEN',
    });

    // p3 sceglie di tirare con 4 dadi nel prossimo turno
    expect(state.pendingChoice?.playerId).toBe('p3');
    state = applyGameAction(state, {
      type: 'RESOLVE_PENDING_CHOICE',
      playerId: 'p3',
      decision: 'FOUR_DICE',
    });

    expect(state.pendingChoice).toBeNull();
    expect(state.players[0].tokens).toBe(3); // 5 - 3 + 1 (da p2)
    expect(state.players[1].tokens).toBe(3);
    expect(state.players[2].modifiers.diceCountOverrideNextTurn).toBe(4);
  });

  it('#21 Anima della Festa (Costo 4, ON_OTHER_PLAY_GAIN_TOKEN): +1 gettone quando altri giocano una carta, max 2 per giro', () => {
    let state = createPlayingTestState(21, [6, 6, 6, 6, 6]);
    const anima = getCard(21);
    state.players[0].played = [anima];
    state.players[0].tokens = 2;

    // Passa a p2: p2 gioca una carta (1ª attivazione per p1) e con After Party ne gioca una seconda (2ª attivazione)
    state = applyGameAction(state, { type: 'CASH_IN_DICE', playerId: 'p1' });
    const p1TokensAfterCashIn = state.players[0].tokens;
    state = applyGameAction(state, { type: 'END_TURN', playerId: 'p1' });

    state.dice = [3, 3, 3, 2, 2]; // Full
    const afterParty = getCard(23);
    const pisolino = getCard(1);
    state.players[1].hand = [afterParty, pisolino];
    state.players[1].tokens = 10;

    state = applyGameAction(state, {
      type: 'PLAY_CARD',
      playerId: 'p2',
      cardId: afterParty.id,
    });
    expect(state.players[0].tokens).toBe(p1TokensAfterCashIn + 1);

    state = applyGameAction(state, {
      type: 'PLAY_CARD',
      playerId: 'p2',
      cardId: pisolino.id,
    });
    expect(state.players[0].tokens).toBe(p1TokensAfterCashIn + 2);

    // Passa a p3: p3 gioca una carta -> p1 ha già raggiunto il massimo di 2 per giro!
    state = applyGameAction(state, { type: 'END_TURN', playerId: 'p2' });
    state.dice = [2, 2, 1, 3, 4];
    const russa = getCard(2);
    state.players[2].hand = [russa];
    state = applyGameAction(state, {
      type: 'PLAY_CARD',
      playerId: 'p3',
      cardId: russa.id,
      targetPlayerId: 'p2',
    });
    expect(state.players[0].tokens).toBe(p1TokensAfterCashIn + 2);
  });

  it('#22 Il DJ (Costo 4, ALL_FREE_MARKET_SWAP): a partire da te, ogni giocatore può scambiare gratis una carta col Mercato', () => {
    let state = createPlayingTestState(22, [1, 2, 3, 4, 6]);
    const dj = getCard(22);
    const c1 = getCard(1);
    state.players[0].hand = [dj, c1];
    const m0 = state.market[0];

    state = applyGameAction(state, { type: 'PLAY_CARD', playerId: 'p1', cardId: dj.id });
    expect(state.pendingChoice?.type).toBe('FREE_MARKET_SWAP');
    expect(state.pendingChoice?.playerId).toBe('p1');

    // p1 scambia gratis c1 con m0
    state = applyGameAction(state, {
      type: 'RESOLVE_PENDING_CHOICE',
      playerId: 'p1',
      cardId: c1.id,
      marketCardId: m0.id,
    });
    expect(state.players[0].hand.some((c) => c.id === m0.id)).toBe(true);

    // p2 e p3 scelgono SKIP
    expect(state.pendingChoice?.playerId).toBe('p2');
    state = applyGameAction(state, {
      type: 'RESOLVE_PENDING_CHOICE',
      playerId: 'p2',
      decision: 'SKIP',
    });
    expect(state.pendingChoice?.playerId).toBe('p3');
    state = applyGameAction(state, {
      type: 'RESOLVE_PENDING_CHOICE',
      playerId: 'p3',
      decision: 'SKIP',
    });
    expect(state.pendingChoice).toBeNull();
  });

  it('#23 After Party (Costo 5, PLAY_EXTRA_CARD_NO_COMBO): permette di giocare subito una seconda carta pagando solo i gettoni senza dadi', () => {
    let state = createPlayingTestState(23, [3, 3, 3, 2, 2]); // Full (non è Poker!)
    const afterParty = getCard(23);
    const dormienteSupremo = getCard(8); // Costo 6 (normalmente chiederebbe Poker)
    state.players[0].hand = [afterParty, dormienteSupremo];
    state.players[0].tokens = 15;

    state = applyGameAction(state, {
      type: 'PLAY_CARD',
      playerId: 'p1',
      cardId: afterParty.id,
    });
    expect(state.players[0].modifiers.canPlayExtraCardWithoutCombo).toBe(true);
    expect(
      canPlayCardRightNow(state, state.players[0], dormienteSupremo).canPlayStandard
    ).toBe(true);

    state = applyGameAction(state, {
      type: 'PLAY_CARD',
      playerId: 'p1',
      cardId: dormienteSupremo.id,
    });
    expect(state.players[0].played).toHaveLength(2);
    expect(state.players[0].modifiers.canPlayExtraCardWithoutCombo).toBe(false);
    expect(state.players[0].tokens).toBe(4); // 15 - 5 - 6 = 4
  });

  it('#24 Lo Sponsor (Costo 6, DISCOUNT_COST_AND_COMBO_TIER): le carte costano 1 gettone in meno e chiedono la combinazione del costo inferiore', () => {
    let state = createPlayingTestState(24, [1, 2, 3, 4, 4]); // Scala di 4 (livello 4)
    const sponsor = getCard(24);
    const letargo = getCard(7); // Costo 5 -> con Lo Sponsor costa 4 e chiede Scala di 4 invece di Full!
    state.players[0].played = [sponsor];
    state.players[0].hand = [letargo];
    state.players[0].tokens = 4;

    const check = canPlayCardRightNow(state, state.players[0], letargo);
    expect(check.canPlayStandard).toBe(true);
    expect(check.standardCost).toBe(4);
    expect(check.effectiveTier).toBe(4);

    state = applyGameAction(state, {
      type: 'PLAY_CARD',
      playerId: 'p1',
      cardId: letargo.id,
      targetPlayerId: 'p2',
    });
    expect(state.players[0].tokens).toBe(0);
    expect(state.players[0].played).toHaveLength(2);
  });

  // ==================== CLASSE 4: SCROCCONI (25-32) ====================

  it('#25 Lo Scroccone (Costo 2, STEAL_TOKENS): ruba 1 gettone a un giocatore', () => {
    let state = createPlayingTestState(25, [2, 2, 3, 4, 5]);
    const card = getCard(25);
    state.players[0].hand = [card];
    state.players[0].tokens = 5;
    state.players[1].tokens = 4;

    state = applyGameAction(state, {
      type: 'PLAY_CARD',
      playerId: 'p1',
      cardId: card.id,
      targetPlayerId: 'p2',
    });
    expect(state.players[0].tokens).toBe(4); // 5 - 2 + 1
    expect(state.players[1].tokens).toBe(3); // 4 - 1
  });

  it('#26 Mi Presti 2 Euro? (Costo 2, BORROW_TOKENS_REPAY_NEXT_TURN): prende 2 gettoni da un giocatore e gliene restituisce 1 al prossimo turno', () => {
    let state = createPlayingTestState(26, [2, 2, 3, 4, 5]);
    const card = getCard(26);
    state.players[0].hand = [card];
    state.players[0].tokens = 4;
    state.players[1].tokens = 5;

    state = applyGameAction(state, {
      type: 'PLAY_CARD',
      playerId: 'p1',
      cardId: card.id,
      targetPlayerId: 'p2',
    });
    expect(state.players[0].tokens).toBe(4); // 4 - 2 + 2
    expect(state.players[1].tokens).toBe(3); // 5 - 2

    // Giro completo fino al prossimo turno di p1
    state = applyGameAction(state, { type: 'END_TURN', playerId: 'p1' });
    state = applyGameAction(state, { type: 'CASH_IN_DICE', playerId: 'p2' });
    const p2BeforeRepay = state.players[1].tokens;
    state = applyGameAction(state, { type: 'END_TURN', playerId: 'p2' });
    state = applyGameAction(state, { type: 'CASH_IN_DICE', playerId: 'p3' });
    state = applyGameAction(state, { type: 'END_TURN', playerId: 'p3' });

    expect(state.currentPlayerIndex).toBe(0);
    expect(state.players[0].tokens).toBe(3); // 4 - 1 restituito
    expect(state.players[1].tokens).toBe(p2BeforeRepay + 1);
  });

  it('#27 Il Ladro di Patatine (Costo 3, STEAL_TOKENS): ruba 2 gettoni a un giocatore', () => {
    let state = createPlayingTestState(27, [2, 2, 5, 5, 1]);
    const card = getCard(27);
    state.players[0].hand = [card];
    state.players[0].tokens = 5;
    state.players[2].tokens = 4;

    state = applyGameAction(state, {
      type: 'PLAY_CARD',
      playerId: 'p1',
      cardId: card.id,
      targetPlayerId: 'p3',
    });
    expect(state.players[0].tokens).toBe(4); // 5 - 3 + 2
    expect(state.players[2].tokens).toBe(2); // 4 - 2
  });

  it("#28 L'Imbucato (Costo 3, FREE_IMMEDIATE_MARKET_SWAP): scambia subito gratis una carta non giocata con una del Mercato", () => {
    let state = createPlayingTestState(28, [2, 2, 5, 5, 1]);
    const imbucato = getCard(28);
    const otherHand = getCard(1);
    state.players[0].hand = [imbucato, otherHand];
    const marketTarget = state.market[0];

    state = applyGameAction(state, {
      type: 'PLAY_CARD',
      playerId: 'p1',
      cardId: imbucato.id,
    });
    expect(state.pendingChoice?.type).toBe('FREE_MARKET_SWAP');

    state = applyGameAction(state, {
      type: 'RESOLVE_PENDING_CHOICE',
      playerId: 'p1',
      cardId: otherHand.id,
      marketCardId: marketTarget.id,
    });
    expect(state.pendingChoice).toBeNull();
    expect(state.players[0].hand.some((c) => c.id === marketTarget.id)).toBe(true);
    expect(state.market.some((c) => c.id === otherHand.id)).toBe(true);
  });

  it('#29 Il Parassita (Costo 4, LEFT_NEIGHBOR_CASH_IN_BONUS): quando il giocatore alla tua sinistra sceglie Incassa, prendi +1 gettone dalla scorta', () => {
    let state = createPlayingTestState(29, [1, 2, 3, 4, 5]);
    const parassita = getCard(29);
    // p1 (indice 0) ha Il Parassita in gioco; il giocatore alla sua sinistra è p2 (indice 1)
    state.players[0].played = [parassita];
    state = applyGameAction(state, { type: 'CASH_IN_DICE', playerId: 'p1' });
    const p1Tokens = state.players[0].tokens;
    state = applyGameAction(state, { type: 'END_TURN', playerId: 'p1' });

    // Ora tocca a p2 (alla sinistra di p1): p2 sceglie Incassa -> p1 guadagna +1 gettone dalla scorta!
    state = applyGameAction(state, { type: 'CASH_IN_DICE', playerId: 'p2' });
    expect(state.players[0].tokens).toBe(p1Tokens + 1);
  });

  it("#30 Il Ficcanaso (Costo 4, PEEK_OBJECTIVE_AND_STEAL): guarda l'Obiettivo di un giocatore e gli ruba 1 gettone", () => {
    let state = createPlayingTestState(30, [1, 2, 3, 4, 6]);
    const ficcanaso = getCard(30);
    state.players[0].hand = [ficcanaso];
    state.players[0].tokens = 5;
    state.players[1].tokens = 4;

    state = applyGameAction(state, {
      type: 'PLAY_CARD',
      playerId: 'p1',
      cardId: ficcanaso.id,
      targetPlayerId: 'p2',
    });
    expect(state.players[0].tokens).toBe(2); // 5 - 4 + 1
    expect(state.players[1].tokens).toBe(3);
    expect(state.players[0].modifiers.revealedObjectivePlayerIds).toContain('p2');
  });

  it('#31 Lo Sfratto (Costo 5, RETURN_PLAYED_CARD): rimanda in mano una carta giocata di costo <= 4 e sblocca i doppioni per gli altri', () => {
    let state = createPlayingTestState(31, [3, 3, 3, 2, 2]);
    const sfratto = getCard(31);
    const p2PlayedCopy = { ...getCard(5), id: 'coma-p2' }; // Costo 4
    const p3HandCopy = { ...getCard(5), id: 'coma-p3' };   // Stessa carta in mano a p3

    state.players[0].hand = [sfratto];
    state.players[1].played = [p2PlayedCopy];
    state.players[2].hand = [p3HandCopy];

    // Prima de Lo Sfratto, la copia di p3 è bloccata!
    expect(isCardBlockedByTable(state, p3HandCopy).blocked).toBe(true);

    state = applyGameAction(state, {
      type: 'PLAY_CARD',
      playerId: 'p1',
      cardId: sfratto.id,
    });
    expect(state.pendingChoice?.type).toBe('CHOOSE_TARGET_PLAYED_CARD');

    state = applyGameAction(state, {
      type: 'RESOLVE_PENDING_CHOICE',
      playerId: 'p1',
      targetPlayedCardId: p2PlayedCopy.id,
    });

    expect(state.players[1].played).toHaveLength(0);
    expect(state.players[1].hand.some((c) => c.id === p2PlayedCopy.id)).toBe(true);
    // Ora la copia di p3 è SBLOCCATA!
    expect(isCardBlockedByTable(state, p3HandCopy).blocked).toBe(false);
  });

  it("#32 Il Mantenuto (Costo 6, TURN_START_STEAL_FROM_RICHEST): a inizio turno ruba 1 gettone al giocatore che ne ha di più", () => {
    let state = createPlayingTestState(32, [6, 6, 6, 6, 1]);
    const mantenuto = getCard(32);
    state.players[1].played = [mantenuto];
    state.players[1].tokens = 2;
    state.players[0].tokens = 3;
    state.players[2].tokens = 9; // p3 è il più ricco

    state = applyGameAction(state, { type: 'CASH_IN_DICE', playerId: 'p1' });
    state = applyGameAction(state, { type: 'END_TURN', playerId: 'p1' });

    // Inizia il turno di p2: ruba 1 gettone a p3 (che ne aveva 9)
    expect(state.currentPlayerIndex).toBe(1);
    expect(state.players[1].tokens).toBe(3);
    expect(state.players[2].tokens).toBe(8);
  });

  it('Nessuna logica cablata per nome: carte rinominate dall’editor funzionano identicamente grazie a EffectModel', () => {
    let state = createPlayingTestState(99, [2, 2, 3, 4, 5]);
    const customSponsor: CardData = {
      ...getCard(24),
      id: 'custom-999',
      name: 'Carta Creata Dall Editor Senza Nome Originale',
    };
    state.players[0].played = [customSponsor];
    const mods = getActiveModifiers(state.players[0], true);
    expect(mods.costDiscount).toBe(1);
    expect(mods.comboTierDiscount).toBe(1);
  });
});
