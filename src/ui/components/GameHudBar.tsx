import React, { useEffect, useRef, useState } from 'react';
import { evaluateObjective } from '../../engine/objectives';
import { useGame } from '../state/GameContext';

export const GameHudBar: React.FC = () => {
  const {
    inRoom,
    gameState,
    me,
    catalog,
    setShowCardEditor,
    setShowRulesModal,
    setShowReferenceModal,
    setShowMarketDrawer,
    setShowLogDrawer,
    setShowObjectiveModal,
    handleLeaveRoom,
    shareInviteLink,
  } = useGame();

  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [tokenDelta, setTokenDelta] = useState<number | null>(null);
  const prevTokensRef = useRef<number | null>(null);
  const [copiedNotice, setCopiedNotice] = useState(false);

  useEffect(() => {
    if (!me) {
      prevTokensRef.current = null;
      return;
    }
    if (prevTokensRef.current !== null && prevTokensRef.current !== me.tokens) {
      const diff = me.tokens - prevTokensRef.current;
      setTokenDelta(diff);
      const timer = setTimeout(() => setTokenDelta(null), 1600);
      prevTokensRef.current = me.tokens;
      return () => clearTimeout(timer);
    }
    prevTokensRef.current = me.tokens;
  }, [me?.tokens, me]);

  const myObjEval = me
    ? evaluateObjective(me.played, me.objective, gameState.config.teamSize)
    : null;

  const handleCopyInvite = async () => {
    await shareInviteLink();
    setCopiedNotice(true);
    setTimeout(() => setCopiedNotice(false), 2000);
  };

  return (
    <header
      style={{
        background: 'rgba(28, 22, 58, 0.97)',
        borderBottom: '4px solid #fffdf6',
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '10px',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: '0 6px 18px rgba(0, 0, 0, 0.45)',
      }}
    >
      {/* SINISTRA: Brand + Contatore Gettoni Sempre in Primo Piano */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <span
          style={{
            fontFamily: 'var(--font-bubbles)',
            fontSize: '1.35rem',
            color: '#bff0da',
            textShadow: '0 2px 0 #ea5444',
            letterSpacing: '0.02em',
          }}
        >
          🃏 LAMENCARDS
        </span>

        {inRoom && me && (
          <div
            style={{
              position: 'relative',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: '#ffd166',
              color: '#2b2350',
              border: '3px solid #2b2350',
              borderRadius: '999px',
              padding: '5px 14px',
              fontFamily: 'var(--font-title)',
              fontSize: '1.2rem',
              boxShadow: '0 3px 0 #2b2350',
            }}
            title="I tuoi Gettoni attuali"
          >
            <span>🪙 {me.tokens}</span>
            <span
              style={{
                fontFamily: 'var(--font-effect)',
                fontSize: '0.82rem',
                fontWeight: 800,
                opacity: 0.85,
              }}
            >
              gettoni
            </span>

            {tokenDelta !== null && tokenDelta !== 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '-14px',
                  right: '-8px',
                  background: tokenDelta > 0 ? '#22c55e' : '#ea5444',
                  color: '#ffffff',
                  border: '2px solid #2b2350',
                  borderRadius: '999px',
                  padding: '2px 8px',
                  fontSize: '0.88rem',
                  fontFamily: 'var(--font-title)',
                  animation: 'floatDelta 1.5s ease forwards',
                  pointerEvents: 'none',
                }}
              >
                {tokenDelta > 0 ? `+${tokenDelta}` : tokenDelta} 🪙
              </span>
            )}
          </div>
        )}

        {inRoom && (
          <button
            type="button"
            onClick={handleCopyInvite}
            style={{
              background: '#ea5444',
              color: '#ffffff',
              border: '2px solid #fffdf6',
              borderRadius: '999px',
              padding: '5px 12px',
              fontFamily: 'var(--font-effect)',
              fontSize: '0.88rem',
              fontWeight: 800,
              cursor: 'pointer',
            }}
            title="Tocca per condividere il link della stanza"
          >
            {copiedNotice ? '✓ Link Copiato!' : `🏠 ${gameState.roomCode}`}
          </button>
        )}
      </div>

      {/* CENTRO / DESTRA: Info Partita Raggruppate + Tasto Impostazioni */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        {inRoom && me && (
          <>
            <button
              type="button"
              className="btn-caramella btn-mint"
              style={{ minHeight: '42px', padding: '6px 12px', fontSize: '0.9rem' }}
              onClick={() => setShowObjectiveModal(true)}
            >
              🎯 Obiettivo ({me.played.length}/{gameState.config.teamSize})
              {myObjEval?.satisfied ? ' ✓' : ''}
            </button>

            <button
              type="button"
              className="btn-caramella btn-cream"
              style={{ minHeight: '42px', padding: '6px 12px', fontSize: '0.9rem' }}
              onClick={() => setShowMarketDrawer(true)}
            >
              🏪 Mercato ({gameState.market.length})
            </button>

            <button
              type="button"
              className="btn-caramella btn-cream"
              style={{ minHeight: '42px', padding: '6px 12px', fontSize: '0.9rem' }}
              onClick={() => setShowLogDrawer(true)}
            >
              📜 Mosse ({gameState.actionLog.length})
            </button>
          </>
        )}

        <button
          type="button"
          className="btn-caramella btn-gold"
          style={{ minHeight: '42px', padding: '6px 12px', fontSize: '0.9rem' }}
          onClick={() => setShowReferenceModal(true)}
        >
          📖 Combinazioni Dadi
        </button>

        {/* Menu Impostazioni Raggruppato */}
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            className="btn-caramella btn-cream"
            style={{ minHeight: '42px', padding: '6px 12px', fontSize: '0.92rem' }}
            onClick={() => setShowSettingsMenu((prev) => !prev)}
          >
            ⚙️ Impostazioni
          </button>

          {showSettingsMenu && (
            <>
              <div
                style={{ position: 'fixed', inset: 0, zIndex: 105 }}
                onClick={() => setShowSettingsMenu(false)}
              />
              <div
                className="panel-caramella"
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 'calc(100% + 8px)',
                  width: '280px',
                  padding: '12px',
                  zIndex: 110,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div
                  style={{
                    fontFamily: 'var(--font-title)',
                    fontSize: '1.05rem',
                    borderBottom: '2px solid #2b2350',
                    paddingBottom: '6px',
                  }}
                >
                  ⚙️ Menu &amp; Strumenti
                </div>

                <button
                  type="button"
                  className="btn-caramella btn-mint"
                  style={{ width: '100%', justifyContent: 'flex-start', fontSize: '0.92rem' }}
                  onClick={() => {
                    setShowSettingsMenu(false);
                    setShowCardEditor(true);
                  }}
                >
                  🎨 Editor Carte ({catalog.length})
                </button>

                <button
                  type="button"
                  className="btn-caramella btn-gold"
                  style={{ width: '100%', justifyContent: 'flex-start', fontSize: '0.92rem' }}
                  onClick={() => {
                    setShowSettingsMenu(false);
                    setShowRulesModal(true);
                  }}
                >
                  ⚙️ Regole &amp; Simulatore Bot
                </button>

                <button
                  type="button"
                  className="btn-caramella btn-cream"
                  style={{ width: '100%', justifyContent: 'flex-start', fontSize: '0.92rem' }}
                  onClick={() => {
                    setShowSettingsMenu(false);
                    setShowReferenceModal(true);
                  }}
                >
                  📖 Carta di Riferimento
                </button>

                {inRoom && (
                  <>
                    <button
                      type="button"
                      className="btn-caramella btn-cream"
                      style={{ width: '100%', justifyContent: 'flex-start', fontSize: '0.92rem' }}
                      onClick={() => {
                        setShowSettingsMenu(false);
                        handleCopyInvite();
                      }}
                    >
                      🔗 Condividi Stanza ({gameState.roomCode})
                    </button>

                    <button
                      type="button"
                      className="btn-caramella btn-coral"
                      style={{ width: '100%', justifyContent: 'flex-start', fontSize: '0.92rem' }}
                      onClick={() => {
                        setShowSettingsMenu(false);
                        handleLeaveRoom();
                      }}
                    >
                      🚪 Esci dalla Stanza
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
