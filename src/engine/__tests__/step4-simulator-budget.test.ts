import { describe, expect, it } from 'vitest';
import { DEFAULT_CARDS } from '../../data/defaultData';
import {
  estimateCardBudget,
  evaluateCatalogBudget,
  runSimulation,
  simulateDiceComboProbabilities,
} from '../index';

describe('Step 4 — Simulatore Headless, Strategie Bot, Probabilità Dadi e Budget Check', () => {
  it('runSimulation è deterministico: stesso seed => stesso identico SimulationReport', () => {
    const rep1 = runSimulation({
      games: 15,
      players: 4,
      seed: 12345,
      botStrategy: 'GREEDY',
      includeDiceMonteCarlo: false,
    });
    const rep2 = runSimulation({
      games: 15,
      players: 4,
      seed: 12345,
      botStrategy: 'GREEDY',
      includeDiceMonteCarlo: false,
    });

    expect(rep1).toEqual(rep2);
    expect(rep1.cardStats).toHaveLength(32);
    expect(rep1.seatWinRatesPercent).toHaveLength(4);
    expect(rep1.averageRounds).toBeGreaterThan(3);
  });

  it('supporta entrambe le strategie bot RANDOM e GREEDY e da 3 a 6 giocatori', () => {
    const repRandom = runSimulation({
      games: 10,
      players: 3,
      seed: 42,
      botStrategy: 'RANDOM',
      includeDiceMonteCarlo: false,
    });
    const repGreedy = runSimulation({
      games: 10,
      players: 6,
      seed: 42,
      botStrategy: 'GREEDY',
      includeDiceMonteCarlo: false,
    });

    expect(repRandom.gamesSimulated).toBe(10);
    expect(repRandom.playerCount).toBe(3);
    expect(repGreedy.gamesSimulated).toBe(10);
    expect(repGreedy.playerCount).toBe(6);
  });

  it('simulateDiceComboProbabilities riproduce le probabilità del GDD per 5 e 4 dadi', () => {
    const probs = simulateDiceComboProbabilities(4000, 42);
    expect(probs).toHaveLength(5);

    const pair = probs.find((p) => p.comboId === 'ONE_PAIR')!;
    const twoPair = probs.find((p) => p.comboId === 'TWO_PAIR')!;
    const straight4 = probs.find((p) => p.comboId === 'STRAIGHT_4')!;
    const full = probs.find((p) => p.comboId === 'FULL_HOUSE')!;
    const poker = probs.find((p) => p.comboId === 'FOUR_OF_A_KIND')!;

    expect(pair.simulated5DicePercent).toBeGreaterThan(97);
    expect(twoPair.simulated5DicePercent).toBeGreaterThan(68);
    expect(straight4.simulated5DicePercent).toBeGreaterThan(50);
    expect(straight4.simulated4DicePercent).toBeLessThan(straight4.simulated5DicePercent);
    expect(full.simulated5DicePercent).toBeGreaterThan(28);
    expect(poker.simulated5DicePercent).toBeGreaterThan(22);
    expect(poker.simulated4DicePercent).toBeLessThan(16);
  });

  it('evaluateCatalogBudget valuta tutte le 32 carte rispetto al budget GDD (costo - 1)', () => {
    const evaluations = evaluateCatalogBudget(DEFAULT_CARDS);
    expect(evaluations).toHaveLength(32);

    const pisolino = estimateCardBudget(DEFAULT_CARDS[0]); // Costo 2 -> budget 1, +1 gettone = 1
    expect(pisolino.targetBudget).toBe(1);
    expect(pisolino.estimatedValue).toBe(1);
    expect(pisolino.status).toBe('BILANCIATA');
  });
});
