import React, { useMemo, useState } from 'react';
import { calculateCashInTokens, COMBO_LABELS_IT } from '../../engine/dice';
import { canPlayCardRightNow } from '../../engine/gameEngine';
import { CardData } from '../../engine/types';
import { useGame } from '../state/GameContext';
import { CardComponent } from './CardComponent';
import { openCardZoom } from './CardZoomModal';

export const PlayerHandFan: React.FC = () => {
  const {
    gameState,
    me,
    isMyTurn,
    turnUiStage,
    dispatchGameAction,
    setShowMarketDrawer,
    setShowTradeModal,
  } = useGame();

  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [pendingTargetCard, setPendingTargetCard] = useState<{
    card: CardData;
    useNoComboAlternateCost?: boolean;
  } | null>(null);

  const isHandFocus = isMyTurn && turnUiStage === 'HAND_STAGE';

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
    return calculateCashInTokens(
      gameState.dice,
      passiveBonus,
      gameState.config.cashInHighFaces
    );
  }, [
    gameState.dice,
    gameState.config.enableCardEffects,
    gameState.config.cashInHighFaces,
    me,
  ]);

  if (!me) return null;

  const selectedCard = me.hand.find((c) => c.id === selectedCardId) || null;
  const selectedPlayCheck = selectedCard
    ? canPlayCardRightNow(gameState, me, selectedCard)
    : null;

  const triggerPlayCard = (card: CardData, useNoComboAlternateCost = false) => {
    if (!isMyTurn) return;
    if (
      gameState.config.enableCardEffects &&
      card.effectModel.requiresTargetPlayer
    ) {
      setPendingTargetCard({ card, useNoComboAlternateCost });
    } else {
      dispatchGameAction({
        type: 'PLAY_CARD',
        playerId: me.id,
        cardId: card.id,
        useNoComboAlternateCost,
      });
      setSelectedCardId(null);
    }
  };

  return (
    <>
      {/* MANO SOSPESE DIRETTAMENTE SUL BORDO INFERIORE DEL TAVOLO (nessun riquadro isolato) */}
      <div
        style={{
          marginTop: 'auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px',
          paddingTop: '4px',
          position: 'relative',
          zIndex: 20,
        }}
      >
        {/* Barra HUD azioni rapide del turno (solo quando tocca a me in Fase 2) */}
        {isHandFocus && gameState.phase === 'PLAYING' && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexWrap: 'wrap',
              gap: '8px',
              padding: '6px 12px',
              background: 'rgba(15, 11, 35, 0.72)',
              border: '2px solid rgba(255, 253, 246, 0.25)',
              borderRadius: '999px',
            }}
          >
            {me.modifiers.canPlayExtraCardWithoutCombo && (
              <span
                style={{
                  background: '#ffd166',
                  color: '#2b2350',
                  borderRadius: '999px',
                  padding: '4px 12px',
                  fontSize: '0.88rem',
                  fontWeight: 900,
                }}
              >
                🎉 After Party attivo!
              </span>
            )}

            {!gameState.mainActionTaken && (
              <button
                type="button"
                className="btn-caramella btn-gold"
                style={{ minHeight: '40px', padding: '6px 14px', fontSize: '0.92rem' }}
                onClick={() =>
                  dispatchGameAction({ type: 'CASH_IN_DICE', playerId: me.id })
                }
              >
                🪙 Incassa (+{cashInPreview})
              </button>
            )}

            <button
              type="button"
              className="btn-caramella btn-mint"
              style={{ minHeight: '40px', padding: '6px 14px', fontSize: '0.92rem' }}
              onClick={() => setShowMarketDrawer(true)}
            >
              🏪 Mercato (
              {me.modifiers.freeMarketSwapsCount > 0
                ? 'GRATIS'
                : `${gameState.config.marketSwapCost} 🪙`}
              )
            </button>

            {me.played.length < gameState.config.teamSize - 1 &&
              !gameState.hasMadeTradeOfferThisTurn &&
              me.hand.length > 0 && (
                <button
                  type="button"
                  className="btn-caramella btn-cream"
                  style={{ minHeight: '40px', padding: '6px 14px', fontSize: '0.92rem' }}
                  onClick={() => setShowTradeModal(true)}
                >
                  🤝 Compra Carta
                </button>
              )}

            <button
              type="button"
              className="btn-caramella btn-coral"
              style={{ minHeight: '40px', padding: '6px 18px', fontSize: '0.96rem' }}
              onClick={() =>
                dispatchGameAction({ type: 'END_TURN', playerId: me.id })
              }
            >
              ➔ Passa il Turno
            </button>
          </div>
        )}

        {/* Pillola flottante della carta toccata nella mano */}
        {selectedCard && selectedPlayCheck && (
          <div
            style={{
              background: '#fffdf6',
              color: '#2b2350',
              border: '3px solid #2b2350',
              borderRadius: '18px',
              padding: '10px 16px',
              boxShadow: '0 6px 0 #2b2350',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
              maxWidth: '720px',
              width: 'calc(100% - 24px)',
            }}
          >
            <div style={{ flex: 1, minWidth: '200px' }}>
              <div style={{ fontFamily: 'var(--font-title)', fontSize: '1.18rem' }}>
                {selectedCard.name} • {selectedPlayCheck.standardCost} 🪙
              </div>
              <div style={{ fontSize: '0.92rem', fontWeight: 800 }}>
                {selectedPlayCheck.blockedByOwner ? (
                  <span style={{ color: '#c93b2b' }}>
                    🔒 Bloccata da {selectedPlayCheck.blockedByOwner} (usa Mercato o Lo Sfratto)
                  </span>
                ) : (
                  <>
                    Richiede:{' '}
                    <strong>
                      {selectedPlayCheck.requiredCombos
                        .map((c) => COMBO_LABELS_IT[c])
                        .join(' / ')}
                    </strong>
                  </>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {isMyTurn && selectedPlayCheck.canPlayStandard && (
                <button
                  type="button"
                  className="btn-caramella btn-coral"
                  style={{ minHeight: '42px', padding: '8px 16px', fontSize: '0.98rem' }}
                  onClick={() => triggerPlayCard(selectedCard, false)}
                >
                  ▶ Gioca ({selectedPlayCheck.standardCost} 🪙)
                </button>
              )}

              {isMyTurn && selectedPlayCheck.canPlayNoComboAlt && (
                <button
                  type="button"
                  className="btn-caramella btn-gold"
                  style={{ minHeight: '42px', padding: '8px 14px', fontSize: '0.94rem' }}
                  onClick={() => triggerPlayCard(selectedCard, true)}
                >
                  ▶ Senza dadi ({selectedPlayCheck.altCost} 🪙)
                </button>
              )}

              <button
                type="button"
                className="btn-caramella btn-cream"
                style={{ minHeight: '42px', padding: '8px 12px', fontSize: '0.92rem' }}
                onClick={() =>
                  openCardZoom({
                    card: selectedCard,
                    effectiveCost: selectedPlayCheck.standardCost,
                    canPlay:
                      isMyTurn &&
                      (selectedPlayCheck.canPlayStandard ||
                        selectedPlayCheck.canPlayNoComboAlt),
                    onPlayCard:
                      isMyTurn && selectedPlayCheck.canPlayStandard
                        ? () => triggerPlayCard(selectedCard, false)
                        : undefined,
                  })
                }
              >
                🔍
              </button>
            </div>
          </div>
        )}

        {/* CARTE IN MANO A VENTAGLIO SUL BORDO INFERIORE */}
        {me.hand.length > 0 && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'flex-end',
              width: '100%',
              overflowX: 'auto',
              padding: isHandFocus ? '18px 16px 8px' : '12px 16px 0px',
              transform: isHandFocus || selectedCardId ? 'translateY(0)' : 'translateY(26px)',
              transition: 'transform 0.22s ease',
            }}
          >
            {me.hand.map((card, idx) => {
              const playCheck = canPlayCardRightNow(gameState, me, card);
              const isBlocked = Boolean(playCheck.blockedByOwner);
              const canPlayAny =
                isMyTurn && (playCheck.canPlayStandard || playCheck.canPlayNoComboAlt);
              const isSelected = selectedCardId === card.id;

              const badge = isBlocked
                ? `🔒 ${playCheck.blockedByOwner}`
                : canPlayAny
                ? '✓ GIOCABILE'
                : undefined;

              const mid = (me.hand.length - 1) / 2;
              const angle = (idx - mid) * 4;
              const arcLift = Math.abs(idx - mid) * 5;
              const liftY = isSelected ? -24 : arcLift;

              return (
                <div
                  key={card.id}
                  style={{
                    flexShrink: 0,
                    marginLeft: idx > 0 ? (isHandFocus ? '-18px' : '-32px') : '0px',
                    transform: `translateY(${liftY}px) rotate(${isSelected ? 0 : angle}deg)`,
                    zIndex: isSelected ? 40 : idx + 1,
                    transition: 'transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <CardComponent
                    card={card}
                    size={isHandFocus ? 'md' : 'sm'}
                    canPlayHighlight={canPlayAny}
                    effectiveCost={playCheck.standardCost}
                    selectedBadge={badge}
                    onClick={() =>
                      setSelectedCardId((prev) => (prev === card.id ? null : card.id))
                    }
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODALE SCELTA BERSAGLIO PER CARTE OSTACOLO */}
      {pendingTargetCard && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 190,
            background: 'rgba(18, 13, 40, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
          onClick={() => setPendingTargetCard(null)}
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
            <h3 style={{ margin: 0, fontFamily: 'var(--font-title)', fontSize: '1.5rem' }}>
              🎯 Scegli il Bersaglio per &quot;{pendingTargetCard.card.name}&quot;
            </h3>
            <p style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>
              {pendingTargetCard.card.effectText}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {gameState.players
                .filter((p) => p.id !== me.id)
                .map((opp) => (
                  <button
                    key={opp.id}
                    type="button"
                    className="btn-caramella btn-mint"
                    style={{ width: '100%', justifyContent: 'space-between', fontSize: '1rem' }}
                    onClick={() => {
                      dispatchGameAction({
                        type: 'PLAY_CARD',
                        playerId: me.id,
                        cardId: pendingTargetCard.card.id,
                        targetPlayerId: opp.id,
                        useNoComboAlternateCost: pendingTargetCard.useNoComboAlternateCost,
                      });
                      setPendingTargetCard(null);
                      setSelectedCardId(null);
                    }}
                  >
                    <span>🎯 Colpisci {opp.name}</span>
                    <span>
                      🪙 {opp.tokens} • ⚡ {opp.played.length} in campo
                    </span>
                  </button>
                ))}

              <button
                type="button"
                className="btn-caramella btn-cream"
                onClick={() => setPendingTargetCard(null)}
              >
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
