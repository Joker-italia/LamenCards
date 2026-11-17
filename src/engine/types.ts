export type CardClass = 'Dormienti' | 'Utenti' | 'Festaioli' | 'Scrocconi' | string;

export type CardRarity = 'Comune' | 'Rara' | 'PROMO';

export type EffectCategory = 'Aiuto' | 'Ostacolo' | 'Caos';

export type EffectTiming = 'ON_ENTER' | 'WHILE_IN_PLAY' | 'PASSIVE_NONE';

export type EffectTemplateId =
  | 'NONE'
  | 'GAIN_TOKENS'
  | 'STEAL_TOKENS'
  | 'LOSE_TARGET_TOKENS'
  | 'CASH_IN_BONUS'
  | 'SET_TARGET_NEXT_ROLLS'
  | 'GAIN_TOKENS_AND_NEXT_ROLLS'
  | 'PROTECT_FROM_BUY_AND_BOUNCE'
  | 'OTHERS_FOUR_DICE_ONE_ROUND'
  | 'SKIP_TARGET_NEXT_TURN'
  | 'TURN_START_GAIN_TOKENS'
  | 'GAMBLE_DICE_SWAP'
  | 'ROLL_2D6_JACKPOT_TOKENS'
  | 'ALL_ROLL_LOWEST_LOSES_TOKENS'
  | 'FLIP_DIE_OPPOSITE_ONCE_PER_TURN'
  | 'PASS_UNPLAYED_LEFT'
  | 'FORBID_TARGET_PLAY_NEXT_TURN'
  | 'INVERT_COMBO_TABLE_ONE_ROUND'
  | 'ALL_GAIN_TOKENS_SELF_MORE'
  | 'NO_COMBO_ALTERNATE_COST'
  | 'GAIN_TOKENS_AND_FREE_MARKET'
  | 'OTHERS_PAY_TOKEN_OR_4_DICE'
  | 'ON_OTHER_PLAY_GAIN_TOKEN'
  | 'ALL_FREE_MARKET_SWAP'
  | 'PLAY_EXTRA_CARD_NO_COMBO'
  | 'DISCOUNT_COST_AND_COMBO_TIER'
  | 'BORROW_TOKENS_REPAY_NEXT_TURN'
  | 'FREE_IMMEDIATE_MARKET_SWAP'
  | 'LEFT_NEIGHBOR_CASH_IN_BONUS'
  | 'PEEK_OBJECTIVE_AND_STEAL'
  | 'RETURN_PLAYED_CARD'
  | 'TURN_START_STEAL_FROM_RICHEST';

export interface EffectModel {
  templateId: EffectTemplateId;
  timing: EffectTiming;
  value?: number;
  secondaryValue?: number;
  requiresTargetPlayer?: boolean;
}

export interface CardData {
  id: string;
  baseCardId?: string; // ID univoco del modello carta (per regola blocco personaggi doppi)
  setNumber: number;
  personName: string; // Nome dell'amico (es. "Giorgio", "Mariong")
  name: string;       // Titolo della carta (es. "Il Pisolino", "Giorgio, abile giocatore di carte")
  version: string;    // Eventuale versione o sottotitolo
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
  | 'MAX_RARITY_COUNT';

export interface ObjectiveCard {
  id: string;
  title: string;
  description: string;
  ruleType: ObjectiveRuleType;
  targetNumber: number;
  targetClass?: string;
  targetRarity?: CardRarity;
}

export interface GameConfig {
  minPlayers: number;
  maxPlayers: number;
  allow2PlayersTestMode: boolean;

  // Draft & Spacchettamento iniziale (2 bustine da 5 carte: 1 per classe + 1 jolly)
  packsPerPlayer: number;
  cardsPerPack: number;
  teamSize: number;
  reserveSize: number;

  // Regole "In forse e da definire" & Watchlist GDD
  startingTokens: number; // Proposta GDD: 3
  maxRollsPerTurn: number; // Default GDD: 3
  paidExtraRollEnabled: boolean; // In forse: pagare 1 gettone per un 4° tiro
  paidExtraRollCost: number;
  cashInHighFaces: 'FIVE_AND_SIX' | 'ONLY_SIX'; // GDD p.11: se troppo veloce, dare +1 solo sui 6
  uniquePersonPerTeam: boolean; // In una squadra può entrare una sola versione per persona
  blockDuplicateCardsInPlay: boolean; // Il primo che gioca una carta la blocca per gli altri
  blockAllVersionsOfSamePersonInPlay: boolean; // Se il blocco vale solo per la stessa carta o per la stessa persona
  objectiveVisibility: 'SECRET' | 'PUBLIC';
  marketSwapCost: number;
  marketSwapTiming: 'FREE_IN_TURN' | 'REPLACES_MAIN_ACTION';
  tradeRequiresCardSwap: boolean;
  onObjectiveMismatch: 'ALLOW_RETURN_TO_HAND' | 'NONE';
  enableCardEffects: boolean;

  // Tabella combinazioni per costo (2..6)
  costCombinationsTable: Record<number, DiceComboId[]>;
}

export interface RepayDebtEntry {
  toPlayerId: string;
  amount: number;
}

export interface PlayerActiveModifiers {
  nextCardDiscount: number;
  freeMarketSwapsCount: number;
  canPlayExtraCardWithoutCombo: boolean;
  maxRollsOverrideNextTurn: number | null;
  diceCountOverrideNextTurn: number | null;
  skipNextTurn: boolean;
  forbidPlayNextTurn: boolean;
  usedLuckyDieFlipThisTurn: boolean;
  animaFestaTriggersThisRound: number;
  repayDebtsNextTurn: RepayDebtEntry[];
  revealedObjectivePlayerIds: string[]; // Giocatori spiati con "Il Ficcanaso"
}

export interface PlayerState {
  id: string;
  name: string;
  isHost: boolean;
  isBot: boolean;
  connected: boolean;
  tokens: number;

  // Fase Spacchettamento / Draft (2 pacchetti da 5 carte)
  unopenedPacks: CardData[][];
  pulledPool: CardData[];
  selectedStarterIds: string[];
  selectedReserveIds: string[];
  draftReady: boolean;

  // Fase Partita
  hand: CardData[];
  played: CardData[];
  objectiveCandidates: ObjectiveCard[];
  objective: ObjectiveCard | null;
  modifiers: PlayerActiveModifiers;
}

export interface PendingTradeOffer {
  id: string;
  fromPlayerId: string;
  toPlayerId: string;
  offeredTokens: number;
  targetCardId?: string;
  offeredSwapCardId: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
}

export interface PendingDraftTradeOffer {
  id: string;
  fromPlayerId: string;
  toPlayerId: string;
  fromCardId: string;
  toCardId: string;
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
  market: CardData[];

  // Stato del turno corrente
  turnNumber: number;
  currentPlayerIndex: number;
  turnStep: TurnStep;
  dice: number[];
  keptDice: boolean[];
  rollsLeft: number;
  hasUsedMarketThisTurn: boolean;
  hasMadeTradeOfferThisTurn: boolean;
  mainActionTaken: boolean;

  // Effetti globali per 1 giro
  othersFourDiceUntilPlayerId: string | null; // "Sonno Contagioso": tutti gli altri tirano con 4 dadi fino al tuo prossimo turno
  invertComboTableUntilPlayerId: string | null; // "Il Trip": scambia combinazioni 2<->6 e 3<->5 fino al tuo prossimo turno

  pendingTradeOffer: PendingTradeOffer | null;
  pendingDraftTrades: PendingDraftTradeOffer[];

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
  | { type: 'FLIP_DIE_OPPOSITE'; playerId: string; dieIndex: number }
  | { type: 'CASH_IN_DICE'; playerId: string }
  | {
      type: 'PLAY_CARD';
      playerId: string;
      cardId: string;
      targetPlayerId?: string;
      targetPlayedCardId?: string;
      useNoComboAlternateCost?: boolean;
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
