export type CardClass = 'Dormienti' | 'Utenti' | 'Festaioli' | 'Scrocconi' | string;

export type CardRarity = 'Comune' | 'Rara' | 'PROMO';

export type EffectCategory = 'Aiuto' | 'Ostacolo' | 'Caos';

export type EffectTiming = 'ON_ENTER' | 'WHILE_IN_PLAY' | 'PASSIVE_NONE';

export type EffectTargetType =
  | 'NONE'
  | 'SELF'
  | 'CHOSEN_PLAYER'
  | 'ALL_PLAYERS'
  | 'ALL_OTHERS'
  | 'LEFT_NEIGHBOR'
  | 'RICHEST_OPPONENT';

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

export interface EffectModelParams {
  amount?: number;
  secondaryAmount?: number;
  target?: EffectTargetType;
  maxCardCost?: number;
  maxTriggersPerRound?: number;
  alternateCost?: number;
}

export interface EffectModel {
  templateId: EffectTemplateId;
  timing: EffectTiming;
  category?: EffectCategory;
  value?: number;
  secondaryValue?: number;
  requiresTargetPlayer?: boolean;
  target?: EffectTargetType;
  params?: EffectModelParams;
}

export interface EffectModelDefinition {
  templateId: EffectTemplateId;
  label: string;
  description: string;
  timing: EffectTiming;
  defaultCategory: EffectCategory;
  target: EffectTargetType;
  requiresTargetPlayer: boolean;
  hasPrimaryValue: boolean;
  primaryValueLabel?: string;
  defaultPrimaryValue?: number;
  hasSecondaryValue: boolean;
  secondaryValueLabel?: string;
  defaultSecondaryValue?: number;
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

export type MarketSwapTiming =
  | 'FREE_IN_TURN'
  | 'REPLACES_MAIN_ACTION'
  | 'BEFORE_ROLL'
  | 'AFTER_ACTION'
  | 'ANYTIME_IN_TURN';

export type CashInMode = 'FIVE_AND_SIX' | 'ONLY_SIX' | 'SIX_ONLY';

export type BlockScope = 'SAME_CARD' | 'SAME_PERSON';

export type ObjectiveChangePolicy = 'ALLOW_RETURN_TO_HAND' | 'NONE';

export type RichestTiePolicy = 'FIRST_CLOCKWISE' | 'CHOOSE';

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
  extraPaidRoll?: boolean; // Alias canonico Step 3 per paidExtraRollEnabled
  paidExtraRollCost: number;
  cashInHighFaces: CashInMode; // GDD p.11: se troppo veloce, dare +1 solo sui 6
  cashInMode?: 'FIVE_AND_SIX' | 'SIX_ONLY'; // Alias canonico Step 3
  uniquePersonPerTeam: boolean; // In una squadra può entrare una sola versione per persona
  allowMultipleVersionsSamePerson?: boolean; // Alias canonico Step 3 (!uniquePersonPerTeam)
  blockDuplicateCardsInPlay: boolean; // Il primo che gioca una carta la blocca per gli altri
  blockAllVersionsOfSamePersonInPlay: boolean; // Se il blocco vale solo per la stessa carta o per la stessa persona
  blockScope?: BlockScope; // Alias canonico Step 3 ('SAME_CARD' | 'SAME_PERSON')
  objectiveVisibility: 'SECRET' | 'PUBLIC';
  objectiveHidden?: boolean; // Alias canonico Step 3 (objectiveVisibility === 'SECRET')
  marketSwapCost: number;
  marketSwapPrice?: number; // Alias canonico Step 3 per marketSwapCost
  marketSwapTiming: MarketSwapTiming;
  marketSwapConsumesAction?: boolean; // Se true, lo scambio col Mercato consuma l'azione principale del turno
  tradeRequiresCardSwap: boolean;
  tradeRequiresCardBack?: boolean; // Alias canonico Step 3 per tradeRequiresCardSwap
  onObjectiveMismatch: ObjectiveChangePolicy;
  objectiveChangePolicy?: ObjectiveChangePolicy; // Alias canonico Step 3
  enableCardEffects: boolean;
  richestTiePolicy?: RichestTiePolicy; // Gestione pareggio per "Il Mantenuto"
  seed?: number; // Seed opzionale per il PRNG deterministico

  // Tabella combinazioni per costo (2..6)
  costCombinationsTable: Record<number, DiceComboId[]>;
  comboTable?: Record<number, DiceComboId[]>; // Alias canonico Step 3
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

export interface ComputedPlayerModifiers {
  protectedFromBuyAndBounce: boolean;
  hasFlipDieOpposite: boolean;
  costDiscount: number;
  comboTierDiscount: number;
  cashInBonus: number;
  turnStartGainTokens: number;
  turnStartStealFromRichest: number;
  onOtherPlayGainToken: Array<{ cardName: string; gain: number; maxPerRound: number }>;
  leftNeighborCashInBonus: Array<{ cardName: string; bonus: number }>;
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
  handCount?: number; // Popolato in getPublicStateFor quando la mano è coperta
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

export type PendingChoiceType =
  | 'CHOOSE_TARGET_PLAYER'
  | 'CHOOSE_TARGET_PLAYED_CARD'
  | 'GIORGIO_SWAP_CHOICE'
  | 'PASS_CARD_LEFT'
  | 'PAY_TOKEN_OR_FOUR_DICE'
  | 'FREE_MARKET_SWAP'
  | 'CHOOSE_RICHEST_TIE';

export interface PendingChoiceOption {
  id: string;
  label: string;
  targetPlayerId?: string;
  cardId?: string;
  marketCardId?: string;
  targetPlayedCardId?: string;
  decision?: 'PAY_TOKEN' | 'FOUR_DICE' | 'SKIP';
}

export interface PendingChoice {
  id: string;
  type: PendingChoiceType;
  playerId: string;         // Giocatore che deve compiere la scelta ora
  sourcePlayerId: string;   // Giocatore che ha attivato l'effetto
  sourceCardId: string;
  sourceCardName: string;
  templateId: EffectTemplateId;
  promptText: string;       // Testo mostrato a chi deve scegliere
  publicMessage: string;    // Testo visibile pubblicamente agli altri giocatori durante l'attesa
  options: PendingChoiceOption[];
  eligibleTargetPlayerIds?: string[];
  eligibleHandCardIds?: string[];
  eligibleMarketCardIds?: string[];
  eligiblePlayedCards?: Array<{ playerId: string; playerName: string; card: CardData }>;
  maxCardCost?: number;
  tokenAmount?: number;
  secondaryAmount?: number;
}

export interface PublicEffectDiceRoll {
  id: string;
  turnNumber: number;
  cardName: string;
  sourcePlayerId: string;
  rolls: Array<{ playerId: string; playerName: string; dice: number[] }>;
  summary: string;
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

  // Stato PRNG deterministico (Step 1)
  rngSeed: number;
  rngState: number;
  nextIdCounter: number;

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

  // Scelte interattive in sospeso per effetti carte (Step 2)
  pendingChoice: PendingChoice | null;
  pendingChoicesQueue?: PendingChoice[];
  pendingPassLeftSelections?: Record<string, string>;
  lastEffectDiceRolls?: PublicEffectDiceRoll[];

  pendingTradeOffer: PendingTradeOffer | null;
  pendingDraftTrades: PendingDraftTradeOffer[];

  winnerPlayerId: string | null;
  actionLog: MoveLogEntry[];
}

export type GameAction =
  | { type: 'UPDATE_CONFIG'; config: Partial<GameConfig>; timestamp?: number }
  | { type: 'UPDATE_CATALOG'; catalog: CardData[]; timestamp?: number }
  | { type: 'ADD_PLAYER'; id: string; name: string; isHost?: boolean; isBot?: boolean; timestamp?: number }
  | { type: 'REMOVE_PLAYER'; playerId: string; timestamp?: number }
  | { type: 'START_PACK_OPENING'; timestamp?: number }
  | { type: 'OPEN_NEXT_PACK'; playerId: string; timestamp?: number }
  | {
      type: 'PROPOSE_DRAFT_TRADE';
      fromPlayerId: string;
      toPlayerId: string;
      fromCardId: string;
      toCardId: string;
      timestamp?: number;
    }
  | { type: 'ACCEPT_DRAFT_TRADE'; tradeId: string; timestamp?: number }
  | { type: 'REJECT_DRAFT_TRADE'; tradeId: string; timestamp?: number }
  | { type: 'TOGGLE_DRAFT_SELECTION'; playerId: string; cardId: string; role: 'STARTER' | 'RESERVE'; timestamp?: number }
  | { type: 'AUTO_SELECT_DRAFT'; playerId: string; timestamp?: number }
  | { type: 'CONFIRM_DRAFT_TEAM'; playerId: string; timestamp?: number }
  | { type: 'PICK_OBJECTIVE'; playerId: string; objectiveId: string; timestamp?: number }
  | { type: 'ROLL_DICE'; playerId: string; timestamp?: number }
  | { type: 'BUY_EXTRA_ROLL'; playerId: string; timestamp?: number }
  | { type: 'TOGGLE_KEEP_DIE'; playerId: string; dieIndex: number; timestamp?: number }
  | { type: 'FLIP_DIE_OPPOSITE'; playerId: string; dieIndex: number; timestamp?: number }
  | { type: 'CONFIRM_DICE_ROLL'; playerId: string; timestamp?: number }
  | { type: 'CASH_IN_DICE'; playerId: string; timestamp?: number }
  | {
      type: 'PLAY_CARD';
      playerId: string;
      cardId: string;
      targetPlayerId?: string;
      targetPlayedCardId?: string;
      handCardId?: string;
      useNoComboAlternateCost?: boolean;
      timestamp?: number;
    }
  | {
      type: 'RESOLVE_PENDING_CHOICE';
      playerId: string;
      choiceId?: string;
      optionId?: string;
      targetPlayerId?: string;
      cardId?: string;
      marketCardId?: string;
      targetPlayedCardId?: string;
      decision?: 'PAY_TOKEN' | 'FOUR_DICE' | 'SKIP';
      timestamp?: number;
    }
  | { type: 'MARKET_SWAP'; playerId: string; handCardId: string; marketCardId: string; timestamp?: number }
  | {
      type: 'OFFER_PLAYER_TRADE';
      fromPlayerId: string;
      toPlayerId: string;
      offeredTokens: number;
      offeredSwapCardId?: string;
      targetCardId?: string;
      timestamp?: number;
    }
  | { type: 'RESPOND_PLAYER_TRADE'; playerId?: string; accept: boolean; chosenTargetCardId?: string; timestamp?: number }
  | { type: 'RETURN_MISMATCHED_CARD_TO_HAND'; playerId: string; playedCardId: string; timestamp?: number }
  | { type: 'END_TURN'; playerId: string; timestamp?: number }
  | { type: 'RESET_TO_LOBBY'; timestamp?: number };

export type ActionValidationResult =
  | { ok: true }
  | { ok: false; reason: string };

export interface PlayableCardInfo {
  card: CardData;
  playable: boolean;
  canPlayStandard: boolean;
  canPlayNoComboAlt: boolean;
  effectiveCost: number;
  altCost: number;
  requiredCombos: DiceComboId[];
  effectiveTier: number;
  blocked: boolean;
  blockedByOwner?: string;
  reason?: string;
}
