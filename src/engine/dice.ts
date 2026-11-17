import { DiceComboId, GameConfig } from './types';

export const COMBO_LABELS_IT: Record<DiceComboId, string> = {
  ONE_PAIR: 'Una coppia',
  TWO_PAIR: 'Doppia coppia',
  THREE_OF_A_KIND: 'Tris',
  FULL_HOUSE: 'Full',
  STRAIGHT_4: 'Scala di 4',
  FOUR_OF_A_KIND: 'Poker',
  STRAIGHT_5: 'Scala di 5',
  FIVE_OF_A_KIND: '5 Dadi Uguali',
};

export function rollSingleDie(): number {
  return Math.floor(Math.random() * 6) + 1;
}

/**
 * Restituisce tutte le combinazioni soddisfatte dai dadi correnti (4 o 5 dadi).
 */
export function evaluateDiceCombos(dice: number[]): DiceComboId[] {
  if (!dice || dice.length === 0) return [];

  const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  for (const d of dice) {
    if (d >= 1 && d <= 6) {
      counts[d] = (counts[d] || 0) + 1;
    }
  }

  const freq = Object.values(counts)
    .filter((c) => c > 0)
    .sort((a, b) => b - a);

  const maxSame = freq[0] || 0;
  const secondSame = freq[1] || 0;

  const uniqueSorted = Array.from(new Set(dice.filter((d) => d >= 1 && d <= 6))).sort(
    (a, b) => a - b
  );

  let maxConsecutive = 1;
  let currentConsecutive = 1;
  for (let i = 1; i < uniqueSorted.length; i++) {
    if (uniqueSorted[i] === uniqueSorted[i - 1] + 1) {
      currentConsecutive++;
      if (currentConsecutive > maxConsecutive) {
        maxConsecutive = currentConsecutive;
      }
    } else {
      currentConsecutive = 1;
    }
  }

  const achieved = new Set<DiceComboId>();

  if (maxSame >= 2) achieved.add('ONE_PAIR');
  if ((maxSame >= 2 && secondSame >= 2) || maxSame >= 4) achieved.add('TWO_PAIR');
  if (maxSame >= 3) achieved.add('THREE_OF_A_KIND');
  if ((maxSame >= 3 && secondSame >= 2) || maxSame >= 5) achieved.add('FULL_HOUSE');
  if (maxConsecutive >= 4) achieved.add('STRAIGHT_4');
  if (maxSame >= 4) achieved.add('FOUR_OF_A_KIND');
  if (maxConsecutive >= 5) achieved.add('STRAIGHT_5');
  if (maxSame >= 5) achieved.add('FIVE_OF_A_KIND');

  return Array.from(achieved);
}

/**
 * Calcola quanti gettoni si ottengono con l'azione "Incassa":
 * 1 gettone base + 1 per ogni dado che mostra 5 o 6 (+ eventuali bonus "Il Pisolino Strategico").
 */
export function calculateCashInTokens(dice: number[], bonusTokens = 0): number {
  const highDiceCount = dice.filter((d) => d === 5 || d === 6).length;
  return 1 + highDiceCount + bonusTokens;
}

/**
 * Verifica se i dadi attuali soddisfano la combinazione richiesta per un dato costo (2..6),
 * tenendo conto di eventuali penalità come "Il Boss" (+1 livello combinazione).
 */
export function canDiceSatisfyCardCost(
  dice: number[],
  baseCost: number,
  config: GameConfig,
  comboTierOffset = 0
): { satisfied: boolean; requiredCombos: DiceComboId[]; effectiveTier: number } {
  const effectiveTier = Math.min(6, Math.max(2, baseCost + comboTierOffset));
  const requiredCombos = config.costCombinationsTable[effectiveTier] || ['ONE_PAIR'];
  const achieved = evaluateDiceCombos(dice);
  const satisfied = requiredCombos.some((req) => achieved.includes(req));
  return {
    satisfied,
    requiredCombos,
    effectiveTier,
  };
}
