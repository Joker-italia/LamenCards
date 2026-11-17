import React, { useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_CARDS, DEFAULT_GAME_CONFIG } from './data/defaultData';
import { executeBotTurnStep } from './engine/botSimulator';
import {
  calculateCashInTokens,
  canDiceSatisfyCardCost,
  COMBO_LABELS_IT,
  evaluateDiceCombos,
} from './engine/dice';
import { applyGameAction, createInitialGameState } from './engine/gameEngine';
import { evaluateObjective } from './engine/objectives';
import { CardData, GameAction, GameConfig, GameState } from './engine/types';
import { P2PRoomManager } from './network/p2pRoom';
import { CardComponent } from './ui/components/CardComponent';
import { CardEditorModal } from './ui/components/CardEditorModal';
import { ReferenceCardModal } from './ui/components/ReferenceCardModal';
import { RulesConfigModal } from './ui/components/RulesConfigModal';

const STORAGE_CARDS_KEY = 'lamencards_custom_catalog_v1';
const STORAGE_CONFIG_KEY = 'lamencards_custom_config_v1';
const STORAGE_PLAYER_ID_KEY = 'lamencards_device_player_id_v1';
const STORAGE_PLAYER_NAME_KEY = 'lamencards_device_player_name_v1';

function getOrCreateDevicePlayerId(): string {
  const existing = sessionStorage.getItem(STORAGE_PLAYER_ID_KEY);
  if (existing) return existing;
  const created = `p-${Math.random().toString(36).substring(2, 8)}-${Date.now().toString(36).slice(-3)}`;
  sessionStorage.setItem(STORAGE_PLAYER_ID_KEY, created);
  return created;
}

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export const App: React.FC = () => {
  const [myPlayerId] = useState<string>(() => getOrCreateDevicePlayerId());
  const [myPlayerName, setMyPlayerName] = useState<string>(
    () => localStorage.getItem(STORAGE_PLAYER_NAME_KEY) || ''
  );

  const [catalog, setCatalog] = useState<CardData[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_CARDS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length >= 6) return parsed;
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

  // Stato connessione stanza P2P
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

  // Modali UI
  const [showCardEditor, setShowCardEditor] = useState<boolean>(false);
  const [showRulesModal, setShowRulesModal] = useState<boolean>(false);
  const [showReferenceModal, setShowReferenceModal] = useState<boolean>(false);
  const [showMarketDrawer, setShowMarketDrawer] = useState<boolean>(false);
  const [showLogDrawer, setShowLogDrawer] = useState<boolean>(false);
  const [showTradeModal, setShowTradeModal] = useState<boolean>(false);

  // Selettori interattivi per Mercato, Acquisti e Carte con bersaglio
  const [selectedMarketCardId, setSelectedMarketCardId] = useState<string>('');
  const [selectedHandSwapCardId, setSelectedHandSwapCardId] = useState<string>('');
  const [tradeTargetPlayerId, setTradeTargetPlayerId] = useState<string>('');
  const [tradeOfferedTokens, setTradeOfferedTokens] = useState<number>(2);
  const [pendingCardToPlay, setPendingCardToPlay] = useState<CardData | null>(null);
  const [draftSelectionMode, setDraftSelectionMode] = useState<'STARTER' | 'RESERVE'>('STARTER');

  const roomManagerRef = useRef<P2PRoomManager | null>(null);
  const stateRef = useRef<GameState>(gameState);
  stateRef.current = gameState;

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

  // Gestione automatica del turno dei Bot quando l'utente è Host
  useEffect(() => {
    if (!inRoom || roomRole !== 'HOST') return;
    if (gameState.phase !== 'PLAYING') return;
    const activePlayer = gameState.players[gameState.currentPlayerIndex];
    if (!activePlayer || !activePlayer.isBot) return;

    const timer = setTimeout(() => {
      setGameState((prev) => {
        const next = executeBotTurnStep(prev);
        roomManagerRef.current?.broadcastStateFromHost(next);
        return next;
      });
    }, 650);

    return () => clearTimeout(timer);
  }, [
    inRoom,
    roomRole,
    gameState.phase,
    gameState.currentPlayerIndex,
    gameState.rollsLeft,
    gameState.mainActionTaken,
    gameState.players,
  ]);

  const handleCreateHostRoom = () => {
    const cleanName = myPlayerName.trim() || 'Capitano (Host)';
    localStorage.setItem(STORAGE_PLAYER_NAME_KEY, cleanName);
    const code = generateRoomCode();

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

  const handleJoinRoomAsClient = () => {
    const code = joinCodeInput.trim().toUpperCase();
    if (!code) {
      alert('Inserisci il Codice Stanza comunicato dall’Host!');
      return;
    }
    const cleanName = myPlayerName.trim() || `Giocatore ${myPlayerId.slice(-3)}`;
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

  const me = useMemo(
    () => gameState.players.find((p) => p.id === myPlayerId) || gameState.players[0],
    [gameState.players, myPlayerId]
  );

  const activePlayer = gameState.players[gameState.currentPlayerIndex];
  const isMyTurn = Boolean(me && activePlayer && me.id === activePlayer.id);
  const achievedCombos = useMemo(() => evaluateDiceCombos(gameState.dice), [gameState.dice]);

  const cashInPreview = useMemo(() => {
    if (!me) return 1;
    const passiveBonus = gameState.config.enableCardEffects
      ? me.played.reduce(
          (acc, c) =>
            c.effectModel.timing === 'WHILE_IN_PLAY' &&
            c.effectModel.templateId === 'CASH_IN_BONUS'
              ? acc + (c.effectModel.value || 1)
              : acc,
          0
        )
      : 0;
    return calculateCashInTokens(gameState.dice, passiveBonus);
  }, [gameState.dice, gameState.config.enableCardEffects, me]);

  const myObjectiveEval = useMemo(() => {
    if (!me) return null;
    return evaluateObjective(me.played, me.objective, gameState.config.teamSize);
  }, [me, gameState.config.teamSize]);

  const shareInviteLink = () => {
    const url = `${window.location.origin}${window.location.pathname}?room=${gameState.roomCode}`;
    navigator.clipboard?.writeText(url);
    alert(`Link stanza copiato!\nInvia questo link agli amici:\n${url}`);
  };

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      {/* TOP NAVBAR */}
      <header
        style={{
          background: 'rgba(28, 22, 58, 0.95)',
          borderBottom: '3px solid #fffdf6',
          padding: '8px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px',
          position: 'sticky',
          top: 0,
          zIndex: 40,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span
            style={{
              fontFamily: 'var(--font-bubbles)',
              fontSize: '1.35rem',
              color: '#bff0da',
              textShadow: '0 2px 0 #ea5444',
            }}
          >
            🃏 LAMENCARDS
          </span>
          {inRoom && (
            <span
              style={{
                background: '#ea5444',
                color: '#ffffff',
                border: '2px solid #fffdf6',
                borderRadius: '999px',
                padding: '2px 10px',
                fontFamily: 'var(--font-effect)',
                fontSize: '0.78rem',
                fontWeight: 800,
              }}
            >
              Stanza: {gameState.roomCode}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <button
            className="btn-caramella btn-cream"
            style={{ padding: '5px 10px', fontSize: '0.75rem' }}
            onClick={() => setShowReferenceModal(true)}
          >
            📋 Riferimento
          </button>
          <button
            className="btn-caramella btn-mint"
            style={{ padding: '5px 10px', fontSize: '0.75rem' }}
            onClick={() => setShowCardEditor(true)}
          >
            🎨 Editor Carte ({catalog.length})
          </button>
          <button
            className="btn-caramella btn-gold"
            style={{ padding: '5px 10px', fontSize: '0.75rem' }}
            onClick={() => setShowRulesModal(true)}
          >
            ⚙️ Regole &amp; Simulatore
          </button>
          {inRoom && (
            <button
              className="btn-caramella btn-coral"
              style={{ padding: '5px 10px', fontSize: '0.75rem' }}
              onClick={handleLeaveRoom}
            >
              ✕ Esci
            </button>
          )}
        </div>
      </header>

      {/* CONTENUTO PRINCIPALE */}
      <main
        style={{
          flex: 1,
          width: '100%',
          maxWidth: '1120px',
          margin: '0 auto',
          padding: '14px 12px 32px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        {/* 1. SCHERMATA HOME (Non ancora in una stanza) */}
        {!inRoom && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '18px',
              alignItems: 'start',
            }}
          >
            {/* Card Accesso Stanza P2P */}
            <div className="panel-caramella" style={{ padding: '20px' }}>
              <h1
                style={{
                  margin: '0 0 6px',
                  fontFamily: 'var(--font-title)',
                  fontSize: '1.7rem',
                  color: '#2b2350',
                }}
              >
                Tavolo Multiplayer P2P
              </h1>
              <p style={{ margin: '0 0 14px', fontSize: '0.88rem', fontWeight: 700 }}>
                Gioca da <strong>3 a 6 amici</strong> ognuno col proprio smartphone (iOS e Android) collegato a questo indirizzo web!
              </p>

              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 800, marginBottom: '12px' }}>
                Il tuo Nome o Soprannome:
                <input
                  type="text"
                  placeholder="Es. Giorgio, Marco, Luca..."
                  value={myPlayerName}
                  onChange={(e) => setMyPlayerName(e.target.value)}
                  style={{
                    width: '100%',
                    marginTop: '4px',
                    padding: '10px 12px',
                    borderRadius: '12px',
                    border: '3px solid #2b2350',
                    fontSize: '0.95rem',
                    fontWeight: 800,
                  }}
                />
              </label>

              <button
                className="btn-caramella btn-coral"
                style={{ width: '100%', fontSize: '1rem', padding: '12px', marginBottom: '14px' }}
                onClick={handleCreateHostRoom}
              >
                🏠 Crea Nuova Stanza (Fai da Host)
              </button>

              <div
                style={{
                  borderTop: '2px dashed rgba(43,35,80,0.25)',
                  paddingTop: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <span style={{ fontSize: '0.82rem', fontWeight: 800 }}>
                  Oppure entra nella stanza di un amico:
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="CODICE (es. K7M4P)"
                    value={joinCodeInput}
                    onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                    style={{
                      flex: 1,
                      padding: '10px 12px',
                      borderRadius: '12px',
                      border: '3px solid #2b2350',
                      fontSize: '0.95rem',
                      fontWeight: 900,
                      textTransform: 'uppercase',
                    }}
                  />
                  <button
                    className="btn-caramella btn-mint"
                    style={{ padding: '10px 16px', fontSize: '0.92rem' }}
                    onClick={handleJoinRoomAsClient}
                  >
                    ➔ Entra
                  </button>
                </div>
              </div>
            </div>

            {/* Vetrina Carte Stile Caramella */}
            <div className="panel-night" style={{ padding: '18px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '10px',
                }}
              >
                <h2 style={{ margin: 0, fontFamily: 'var(--font-title)', fontSize: '1.25rem' }}>
                  ✨ Set di Prova del GDD ({catalog.length} Carte)
                </h2>
                <button
                  className="btn-caramella btn-mint"
                  style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                  onClick={() => setShowCardEditor(true)}
                >
                  Modifica Carte
                </button>
              </div>
              <div
                style={{
                  display: 'flex',
                  gap: '12px',
                  overflowX: 'auto',
                  paddingBottom: '8px',
                }}
              >
                {catalog.slice(0, 6).map((c) => (
                  <div key={c.id} style={{ flexShrink: 0 }}>
                    <CardComponent
                      card={c}
                      size="sm"
                      onClick={() => setShowCardEditor(true)}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 2. LOBBY DELLA STANZA P2P */}
        {inRoom && gameState.phase === 'LOBBY' && (
          <div className="panel-caramella" style={{ padding: '20px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
                borderBottom: '3px solid #2b2350',
                paddingBottom: '12px',
                marginBottom: '16px',
              }}
            >
              <div>
                <div style={{ fontSize: '0.78rem', fontWeight: 800, opacity: 0.75 }}>
                  {netStatus}
                </div>
                <h2
                  style={{
                    margin: '2px 0 0',
                    fontFamily: 'var(--font-title)',
                    fontSize: '1.65rem',
                  }}
                >
                  Codice Stanza: <span style={{ color: '#ea5444' }}>{gameState.roomCode}</span>
                </h2>
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  className="btn-caramella btn-mint"
                  style={{ fontSize: '0.82rem' }}
                  onClick={shareInviteLink}
                >
                  🔗 Copia Link Invito per i Telefoni
                </button>
                {roomRole === 'HOST' && gameState.players.length < gameState.config.maxPlayers && (
                  <button
                    className="btn-caramella btn-gold"
                    style={{ fontSize: '0.82rem' }}
                    onClick={() =>
                      dispatchGameAction({
                        type: 'ADD_PLAYER',
                        id: `bot-${Date.now()}`,
                        name: `Amico Bot #${gameState.players.length + 1}`,
                        isBot: true,
                      })
                    }
                  >
                    🤖 + Aggiungi Bot di Test
                  </button>
                )}
              </div>
            </div>

            <h3 style={{ margin: '0 0 10px', fontFamily: 'var(--font-title)', fontSize: '1.15rem' }}>
              👥 Giocatori Connessi ({gameState.players.length}/{gameState.config.maxPlayers}) — Consigliati: 3–6 giocatori
            </h3>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: '10px',
                marginBottom: '18px',
              }}
            >
              {gameState.players.map((p, idx) => (
                <div
                  key={p.id}
                  style={{
                    background: p.id === myPlayerId ? '#bff0da' : '#ffffff',
                    border: '3px solid #2b2350',
                    borderRadius: '14px',
                    padding: '10px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 900, fontSize: '0.92rem' }}>
                      {idx + 1}. {p.name} {p.id === myPlayerId ? '(Tu)' : ''}
                    </div>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, opacity: 0.75 }}>
                      {p.isHost ? '👑 Host Stanza' : p.isBot ? '🤖 Bot IA' : '📱 Smartphone P2P'}
                    </div>
                  </div>
                  {roomRole === 'HOST' && !p.isHost && (
                    <button
                      onClick={() =>
                        dispatchGameAction({ type: 'REMOVE_PLAYER', playerId: p.id })
                      }
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#c93b2b',
                        fontWeight: 900,
                        cursor: 'pointer',
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div
              style={{
                background: '#f5f2eb',
                border: '2px solid #2b2350',
                borderRadius: '14px',
                padding: '12px',
                marginBottom: '16px',
                fontSize: '0.82rem',
              }}
            >
              <strong>Regole attive per questa partita:</strong> Ogni giocatore apre{' '}
              <strong>
                {gameState.config.packsPerPlayer} bustine da {gameState.config.cardsPerPack} carte
              </strong>{' '}
              ({gameState.config.packsPerPlayer * gameState.config.cardsPerPack} carte totali), sceglie{' '}
              <strong>{gameState.config.teamSize} titolari</strong> +{' '}
              <strong>{gameState.config.reserveSize} riserve</strong> per il Mercato, parte con{' '}
              <strong>{gameState.config.startingTokens} gettoni</strong> e pesca{' '}
              <strong>2 Obiettivi</strong>.
            </div>

            {roomRole === 'HOST' ? (
              <button
                className="btn-caramella btn-coral"
                style={{ width: '100%', padding: '14px', fontSize: '1.08rem' }}
                disabled={gameState.players.length < 2}
                onClick={() => dispatchGameAction({ type: 'START_PACK_OPENING' })}
              >
                📦 Distribuisci le Bustine e Inizia lo Spacchettamento!
              </button>
            ) : (
              <div style={{ textAlign: 'center', fontWeight: 800, padding: '10px' }}>
                ⏳ In attesa che l&apos;Host avvii lo spacchettamento delle bustine...
              </div>
            )}
          </div>
        )}

        {/* 3. FASE SPACCHETTAMENTO & SCELTA SQUADRA (2 Pacchetti da 5 carte) */}
        {inRoom && gameState.phase === 'PACK_OPENING' && me && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="panel-caramella" style={{ padding: '16px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '10px',
                }}
              >
                <div>
                  <h2 style={{ margin: 0, fontFamily: 'var(--font-title)', fontSize: '1.45rem' }}>
                    📦 Fase 1: Spacchettamento &amp; Composizione Squadra
                  </h2>
                  <p style={{ margin: '2px 0 0', fontSize: '0.82rem', fontWeight: 700 }}>
                    Apri i tuoi <strong>{gameState.config.packsPerPlayer} pacchetti da {gameState.config.cardsPerPack} carte</strong>, poi scegli{' '}
                    <strong>{gameState.config.teamSize} Titolari</strong> (la tua squadra coperta) e{' '}
                    <strong>{gameState.config.reserveSize} Riserve</strong> (che andranno nel Mercato).
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    className="btn-caramella btn-gold"
                    style={{ fontSize: '0.8rem', padding: '7px 12px' }}
                    onClick={() =>
                      dispatchGameAction({ type: 'AUTO_SELECT_DRAFT', playerId: me.id })
                    }
                  >
                    ⚡ Apri Tutto &amp; Scelta Rapida
                  </button>
                </div>
              </div>

              {/* Bustine ancora chiuse da toccare per aprire */}
              {me.unopenedPacks.length > 0 && (
                <div
                  style={{
                    marginTop: '14px',
                    padding: '16px',
                    background: '#2b2350',
                    color: '#fffdf6',
                    borderRadius: '18px',
                    textAlign: 'center',
                  }}
                >
                  <div
                    style={{
                      fontFamily: 'var(--font-title)',
                      fontSize: '1.15rem',
                      marginBottom: '10px',
                    }}
                  >
                    ✨ Tocca una bustina per strapparla e scoprire le {gameState.config.cardsPerPack} carte! ({me.unopenedPacks.length} rimaste)
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'center',
                      gap: '18px',
                      flexWrap: 'wrap',
                    }}
                  >
                    {me.unopenedPacks.map((pack, idx) => (
                      <div
                        key={idx}
                        className="booster-pack"
                        style={{ width: '148px', padding: '14px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between' }}
                        onClick={() =>
                          dispatchGameAction({ type: 'OPEN_NEXT_PACK', playerId: me.id })
                        }
                      >
                        <span
                          style={{
                            background: '#ffd166',
                            color: '#2b2350',
                            padding: '2px 8px',
                            borderRadius: '999px',
                            fontWeight: 900,
                            fontSize: '0.7rem',
                            border: '2px solid #2b2350',
                          }}
                        >
                          {pack.length} CARTE
                        </span>
                        <div style={{ fontSize: '2.6rem' }}>🃏</div>
                        <div
                          style={{
                            fontFamily: 'var(--font-bubbles)',
                            color: '#fffdf6',
                            fontSize: '0.95rem',
                            textAlign: 'center',
                            textShadow: '0 2px 0 #2b2350',
                          }}
                        >
                          BUSTINA #{idx + 1}
                          <br />
                          <span style={{ fontSize: '0.7rem', fontFamily: 'var(--font-effect)' }}>
                            TOCCA PER APRIRE
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Carte sbustate (Pool di 10 carte) */}
              {me.pulledPool.length > 0 && (
                <div style={{ marginTop: '14px' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '8px',
                      marginBottom: '10px',
                    }}
                  >
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => setDraftSelectionMode('STARTER')}
                        style={{
                          padding: '7px 12px',
                          borderRadius: '12px',
                          border: '3px solid #2b2350',
                          background: draftSelectionMode === 'STARTER' ? '#ea5444' : '#ffffff',
                          color: draftSelectionMode === 'STARTER' ? '#ffffff' : '#2b2350',
                          fontWeight: 900,
                          fontSize: '0.82rem',
                          cursor: 'pointer',
                        }}
                      >
                        1️⃣ Scegli Titolari ({me.selectedStarterIds.length}/{gameState.config.teamSize})
                      </button>
                      <button
                        type="button"
                        onClick={() => setDraftSelectionMode('RESERVE')}
                        style={{
                          padding: '7px 12px',
                          borderRadius: '12px',
                          border: '3px solid #2b2350',
                          background: draftSelectionMode === 'RESERVE' ? '#ffd166' : '#ffffff',
                          color: '#2b2350',
                          fontWeight: 900,
                          fontSize: '0.82rem',
                          cursor: 'pointer',
                        }}
                      >
                        2️⃣ Scegli Riserve Mercato ({me.selectedReserveIds.length}/{gameState.config.reserveSize})
                      </button>
                    </div>

                    <button
                      className="btn-caramella btn-coral"
                      disabled={
                        me.draftReady ||
                        me.selectedStarterIds.length !== gameState.config.teamSize ||
                        me.selectedReserveIds.length !== gameState.config.reserveSize
                      }
                      onClick={() =>
                        dispatchGameAction({ type: 'CONFIRM_DRAFT_TEAM', playerId: me.id })
                      }
                    >
                      {me.draftReady
                        ? '✓ Squadra Confermata (In attesa degli altri...)'
                        : `✓ Conferma ${gameState.config.teamSize} Titolari + ${gameState.config.reserveSize} Riserve`}
                    </button>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                      gap: '12px',
                      justifyItems: 'center',
                    }}
                  >
                    {me.pulledPool.map((card) => {
                      const isStarter = me.selectedStarterIds.includes(card.id);
                      const isReserve = me.selectedReserveIds.includes(card.id);
                      const badge = isStarter
                        ? '★ TITOLARE'
                        : isReserve
                        ? '🏪 RISERVA'
                        : undefined;

                      return (
                        <CardComponent
                          key={card.id}
                          card={card}
                          size="sm"
                          selectedBadge={badge}
                          canPlayHighlight={isStarter}
                          onClick={() =>
                            dispatchGameAction({
                              type: 'TOGGLE_DRAFT_SELECTION',
                              playerId: me.id,
                              cardId: card.id,
                              role: draftSelectionMode,
                            })
                          }
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Stato preparazione degli altri amici */}
              <div
                style={{
                  marginTop: '14px',
                  paddingTop: '10px',
                  borderTop: '2px solid rgba(43,35,80,0.2)',
                  display: 'flex',
                  gap: '8px',
                  flexWrap: 'wrap',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                }}
              >
                <span>Stato giocatori:</span>
                {gameState.players.map((p) => (
                  <span
                    key={p.id}
                    style={{
                      padding: '2px 8px',
                      borderRadius: '999px',
                      background: p.draftReady ? '#22c55e' : '#ffd166',
                      color: p.draftReady ? '#ffffff' : '#2b2350',
                      border: '1.5px solid #2b2350',
                    }}
                  >
                    {p.name}: {p.draftReady ? 'Pronto ✓' : 'Sta scegliendo...'}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 4. FASE SCELTA CARTA OBIETTIVO (Dopo aver deciso le squadre!) */}
        {inRoom && gameState.phase === 'OBJECTIVE_PICK' && me && (
          <div className="panel-caramella" style={{ padding: '20px', textAlign: 'center' }}>
            <h2 style={{ margin: '0 0 6px', fontFamily: 'var(--font-title)', fontSize: '1.5rem' }}>
              🎯 Scegli il tuo Obiettivo Segreto!
            </h2>
            <p style={{ margin: '0 0 16px', fontSize: '0.86rem', fontWeight: 700 }}>
              Come previsto dal GDD, ora che le squadre sono decise peschi <strong>2 carte Obiettivo</strong>: scegline <strong>1 da tenere coperta</strong> per tutta la partita e scarta l&apos;altra.
            </p>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                gap: '14px',
                marginBottom: '18px',
              }}
            >
              {me.objectiveCandidates.map((obj) => {
                const isSelected = me.objective?.id === obj.id;
                const previewEval = evaluateObjective(me.hand, obj, gameState.config.teamSize);

                return (
                  <div
                    key={obj.id}
                    onClick={() =>
                      dispatchGameAction({
                        type: 'PICK_OBJECTIVE',
                        playerId: me.id,
                        objectiveId: obj.id,
                      })
                    }
                    style={{
                      background: isSelected ? '#bff0da' : '#ffffff',
                      border: '4px solid #2b2350',
                      borderRadius: '20px',
                      padding: '16px',
                      cursor: 'pointer',
                      boxShadow: '0 6px 0 #2b2350',
                      textAlign: 'left',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '6px',
                      }}
                    >
                      <span
                        style={{
                          fontFamily: 'var(--font-title)',
                          fontSize: '1.15rem',
                          color: '#ea5444',
                        }}
                      >
                        🎯 {obj.title}
                      </span>
                      {isSelected && (
                        <span
                          style={{
                            background: '#22c55e',
                            color: '#ffffff',
                            padding: '2px 8px',
                            borderRadius: '999px',
                            fontSize: '0.72rem',
                            fontWeight: 900,
                          }}
                        >
                          SCELTO ✓
                        </span>
                      )}
                    </div>
                    <p style={{ margin: '0 0 10px', fontWeight: 800, fontSize: '0.88rem' }}>
                      {obj.description}
                    </p>
                    <div
                      style={{
                        fontSize: '0.75rem',
                        background: '#f5f2eb',
                        padding: '6px 8px',
                        borderRadius: '8px',
                        border: '1.5px solid #2b2350',
                        fontWeight: 700,
                      }}
                    >
                      Compatibilità con i tuoi 4 titolari attuali: <strong>{previewEval.progressText}</strong>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 5. TAVOLO DI GIOCO PRINCIPALE (PLAYING & GAME_OVER) */}
        {inRoom && (gameState.phase === 'PLAYING' || gameState.phase === 'GAME_OVER') && me && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Banner Vincitore se la partita è terminata */}
            {gameState.phase === 'GAME_OVER' && (
              <div
                className="panel-caramella"
                style={{
                  background: '#ffd166',
                  padding: '18px',
                  textAlign: 'center',
                }}
              >
                <h2 style={{ margin: '0 0 6px', fontFamily: 'var(--font-title)', fontSize: '1.7rem' }}>
                  🏆 PARTITA CONCLUSA! Vincitore:{' '}
                  {gameState.players.find((p) => p.id === gameState.winnerPlayerId)?.name}
                </h2>
                <p style={{ margin: '0 0 12px', fontWeight: 800 }}>
                  Ha schierato tutte e {gameState.config.teamSize} le carte della sua squadra rispettando il proprio Obiettivo!
                </p>
                {roomRole === 'HOST' && (
                  <button
                    className="btn-caramella btn-coral"
                    onClick={() => dispatchGameAction({ type: 'RESET_TO_LOBBY' })}
                  >
                    ↺ Torna alla Lobby per una Nuova Partita
                  </button>
                )}
              </div>
            )}

            {/* Barra Giocatori al Tavolo (Senso Orario) + Accesso Rapido Mercato & Mosse */}
            <div className="panel-night" style={{ padding: '12px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '8px',
                  marginBottom: '10px',
                }}
              >
                <div style={{ fontWeight: 900, fontSize: '0.88rem' }}>
                  🔄 Giro #{gameState.turnNumber} • Turno di:{' '}
                  <span style={{ color: '#ffd166' }}>{activePlayer?.name}</span>
                  {isMyTurn && (
                    <span
                      style={{
                        marginLeft: '8px',
                        background: '#22c55e',
                        color: '#ffffff',
                        padding: '2px 8px',
                        borderRadius: '999px',
                        fontSize: '0.75rem',
                      }}
                    >
                      TOCCA A TE!
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <button
                    className="btn-caramella btn-mint"
                    style={{ padding: '5px 10px', fontSize: '0.76rem' }}
                    onClick={() => setShowMarketDrawer(true)}
                  >
                    🏪 Mercato ({gameState.market.length} carte)
                  </button>
                  <button
                    className="btn-caramella btn-cream"
                    style={{ padding: '5px 10px', fontSize: '0.76rem' }}
                    onClick={() => setShowLogDrawer(true)}
                  >
                    📜 Registro Mosse ({gameState.actionLog.length})
                  </button>
                </div>
              </div>

              {/* Strip dei giocatori */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))',
                  gap: '8px',
                }}
              >
                {gameState.players.map((p, idx) => {
                  const isTurn = idx === gameState.currentPlayerIndex;
                  return (
                    <div
                      key={p.id}
                      style={{
                        background: isTurn ? '#fffdf6' : 'rgba(255,253,246,0.1)',
                        color: isTurn ? '#2b2350' : '#fffdf6',
                        border: isTurn ? '3px solid #ffd166' : '2px solid rgba(255,253,246,0.22)',
                        borderRadius: '14px',
                        padding: '8px 10px',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          fontWeight: 900,
                          fontSize: '0.84rem',
                        }}
                      >
                        <span>
                          {isTurn ? '▶ ' : ''}
                          {p.name} {p.id === me.id ? '(Tu)' : ''}
                        </span>
                        <span
                          style={{
                            background: '#ffd166',
                            color: '#2b2350',
                            padding: '1px 7px',
                            borderRadius: '999px',
                            fontSize: '0.75rem',
                            border: '1.5px solid #2b2350',
                          }}
                        >
                          🪙 {p.tokens}
                        </span>
                      </div>

                      <div style={{ fontSize: '0.72rem', marginTop: '4px', opacity: 0.9 }}>
                        In gioco: <strong>{p.played.length}/{gameState.config.teamSize}</strong> • In mano:{' '}
                        <strong>{p.hand.length}</strong>
                      </div>

                      {/* Mini-lista carte scoperte in gioco */}
                      {p.played.length > 0 && (
                        <div
                          style={{
                            display: 'flex',
                            gap: '4px',
                            flexWrap: 'wrap',
                            marginTop: '5px',
                          }}
                        >
                          {p.played.map((c) => (
                            <span
                              key={c.id}
                              style={{
                                background: '#bff0da',
                                color: '#2b2350',
                                border: '1.5px solid #2b2350',
                                borderRadius: '6px',
                                padding: '1px 5px',
                                fontSize: '0.65rem',
                                fontWeight: 800,
                              }}
                            >
                              {c.name} ({c.cost})
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* NOTIFICA SE QUALCUNO TI HA FATTO UN'OFFERTA DI ACQUISTO */}
            {gameState.pendingTradeOffer &&
              gameState.pendingTradeOffer.toPlayerId === me.id && (
                <div
                  className="panel-caramella"
                  style={{
                    background: '#ffd166',
                    padding: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '10px',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 900, fontSize: '0.98rem' }}>
                      🤝 Offerta di Acquisto da{' '}
                      {
                        gameState.players.find(
                          (p) => p.id === gameState.pendingTradeOffer?.fromPlayerId
                        )?.name
                      }
                      !
                    </div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700 }}>
                      Ti offre <strong>{gameState.pendingTradeOffer.offeredTokens} gettoni</strong> + 1 sua carta coperta in cambio di una tua carta non giocata.
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      className="btn-caramella btn-mint"
                      onClick={() =>
                        dispatchGameAction({
                          type: 'RESPOND_PLAYER_TRADE',
                          accept: true,
                          chosenTargetCardId: me.hand[0]?.id,
                        })
                      }
                    >
                      ✓ Accetta Scambio
                    </button>
                    <button
                      className="btn-caramella btn-coral"
                      onClick={() =>
                        dispatchGameAction({
                          type: 'RESPOND_PLAYER_TRADE',
                          accept: false,
                        })
                      }
                    >
                      ✕ Rifiuta
                    </button>
                  </div>
                </div>
              )}

            {/* CENTRO TAVOLO: VASSOIO DEI 5 DADI & SCELTA (GIOCA O INCASSA) */}
            <div className="panel-caramella" style={{ padding: '16px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '10px',
                  marginBottom: '12px',
                }}
              >
                <div>
                  <h3 style={{ margin: 0, fontFamily: 'var(--font-title)', fontSize: '1.22rem' }}>
                    🎲 I 5 Dadi del Turno ({activePlayer?.name})
                  </h3>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700 }}>
                    {isMyTurn && !gameState.mainActionTaken
                      ? 'Tocca i dadi che vuoi TENERE prima di ritirare, poi scegli se GIOCARE una carta o INCASSARE gettoni.'
                      : `Tiri rimasti: ${gameState.rollsLeft}`}
                  </div>
                </div>

                {/* Badge Combinazioni Attuali */}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {achievedCombos.length > 0 ? (
                    achievedCombos.map((combo) => (
                      <span
                        key={combo}
                        style={{
                          background: '#2b2350',
                          color: '#bff0da',
                          padding: '3px 9px',
                          borderRadius: '999px',
                          fontSize: '0.74rem',
                          fontWeight: 800,
                        }}
                      >
                        ✓ {COMBO_LABELS_IT[combo]}
                      </span>
                    ))
                  ) : (
                    <span
                      style={{
                        background: '#e2e8f0',
                        color: '#2b2350',
                        padding: '3px 9px',
                        borderRadius: '999px',
                        fontSize: '0.74rem',
                        fontWeight: 800,
                      }}
                    >
                      Nessuna combinazione
                    </span>
                  )}
                </div>
              </div>

              {/* I 5 Dadi */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  gap: '10px',
                  flexWrap: 'wrap',
                  marginBottom: '14px',
                }}
              >
                {gameState.dice.map((val, idx) => {
                  const kept = gameState.keptDice[idx];
                  return (
                    <div
                      key={idx}
                      className={`die-box ${kept ? 'kept' : ''}`}
                      onClick={() => {
                        if (isMyTurn && !gameState.mainActionTaken) {
                          dispatchGameAction({
                            type: 'TOGGLE_KEEP_DIE',
                            playerId: me.id,
                            dieIndex: idx,
                          });
                        }
                      }}
                    >
                      <span>{val}</span>
                      <span
                        style={{
                          fontSize: '0.52rem',
                          fontFamily: 'var(--font-effect)',
                          fontWeight: 800,
                          marginTop: '-2px',
                        }}
                      >
                        {kept ? 'TENUTO' : 'LIBERO'}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Se il giocatore ha il Dado Jolly ("La Fortuna del Principiante") */}
              {isMyTurn && me.modifiers.hasJokerDieNextRoll && !gameState.mainActionTaken && (
                <div
                  style={{
                    background: '#bff0da',
                    border: '2px solid #2b2350',
                    borderRadius: '12px',
                    padding: '8px 12px',
                    marginBottom: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '8px',
                    fontSize: '0.8rem',
                    fontWeight: 800,
                  }}
                >
                  <span>🍀 Hai un Dado Jolly! Scegli il valore per il 1° dado:</span>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {[1, 2, 3, 4, 5, 6].map((v) => (
                      <button
                        key={v}
                        className="btn-caramella btn-gold"
                        style={{ padding: '3px 9px', fontSize: '0.8rem' }}
                        onClick={() =>
                          dispatchGameAction({
                            type: 'SET_JOKER_DIE_VALUE',
                            playerId: me.id,
                            dieIndex: 0,
                            value: v,
                          })
                        }
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Pulsanti Azione del Turno */}
              {isMyTurn && gameState.phase === 'PLAYING' && (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    gap: '10px',
                    flexWrap: 'wrap',
                  }}
                >
                  {!gameState.mainActionTaken && (
                    <>
                      <button
                        className="btn-caramella btn-mint"
                        disabled={gameState.rollsLeft <= 0}
                        onClick={() =>
                          dispatchGameAction({ type: 'ROLL_DICE', playerId: me.id })
                        }
                      >
                        🎲 Ritira Dadi ({gameState.rollsLeft} rimasti)
                      </button>

                      {gameState.config.paidExtraRollEnabled &&
                        gameState.rollsLeft === 0 &&
                        me.tokens >= gameState.config.paidExtraRollCost && (
                          <button
                            className="btn-caramella btn-cream"
                            onClick={() =>
                              dispatchGameAction({
                                type: 'BUY_EXTRA_ROLL',
                                playerId: me.id,
                              })
                            }
                          >
                            +1 Tiro Extra (-{gameState.config.paidExtraRollCost} 🪙)
                          </button>
                        )}

                      <button
                        className="btn-caramella btn-gold"
                        onClick={() =>
                          dispatchGameAction({ type: 'CASH_IN_DICE', playerId: me.id })
                        }
                      >
                        🪙 Scegli INCASSA (+{cashInPreview} Gettoni)
                      </button>
                    </>
                  )}

                  <button
                    className="btn-caramella btn-cream"
                    onClick={() => setShowMarketDrawer(true)}
                  >
                    🏪 Scambia col Mercato ({gameState.config.marketSwapCost} 🪙)
                  </button>

                  {me.played.length < gameState.config.teamSize - 1 &&
                    !gameState.hasMadeTradeOfferThisTurn &&
                    me.hand.length > 0 && (
                      <button
                        className="btn-caramella btn-cream"
                        onClick={() => setShowTradeModal(true)}
                      >
                        🤝 Compra Carta da Avversario
                      </button>
                    )}

                  {gameState.mainActionTaken && (
                    <button
                      className="btn-caramella btn-coral"
                      onClick={() =>
                        dispatchGameAction({ type: 'END_TURN', playerId: me.id })
                      }
                    >
                      ➔ Passa il Turno
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* IL TUO OBIETTIVO PERSONALE + STATO SQUADRA */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '12px',
              }}
            >
              {/* Box Obiettivo */}
              <div className="panel-night" style={{ padding: '12px 14px' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--font-title)',
                      fontSize: '1.05rem',
                      color: '#bff0da',
                    }}
                  >
                    🎯 Il Tuo Obiettivo ({gameState.config.objectiveVisibility === 'SECRET' ? 'Coperto' : 'Scoperto'}):{' '}
                    {me.objective?.title || 'Nessuno'}
                  </span>
                  <span
                    style={{
                      background: myObjectiveEval?.satisfied ? '#22c55e' : '#ea5444',
                      color: '#ffffff',
                      padding: '2px 8px',
                      borderRadius: '999px',
                      fontSize: '0.7rem',
                      fontWeight: 900,
                    }}
                  >
                    {myObjectiveEval?.progressText}
                  </span>
                </div>
                <div style={{ fontSize: '0.8rem', marginTop: '4px', opacity: 0.9 }}>
                  {me.objective?.description}
                </div>

                {/* Se Cambio di Programma ha offerto un 2° Obiettivo */}
                {me.objectiveCandidates.length > 1 && (
                  <div style={{ marginTop: '8px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {me.objectiveCandidates.map((cand) => (
                      <button
                        key={cand.id}
                        className="btn-caramella btn-mint"
                        style={{ padding: '3px 8px', fontSize: '0.72rem' }}
                        onClick={() =>
                          dispatchGameAction({
                            type: 'PICK_OBJECTIVE',
                            playerId: me.id,
                            objectiveId: cand.id,
                          })
                        }
                      >
                        Usa: {cand.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Box Modificatori & Risorse Personali */}
              <div className="panel-night" style={{ padding: '12px 14px' }}>
                <div style={{ fontFamily: 'var(--font-title)', fontSize: '1.05rem', color: '#ffd166' }}>
                  🪙 I Tuoi Gettoni: {me.tokens} • Squadra in gioco: {me.played.length}/{gameState.config.teamSize}
                </div>
                <div style={{ fontSize: '0.78rem', marginTop: '4px', opacity: 0.9 }}>
                  {me.modifiers.nextCardDiscount > 0 && (
                    <span style={{ marginRight: '8px', color: '#8ce0bc' }}>
                      ⚡ Sconto prossima carta: -{me.modifiers.nextCardDiscount} gettoni!
                    </span>
                  )}
                  {me.modifiers.comboTierOffsetFromBoss > 0 && (
                    <span style={{ color: '#ea5444' }}>
                      ⚠️ Bersagliato da &quot;Il Boss&quot;: combinazione costo +1!
                    </span>
                  )}
                  {me.played.length === gameState.config.teamSize - 1 && (
                    <span>🔒 Sei a 1 carta dalla vittoria: non puoi comprare carte dagli avversari.</span>
                  )}
                </div>
              </div>
            </div>

            {/* SEZIONE MANO COPERTA DEL GIOCATORE (SUL PROPRIO TELEFONO) */}
            <div className="panel-caramella" style={{ padding: '16px' }}>
              <h3 style={{ margin: '0 0 10px', fontFamily: 'var(--font-title)', fontSize: '1.2rem' }}>
                🖐️ La Tua Mano Coperta ({me.hand.length} carte da giocare)
              </h3>
              {me.hand.length === 0 ? (
                <div style={{ fontSize: '0.86rem', fontWeight: 700 }}>
                  Hai messo in gioco tutte le carte della tua mano!
                </div>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    gap: '14px',
                    overflowX: 'auto',
                    paddingBottom: '8px',
                  }}
                >
                  {me.hand.map((card) => {
                    const effectiveCost = Math.max(
                      0,
                      card.cost - (me.modifiers.nextCardDiscount || 0)
                    );
                    const comboCheck = canDiceSatisfyCardCost(
                      gameState.dice,
                      card.cost,
                      gameState.config,
                      me.modifiers.comboTierOffsetFromBoss
                    );
                    const canPlayNow =
                      isMyTurn &&
                      !gameState.mainActionTaken &&
                      me.tokens >= effectiveCost &&
                      comboCheck.satisfied;

                    return (
                      <div
                        key={card.id}
                        style={{
                          flexShrink: 0,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <CardComponent
                          card={card}
                          size="md"
                          canPlayHighlight={canPlayNow}
                          effectiveCost={effectiveCost}
                          selectedBadge={canPlayNow ? '✓ GIOCABILE' : undefined}
                          onClick={() => {
                            if (!canPlayNow) return;
                            if (
                              gameState.config.enableCardEffects &&
                              card.effectModel.requiresTargetPlayer
                            ) {
                              setPendingCardToPlay(card);
                            } else {
                              dispatchGameAction({
                                type: 'PLAY_CARD',
                                playerId: me.id,
                                cardId: card.id,
                              });
                            }
                          }}
                        />
                        <div style={{ fontSize: '0.72rem', fontWeight: 800, textAlign: 'center' }}>
                          Richiede:{' '}
                          {comboCheck.requiredCombos
                            .map((c) => COMBO_LABELS_IT[c])
                            .join(' / ')}
                        </div>
                        {canPlayNow && (
                          <button
                            className="btn-caramella btn-coral"
                            style={{ padding: '5px 12px', fontSize: '0.78rem' }}
                            onClick={() => {
                              if (
                                gameState.config.enableCardEffects &&
                                card.effectModel.requiresTargetPlayer
                              ) {
                                setPendingCardToPlay(card);
                              } else {
                                dispatchGameAction({
                                  type: 'PLAY_CARD',
                                  playerId: me.id,
                                  cardId: card.id,
                                });
                              }
                            }}
                          >
                            ▶ Gioca ({effectiveCost} 🪙)
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* SEZIONE CARTE GIÀ IN GIOCO DAVANTI A TE */}
            <div className="panel-night" style={{ padding: '16px' }}>
              <h3 style={{ margin: '0 0 10px', fontFamily: 'var(--font-title)', fontSize: '1.15rem' }}>
                ✨ Le Tue Carte Scoperte in Gioco ({me.played.length}/{gameState.config.teamSize})
              </h3>
              {me.played.length === 0 ? (
                <div style={{ fontSize: '0.82rem', opacity: 0.8 }}>
                  Non hai ancora carte giocate davanti a te.
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '6px' }}>
                  {me.played.map((card) => {
                    const isMismatched =
                      myObjectiveEval?.mismatchedCardIds.includes(card.id) || false;
                    return (
                      <div
                        key={card.id}
                        style={{
                          flexShrink: 0,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <CardComponent
                          card={card}
                          size="sm"
                          selectedBadge={isMismatched ? '⚠️ VIOLAZIONE' : 'IN GIOCO'}
                        />
                        {isMismatched &&
                          gameState.config.onObjectiveMismatch === 'ALLOW_RETURN_TO_HAND' && (
                            <button
                              className="btn-caramella btn-gold"
                              style={{ padding: '4px 8px', fontSize: '0.7rem' }}
                              onClick={() =>
                                dispatchGameAction({
                                  type: 'RETURN_MISMATCHED_CARD_TO_HAND',
                                  playerId: me.id,
                                  playedCardId: card.id,
                                })
                              }
                            >
                              ↩ Riprendi in mano
                            </button>
                          )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* MODALE SCELTA BERSAGLIO PER CARTE OSTACOLO */}
      {pendingCardToPlay && me && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 120,
            background: 'rgba(20,15,45,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '14px',
          }}
        >
          <div className="panel-caramella" style={{ maxWidth: '420px', width: '100%', padding: '18px' }}>
            <h3 style={{ margin: '0 0 8px', fontFamily: 'var(--font-title)' }}>
              🎯 Scegli l&apos;Avversario Bersaglio per &quot;{pendingCardToPlay.name}&quot;
            </h3>
            <p style={{ margin: '0 0 12px', fontSize: '0.82rem', fontWeight: 700 }}>
              {pendingCardToPlay.effectText}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {gameState.players
                .filter((p) => p.id !== me.id)
                .map((opp) => (
                  <button
                    key={opp.id}
                    className="btn-caramella btn-mint"
                    onClick={() => {
                      dispatchGameAction({
                        type: 'PLAY_CARD',
                        playerId: me.id,
                        cardId: pendingCardToPlay.id,
                        targetPlayerId: opp.id,
                      });
                      setPendingCardToPlay(null);
                    }}
                  >
                    Colpisci {opp.name} (🪙 {opp.tokens} • In gioco: {opp.played.length})
                  </button>
                ))}
              <button
                className="btn-caramella btn-cream"
                onClick={() => setPendingCardToPlay(null)}
              >
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DRAWER MERCATO (Centro Tavolo) */}
      {showMarketDrawer && me && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 115,
            background: 'rgba(20,15,45,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '14px',
          }}
          onClick={() => setShowMarketDrawer(false)}
        >
          <div
            className="panel-caramella"
            style={{ width: '100%', maxWidth: '720px', maxHeight: '88dvh', overflowY: 'auto', padding: '18px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h3 style={{ margin: 0, fontFamily: 'var(--font-title)', fontSize: '1.35rem' }}>
                🏪 Mercato Centrale ({gameState.market.length} Carte Scoperte)
              </h3>
              <button
                className="btn-caramella btn-coral"
                style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                onClick={() => setShowMarketDrawer(false)}
              >
                Chiudi
              </button>
            </div>
            <p style={{ margin: '0 0 12px', fontSize: '0.82rem', fontWeight: 700 }}>
              Nel tuo turno puoi scambiare 1 tua carta non giocata con 1 del Mercato pagando{' '}
              <strong>{gameState.config.marketSwapCost} gettone/i</strong>.
            </p>

            <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '10px' }}>
              {gameState.market.map((mc) => (
                <div key={mc.id} style={{ flexShrink: 0 }}>
                  <CardComponent
                    card={mc}
                    size="sm"
                    selectedBadge={selectedMarketCardId === mc.id ? 'SCELTA MERCATO' : undefined}
                    onClick={() => setSelectedMarketCardId(mc.id)}
                  />
                </div>
              ))}
            </div>

            {isMyTurn && me.hand.length > 0 && (
              <div style={{ marginTop: '12px', borderTop: '2px solid #2b2350', paddingTop: '10px' }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 800, marginBottom: '8px' }}>
                  Scegli quale tua carta non giocata lasciare nel Mercato:
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
                  {me.hand.map((hc) => (
                    <button
                      key={hc.id}
                      type="button"
                      onClick={() => setSelectedHandSwapCardId(hc.id)}
                      style={{
                        padding: '6px 10px',
                        borderRadius: '10px',
                        border: '2px solid #2b2350',
                        background: selectedHandSwapCardId === hc.id ? '#ea5444' : '#ffffff',
                        color: selectedHandSwapCardId === hc.id ? '#ffffff' : '#2b2350',
                        fontWeight: 800,
                        fontSize: '0.78rem',
                        cursor: 'pointer',
                      }}
                    >
                      Cedi: {hc.name}
                    </button>
                  ))}
                </div>
                <button
                  className="btn-caramella btn-coral"
                  disabled={
                    !selectedMarketCardId ||
                    !selectedHandSwapCardId ||
                    gameState.hasUsedMarketThisTurn ||
                    me.tokens < gameState.config.marketSwapCost
                  }
                  onClick={() => {
                    dispatchGameAction({
                      type: 'MARKET_SWAP',
                      playerId: me.id,
                      handCardId: selectedHandSwapCardId,
                      marketCardId: selectedMarketCardId,
                    });
                    setShowMarketDrawer(false);
                  }}
                >
                  ✓ Conferma Scambio col Mercato (-{gameState.config.marketSwapCost} 🪙)
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODALE ACQUISTO CARTA DA UN ALTRO GIOCATORE */}
      {showTradeModal && me && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 115,
            background: 'rgba(20,15,45,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '14px',
          }}
          onClick={() => setShowTradeModal(false)}
        >
          <div
            className="panel-caramella"
            style={{ width: '100%', maxWidth: '440px', padding: '18px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 8px', fontFamily: 'var(--font-title)' }}>
              🤝 Fai un&apos;Offerta di Acquisto (Max 1 per turno)
            </h3>
            <p style={{ margin: '0 0 12px', fontSize: '0.8rem', fontWeight: 700 }}>
              Offri gettoni a un avversario per scambiare una carta non ancora giocata.
            </p>

            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, marginBottom: '8px' }}>
              Avversario:
              <select
                value={tradeTargetPlayerId}
                onChange={(e) => setTradeTargetPlayerId(e.target.value)}
                style={{ width: '100%', padding: '8px', borderRadius: '10px', border: '2px solid #2b2350', marginTop: '4px' }}
              >
                <option value="">-- Seleziona giocatore --</option>
                {gameState.players
                  .filter((p) => p.id !== me.id && p.hand.length > 0)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.hand.length} carte in mano)
                    </option>
                  ))}
              </select>
            </label>

            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, marginBottom: '8px' }}>
              Gettoni offerti (Hai {me.tokens} 🪙):
              <input
                type="number"
                min={1}
                max={Math.max(1, me.tokens)}
                value={tradeOfferedTokens}
                onChange={(e) => setTradeOfferedTokens(Number(e.target.value))}
                style={{ width: '100%', padding: '8px', borderRadius: '10px', border: '2px solid #2b2350', marginTop: '4px' }}
              />
            </label>

            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, marginBottom: '12px' }}>
              Tua carta non giocata da dare in cambio:
              <select
                value={selectedHandSwapCardId}
                onChange={(e) => setSelectedHandSwapCardId(e.target.value)}
                style={{ width: '100%', padding: '8px', borderRadius: '10px', border: '2px solid #2b2350', marginTop: '4px' }}
              >
                <option value="">-- Seleziona una tua carta --</option>
                {me.hand.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} (Costo {c.cost})
                  </option>
                ))}
              </select>
            </label>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                className="btn-caramella btn-cream"
                onClick={() => setShowTradeModal(false)}
              >
                Annulla
              </button>
              <button
                className="btn-caramella btn-coral"
                disabled={
                  !tradeTargetPlayerId ||
                  !selectedHandSwapCardId ||
                  me.tokens < tradeOfferedTokens
                }
                onClick={() => {
                  dispatchGameAction({
                    type: 'OFFER_PLAYER_TRADE',
                    fromPlayerId: me.id,
                    toPlayerId: tradeTargetPlayerId,
                    offeredTokens: tradeOfferedTokens,
                    offeredSwapCardId: selectedHandSwapCardId,
                  });
                  setShowTradeModal(false);
                }}
              >
                Invia Offerta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DRAWER REGISTRO DELLE MOSSE */}
      {showLogDrawer && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 115,
            background: 'rgba(20,15,45,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '14px',
          }}
          onClick={() => setShowLogDrawer(false)}
        >
          <div
            className="panel-caramella"
            style={{ width: '100%', maxWidth: '580px', maxHeight: '85dvh', display: 'flex', flexDirection: 'column', padding: '18px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h3 style={{ margin: 0, fontFamily: 'var(--font-title)' }}>
                📜 Registro delle Mosse della Partita
              </h3>
              <button
                className="btn-caramella btn-coral"
                style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                onClick={() => setShowLogDrawer(false)}
              >
                Chiudi
              </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {gameState.actionLog.map((entry) => (
                <div
                  key={entry.id}
                  style={{
                    background: '#ffffff',
                    border: '2px solid #2b2350',
                    borderRadius: '10px',
                    padding: '6px 10px',
                    fontSize: '0.78rem',
                  }}
                >
                  <span style={{ fontWeight: 900, color: '#ea5444' }}>
                    [Giro {entry.turnNumber}]
                  </span>{' '}
                  {entry.message}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODALI GLOBALI: EDITOR CARTE, REGOLE CONFIGURABILI, CARTA RIFERIMENTO */}
      {showCardEditor && (
        <CardEditorModal
          catalog={catalog}
          onSaveCatalog={handleSaveCatalog}
          onClose={() => setShowCardEditor(false)}
        />
      )}

      {showRulesModal && (
        <RulesConfigModal
          config={inRoom ? gameState.config : savedConfig}
          catalog={catalog}
          onSaveConfig={handleSaveConfig}
          onClose={() => setShowRulesModal(false)}
        />
      )}

      {showReferenceModal && (
        <ReferenceCardModal
          config={inRoom ? gameState.config : savedConfig}
          onClose={() => setShowReferenceModal(false)}
        />
      )}
    </div>
  );
};
