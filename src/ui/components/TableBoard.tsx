import React from 'react';
import { evaluateObjective } from '../../engine/objectives';
import { useGame } from '../state/GameContext';
import { CardComponent } from './CardComponent';
import { openCardZoom } from './CardZoomModal';

/**
 * Zona superiore del tavolo: tutti gli avversari disposti attorno al panno verde
 * con le loro carte scoperte appoggiate sul tavolo e un ventaglio compatto per le carte coperte in mano.
 */
export const OpponentsTableZone: React.FC = () => {
  const { gameState, me } = useGame();
  if (!me) return null;

  const opponents = gameState.players.filter((p) => p.id !== me.id);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        padding: '12px 14px 4px',
      }}
    >
      {/* Intestazione compatta giro + eventuali effetti globali sul tavolo */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span
            style={{
              background: 'rgba(15, 11, 35, 0.65)',
              color: '#fffdf6',
              border: '2px solid rgba(255, 253, 246, 0.25)',
              borderRadius: '999px',
              padding: '3px 12px',
              fontFamily: 'var(--font-effect)',
              fontSize: '0.88rem',
              fontWeight: 800,
            }}
          >
            🔄 Giro #{gameState.turnNumber}
          </span>

          {gameState.othersFourDiceUntilPlayerId && (
            <span
              style={{
                background: '#f97316',
                color: '#ffffff',
                border: '2px solid #2b2350',
                borderRadius: '999px',
                padding: '3px 12px',
                fontSize: '0.86rem',
                fontWeight: 900,
              }}
            >
              😴 Sonno Contagioso (4 dadi)
            </span>
          )}

          {gameState.invertComboTableUntilPlayerId && (
            <span
              style={{
                background: '#8b5cf6',
                color: '#ffffff',
                border: '2px solid #2b2350',
                borderRadius: '999px',
                padding: '3px 12px',
                fontSize: '0.86rem',
                fontWeight: 900,
              }}
            >
              🌀 Il Trip attivo (2↔6, 3↔5)
            </span>
          )}
        </div>
      </div>

      {/* Postazioni degli avversari attorno al lato superiore del tavolo */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${Math.max(1, Math.min(opponents.length, 3))}, minmax(210px, 1fr))`,
          gap: '10px',
          alignItems: 'start',
        }}
      >
        {opponents.map((opp) => {
          const isTurn =
            gameState.players[gameState.currentPlayerIndex]?.id === opp.id;
          const canSeeObj =
            gameState.config.objectiveVisibility === 'PUBLIC' ||
            me.modifiers.revealedObjectivePlayerIds.includes(opp.id);

          return (
            <div
              key={opp.id}
              style={{
                background: isTurn
                  ? 'rgba(255, 209, 102, 0.14)'
                  : 'rgba(11, 20, 26, 0.34)',
                border: isTurn
                  ? '2.5px solid #ffd166'
                  : '1.5px solid rgba(255, 253, 246, 0.16)',
                borderRadius: '18px',
                padding: '10px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              {/* Nome + Gettoni + Carte coperte in mano */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '6px',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {isTurn && (
                    <span
                      style={{
                        background: '#ffd166',
                        color: '#2b2350',
                        borderRadius: '999px',
                        padding: '1px 8px',
                        fontSize: '0.76rem',
                        fontWeight: 900,
                      }}
                    >
                      ▶
                    </span>
                  )}
                  <span
                    style={{
                      fontFamily: 'var(--font-title)',
                      fontSize: '1.12rem',
                      color: isTurn ? '#ffd166' : '#fffdf6',
                    }}
                  >
                    {opp.name}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span
                    style={{
                      background: '#ffd166',
                      color: '#2b2350',
                      border: '2px solid #2b2350',
                      borderRadius: '999px',
                      padding: '1px 9px',
                      fontSize: '0.86rem',
                      fontWeight: 900,
                    }}
                  >
                    🪙 {opp.tokens}
                  </span>
                  <span
                    style={{
                      background: 'rgba(255, 253, 246, 0.14)',
                      color: '#fffdf6',
                      border: '1.5px solid rgba(255, 253, 246, 0.3)',
                      borderRadius: '999px',
                      padding: '1px 8px',
                      fontSize: '0.82rem',
                      fontWeight: 800,
                    }}
                    title="Carte coperte in mano"
                  >
                    🃏 {opp.hand.length}
                  </span>
                </div>
              </div>

              {canSeeObj && opp.objective && (
                <div
                  style={{
                    fontSize: '0.82rem',
                    fontWeight: 800,
                    color: '#ffd166',
                    background: 'rgba(0, 0, 0, 0.25)',
                    padding: '4px 8px',
                    borderRadius: '8px',
                  }}
                >
                  🎯 {opp.objective.title}
                </div>
              )}

              {/* Carte scoperte appoggiate sul tavolo davanti all'avversario */}
              <div
                style={{
                  display: 'flex',
                  gap: '8px',
                  overflowX: 'auto',
                  paddingBottom: '2px',
                  minHeight: '64px',
                  alignItems: 'center',
                }}
              >
                {opp.played.length === 0 ? (
                  <span
                    style={{
                      fontSize: '0.84rem',
                      color: 'rgba(255, 253, 246, 0.5)',
                      fontWeight: 700,
                      fontStyle: 'italic',
                    }}
                  >
                    Nessuna carta sul tavolo
                  </span>
                ) : (
                  opp.played.map((card) => (
                    <div key={card.id} style={{ flexShrink: 0 }}>
                      <CardComponent
                        card={card}
                        size="xs"
                        onClick={() =>
                          openCardZoom({
                            card,
                            badge: `IN CAMPO (${opp.name})`,
                          })
                        }
                      />
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/**
 * Zona inferiore del tavolo davanti a te: i 4 slot della tua squadra sul panno verde.
 */
export const MyTableZone: React.FC = () => {
  const { gameState, me, dispatchGameAction } = useGame();
  if (!me) return null;

  const myObjEval = evaluateObjective(me.played, me.objective, gameState.config.teamSize);
  const emptySlots = Math.max(0, gameState.config.teamSize - me.played.length);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '6px',
        padding: '4px 14px 6px',
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: '10px',
          justifyContent: 'center',
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        {me.played.map((card) => {
          const isMismatched = myObjEval.mismatchedCardIds.includes(card.id);
          return (
            <div
              key={card.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <CardComponent
                card={card}
                size="xs"
                selectedBadge={isMismatched ? '⚠️ VIOLAZIONE' : undefined}
                onClick={() =>
                  openCardZoom({
                    card,
                    badge: isMismatched ? '⚠️ VIOLAZIONE OBIETTIVO' : 'IN CAMPO (TUA)',
                  })
                }
              />
              {isMismatched &&
                gameState.config.onObjectiveMismatch === 'ALLOW_RETURN_TO_HAND' && (
                  <button
                    type="button"
                    className="btn-caramella btn-gold"
                    style={{ padding: '4px 8px', minHeight: '32px', fontSize: '0.8rem' }}
                    onClick={() =>
                      dispatchGameAction({
                        type: 'RETURN_MISMATCHED_CARD_TO_HAND',
                        playerId: me.id,
                        playedCardId: card.id,
                      })
                    }
                  >
                    ↩ Riprendi
                  </button>
                )}
            </div>
          );
        })}

        {Array.from({ length: emptySlots }).map((_, i) => (
          <div key={`slot-${i}`} className="table-card-slot">
            Slot {me.played.length + i + 1}/{gameState.config.teamSize}
          </div>
        ))}
      </div>
    </div>
  );
};

export const TableBoard: React.FC = () => {
  return (
    <>
      <OpponentsTableZone />
      <MyTableZone />
    </>
  );
};
