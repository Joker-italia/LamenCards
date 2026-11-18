import React, { useState } from 'react';
import { isPlayerProtectedByPiumone } from '../../engine/gameEngine';
import { useGame } from '../state/GameContext';

export const TradeModal: React.FC = () => {
  const {
    gameState,
    me,
    showTradeModal,
    setShowTradeModal,
    dispatchGameAction,
  } = useGame();

  const [tradeTargetPlayerId, setTradeTargetPlayerId] = useState<string>('');
  const [tradeOfferedTokens, setTradeOfferedTokens] = useState<number>(2);
  const [selectedHandSwapCardId, setSelectedHandSwapCardId] = useState<string>('');
  const [incomingChosenCardId, setIncomingChosenCardId] = useState<string>('');

  if (!me) return null;

  const incomingOffer =
    gameState.pendingTradeOffer &&
    gameState.pendingTradeOffer.status === 'PENDING' &&
    gameState.pendingTradeOffer.toPlayerId === me.id
      ? gameState.pendingTradeOffer
      : null;

  // 1. Modale automatica di Reazione Fuori Turno quando un avversario ti fa un'offerta
  if (incomingOffer) {
    const buyer = gameState.players.find((p) => p.id === incomingOffer.fromPlayerId);
    const chosenId = incomingChosenCardId || me.hand[0]?.id || '';

    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 170,
          background: 'rgba(18, 13, 40, 0.88)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
        }}
      >
        <div
          className="panel-caramella"
          style={{
            width: '100%',
            maxWidth: '500px',
            padding: '22px',
            background: '#ffd166',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          <h3 style={{ margin: 0, fontFamily: 'var(--font-title)', fontSize: '1.55rem' }}>
            🤝 Offerta di Acquisto da {buyer?.name}!
          </h3>
          <p style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>
            <strong>{buyer?.name}</strong> ti offre{' '}
            <span
              style={{
                background: '#fffdf6',
                padding: '2px 10px',
                borderRadius: '999px',
                border: '2px solid #2b2350',
              }}
            >
              🪙 {incomingOffer.offeredTokens} gettoni
            </span>{' '}
            + 1 sua carta coperta in cambio di una tua carta non ancora giocata!
          </p>

          {me.hand.length > 0 && (
            <div
              style={{
                background: '#fffdf6',
                border: '3px solid #2b2350',
                borderRadius: '16px',
                padding: '12px',
              }}
            >
              <label style={{ display: 'block', fontSize: '0.96rem', fontWeight: 900, marginBottom: '6px' }}>
                Se accetti, quale tua carta vuoi cedergli?
              </label>
              <select
                value={chosenId}
                onChange={(e) => setIncomingChosenCardId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '12px',
                  border: '3px solid #2b2350',
                  fontWeight: 800,
                  fontSize: '1rem',
                }}
              >
                {me.hand.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.cardClass} • Costo {c.cost})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn-caramella btn-mint"
              style={{ flex: 1, fontSize: '1.05rem' }}
              onClick={() =>
                dispatchGameAction({
                  type: 'RESPOND_PLAYER_TRADE',
                  accept: true,
                  chosenTargetCardId: chosenId,
                })
              }
            >
              ✓ Accetta (+{incomingOffer.offeredTokens} 🪙)
            </button>
            <button
              type="button"
              className="btn-caramella btn-coral"
              style={{ flex: 1, fontSize: '1.05rem' }}
              onClick={() =>
                dispatchGameAction({
                  type: 'RESPOND_PLAYER_TRADE',
                  accept: false,
                })
              }
            >
              ✕ Rifiuta Offerta
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. Modale per proporre un'offerta durante il proprio turno
  if (!showTradeModal) return null;

  const eligibleTargets = gameState.players.filter(
    (p) =>
      p.id !== me.id &&
      p.hand.length > 0 &&
      !isPlayerProtectedByPiumone(p, gameState.config.enableCardEffects)
  );

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 160,
        background: 'rgba(18, 13, 40, 0.86)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={() => setShowTradeModal(false)}
    >
      <div
        className="panel-caramella"
        style={{
          width: '100%',
          maxWidth: '480px',
          padding: '22px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontFamily: 'var(--font-title)', fontSize: '1.45rem' }}>
            🤝 Compra Carta da un Avversario
          </h3>
          <button
            type="button"
            className="btn-caramella btn-coral"
            style={{ padding: '6px 12px', minHeight: '40px' }}
            onClick={() => setShowTradeModal(false)}
          >
            ✕
          </button>
        </div>

        <p style={{ margin: 0, fontSize: '0.96rem', fontWeight: 700 }}>
          Nel tuo turno puoi fare <strong>1 sola offerta</strong> per comprare una carta non ancora
          giocata da un altro giocatore, dandogli una tua carta non giocata in cambio.
        </p>

        <label style={{ display: 'block', fontSize: '0.96rem', fontWeight: 800 }}>
          A quale giocatore vuoi fare l&apos;offerta?
          <select
            value={tradeTargetPlayerId}
            onChange={(e) => setTradeTargetPlayerId(e.target.value)}
            style={selectFieldStyle}
          >
            <option value="">-- Seleziona avversario --</option>
            {eligibleTargets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} (🃏 {p.hand.length} in mano • 🪙 {p.tokens})
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: 'block', fontSize: '0.96rem', fontWeight: 800 }}>
          Quanti gettoni offri? (Hai {me.tokens} 🪙):
          <input
            type="number"
            min={1}
            max={Math.max(1, me.tokens)}
            value={tradeOfferedTokens}
            onChange={(e) => setTradeOfferedTokens(Number(e.target.value))}
            style={selectFieldStyle}
          />
        </label>

        <label style={{ display: 'block', fontSize: '0.96rem', fontWeight: 800 }}>
          Quale tua carta non giocata cedi in cambio?
          <select
            value={selectedHandSwapCardId}
            onChange={(e) => setSelectedHandSwapCardId(e.target.value)}
            style={selectFieldStyle}
          >
            <option value="">-- Seleziona una tua carta --</option>
            {me.hand.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} (Costo {c.cost} • {c.cardClass})
              </option>
            ))}
          </select>
        </label>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '4px' }}>
          <button
            type="button"
            className="btn-caramella btn-cream"
            onClick={() => setShowTradeModal(false)}
          >
            Annulla
          </button>
          <button
            type="button"
            className="btn-caramella btn-coral"
            disabled={
              !tradeTargetPlayerId ||
              !selectedHandSwapCardId ||
              me.tokens < tradeOfferedTokens ||
              tradeOfferedTokens < 1
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
            📤 Invia Offerta ({tradeOfferedTokens} 🪙)
          </button>
        </div>
      </div>
    </div>
  );
};

const selectFieldStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: '12px',
  border: '3px solid #2b2350',
  marginTop: '6px',
  fontWeight: 800,
  fontSize: '0.98rem',
  background: '#ffffff',
  color: '#2b2350',
};
