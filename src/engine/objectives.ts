import { CardData, ObjectiveCard } from './types';

export interface ObjectiveEvaluation {
  satisfied: boolean;
  progressText: string;
  mismatchedCardIds: string[];
}

export function evaluateObjective(
  playedCards: CardData[],
  objective: ObjectiveCard | null,
  requiredTeamSize = 4
): ObjectiveEvaluation {
  if (!objective) {
    return {
      satisfied: playedCards.length >= requiredTeamSize,
      progressText: `${playedCards.length}/${requiredTeamSize} carte in gioco`,
      mismatchedCardIds: [],
    };
  }

  const hasFullTeam = playedCards.length >= requiredTeamSize;

  switch (objective.ruleType) {
    case 'MIN_DISTINCT_CLASSES': {
      const distinctClasses = new Set(playedCards.map((c) => c.cardClass));
      const count = distinctClasses.size;
      const ruleMet = count >= objective.targetNumber;
      return {
        satisfied: hasFullTeam && ruleMet,
        progressText: `Classi diverse: ${count}/${objective.targetNumber}`,
        mismatchedCardIds: [],
      };
    }

    case 'MIN_SAME_CLASS': {
      const counts: Record<string, number> = {};
      for (const c of playedCards) {
        counts[c.cardClass] = (counts[c.cardClass] || 0) + 1;
      }
      const currentCount = objective.targetClass
        ? counts[objective.targetClass] || 0
        : Math.max(0, ...Object.values(counts));
      const ruleMet = currentCount >= objective.targetNumber;
      return {
        satisfied: hasFullTeam && ruleMet,
        progressText: objective.targetClass
          ? `${objective.targetClass}: ${currentCount}/${objective.targetNumber}`
          : `Stessa classe max: ${currentCount}/${objective.targetNumber}`,
        mismatchedCardIds: [],
      };
    }

    case 'MIN_TOTAL_COST': {
      const totalCost = playedCards.reduce((sum, c) => sum + c.cost, 0);
      const ruleMet = totalCost >= objective.targetNumber;
      return {
        satisfied: hasFullTeam && ruleMet,
        progressText: `Costo totale in gioco: ${totalCost}/${objective.targetNumber}`,
        mismatchedCardIds: [],
      };
    }

    case 'FORBID_COST': {
      const forbidden = playedCards.filter((c) => c.cost === objective.targetNumber);
      const ruleMet = forbidden.length === 0;
      return {
        satisfied: hasFullTeam && ruleMet,
        progressText: ruleMet
          ? `OK (0 carte di costo ${objective.targetNumber})`
          : `Violato! Hai ${forbidden.length} carta/e di costo ${objective.targetNumber}`,
        mismatchedCardIds: forbidden.map((c) => c.id),
      };
    }

    case 'ALL_EFFECT_TYPES': {
      const types = new Set(playedCards.map((c) => c.effectType));
      const required: Array<'Aiuto' | 'Ostacolo' | 'Caos'> = ['Aiuto', 'Ostacolo', 'Caos'];
      const count = required.filter((t) => types.has(t)).length;
      const ruleMet = count >= 3;
      return {
        satisfied: hasFullTeam && ruleMet,
        progressText: `Tipi effetto: ${count}/3 (${Array.from(types).join(', ') || 'nessuno'})`,
        mismatchedCardIds: [],
      };
    }

    case 'MAX_RARITY_COUNT': {
      const targetRarity = objective.targetRarity || 'PROMO';
      const matching = playedCards.filter((c) => c.rarity === targetRarity);
      const ruleMet = matching.length <= objective.targetNumber;
      return {
        satisfied: hasFullTeam && ruleMet,
        progressText: `${targetRarity}: ${matching.length} (max ${objective.targetNumber})`,
        mismatchedCardIds: ruleMet ? [] : matching.slice(objective.targetNumber).map((c) => c.id),
      };
    }

    default:
      return {
        satisfied: hasFullTeam,
        progressText: `${playedCards.length}/${requiredTeamSize}`,
        mismatchedCardIds: [],
      };
  }
}
