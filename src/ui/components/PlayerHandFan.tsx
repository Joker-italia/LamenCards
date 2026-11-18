import React, { useEffect, useMemo, useState } from 'react';
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
    setTurnUiStage,
    dispatchGameAction,
    setShowMarketDrawer,
    setShowTradeModal,
  } = useGame();

  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [manualExpand, setManualExpand] = useState<boolean>(false);
  const [pendingTargetCard, setPendingTargetCard] = useState<{
    card: CardData;
    useNoComboAlternateCost?: boolean;
  } | null>(null);

  // Quando passo alla Fase 2 (HAND_STAGE), espando automaticamente il ventaglio della mano
  const isHandExpanded =
    (isMyTurn && turnUiStage === 'HAND_STAGE') || manualExpand;

  useEffect(() => {
    if (isMyTurn && turnUiStage === 'DICE_STAGE') {
      setManualExpand(false);
    }
  }, [isMyTurn, turnUiStage]);

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
      <section
        className="panel-caramella"
        style={{
          padding: isHandExpanded ? '18px 18px 22px' : '12px 18px',
          background: isHandExpanded
            ? 'linear-gradient(180deg, #fffdf6 0%, #eefbf5 100%)'
            : '#fffdf6',
          border: '4px solid #2b2350',
          transition: 'all 0.22s ease',
        }}
      >
        {/* Header Mano: Mostra stato, After Party, e bottone per alzare/abbassare la mano */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px',
            marginBottom: isHandExpanded ? '14px' : '6px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0, fontFamily: 'var(--font-title)', fontSize: '1.4rem' }}>
              🖐️ La Tua Mano a Ventaglio ({me.hand.length} carte)
            </h3>

            {isMyTurn && turnUiStage === 'HAND_STAGE' && !gameState.mainActionTaken && (
              <span
                style={{
                  background: '#22c55e',
                  color: '#ffffff',
                  border: '2px solid #2b2350',
                  borderRadius: '999px',
                  padding: '3px 12px',
                  fontSize: '0.88rem',
                  fontWeight: 900,
                }}
              >
                FASE 2: SCEGLI LA TUA MOSSA
              </span>
            )}

            {isMyTurn && me.modifiers.canPlayExtraCardWithoutCombo && (
              <span
                style={{
                  background: '#ffd166',
                  color: '#2b2350',
                  border: '2px solid #2b2350',
                  borderRadius: '999px',
                  padding: '4px 12px',
                  fontSize: '0.9rem',
                  fontWeight: 900,
                }}
              >
                🎉 After Party attivo! Gioca una 2ª carta senza dadi!
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn-caramella btn-cream"
              style={{ minHeight: '40px', padding: '6px 14px', fontSize: '0.9rem' }}
              onClick={() => {
                if (isMyTurn && turnUiStage === 'DICE_STAGE') {
                  setTurnUiStage('HAND_STAGE');
                } else {
                  setManualExpand((prev) => !prev);
                }
              }}
            >
              {isHandExpanded ? '🔽 Racchiudi Mano' : '🔼 Alza Mano di Carte'}
            </button>
          </div>
        </div>

        {/* Barra Azioni del Turno quando tocca a me e siamo nella Fase 2 */}
        {isMyTurn && gameState.phase === 'PLAYING' && isHandExpanded && (
          <div
            style={{
              background: '#f5f2eb',
              border: '3px solid #2b2350',
              borderRadius: '18px',
              padding: '12px 14px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {!gameState.mainActionTaken && (
                <button
                  type="button"
                  className="btn-caramella btn-gold"
                  onClick={() =>
                    dispatchGameAction({ type: 'CASH_IN_DICE', playerId: me.id })
                  }
                >
                  🪙 Non giochi? Scegli INCASSA (+{cashInPreview} Gettoni)
                </button>
              )}

              <button
                type="button"
                className="btn-caramella btn-mint"
                onClick={() => setShowMarketDrawer(true)}
              >
                🏪 Scambia col Mercato (
                {me.modifiers.freeMarketSwapsCount > 0
                  ? 'GRATIS!'
                  : `${gameState.config.marketSwapCost} 🪙`}
                )
              </button>

              {me.played.length < gameState.config.teamSize - 1 &&
                !gameState.hasMadeTradeOfferThisTurn &&
                me.hand.length > 0 && (
                  <button
                    type="button"
                    className="btn-caramella btn-cream"
                    onClick={() => setShowTradeModal(true)}
                  >
                    🤝 Compra Carta da Avversario
                  </button>
                )}
            </div>

            <button
              type="button"
              className="btn-caramella btn-coral"
              style={{
                fontSize: '1.08rem',
                padding: '12px 22px',
              }}
              onClick={() =>
                dispatchGameAction({ type: 'END_TURN', playerId: me.id })
              }
            >
              ➔ Concludi e Passa il Turno
            </button>
          </div>
        )}

        {/* Spotlight della carta selezionata nel ventaglio */}
        {selectedCard && selectedPlayCheck && isHandExpanded && (
          <div
            style={{
              background: '#bff0da',
              border: '3px solid #2b2350',
              borderRadius: '18px',
              padding: '14px 16px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
              boxShadow: '0 4px 0 #2b2350',
            }}
          >
            <div style={{ flex: 1, minWidth: '240px' }}>
              <div style={{ fontFamily: 'var(--font-title)', fontSize: '1.3rem' }}>
                🃏 {selectedCard.name} ({selectedCard.cardClass} • Costo{' '}
                {selectedPlayCheck.standardCost} 🪙)
              </div>
              <div style={{ fontSize: '0.98rem', fontWeight: 800, marginTop: '2px' }}>
                {selectedCard.effectText}
              </div>
              <div style={{ fontSize: '0.9rem', fontWeight: 800, marginTop: '4px', opacity: 0.9 }}>
                {selectedPlayCheck.blockedByOwner ? (
                  <span style={{ color: '#c93b2b' }}>
                    🔒 Bloccata in campo da {selectedPlayCheck.blockedByOwner}! Scambiala col Mercato o usa Lo Sfratto.
                  </span>
                ) : (
                  <>
                    🎲 Richiede:{' '}
                    <strong>
                      {selectedPlayCheck.requiredCombos
                        .map((c) => COMBO_LABELS_IT[c])
                        .join(' / ')}
                    </strong>
                  </>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {isMyTurn && selectedPlayCheck.canPlayStandard && (
                <button
                  type="button"
                  className="btn-caramella btn-coral"
                  style={{ fontSize: '1.08rem', padding: '12px 20px' }}
                  onClick={() => triggerPlayCard(selectedCard, false)}
                >
                  ▶ Gioca Carta ({selectedPlayCheck.standardCost} 🪙)
                </button>
              )}

              {isMyTurn && selectedPlayCheck.canPlayNoComboAlt && (
                <button
                  type="button"
                  className="btn-caramella btn-gold"
                  style={{ fontSize: '1rem', padding: '12px 18px' }}
                  onClick={() => triggerPlayCard(selectedCard, true)}
                >
                  ▶ Gioca senza dadi ({selectedPlayCheck.altCost} 🪙)
                </button>
              )}

              <button
                type="button"
                className="btn-caramella btn-cream"
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
                🔍 Ingrandisci
              </button>
            </div>
          </div>
        )}

        {/* VENTAGLIO DELLE CARTE IN MANO */}
        {me.hand.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '16px',
              fontSize: '1.05rem',
              fontWeight: 800,
            }}
          >
            🎉 Hai schierato tutte le carte della tua mano sul tavolo!
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'flex-end',
              overflowX: 'auto',
              padding: isHandExpanded ? '24px 12px 10px' : '8px 12px 4px',
              gap: isHandExpanded ? '14px' : '0px',
            }}
          >
            {me.hand.map((card, idx) => {
              const playCheck = canPlayCardRightNow(gameState, me, card);
              const isBlocked = Boolean(playCheck.blockedByOwner);
              const canPlayAny =
                isMyTurn && (playCheck.canPlayStandard || playCheck.canPlayNoComboAlt);
              const isSelected = selectedCardId === card.id;

              const badge = isBlocked
                ? `🔒 BLOCCATA (${playCheck.blockedByOwner})`
                : canPlayAny
                ? '✓ GIOCABILE'
                : undefined;

              // Angolo leggero a ventaglio
              const mid = (me.hand.length - 1) / 2;
              const angle = (idx - mid) * (isHandExpanded ? 3.5 : 5);
              const liftY = isSelected ? -20 : Math.abs(idx - mid) * 4;

              return (
                <div
                  key={card.id}
                  style={{
                    flexShrink: 0,
                    marginLeft: !isHandExpanded && idx > 0 ? '-42px' : '0px',
                    transform: `translateY(${liftY}px) rotate(${isSelected ? 0 : angle}deg)`,
                    zIndex: isSelected ? 30 : idx + 1,
                    transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <CardComponent
                    card={card}
                    size={isHandExpanded ? 'md' : 'sm'}
                    canPlayHighlight={canPlayAny}
                    effectiveCost={playCheck.standardCost}
                    selectedBadge={badge}
                    onClick={() => {
                      if (!isHandExpanded) {
                        setManualExpand(true);
                        if (isMyTurn) setTurnUiStage('HAND_STAGE');
                        setSelectedCardId(card.id);
                        return;
                      }
                      setSelectedCardId((prev) => (prev === card.id ? null : card.id));
                    }}
                  />

                  {/* Bottone diretto "Gioca" sotto la carta se il ventaglio è aperto */}
                  {isHandExpanded && isMyTurn && canPlayAny && (
                    <button
                      type="button"
                      className="btn-caramella btn-coral"
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        minHeight: '42px',
                        fontSize: '0.94rem',
                      }}
                      onClick={() =>
                        triggerPlayCard(
                          card,
                          !playCheck.canPlayStandard && playCheck.canPlayNoComboAlt
                        )
                      }
                    >
                      ▶ Gioca ({playCheck.canPlayStandard ? playCheck.standardCost : playCheck.altCost} 🪙)
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* MODALE SCELTA BERSAGLIO PER CARTE OSTACOLO (es. Lo Scroccone, Il Letargo, Lo Sfratto) */}
      {pendingTargetCard && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 190,
            background: 'rgba(18, 13, 40, 0.88)',
            backdropFilter: 'blur(6px)',
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
