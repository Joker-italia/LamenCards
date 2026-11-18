import React, { useState } from 'react';
import { isCardBlockedByTable } from '../../engine/gameEngine';
import { useGame } from '../state/GameContext';
import { CardComponent } from './CardComponent';

export const MarketDrawer: React.FC = () => {
  const {
    gameState,
    me,
    isMyTurn,
    showMarketDrawer,
    setShowMarketDrawer,
    dispatchGameAction,
  } = useGame();

  const [selectedMarketCardId, setSelectedMarketCardId] = useState<string>('');
  const [selectedHandSwapCardId, setSelectedHandSwapCardId] = useState<string>('');

  if (!showMarketDrawer || !me) return null;

  const hasFreeSwap = me.modifiers.freeMarketSwapsCount > 0;
  const swapCost = hasFreeSwap ? 0 : gameState.config.marketSwapCost;
  const canAffordSwap =
    isMyTurn &&
    me.hand.length > 0 &&
    (hasFreeSwap ||
      (!gameState.hasUsedMarketThisTurn &&
        me.tokens >= swapCost &&
        (gameState.config.marketSwapTiming === 'FREE_IN_TURN' || !gameState.mainActionTaken)));

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 155,
        background: 'rgba(18, 13, 40, 0.86)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '14px',
      }}
      onClick={() => setShowMarketDrawer(false)}
    >
      <div
        className="panel-caramella"
        style={{
          width: '100%',
          maxWidth: '860px',
          maxHeight: '90dvh',
          overflowY: 'auto',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontFamily: 'var(--font-title)', fontSize: '1.5rem' }}>
              🏪 Mercato Centrale ({gameState.market.length} Carte Scoperte)
            </h3>
            <div style={{ fontSize: '0.96rem', fontWeight: 700, marginTop: '2px' }}>
              Nel tuo turno puoi scambiare 1 tua carta non giocata con 1 carta del Mercato per{' '}
              <strong>
                {hasFreeSwap ? '0 Gettoni (SCAMBIO GRATIS ATTIVO!)' : `${swapCost} Gettone/i`}
              </strong>
              .
            </div>
          </div>

          <button
            type="button"
            className="btn-caramella btn-coral"
            style={{ padding: '6px 14px', minHeight: '42px' }}
            onClick={() => setShowMarketDrawer(false)}
          >
            ✕ Chiudi
          </button>
        </div>

        {gameState.market.length === 0 ? (
          <div
            style={{
              background: '#f5f2eb',
              border: '2px solid #2b2350',
              borderRadius: '16px',
              padding: '18px',
              textAlign: 'center',
              fontSize: '1rem',
              fontWeight: 800,
            }}
          >
            Il Mercato si riempie con le 2 riserve di ogni giocatore appena termina il Draft!
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              gap: '14px',
              overflowX: 'auto',
              padding: '6px 4px 12px',
            }}
          >
            {gameState.market.map((mc) => {
              const blockCheck = isCardBlockedByTable(gameState, mc);
              const isSelected = selectedMarketCardId === mc.id;
              const badge = isSelected
                ? '✓ SCELTA DAL MERCATO'
                : blockCheck.blocked
                ? `🔒 IN CAMPO (${blockCheck.ownerName})`
                : undefined;

              return (
                <div key={mc.id} style={{ flexShrink: 0 }}>
                  <CardComponent
                    card={mc}
                    size="sm"
                    selectedBadge={badge}
                    canPlayHighlight={isSelected}
                    onClick={() => setSelectedMarketCardId(mc.id)}
                  />
                </div>
              );
            })}
          </div>
        )}

        {isMyTurn && gameState.phase === 'PLAYING' && me.hand.length > 0 && (
          <div
            style={{
              background: '#eefbf5',
              border: '3px solid #2b2350',
              borderRadius: '18px',
              padding: '14px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <div style={{ fontSize: '1rem', fontWeight: 900 }}>
              🔄 Scegli quale tua carta non giocata lasciare nel Mercato in cambio:
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {me.hand.map((hc) => {
                const blocked = isCardBlockedByTable(gameState, hc).blocked;
                const active = selectedHandSwapCardId === hc.id;
                return (
                  <button
                    key={hc.id}
                    type="button"
                    onClick={() => setSelectedHandSwapCardId(hc.id)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '12px',
                      border: '3px solid #2b2350',
                      background: active ? '#ea5444' : '#ffffff',
                      color: active ? '#ffffff' : '#2b2350',
                      fontWeight: 800,
                      fontSize: '0.94rem',
                      cursor: 'pointer',
                    }}
                  >
                    Cedi: {hc.name} (Costo {hc.cost}) {blocked ? '🔒 Bloccata' : ''}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              className="btn-caramella btn-coral"
              disabled={!selectedMarketCardId || !selectedHandSwapCardId || !canAffordSwap}
              onClick={() => {
                dispatchGameAction({
                  type: 'MARKET_SWAP',
                  playerId: me.id,
                  handCardId: selectedHandSwapCardId,
                  marketCardId: selectedMarketCardId,
                });
                setSelectedMarketCardId('');
                setSelectedHandSwapCardId('');
                setShowMarketDrawer(false);
              }}
            >
              ✓ Conferma Scambio col Mercato ({hasFreeSwap ? 'GRATIS!' : `-${swapCost} 🪙`})
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
