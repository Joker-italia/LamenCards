import React from 'react';
import { evaluateObjective } from '../../engine/objectives';
import { useGame } from '../state/GameContext';
import { CardComponent } from './CardComponent';
import { openCardZoom } from './CardZoomModal';

export const TableBoard: React.FC = () => {
  const { gameState, me, dispatchGameAction } = useGame();

  if (!me) return null;

  const myObjEval = evaluateObjective(me.played, me.objective, gameState.config.teamSize);

  return (
    <section
      className="panel-night"
      style={{
        padding: '18px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}
    >
      {/* Intestazione Tavolo + Effetti Globali Attivi */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px',
          borderBottom: '2px solid rgba(255, 253, 246, 0.2)',
          paddingBottom: '10px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0, fontFamily: 'var(--font-title)', fontSize: '1.35rem' }}>
            🏟️ Carte Scoperte sul Tavolo (Giro #{gameState.turnNumber})
          </h3>

          {gameState.othersFourDiceUntilPlayerId && (
            <span
              style={{
                background: '#f97316',
                color: '#ffffff',
                border: '2px solid #fffdf6',
                borderRadius: '999px',
                padding: '3px 12px',
                fontSize: '0.88rem',
                fontWeight: 900,
              }}
            >
              😴 Sonno Contagioso attivo (4 dadi)
            </span>
          )}

          {gameState.invertComboTableUntilPlayerId && (
            <span
              style={{
                background: '#8b5cf6',
                color: '#ffffff',
                border: '2px solid #fffdf6',
                borderRadius: '999px',
                padding: '3px 12px',
                fontSize: '0.88rem',
                fontWeight: 900,
              }}
            >
              🌀 Il Trip attivo (Costi 2↔6 e 3↔5 invertiti!)
            </span>
          )}
        </div>

        <div style={{ fontSize: '0.9rem', fontWeight: 700, opacity: 0.9 }}>
          Tocca qualsiasi carta in tavola per ingrandirla 🔍
        </div>
      </div>

      {/* Griglia delle Squadre Scoperte di tutti i Giocatori */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '14px',
        }}
      >
        {gameState.players.map((p, idx) => {
          const isTurn = idx === gameState.currentPlayerIndex;
          const isMe = p.id === me.id;
          const canSeeObj =
            isMe ||
            gameState.config.objectiveVisibility === 'PUBLIC' ||
            me.modifiers.revealedObjectivePlayerIds.includes(p.id);

          return (
            <div
              key={p.id}
              style={{
                background: isMe
                  ? 'rgba(191, 240, 218, 0.14)'
                  : 'rgba(255, 253, 246, 0.07)',
                border: isTurn
                  ? '3px solid #ffd166'
                  : isMe
                  ? '3px solid #bff0da'
                  : '2px solid rgba(255, 253, 246, 0.22)',
                borderRadius: '18px',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              {/* Riga Info Giocatore: Nome, Gettoni, Carte Coperte in Mano */}
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
                  {isTurn && (
                    <span
                      style={{
                        background: '#ffd166',
                        color: '#2b2350',
                        border: '2px solid #2b2350',
                        borderRadius: '999px',
                        padding: '2px 10px',
                        fontSize: '0.82rem',
                        fontWeight: 900,
                      }}
                    >
                      ▶ DI TURNO
                    </span>
                  )}
                  <span
                    style={{
                      fontFamily: 'var(--font-title)',
                      fontSize: '1.2rem',
                      color: isMe ? '#bff0da' : '#fffdf6',
                    }}
                  >
                    {p.name} {isMe ? '(Tu)' : ''}
                  </span>
                </div>

                {/* Badge Pubblici: Gettoni + Carte Coperte in Mano + Carte in Gioco */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <span
                    style={{
                      background: '#ffd166',
                      color: '#2b2350',
                      border: '2px solid #2b2350',
                      borderRadius: '999px',
                      padding: '3px 10px',
                      fontSize: '0.9rem',
                      fontWeight: 900,
                    }}
                  >
                    🪙 {p.tokens}
                  </span>

                  <span
                    style={{
                      background: 'rgba(255, 253, 246, 0.16)',
                      color: '#fffdf6',
                      border: '2px solid rgba(255, 253, 246, 0.35)',
                      borderRadius: '999px',
                      padding: '3px 10px',
                      fontSize: '0.88rem',
                      fontWeight: 800,
                    }}
                    title="Carte coperte ancora in mano"
                  >
                    🃏 {p.hand.length} in mano
                  </span>

                  <span
                    style={{
                      background: p.played.length >= gameState.config.teamSize ? '#22c55e' : '#2b2350',
                      color: '#fffdf6',
                      border: '2px solid #fffdf6',
                      borderRadius: '999px',
                      padding: '3px 10px',
                      fontSize: '0.88rem',
                      fontWeight: 900,
                    }}
                  >
                    ⚡ {p.played.length}/{gameState.config.teamSize} in campo
                  </span>
                </div>
              </div>

              {/* Obiettivo Visibile (se pubblico o spiato con Il Ficcanaso) */}
              {canSeeObj && p.objective && (
                <div
                  style={{
                    background: 'rgba(255, 209, 102, 0.16)',
                    border: '1.5px solid rgba(255, 209, 102, 0.5)',
                    borderRadius: '10px',
                    padding: '6px 10px',
                    fontSize: '0.88rem',
                    fontWeight: 800,
                    color: '#ffd166',
                  }}
                >
                  🎯 {isMe ? 'Il tuo Obiettivo:' : 'Obiettivo spiato:'}{' '}
                  <strong>{p.objective.title}</strong> — {p.objective.description}
                </div>
              )}

              {/* Carte Giocate Scoperte davanti a questo Giocatore */}
              {p.played.length === 0 ? (
                <div
                  style={{
                    padding: '16px',
                    borderRadius: '14px',
                    border: '2px dashed rgba(255, 253, 246, 0.25)',
                    textAlign: 'center',
                    fontSize: '0.94rem',
                    opacity: 0.8,
                    fontWeight: 700,
                  }}
                >
                  Nessuna carta ancora schierata in tavola.
                </div>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    gap: '12px',
                    overflowX: 'auto',
                    padding: '4px 2px 8px',
                  }}
                >
                  {p.played.map((card) => {
                    const isMismatched =
                      isMe && (myObjEval?.mismatchedCardIds.includes(card.id) || false);

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
                          selectedBadge={isMismatched ? '⚠️ VIOLAZIONE' : 'IN CAMPO'}
                          onClick={() =>
                            openCardZoom({
                              card,
                              badge: isMismatched ? '⚠️ VIOLAZIONE OBIETTIVO' : `IN CAMPO (${p.name})`,
                            })
                          }
                        />
                        {isMismatched &&
                          gameState.config.onObjectiveMismatch === 'ALLOW_RETURN_TO_HAND' && (
                            <button
                              type="button"
                              className="btn-caramella btn-gold"
                              style={{ padding: '6px 10px', minHeight: '38px', fontSize: '0.86rem' }}
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
          );
        })}
      </div>
    </section>
  );
};
