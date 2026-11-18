import {
  CardData,
  EffectTemplateId,
  GameAction,
  GameState,
  getPublicStateFor as engineGetPublicStateFor,
  validateAction as engineValidateAction,
} from '../engine';

/**
 * Restituisce una copia di `GameState` filtrata per uno specifico giocatore (`viewerPlayerId`),
 * delegando al selettore autoritativo dell'Engine (`getPublicStateFor`).
 */
export function getPublicStateFor(state: GameState, viewerPlayerId: string): GameState {
  return engineGetPublicStateFor(state, viewerPlayerId);
}

/**
 * Valida che un'azione ricevuta da un client P2P sia legittima prima che l'Host la applichi,
 * delegando a `validateAction` dell'Engine.
 */
export function validateClientAction(
  state: GameState,
  action: GameAction,
  senderPlayerId?: string
): { valid: boolean; reason?: string } {
  const res = engineValidateAction(state, action, senderPlayerId);
  return res.ok ? { valid: true } : { valid: false, reason: res.reason };
}

/**
 * Stima il valore in gettoni dell'effetto di una carta secondo le Linee Guida Matematiche del GDD (Sez. 5):
 * - Unità base: 1 gettone
 * - Budget ideale per costo: Costo - 1 gettoni (Costo 2->1, 3->2, 4->3, 5->4, 6->5)
 * - Rubare 1 gettone = 1.5
 * - Saltare 1 turno = 4.5
 * - Finché è in gioco = contato su ~2.5 utilizzi medi
 */
export function estimateCardBudget(card: CardData): {
  targetBudget: number;
  estimatedValue: number;
  status: 'SOTTO_BUDGET' | 'BILANCIATA' | 'SOPRA_BUDGET';
  note: string;
} {
  const targetBudget = Math.max(1, card.cost - 1);
  const tpl: EffectTemplateId = card.effectModel.templateId;
  const val = card.effectModel.value ?? 1;
  const sec = card.effectModel.secondaryValue ?? 1;

  let estimated = 1;

  switch (tpl) {
    case 'NONE':
      estimated = 0;
      break;
    case 'GAIN_TOKENS':
      estimated = val * 1;
      break;
    case 'STEAL_TOKENS':
      estimated = val * 1.5;
      break;
    case 'LOSE_TARGET_TOKENS':
      estimated = val * 1;
      break;
    case 'SET_TARGET_NEXT_ROLLS':
      estimated = Math.max(0.5, (3 - val) * 1);
      break;
    case 'GAIN_TOKENS_AND_NEXT_ROLLS':
      estimated = val + Math.max(0, sec - 3) * 1;
      break;
    case 'PROTECT_FROM_BUY_AND_BOUNCE':
      estimated = 2.0;
      break;
    case 'CASH_IN_BONUS':
      estimated = val * 2.5;
      break;
    case 'OTHERS_FOUR_DICE_ONE_ROUND':
      estimated = 3.0;
      break;
    case 'SKIP_TARGET_NEXT_TURN':
      estimated = 4.5;
      break;
    case 'TURN_START_GAIN_TOKENS':
      estimated = val * 2.5;
      break;
    case 'GAMBLE_DICE_SWAP':
      estimated = 1.0;
      break;
    case 'ROLL_2D6_JACKPOT_TOKENS':
      estimated = (11 / 36) * val + (25 / 36) * sec;
      break;
    case 'ALL_ROLL_LOWEST_LOSES_TOKENS':
      estimated = val * 1.1;
      break;
    case 'FLIP_DIE_OPPOSITE_ONCE_PER_TURN':
      estimated = 3.0;
      break;
    case 'PASS_UNPLAYED_LEFT':
      estimated = 3.0;
      break;
    case 'FORBID_TARGET_PLAY_NEXT_TURN':
      estimated = 4.0;
      break;
    case 'INVERT_COMBO_TABLE_ONE_ROUND':
      estimated = 5.0;
      break;
    case 'ALL_GAIN_TOKENS_SELF_MORE':
      estimated = Math.max(0.5, val - sec * 0.5);
      break;
    case 'NO_COMBO_ALTERNATE_COST':
      estimated = 1.0;
      break;
    case 'GAIN_TOKENS_AND_FREE_MARKET':
      estimated = val + 1.0;
      break;
    case 'OTHERS_PAY_TOKEN_OR_4_DICE':
      estimated = 2.2;
      break;
    case 'ON_OTHER_PLAY_GAIN_TOKEN':
      estimated = 3.0;
      break;
    case 'ALL_FREE_MARKET_SWAP':
      estimated = 3.0;
      break;
    case 'PLAY_EXTRA_CARD_NO_COMBO':
      estimated = 4.2;
      break;
    case 'DISCOUNT_COST_AND_COMBO_TIER':
      estimated = val * 5.0;
      break;
    case 'BORROW_TOKENS_REPAY_NEXT_TURN':
      estimated = val * 1.2 - sec * 0.8;
      break;
    case 'FREE_IMMEDIATE_MARKET_SWAP':
      estimated = 2.0;
      break;
    case 'LEFT_NEIGHBOR_CASH_IN_BONUS':
      estimated = val * 2.8;
      break;
    case 'PEEK_OBJECTIVE_AND_STEAL':
      estimated = val * 1.5 + 1.5;
      break;
    case 'RETURN_PLAYED_CARD':
      estimated = Math.min(5, val) * 0.85 + 0.5;
      break;
    case 'TURN_START_STEAL_FROM_RICHEST':
      estimated = val * 1.5 * 2.8;
      break;
    default:
      estimated = targetBudget;
  }

  const rounded = Number(estimated.toFixed(1));
  const diff = rounded - targetBudget;

  if (diff > 0.7) {
    return {
      targetBudget,
      estimatedValue: rounded,
      status: 'SOPRA_BUDGET',
      note: `Stima ~${rounded} 🪙 vs budget GDD ${targetBudget} 🪙 (molto forte, tieni d'occhio nei test!)`,
    };
  }
  if (diff < -0.7) {
    return {
      targetBudget,
      estimatedValue: rounded,
      status: 'SOTTO_BUDGET',
      note: `Stima ~${rounded} 🪙 vs budget GDD ${targetBudget} 🪙 (effetto leggero, puoi potenziarlo)`,
    };
  }
  return {
    targetBudget,
    estimatedValue: rounded,
    status: 'BILANCIATA',
    note: `Stima ~${rounded} 🪙 perfettamente in linea col budget GDD (${targetBudget} 🪙)`,
  };
}
