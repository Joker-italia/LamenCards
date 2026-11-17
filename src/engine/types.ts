export type CardClass = 'Dormienti' | 'Utenti' | 'PROMO' | string;

export type CardRarity = 'Comune' | 'Rara' | 'Olografica';

export type EffectCategory = 'Aiuto' | 'Ostacolo' | 'Caos';

export type EffectTiming = 'ON_ENTER' | 'WHILE_IN_PLAY' | 'PASSIVE_NONE';

export type EffectTemplateId =
  | 'NONE'
  | 'GAIN_TOKENS'
  | 'STEAL_TOKENS'
  | 'CASH_IN_BONUS'
  | 'NEXT_CARD_DISCOUNT'
  | 'RETURN_PLAYED_CARD'
  | 'GRANT_JOKER_DIE'
  | 'REDUCE_TARGET_ROLLS'
  | 'REDUCE_ALL_DICE'
  | 'SHIFT_TARGET_COMBO_TIER'
  | 'PASS_UNPLAYED_LEFT'
  | 'ALL_REDRAW_OBJECTIVE'
  | 'GAMBLE_DICE_SWAP';

export interface EffectModel {
  templateId: EffectTemplateId;
  timing: EffectTiming;
  value?: number;
  secondaryValue?: number;
  requiresTargetPlayer?: boolean;
}

export interface CardData {
  id: string;
  setNumber: number;
  personName: string; // Nome base dell'amico (es. "Giorgio") per regola unicità persona
  name: string;       // Titolo/Nome carta (es. "Il Caffè Doppio" o "Giorgio")
  version: string;    // Eventuale versione (es. "Abile giocatore di carte", "Dormiente")
  cardClass: CardClass;
  rarity: CardRarity;
  cost: 2 | 3 | 4 | 5 | 6;
  effectType: EffectCategory;
  effectText: string;
  effectModel: EffectModel;
  photoUrl?: string;
  avatarSeed?: string;
}

export type DiceComboId =
  | 'ONE_PAIR'
  | 'TWO_PAIR'
  | 'THREE_OF_A_KIND'
  | 'FULL_HOUSE'
  | 'STRAIGHT_4'
  | 'FOUR_OF_A_KIND'
  | 'STRAIGHT_5'
  | 'FIVE_OF_A_KIND';

export type ObjectiveRuleType =
  | 'MIN_DISTINCT_CLASSES'
  | 'MIN_SAME_CLASS'
  | 'MIN_TOTAL_COST'
  | 'FORBID_COST'
  | 'ALL_EFFECT_TYPES'
  | 'MAX_CLASS_COUNT';

export interface ObjectiveCard {
  id: string;
  title: string;
  description: string;
  ruleType: ObjectiveRuleType;
  targetNumber: number;
  targetClass?: string;
}

export interface GameConfig {
  // Confermati / Struttura base
  minPlayers: number;
  maxPlayers: number;
  allow2PlayersTestMode: boolean;

  // Draft & Spacchettamento iniziale
  packsPerPlayer: number; // Default: 2 pacchetti
  cardsPerPack: number;   // Default: 5 carte per pacchetto (10 totali)
  teamSize: number;       // Default: 4 titolari
  reserveSize: number;    // Default: 2 riserve nel Mercato

  // Opzioni "In forse e da definire" dal GDD
  startingTokens: number; // Proposta GDD: 3
  maxRollsPerTurn: number; // Default GDD: 3
  paidExtraRollEnabled: boolean; // In forse: pagare 1 gettone per un 4° tiro
  paidExtraRollCost: number;
  uniquePersonPerTeam: boolean; // Una sola versione per persona in squadra
  objectiveVisibility: 'SECRET' | 'PUBLIC'; // Coperto (default) o scoperto
  marketSwapCost: number; // Prezzo scambio col Mercato
  marketSwapTiming: 'FREE_IN_TURN' | 'REPLACES_MAIN_ACTION'; // Momento del turno
  tradeRequiresCardSwap: boolean; // Chi vende riceve una carta non giocata in cambio
  onObjectiveMismatch: 'ALLOW_RETURN_TO_HAND' | 'ALLOW_MARKET_SWAP' | 'NONE';
  enableCardEffects: boolean; // Permette di testare sia con effetti attivi sia solo motore base

  // Tabella combinazioni per costo (2..6)
  costCombinationsTable: Record<number, DiceComboId[]>;
}

export interface PlayerActiveModifiers {
  nextCardDiscount: number;
  hasJokerDieNextRoll: boolean;
  maxRollsOverrideNextTurn: number | null;
  comboTierOffsetFromBoss: number; // +1 se bersagliato da "Il Boss"
  bossSourceCardId?: string;
}

export interface PlayerState {
  id: string;
  name: string;
  isHost: boolean;
  isBot: boolean;
  connected: boolean;
  tokens: number;

  // Fase Spacchettamento / Draft (2 pacchetti da 5 carte)
  unopenedPacks: CardData[][]; // Array di pacchetti (ciascuno con 5 carte)
  pulledPool: CardData[];      // Le 10 carte trovate nei pacchetti
  selectedStarterIds: string[]; // 4 ID scelti come titolari
  selectedReserveIds: string[]; // 2 ID scelti come riserve per il Mercato
  draftReady: boolean;

  // Fase Partita
  hand: CardData[];            // Carte titolari coperte (non ancora giocate)
  played: CardData[];          // Carte giocate scoperte davanti a sé
  objectiveCandidates: ObjectiveCard[]; // Le 2 carte Obiettivo pescate a inizio partita
  objective: ObjectiveCard | null;      // L'Obiettivo scelto
  modifiers: PlayerActiveModifiers;
}

export interface PendingTradeOffer {
  id: string;
  fromPlayerId: string;
  toPlayerId: string;
  offeredTokens: number;
  targetCardId?: string; // Se vuoto, chiede una carta a scelta o specifica
  offeredSwapCardId: string; // La carta non giocata ceduta in cambio
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
}

export interface PendingDraftTradeOffer {
  id: string;
  fromPlayerId: string;
  toPlayerId: string;
  fromCardId: string;
  toCardId: string;
}

export interface PendingEffectPrompt {
  sourcePlayerId: string;
  sourceCard: CardData;
  effectTemplateId: EffectTemplateId;
  description: string;
}

export interface MoveLogEntry {
  id: string;
  turnNumber: number;
  timestamp: number;
  playerId: string;
  playerName: string;
  actionType: string;
  message: string;
}

export type GamePhase =
  | 'LOBBY'
  | 'PACK_OPENING'
  | 'OBJECTIVE_PICK'
  | 'PLAYING'
  | 'GAME_OVER';

export type TurnStep = 'ROLLING' | 'ACTION_DECISION' | 'POST_ACTION';

export interface GameState {
  roomCode: string;
  phase: GamePhase;
  config: GameConfig;
  catalog: CardData[];
  objectivesDeck: ObjectiveCard[];

  players: PlayerState[];
  market: CardData[]; // Carte di riserva scoperte al centro

  // Stato del turno corrente
  turnNumber: number;
  currentPlayerIndex: number;
  turnStep: TurnStep;
  dice: number[];          // 5 dadi (valori 1..6)
  keptDice: boolean[];     // 5 flag per tenere i dadi
  rollsLeft: number;
  hasUsedMarketThisTurn: boolean;
  hasMadeTradeOfferThisTurn: boolean;
  mainActionTaken: boolean;

  // Effetti globali temporanei (es. "Quello che si addormenta sul divano": 4 dadi per 1 giro)
  globalFourDiceUntilPlayerId: string | null;

  // Trattative / Offerte in corso
  pendingTradeOffer: PendingTradeOffer | null;
  pendingDraftTrades: PendingDraftTradeOffer[];

  // Vincitore
  winnerPlayerId: string | null;
  actionLog: MoveLogEntry[];
}

export type GameAction =
  | { type: 'UPDATE_CONFIG'; config: Partial<GameConfig> }
  | { type: 'UPDATE_CATALOG'; catalog: CardData[] }
  | { type: 'ADD_PLAYER'; id: string; name: string; isHost?: boolean; isBot?: boolean }
  | { type: 'REMOVE_PLAYER'; playerId: string }
  | { type: 'START_PACK_OPENING' }
  | { type: 'OPEN_NEXT_PACK'; playerId: string }
  | { type: 'PROPOSE_DRAFT_TRADE'; fromPlayerId: string; toPlayerId: string; fromCardId: string; toCardId: string }
  | { type: 'ACCEPT_DRAFT_TRADE'; tradeId: string }
  | { type: 'REJECT_DRAFT_TRADE'; tradeId: string }
  | { type: 'TOGGLE_DRAFT_SELECTION'; playerId: string; cardId: string; role: 'STARTER' | 'RESERVE' }
  | { type: 'AUTO_SELECT_DRAFT'; playerId: string }
  | { type: 'CONFIRM_DRAFT_TEAM'; playerId: string }
  | { type: 'PICK_OBJECTIVE'; playerId: string; objectiveId: string }
  | { type: 'ROLL_DICE'; playerId: string }
  | { type: 'BUY_EXTRA_ROLL'; playerId: string }
  | { type: 'TOGGLE_KEEP_DIE'; playerId: string; dieIndex: number }
  | { type: 'SET_JOKER_DIE_VALUE'; playerId: string; dieIndex: number; value: number }
  | { type: 'CASH_IN_DICE'; playerId: string }
  | {
      type: 'PLAY_CARD';
      playerId: string;
      cardId: string;
      targetPlayerId?: string;
      targetPlayedCardId?: string;
      ownSwapCardId?: string;
    }
  | { type: 'MARKET_SWAP'; playerId: string; handCardId: string; marketCardId: string }
  | {
      type: 'OFFER_PLAYER_TRADE';
      fromPlayerId: string;
      toPlayerId: string;
      offeredTokens: number;
      offeredSwapCardId: string;
      targetCardId?: string;
    }
  | { type: 'RESPOND_PLAYER_TRADE'; accept: boolean; chosenTargetCardId?: string }
  | { type: 'RETURN_MISMATCHED_CARD_TO_HAND'; playerId: string; playedCardId: string }
  | { type: 'END_TURN'; playerId: string }
  | { type: 'RESET_TO_LOBBY' };
