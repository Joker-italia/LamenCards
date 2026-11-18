import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_CARDS, DEFAULT_GAME_CONFIG } from '../../data/defaultData';
import { executeBotTurnStep } from '../../engine/botSimulator';
import {
  applyGameAction,
  createInitialGameState,
} from '../../engine/gameEngine';
import {
  CardData,
  GameAction,
  GameConfig,
  GameState,
  PlayerState,
} from '../../engine/types';
import { P2PRoomManager } from '../../network/p2pRoom';
import {
  generateSafeRoomCode,
  getOrCreateDevicePlayerId,
  STORAGE_CARDS_KEY,
  STORAGE_CONFIG_KEY,
  STORAGE_PLAYER_NAME_KEY,
} from '../hooks/useLocalStorage';

export type TurnUiStage = 'DICE_STAGE' | 'HAND_STAGE';

export interface GameContextValue {
  myPlayerId: string;
  myPlayerName: string;
  setMyPlayerName: (name: string) => void;
  catalog: CardData[];
  savedConfig: GameConfig;
  inRoom: boolean;
  roomRole: 'HOST' | 'CLIENT';
  joinCodeInput: string;
  setJoinCodeInput: (code: string) => void;
  netStatus: string;
  gameState: GameState;
  me: PlayerState | undefined;
  activePlayer: PlayerState | undefined;
  isMyTurn: boolean;
  turnUiStage: TurnUiStage;
  setTurnUiStage: (stage: TurnUiStage) => void;

  // Modals & Drawers
  showCardEditor: boolean;
  setShowCardEditor: (v: boolean) => void;
  showRulesModal: boolean;
  setShowRulesModal: (v: boolean) => void;
  showReferenceModal: boolean;
  setShowReferenceModal: (v: boolean) => void;
  showMarketDrawer: boolean;
  setShowMarketDrawer: (v: boolean) => void;
  showLogDrawer: boolean;
  setShowLogDrawer: (v: boolean) => void;
  showTradeModal: boolean;
  setShowTradeModal: (v: boolean) => void;
  showObjectiveModal: boolean;
  setShowObjectiveModal: (v: boolean) => void;

  // Actions
  dispatchGameAction: (action: GameAction) => void;
  handleCreateHostRoom: () => void;
  handleJoinRoomAsClient: (explicitCode?: string) => void;
  handleLeaveRoom: () => void;
  handleSaveCatalog: (newCatalog: CardData[]) => void;
  handleSaveConfig: (newConfig: GameConfig) => void;
  shareInviteLink: () => Promise<string>;
}

const GameContext = createContext<GameContextValue | null>(null);

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [myPlayerId] = useState<string>(() => getOrCreateDevicePlayerId());
  const [myPlayerName, setMyPlayerName] = useState<string>(
    () => localStorage.getItem(STORAGE_PLAYER_NAME_KEY) || ''
  );

  const [catalog, setCatalog] = useState<CardData[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_CARDS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length >= 8) return parsed;
      }
    } catch {
      // fallback
    }
    return DEFAULT_CARDS;
  });

  const [savedConfig, setSavedConfig] = useState<GameConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_CONFIG_KEY);
      if (saved) return { ...DEFAULT_GAME_CONFIG, ...JSON.parse(saved) };
    } catch {
      // fallback
    }
    return DEFAULT_GAME_CONFIG;
  });

  const [inRoom, setInRoom] = useState<boolean>(false);
  const [roomRole, setRoomRole] = useState<'HOST' | 'CLIENT'>('HOST');
  const [joinCodeInput, setJoinCodeInput] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    return (params.get('room') || '').toUpperCase();
  });
  const [netStatus, setNetStatus] = useState<string>('Pronto');

  const [gameState, setGameState] = useState<GameState>(() =>
    createInitialGameState('LAMEN', catalog, savedConfig)
  );

  const [turnUiStage, setTurnUiStage] = useState<TurnUiStage>('DICE_STAGE');

  const [showCardEditor, setShowCardEditor] = useState<boolean>(false);
  const [showRulesModal, setShowRulesModal] = useState<boolean>(false);
  const [showReferenceModal, setShowReferenceModal] = useState<boolean>(false);
  const [showMarketDrawer, setShowMarketDrawer] = useState<boolean>(false);
  const [showLogDrawer, setShowLogDrawer] = useState<boolean>(false);
  const [showTradeModal, setShowTradeModal] = useState<boolean>(false);
  const [showObjectiveModal, setShowObjectiveModal] = useState<boolean>(false);

  const roomManagerRef = useRef<P2PRoomManager | null>(null);

  const dispatchGameAction = (action: GameAction) => {
    if (!inRoom || roomRole === 'HOST') {
      setGameState((prev) => {
        const next = applyGameAction(prev, action);
        roomManagerRef.current?.broadcastStateFromHost(next);
        return next;
      });
    } else {
      roomManagerRef.current?.sendActionFromClient(action);
    }
  };

  // Gestione automatica delle mosse e risposte dei Bot lato Host
  useEffect(() => {
    if (!inRoom || roomRole !== 'HOST') return;
    if (gameState.phase !== 'PLAYING') return;

    const activePlayer = gameState.players[gameState.currentPlayerIndex];
    const pendingChooser = gameState.pendingChoice
      ? gameState.players.find((p) => p.id === gameState.pendingChoice?.playerId)
      : null;
    const tradeSeller =
      gameState.pendingTradeOffer && gameState.pendingTradeOffer.status === 'PENDING'
        ? gameState.players.find((p) => p.id === gameState.pendingTradeOffer?.toPlayerId)
        : null;

    const shouldBotAct =
      Boolean(pendingChooser?.isBot) ||
      Boolean(tradeSeller?.isBot) ||
      Boolean(!gameState.pendingChoice && !gameState.pendingTradeOffer && activePlayer?.isBot);

    if (!shouldBotAct) return;

    const timer = setTimeout(() => {
      setGameState((prev) => {
        const next = executeBotTurnStep(prev);
        roomManagerRef.current?.broadcastStateFromHost(next);
        return next;
      });
    }, 620);

    return () => clearTimeout(timer);
  }, [
    inRoom,
    roomRole,
    gameState.phase,
    gameState.currentPlayerIndex,
    gameState.turnStep,
    gameState.rollsLeft,
    gameState.mainActionTaken,
    gameState.pendingChoice,
    gameState.pendingTradeOffer,
    gameState.players,
  ]);

  const me = useMemo(
    () => gameState.players.find((p) => p.id === myPlayerId) || gameState.players[0],
    [gameState.players, myPlayerId]
  );

  const activePlayer = gameState.players[gameState.currentPlayerIndex];
  const isMyTurn = Boolean(me && activePlayer && me.id === activePlayer.id);

  // Sincronizza la vista Fase 1 (Lancio Dadi) / Fase 2 (Mano di Carte)
  const prevTurnKeyRef = useRef<string>('');
  useEffect(() => {
    const turnKey = `${gameState.turnNumber}-${gameState.currentPlayerIndex}`;
    if (turnKey !== prevTurnKeyRef.current) {
      prevTurnKeyRef.current = turnKey;
      if (isMyTurn) {
        setTurnUiStage('DICE_STAGE');
      }
    }
  }, [gameState.turnNumber, gameState.currentPlayerIndex, isMyTurn]);

  useEffect(() => {
    if (
      isMyTurn &&
      (gameState.turnStep === 'ACTION_DECISION' ||
        gameState.turnStep === 'POST_ACTION' ||
        gameState.mainActionTaken ||
        me?.modifiers.canPlayExtraCardWithoutCombo)
    ) {
      setTurnUiStage('HAND_STAGE');
    }
  }, [
    isMyTurn,
    gameState.turnStep,
    gameState.mainActionTaken,
    me?.modifiers.canPlayExtraCardWithoutCombo,
  ]);

  const handleCreateHostRoom = () => {
    const cleanName = myPlayerName.trim() || 'Capitano (Host)';
    setMyPlayerName(cleanName);
    localStorage.setItem(STORAGE_PLAYER_NAME_KEY, cleanName);
    const code = generateSafeRoomCode();

    let initial = createInitialGameState(code, catalog, savedConfig);
    initial = applyGameAction(initial, {
      type: 'ADD_PLAYER',
      id: myPlayerId,
      name: cleanName,
      isHost: true,
    });

    setGameState(initial);
    setRoomRole('HOST');
    setInRoom(true);

    roomManagerRef.current?.destroy();
    const manager = new P2PRoomManager('HOST', code, {
      onStatusChange: (_st, detail) => setNetStatus(detail || 'Stanza P2P attiva'),
      onClientJoin: (clientId, clientName) => {
        setGameState((prev) => {
          const next = applyGameAction(prev, {
            type: 'ADD_PLAYER',
            id: clientId,
            name: clientName,
            isHost: false,
          });
          manager.broadcastStateFromHost(next);
          return next;
        });
      },
      onClientAction: (clientAction) => {
        setGameState((prev) => {
          const next = applyGameAction(prev, clientAction);
          manager.broadcastStateFromHost(next);
          return next;
        });
      },
    });

    roomManagerRef.current = manager;
    manager.start(myPlayerId, cleanName);
    manager.broadcastStateFromHost(initial);
  };

  const handleJoinRoomAsClient = (explicitCode?: string) => {
    const code = (explicitCode ?? joinCodeInput).trim().toUpperCase();
    if (!code) {
      alert('Inserisci il Codice Stanza comunicato dall’Host!');
      return;
    }
    const cleanName = myPlayerName.trim() || `Amico ${myPlayerId.slice(-3)}`;
    setMyPlayerName(cleanName);
    localStorage.setItem(STORAGE_PLAYER_NAME_KEY, cleanName);

    setRoomRole('CLIENT');
    setInRoom(true);

    roomManagerRef.current?.destroy();
    const manager = new P2PRoomManager('CLIENT', code, {
      onStatusChange: (_st, detail) => setNetStatus(detail || `Connesso a ${code}`),
      onStateSync: (syncedState) => {
        setGameState(syncedState);
      },
    });
    roomManagerRef.current = manager;
    manager.start(myPlayerId, cleanName);
  };

  const handleLeaveRoom = () => {
    roomManagerRef.current?.destroy();
    roomManagerRef.current = null;
    setInRoom(false);
  };

  const handleSaveCatalog = (newCatalog: CardData[]) => {
    setCatalog(newCatalog);
    localStorage.setItem(STORAGE_CARDS_KEY, JSON.stringify(newCatalog));
    if (inRoom && roomRole === 'HOST') {
      dispatchGameAction({ type: 'UPDATE_CATALOG', catalog: newCatalog });
    }
  };

  const handleSaveConfig = (newConfig: GameConfig) => {
    setSavedConfig(newConfig);
    localStorage.setItem(STORAGE_CONFIG_KEY, JSON.stringify(newConfig));
    if (inRoom && roomRole === 'HOST') {
      dispatchGameAction({ type: 'UPDATE_CONFIG', config: newConfig });
    }
  };

  const shareInviteLink = async (): Promise<string> => {
    const url = `${window.location.origin}${window.location.pathname}?room=${gameState.roomCode}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Entra nella stanza LAMENCARDS (${gameState.roomCode})!`,
          text: `Unisciti alla partita di LAMENCARDS! Codice stanza: ${gameState.roomCode}`,
          url,
        });
        return url;
      }
    } catch {
      // fallback to clipboard
    }
    await navigator.clipboard?.writeText(url);
    return url;
  };

  return (
    <GameContext.Provider
      value={{
        myPlayerId,
        myPlayerName,
        setMyPlayerName,
        catalog,
        savedConfig,
        inRoom,
        roomRole,
        joinCodeInput,
        setJoinCodeInput,
        netStatus,
        gameState,
        me,
        activePlayer,
        isMyTurn,
        turnUiStage,
        setTurnUiStage,
        showCardEditor,
        setShowCardEditor,
        showRulesModal,
        setShowRulesModal,
        showReferenceModal,
        setShowReferenceModal,
        showMarketDrawer,
        setShowMarketDrawer,
        showLogDrawer,
        setShowLogDrawer,
        showTradeModal,
        setShowTradeModal,
        showObjectiveModal,
        setShowObjectiveModal,
        dispatchGameAction,
        handleCreateHostRoom,
        handleJoinRoomAsClient,
        handleLeaveRoom,
        handleSaveCatalog,
        handleSaveConfig,
        shareInviteLink,
      }}
    >
      {children}
    </GameContext.Provider>
  );
};

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) {
    throw new Error('useGame deve essere usato dentro <GameProvider>');
  }
  return ctx;
}
