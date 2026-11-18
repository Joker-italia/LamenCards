import { DEFAULT_RNG_SEED, mulberry32Step, RngStateHolder, rollDieFromRng } from './rng';
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

let fallbackDeterministicState = DEFAULT_RNG_SEED;

/**
 * Tira un singolo dado a 6 facce (1..6) in modo deterministico.
 * Accetta opzionalmente un contenitore `RngStateHolder` (es. `GameState`) o una funzione RNG `() => number`.
 */
export function rollSingleDie(rng?: RngStateHolder | (() => number)): number {
  if (typeof rng === 'function') {
    const val = Math.floor(rng() * 6) + 1;
    return Math.min(6, Math.max(1, val));
  }
  if (rng && typeof rng === 'object' && typeof rng.rngState === 'number') {
    return rollDieFromRng(rng);
  }
  const step = mulberry32Step(fallbackDeterministicState);
  fallbackDeterministicState = step.nextState;
  return Math.floor(step.value * 6) + 1;
}

export function flipDieOppositeFace(val: number): number {
  if (val < 1 || val > 6) return val;
  return 7 - val; // 1<->6, 2<->5, 3<->4
}

/**
 * Restituisce tutte le combinazioni soddisfatte dai dadi correnti (4 o 5 dadi).
 * - ONE_PAIR: almeno 2 dadi uguali
 * - TWO_PAIR: due coppie diverse (es. 2-2-5-5) oppure 4+ dadi uguali (es. 4-4-4-4)
 * - THREE_OF_A_KIND: almeno 3 dadi uguali
 * - STRAIGHT_4: almeno 4 valori consecutivi distinti (1-2-3-4, 2-3-4-5, 3-4-5-6)
 * - FULL_HOUSE: un tris + una coppia (es. 3-3-3-2-2) oppure 5 dadi uguali
 * - FOUR_OF_A_KIND: almeno 4 dadi uguali (Poker)
 * - STRAIGHT_5: 5 valori consecutivi distinti (1-2-3-4-5 o 2-3-4-5-6)
 * - FIVE_OF_A_KIND: 5 dadi uguali
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

  let maxConsecutive = uniqueSorted.length > 0 ? 1 : 0;
  let currentConsecutive = uniqueSorted.length > 0 ? 1 : 0;
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
 * 1 gettone base + 1 per ogni dado 5 o 6 (oppure solo per ogni 6 se impostato in configurazione).
 */
export function calculateCashInTokens(
  dice: number[],
  bonusTokens = 0,
  highFacesMode: 'FIVE_AND_SIX' | 'ONLY_SIX' | 'SIX_ONLY' = 'FIVE_AND_SIX'
): number {
  const isSixOnly = highFacesMode === 'ONLY_SIX' || highFacesMode === 'SIX_ONLY';
  const highDiceCount = isSixOnly
    ? dice.filter((d) => d === 6).length
    : dice.filter((d) => d === 5 || d === 6).length;
  return 1 + highDiceCount + bonusTokens;
}

/**
 * Verifica se i dadi attuali soddisfano la combinazione richiesta per un dato costo (2..6),
 * tenendo conto di "Lo Sponsor" (-1 livello) e "Il Trip" (scambio 2<->6 e 3<->5).
 */
export function canDiceSatisfyCardCost(
  dice: number[],
  baseCost: number,
  config: GameConfig,
  comboTierOffset = 0,
  invertComboTable = false
): { satisfied: boolean; requiredCombos: DiceComboId[]; effectiveTier: number } {
  let effectiveTier = Math.min(6, Math.max(2, baseCost + comboTierOffset));

  if (invertComboTable) {
    const invertedMap: Record<number, number> = {
      2: 6,
      3: 5,
      4: 4,
      5: 3,
      6: 2,
    };
    effectiveTier = invertedMap[effectiveTier] || effectiveTier;
  }

  const table = config.comboTable || config.costCombinationsTable;
  const requiredCombos = table?.[effectiveTier] || ['ONE_PAIR'];
  const achieved = evaluateDiceCombos(dice);
  const satisfied = requiredCombos.some((req) => achieved.includes(req));
  return {
    satisfied,
    requiredCombos,
    effectiveTier,
  };
}
