import { describe, expect, it } from 'vitest';
import { DEFAULT_CARDS, DEFAULT_GAME_CONFIG, DEFAULT_OBJECTIVES } from '../../data/defaultData';
import {
  applyGameAction,
  createInitialGameState,
  evaluateObjective,
  getEffectiveCost,
  getLegalActions,
  getPlayableCards,
  getPublicStateFor,
  getRequiredCombo,
  isCardBlockedByTable,
  validateAction,
} from '../index';
import { CardData, GameState } from '../types';

function getCard(setNumber: number): CardData {
  const found = DEFAULT_CARDS.find((c) => c.setNumber === setNumber);
  if (!found) throw new Error(`Card #${setNumber} not found`);
  return JSON.parse(JSON.stringify(found));
}

function setup3PlayerActiveGame(seed = 500): GameState {
  let state = createInitialGameState('STEP3', DEFAULT_CARDS, DEFAULT_GAME_CONFIG, seed);
  state = applyGameAction(state, { type: 'ADD_PLAYER', id: 'p1', name: 'Alice', isHost: true });
  state = applyGameAction(state, { type: 'ADD_PLAYER', id: 'p2', name: 'Bob' });
  state = applyGameAction(state, { type: 'ADD_PLAYER', id: 'p3', name: 'Charlie' });
  state = applyGameAction(state, { type: 'START_PACK_OPENING' });

  for (const p of state.players) {
    state = applyGameAction(state, { type: 'AUTO_SELECT_DRAFT', playerId: p.id });
    state = applyGameAction(state, { type: 'CONFIRM_DRAFT_TEAM', playerId: p.id });
  }
  for (const p of state.players) {
    state = applyGameAction(state, {
      type: 'PICK_OBJECTIVE',
      playerId: p.id,
      objectiveId: p.objectiveCandidates[0].id,
    });
  }
  return state;
}

describe('Step 3 — Fasi TurnStep, Mercato, Trattative, Obiettivi, Visibilità Pubblica e Validazione', () => {
  describe('1. Fasi del turno esplicite (ROLLING -> ACTION_DECISION -> POST_ACTION)', () => {
    it('scandisce ROLLING -> CONFIRM_DICE_ROLL -> ACTION_DECISION -> CASH_IN_DICE -> POST_ACTION -> END_TURN', () => {
      let state = setup3PlayerActiveGame(101);
      expect(state.phase).toBe('PLAYING');
      expect(state.turnStep).toBe('ROLLING');
      expect(state.rollsLeft).toBe(2);

      // In ROLLING può bloccare un dado e ritirare
      state = applyGameAction(state, { type: 'TOGGLE_KEEP_DIE', playerId: 'p1', dieIndex: 0 });
      expect(state.keptDice[0]).toBe(true);
      state = applyGameAction(state, { type: 'ROLL_DICE', playerId: 'p1' });
      expect(state.rollsLeft).toBe(1);
      expect(state.turnStep).toBe('ROLLING');

      // Conferma esplicita dei dadi (CONFIRM_DICE_ROLL) -> passa a ACTION_DECISION
      state = applyGameAction(state, { type: 'CONFIRM_DICE_ROLL', playerId: 'p1' });
      expect(state.turnStep).toBe('ACTION_DECISION');
      expect(state.rollsLeft).toBe(0);

      // In ACTION_DECISION non è più consentito tirare o bloccare i dadi
      expect(validateAction(state, { type: 'ROLL_DICE', playerId: 'p1' }).ok).toBe(false);
      expect(
        validateAction(state, { type: 'TOGGLE_KEEP_DIE', playerId: 'p1', dieIndex: 1 }).ok
      ).toBe(false);

      // Sceglie INCASSA -> passa a POST_ACTION
      state = applyGameAction(state, { type: 'CASH_IN_DICE', playerId: 'p1' });
      expect(state.turnStep).toBe('POST_ACTION');
      expect(state.mainActionTaken).toBe(true);

      // Non può fare una seconda azione principale in POST_ACTION
      expect(validateAction(state, { type: 'CASH_IN_DICE', playerId: 'p1' }).ok).toBe(false);

      // Chiude il turno -> passa al giocatore successivo in ROLLING
      state = applyGameAction(state, { type: 'END_TURN', playerId: 'p1' });
      expect(state.currentPlayerIndex).toBe(1);
      expect(state.turnStep).toBe('ROLLING');
      expect(state.rollsLeft).toBe(2);
    });

    it('passa automaticamente a ACTION_DECISION quando rollsLeft arriva a 0 (senza 4° tiro extra attivo)', () => {
      let state = setup3PlayerActiveGame(102);
      state = applyGameAction(state, { type: 'ROLL_DICE', playerId: 'p1' }); // 1 rimasto
      expect(state.turnStep).toBe('ROLLING');
      state = applyGameAction(state, { type: 'ROLL_DICE', playerId: 'p1' }); // 0 rimasti
      expect(state.rollsLeft).toBe(0);
      expect(state.turnStep).toBe('ACTION_DECISION');
    });
  });

  describe('2. Mercato e opzioni configurabili (marketSwapPrice, marketSwapTiming, marketSwapConsumesAction)', () => {
    it('rispetta marketSwapPrice, BEFORE_ROLL vs AFTER_ACTION e marketSwapConsumesAction', () => {
      let state = setup3PlayerActiveGame(201);
      state = applyGameAction(state, {
        type: 'UPDATE_CONFIG',
        config: {
          marketSwapPrice: 2,
          marketSwapTiming: 'AFTER_ACTION',
          marketSwapConsumesAction: false,
        },
      });

      const p1 = state.players[0];
      p1.tokens = 5;
      const handCard = p1.hand[0];
      const marketCard = state.market.find(
        (mc) => !p1.hand.some((hc) => hc.baseCardId === mc.baseCardId)
      )!;

      // In ROLLING con marketSwapTiming === 'AFTER_ACTION', lo scambio è vietato!
      expect(
        validateAction(state, {
          type: 'MARKET_SWAP',
          playerId: 'p1',
          handCardId: handCard.id,
          marketCardId: marketCard.id,
        }).ok
      ).toBe(false);

      // Dopo l'azione principale (POST_ACTION), lo scambio è consentito e costa 2 gettoni
      state = applyGameAction(state, { type: 'CASH_IN_DICE', playerId: 'p1' });
      const tokensAfterCash = state.players[0].tokens;
      state = applyGameAction(state, {
        type: 'MARKET_SWAP',
        playerId: 'p1',
        handCardId: handCard.id,
        marketCardId: marketCard.id,
      });
      expect(state.players[0].tokens).toBe(tokensAfterCash - 2);
      expect(state.players[0].hand.some((c) => c.id === marketCard.id)).toBe(true);
    });

    it('quando marketSwapConsumesAction è true, lo scambio col Mercato consuma l’azione principale', () => {
      let state = setup3PlayerActiveGame(202);
      state = applyGameAction(state, {
        type: 'UPDATE_CONFIG',
        config: {
          marketSwapPrice: 1,
          marketSwapTiming: 'ANYTIME_IN_TURN',
          marketSwapConsumesAction: true,
        },
      });
      const p1 = state.players[0];
      const handCard = p1.hand[0];
      const marketCard = state.market.find(
        (mc) => !p1.hand.some((hc) => hc.baseCardId === mc.baseCardId)
      )!;

      state = applyGameAction(state, {
        type: 'MARKET_SWAP',
        playerId: 'p1',
        handCardId: handCard.id,
        marketCardId: marketCard.id,
      });
      expect(state.mainActionTaken).toBe(true);
      expect(state.turnStep).toBe('POST_ACTION');
      expect(validateAction(state, { type: 'CASH_IN_DICE', playerId: 'p1' }).ok).toBe(false);
    });
  });

  describe('3. Trattativa tra giocatori (OFFER_PLAYER_TRADE / RESPOND_PLAYER_TRADE)', () => {
    it('vieta di comprare a chi è a 1 carta dalla vittoria, vieta carte già giocate e limita a max 1 offerta/turno', () => {
      let state = setup3PlayerActiveGame(301);
      state.players[0].tokens = 10;
      state.players[0].hand = [getCard(1)];
      state.players[1].hand = [getCard(5)];
      state.players[1].played = [getCard(2)];

      // Vietato comprare una carta già giocata
      expect(
        validateAction(state, {
          type: 'OFFER_PLAYER_TRADE',
          fromPlayerId: 'p1',
          toPlayerId: 'p2',
          offeredTokens: 2,
          offeredSwapCardId: state.players[0].hand[0].id,
          targetCardId: state.players[1].played[0].id,
        }).ok
      ).toBe(false);

      // Se p1 ha già 3 carte in gioco (a 1 carta dalla vittoria su teamSize=4), non può comprare!
      state.players[0].played = [getCard(10), getCard(11), getCard(12)];
      expect(
        validateAction(state, {
          type: 'OFFER_PLAYER_TRADE',
          fromPlayerId: 'p1',
          toPlayerId: 'p2',
          offeredTokens: 2,
          offeredSwapCardId: state.players[0].hand[0].id,
        }).ok
      ).toBe(false);

      // Con 2 carte in gioco può fare 1 offerta
      state.players[0].played = [getCard(10), getCard(11)];
      state = applyGameAction(state, {
        type: 'OFFER_PLAYER_TRADE',
        fromPlayerId: 'p1',
        toPlayerId: 'p2',
        offeredTokens: 2,
        offeredSwapCardId: state.players[0].hand[0].id,
      });
      expect(state.pendingTradeOffer).not.toBeNull();

      // p2 accetta -> scambiano le carte e 2 gettoni
      state = applyGameAction(state, {
        type: 'RESPOND_PLAYER_TRADE',
        playerId: 'p2',
        accept: true,
        chosenTargetCardId: state.players[1].hand[0].id,
      });
      expect(state.players[0].tokens).toBe(8);
      expect(state.players[0].hand[0].setNumber).toBe(5);
      expect(state.players[1].hand[0].setNumber).toBe(1);

      // Seconda offerta nello stesso turno -> vietata!
      expect(
        validateAction(state, {
          type: 'OFFER_PLAYER_TRADE',
          fromPlayerId: 'p1',
          toPlayerId: 'p3',
          offeredTokens: 2,
          offeredSwapCardId: state.players[0].hand[0].id,
        }).ok
      ).toBe(false);
    });
  });

  describe('4. Personaggi doppi (blockScope: SAME_CARD vs SAME_PERSON)', () => {
    it('blocca la stessa carta per tutti gli altri e supporta blockScope = SAME_PERSON', () => {
      let state = setup3PlayerActiveGame(401);
      const cardA = { ...getCard(1), id: 'c1-a', personName: 'Giorgio' };
      const cardB = { ...getCard(1), id: 'c1-b', personName: 'Giorgio' };
      const diffCardSamePerson = {
        ...getCard(9),
        id: 'c9-giorgio',
        baseCardId: 'card-09',
        personName: 'Giorgio',
      };

      state.players[0].played = [cardA];
      expect(isCardBlockedByTable(state, cardB).blocked).toBe(true);
      expect(isCardBlockedByTable(state, diffCardSamePerson).blocked).toBe(false);

      // Attivando blockScope: 'SAME_PERSON', anche versioni diverse della stessa persona sono bloccate
      state = applyGameAction(state, {
        type: 'UPDATE_CONFIG',
        config: { blockScope: 'SAME_PERSON' },
      });
      expect(isCardBlockedByTable(state, diffCardSamePerson).blocked).toBe(true);
    });
  });

  describe('5. Obiettivi (i 6 esempi del GDD + evaluateObjective)', () => {
    it('verifica tutti e 6 gli esempi di Obiettivo del GDD', () => {
      const cDorm = getCard(1); // Dormienti, costo 2, Aiuto, Comune
      const cUten = getCard(10); // Utenti, costo 2, Ostacolo, Comune
      const cFest = getCard(17); // Festaioli, costo 2, Caos, Comune
      const cScro = getCard(32); // Scrocconi, costo 6, Ostacolo, PROMO

      // 1. 4 classi diverse (obj-1)
      expect(
        evaluateObjective([cDorm, cUten, cFest, cScro], DEFAULT_OBJECTIVES[0], 4).satisfied
      ).toBe(true);
      expect(
        evaluateObjective([cDorm, cDorm, cFest, cScro], DEFAULT_OBJECTIVES[0], 4).satisfied
      ).toBe(false);

      // 2. Almeno 2 carte della stessa classe (obj-2)
      expect(
        evaluateObjective([cDorm, getCard(2), cFest, cScro], DEFAULT_OBJECTIVES[1], 4).satisfied
      ).toBe(true);

      // 3. Costo totale almeno 14 (obj-3)
      expect(
        evaluateObjective(
          [getCard(5), getCard(6), getCard(7), getCard(8)], // 4+4+5+6 = 19
          DEFAULT_OBJECTIVES[2],
          4
        ).satisfied
      ).toBe(true);
      expect(
        evaluateObjective([cDorm, cUten, cFest, getCard(2)], DEFAULT_OBJECTIVES[2], 4).satisfied
      ).toBe(false);

      // 4. Nessuna carta da 6 (obj-4)
      expect(
        evaluateObjective([cDorm, cUten, cFest, getCard(5)], DEFAULT_OBJECTIVES[3], 4).satisfied
      ).toBe(true);
      const evalWith6 = evaluateObjective(
        [cDorm, cUten, cFest, cScro],
        DEFAULT_OBJECTIVES[3],
        4
      );
      expect(evalWith6.satisfied).toBe(false);
      expect(evalWith6.mismatchedCardIds).toContain(cScro.id);

      // 5. Almeno un effetto per ognuno dei tre tipi Aiuto, Ostacolo, Caos (obj-5)
      expect(
        evaluateObjective([cDorm, cUten, cFest, getCard(5)], DEFAULT_OBJECTIVES[4], 4).satisfied
      ).toBe(true);

      // 6. Al massimo una carta PROMO (obj-6)
      expect(
        evaluateObjective([cDorm, cUten, cFest, cScro], DEFAULT_OBJECTIVES[5], 4).satisfied
      ).toBe(true);
      expect(
        evaluateObjective(
          [cDorm, getCard(8), getCard(16), cScro], // 3 PROMO
          DEFAULT_OBJECTIVES[5],
          4
        ).satisfied
      ).toBe(false);
    });
  });

  describe('6. Visibilità Pubblica e Privacy P2P (getPublicStateFor)', () => {
    it('non fa mai trapelare le carte in mano, le bustine o gli obiettivi segreti degli altri giocatori', () => {
      let state = setup3PlayerActiveGame(601);
      const realP2HandNames = state.players[1].hand.map((c) => c.name);
      const realP2ObjTitle = state.players[1].objective?.title;

      const viewForP1 = getPublicStateFor(state, 'p1');
      const p1ViewOfSelf = viewForP1.players[0];
      const p1ViewOfP2 = viewForP1.players[1];

      // p1 vede le proprie carte e il proprio obiettivo
      expect(p1ViewOfSelf.hand[0].name).not.toBe('Carta Coperta');
      expect(p1ViewOfSelf.objective).not.toBeNull();

      // p1 vede il numero di carte in mano di p2 (4), ma MAI quali carte sono!
      expect(p1ViewOfP2.hand).toHaveLength(state.players[1].hand.length);
      expect(p1ViewOfP2.handCount).toBe(state.players[1].hand.length);
      for (const maskedCard of p1ViewOfP2.hand) {
        expect(maskedCard.name).toBe('Carta Coperta');
        expect(realP2HandNames).not.toContain(maskedCard.name);
      }

      // Pool di draft e candidati obiettivo di p2 sono sempre vuoti per p1
      expect(p1ViewOfP2.pulledPool).toEqual([]);
      expect(p1ViewOfP2.selectedStarterIds).toEqual([]);
      expect(p1ViewOfP2.objectiveCandidates).toEqual([]);

      // Obiettivo segreto di p2 è nascosto (null) per p1
      expect(p1ViewOfP2.objective).toBeNull();

      // Se p1 spia p2 con "Il Ficcanaso", allora p1 (e solo p1, non p3!) vede l'obiettivo di p2!
      state.players[0].modifiers.revealedObjectivePlayerIds.push('p2');
      const viewForP1AfterSpy = getPublicStateFor(state, 'p1');
      const viewForP3AfterSpy = getPublicStateFor(state, 'p3');

      expect(viewForP1AfterSpy.players[1].objective?.title).toBe(realP2ObjTitle);
      expect(viewForP3AfterSpy.players[1].objective).toBeNull();
    });

    it('esporta e calcola correttamente i selettori getLegalActions, getPlayableCards, getEffectiveCost, getRequiredCombo', () => {
      const state = setup3PlayerActiveGame(602);
      const legalP1 = getLegalActions(state, 'p1');
      const legalP2 = getLegalActions(state, 'p2');

      expect(legalP1.length).toBeGreaterThan(0);
      expect(legalP2).toEqual([]); // Non è il turno di p2

      const playable = getPlayableCards(state, 'p1');
      expect(playable).toHaveLength(state.players[0].hand.length);

      const firstCard = state.players[0].hand[0];
      expect(getEffectiveCost(state, 'p1', firstCard.id)).toBe(firstCard.cost);
      expect(getRequiredCombo(state, 'p1', firstCard.id).effectiveTier).toBe(firstCard.cost);
    });
  });
});
