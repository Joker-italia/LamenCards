import { describe, expect, it } from 'vitest';
import { DEFAULT_CARDS, DEFAULT_GAME_CONFIG } from '../../data/defaultData';
import {
  applyGameAction,
  calculateCashInTokens,
  canDiceSatisfyCardCost,
  createInitialGameState,
  evaluateDiceCombos,
  executeBotTurnStep,
  flipDieOppositeFace,
  generateBoosterPack,
} from '../index';

describe('Step 1 — Dadi, Combinazioni, Incassa, Draft e Determinismo', () => {
  describe('evaluateDiceCombos & canDiceSatisfyCardCost', () => {
    it('riconosce correttamente Una coppia (Costo 2)', () => {
      const combos = evaluateDiceCombos([2, 2, 3, 5, 6]);
      expect(combos).toContain('ONE_PAIR');
      expect(combos).not.toContain('TWO_PAIR');
      expect(combos).not.toContain('THREE_OF_A_KIND');
      expect(
        canDiceSatisfyCardCost([2, 2, 3, 5, 6], 2, DEFAULT_GAME_CONFIG).satisfied
      ).toBe(true);
      expect(
        canDiceSatisfyCardCost([1, 2, 3, 5, 6], 2, DEFAULT_GAME_CONFIG).satisfied
      ).toBe(false);
    });

    it('riconosce Doppia coppia (Costo 3) e la distingue da Tris e Full', () => {
      const twoPair = evaluateDiceCombos([2, 2, 5, 5, 1]);
      expect(twoPair).toContain('ONE_PAIR');
      expect(twoPair).toContain('TWO_PAIR');
      expect(twoPair).not.toContain('THREE_OF_A_KIND');
      expect(twoPair).not.toContain('FULL_HOUSE');

      const threeKindOnly = evaluateDiceCombos([4, 4, 4, 1, 2]);
      expect(threeKindOnly).toContain('ONE_PAIR');
      expect(threeKindOnly).toContain('THREE_OF_A_KIND');
      expect(threeKindOnly).not.toContain('TWO_PAIR');
      expect(threeKindOnly).not.toContain('FULL_HOUSE');
    });

    it('riconosce Scala di 4 (Costo 4) per 1-2-3-4, 2-3-4-5 e 3-4-5-6 con 5 e 4 dadi', () => {
      expect(evaluateDiceCombos([1, 2, 3, 4, 4])).toContain('STRAIGHT_4');
      expect(evaluateDiceCombos([6, 2, 3, 4, 5])).toContain('STRAIGHT_4');
      expect(evaluateDiceCombos([1, 3, 4, 5, 6])).toContain('STRAIGHT_4');
      // Con 4 dadi (es. Sonno Contagioso / Giro di Shot)
      expect(evaluateDiceCombos([1, 2, 3, 4])).toContain('STRAIGHT_4');
      expect(evaluateDiceCombos([3, 4, 5, 6])).toContain('STRAIGHT_4');
      // Non scala
      expect(evaluateDiceCombos([1, 2, 4, 5, 6])).not.toContain('STRAIGHT_4');
    });

    it('riconosce Full (Costo 5) e verifica che soddisfi anche Doppia coppia e Una coppia', () => {
      const full = evaluateDiceCombos([3, 3, 3, 6, 6]);
      expect(full).toContain('FULL_HOUSE');
      expect(full).toContain('THREE_OF_A_KIND');
      expect(full).toContain('TWO_PAIR');
      expect(full).toContain('ONE_PAIR');
      expect(full).not.toContain('FOUR_OF_A_KIND');
      expect(
        canDiceSatisfyCardCost([3, 3, 3, 6, 6], 5, DEFAULT_GAME_CONFIG).satisfied
      ).toBe(true);
    });

    it('riconosce Poker (Costo 6) e Casi Limite (Poker conta come Coppia e Doppia coppia ma non Full; 5 uguali conta come tutto)', () => {
      const poker = evaluateDiceCombos([5, 5, 5, 5, 2]);
      expect(poker).toContain('FOUR_OF_A_KIND');
      expect(poker).toContain('THREE_OF_A_KIND');
      expect(poker).toContain('TWO_PAIR');
      expect(poker).toContain('ONE_PAIR');
      expect(poker).not.toContain('FULL_HOUSE');

      const fiveSame = evaluateDiceCombos([6, 6, 6, 6, 6]);
      expect(fiveSame).toContain('FIVE_OF_A_KIND');
      expect(fiveSame).toContain('FOUR_OF_A_KIND');
      expect(fiveSame).toContain('FULL_HOUSE');
      expect(fiveSame).toContain('THREE_OF_A_KIND');
      expect(fiveSame).toContain('TWO_PAIR');
      expect(fiveSame).toContain('ONE_PAIR');
    });

    it('gira correttamente la faccia opposta del dado (1<->6, 2<->5, 3<->4)', () => {
      expect(flipDieOppositeFace(1)).toBe(6);
      expect(flipDieOppositeFace(6)).toBe(1);
      expect(flipDieOppositeFace(2)).toBe(5);
      expect(flipDieOppositeFace(5)).toBe(2);
      expect(flipDieOppositeFace(3)).toBe(4);
      expect(flipDieOppositeFace(4)).toBe(3);
    });
  });

  describe('calculateCashInTokens', () => {
    it('calcola 1 + 1 per ogni 5 o 6 nella modalità FIVE_AND_SIX', () => {
      expect(calculateCashInTokens([1, 2, 3, 4, 4], 0, 'FIVE_AND_SIX')).toBe(1);
      expect(calculateCashInTokens([1, 5, 6, 2, 5], 0, 'FIVE_AND_SIX')).toBe(4);
      expect(calculateCashInTokens([5, 5, 6, 6, 6], 1, 'FIVE_AND_SIX')).toBe(7);
    });

    it('calcola 1 + 1 solo per ogni 6 nella modalità ONLY_SIX / SIX_ONLY', () => {
      expect(calculateCashInTokens([5, 5, 5, 5, 2], 0, 'ONLY_SIX')).toBe(1);
      expect(calculateCashInTokens([5, 5, 6, 6, 2], 0, 'SIX_ONLY')).toBe(3);
      expect(calculateCashInTokens([6, 6, 6, 6, 6], 1, 'SIX_ONLY')).toBe(7);
    });
  });

  describe('Draft: Composizione delle bustine (GDD §3)', () => {
    it('ogni bustina da 5 carte contiene 1 carta per ciascuna delle 4 classi + 1 jolly non duplicato', () => {
      const state = createInitialGameState('DRAFT-TEST', DEFAULT_CARDS, DEFAULT_GAME_CONFIG, 12345);
      for (let i = 0; i < 20; i++) {
        const pack = generateBoosterPack(state, DEFAULT_CARDS, 5, i + 1);
        expect(pack).toHaveLength(5);
        const classes = new Set(pack.map((c) => c.cardClass));
        expect(classes.has('Dormienti')).toBe(true);
        expect(classes.has('Utenti')).toBe(true);
        expect(classes.has('Festaioli')).toBe(true);
        expect(classes.has('Scrocconi')).toBe(true);

        const baseIds = new Set(pack.map((c) => c.baseCardId));
        expect(baseIds.size).toBe(5);
      }
    });

    it('aprendone 2 bustine ogni giocatore vede 10 carte con almeno 2 carte per classe', () => {
      let state = createInitialGameState('PACKS-2', DEFAULT_CARDS, DEFAULT_GAME_CONFIG, 999);
      state = applyGameAction(state, { type: 'ADD_PLAYER', id: 'p1', name: 'Luca', isHost: true });
      state = applyGameAction(state, { type: 'ADD_PLAYER', id: 'p2', name: 'Marco' });
      state = applyGameAction(state, { type: 'ADD_PLAYER', id: 'p3', name: 'Giorgio' });
      state = applyGameAction(state, { type: 'START_PACK_OPENING' });

      state = applyGameAction(state, { type: 'OPEN_NEXT_PACK', playerId: 'p1' });
      state = applyGameAction(state, { type: 'OPEN_NEXT_PACK', playerId: 'p1' });

      const p1 = state.players.find((p) => p.id === 'p1')!;
      expect(p1.pulledPool).toHaveLength(10);
      for (const cls of ['Dormienti', 'Utenti', 'Festaioli', 'Scrocconi']) {
        const count = p1.pulledPool.filter((c) => c.cardClass === cls).length;
        expect(count).toBeGreaterThanOrEqual(2);
      }
    });
  });

  describe('Determinismo Puro (Stesso seed => Stato identico)', () => {
    it('due partite complete giocate con lo stesso seed producono uno stato finale deep-equal identico', () => {
      function playFullSeededGame(seed: number) {
        let state = createInitialGameState('DET-ROOM', DEFAULT_CARDS, DEFAULT_GAME_CONFIG, seed);
        for (let i = 0; i < 4; i++) {
          state = applyGameAction(state, {
            type: 'ADD_PLAYER',
            id: `bot-${i}`,
            name: `Bot ${i + 1}`,
            isBot: true,
            isHost: i === 0,
          });
        }
        state = applyGameAction(state, { type: 'START_PACK_OPENING' });
        for (const p of state.players) {
          state = applyGameAction(state, { type: 'CONFIRM_DRAFT_TEAM', playerId: p.id });
        }
        let steps = 0;
        while (state.phase === 'PLAYING' && steps < 600) {
          state = executeBotTurnStep(state, 'GREEDY');
          steps++;
        }
        return state;
      }

      const game1 = playFullSeededGame(77777);
      const game2 = playFullSeededGame(77777);
      const gameDifferent = playFullSeededGame(88888);

      expect(game1.phase).toBe('GAME_OVER');
      expect(game1).toEqual(game2);
      expect(game1.rngState).not.toBe(gameDifferent.rngState);
    });
  });
});
