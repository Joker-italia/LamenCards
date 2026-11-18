import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  calculateCashInTokens,
  COMBO_LABELS_IT,
  evaluateDiceCombos,
  flipDieOppositeFace,
} from '../../engine/dice';
import {
  canPlayCardRightNow,
  hasLuckyDieInPlay,
} from '../../engine/gameEngine';
import { useGame } from '../state/GameContext';

const DIE_DOT_FACES: Record<number, string> = {
  1: '⚀',
  2: '⚁',
  3: '⚂',
  4: '⚃',
  5: '⚄',
  6: '⚅',
};

export const DiceStage: React.FC = () => {
  const {
    gameState,
    me,
    activePlayer,
    isMyTurn,
    turnUiStage,
    setTurnUiStage,
    dispatchGameAction,
  } = useGame();

  const [isRollingAnim, setIsRollingAnim] = useState(false);
  const prevRollsLeftRef = useRef<number>(gameState.rollsLeft);

  useEffect(() => {
    if (prevRollsLeftRef.current !== gameState.rollsLeft) {
      prevRollsLeftRef.current = gameState.rollsLeft;
      setIsRollingAnim(true);
      const timer = setTimeout(() => setIsRollingAnim(false), 500);
      return () => clearTimeout(timer);
    }
  }, [gameState.rollsLeft, gameState.dice]);

  const achievedCombos = useMemo(() => evaluateDiceCombos(gameState.dice), [gameState.dice]);

  const cashInPreview = useMemo(() => {
    if (!activePlayer) return 1;
    const passiveBonus = gameState.config.enableCardEffects
      ? activePlayer.played.reduce(
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
    activePlayer,
  ]);

  const playableCardsCount = useMemo(() => {
    if (!me || !isMyTurn) return 0;
    return me.hand.filter((c) => {
      const check = canPlayCardRightNow(gameState, me, c);
      return check.canPlayStandard || check.canPlayNoComboAlt;
    }).length;
  }, [gameState, me, isMyTurn]);

  if (!me || !activePlayer) return null;

  const canUseLuckyDieFlip = Boolean(
    isMyTurn &&
      hasLuckyDieInPlay(me, gameState.config.enableCardEffects) &&
      !me.modifiers.usedLuckyDieFlipThisTurn &&
      !gameState.mainActionTaken
  );

  // ============================================================================
  // CASO 1: NON TOCCA A ME (Vista Pulita Osservazione Turno Avversario)
  // ============================================================================
  if (!isMyTurn) {
    const statusLabel = gameState.mainActionTaken
      ? 'Ha completato la mossa principale e sta concludendo il turno...'
      : gameState.rollsLeft > 0
      ? `Sta lanciando i dadi (${gameState.rollsLeft} ritiri rimasti)...`
      : 'Ha finito i tiri e sta scegliendo se giocare una carta o incassare...';

    return (
      <section
        className="panel-caramella"
        style={{
          padding: '18px 20px',
          background: 'linear-gradient(145deg, #fffdf6 0%, #f5f2eb 100%)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px',
            marginBottom: '14px',
          }}
        >
          <div>
            <div
              style={{
                display: 'inline-block',
                background: '#2b2350',
                color: '#ffd166',
                borderRadius: '999px',
                padding: '3px 12px',
                fontSize: '0.86rem',
                fontWeight: 900,
                marginBottom: '4px',
              }}
            >
              ⏳ TURNO DI {activePlayer.name.toUpperCase()}
            </div>
            <h3 style={{ margin: 0, fontFamily: 'var(--font-title)', fontSize: '1.35rem' }}>
              🎲 Dadi in Tavola di {activePlayer.name}
            </h3>
            <div style={{ fontSize: '0.96rem', fontWeight: 700, opacity: 0.88 }}>
              {statusLabel}
            </div>
          </div>

          {/* Combinazioni ottenute dall'avversario */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {achievedCombos.length > 0 ? (
              achievedCombos.map((combo) => (
                <span
                  key={combo}
                  style={{
                    background: '#2b2350',
                    color: '#bff0da',
                    padding: '5px 12px',
                    borderRadius: '999px',
                    fontSize: '0.88rem',
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
                  padding: '5px 12px',
                  borderRadius: '999px',
                  fontSize: '0.88rem',
                  fontWeight: 800,
                }}
              >
                Nessuna combinazione
              </span>
            )}
          </div>
        </div>

        {/* Dadi dell'avversario in sola lettura (vedi cosa tiene e cosa tira in tempo reale) */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          {gameState.dice.map((val, idx) => {
            const kept = gameState.keptDice[idx];
            return (
              <div
                key={idx}
                className={`die-box ${kept ? 'kept' : ''} ${isRollingAnim && !kept ? 'rolling' : ''}`}
                style={{ cursor: 'default' }}
              >
                <span style={{ lineHeight: 1 }}>{val}</span>
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontFamily: 'var(--font-effect)',
                    fontWeight: 800,
                    marginTop: '2px',
                  }}
                >
                  {kept ? '🔒 TENUTO' : 'LIBERO'}
                </span>
              </div>
            );
          })}
        </div>
      </section>
    );
  }

  // ============================================================================
  // CASO 2: TOCCA A ME — FASE 2 COMPATTA (Mano a Ventaglio Alzata)
  // ============================================================================
  if (turnUiStage === 'HAND_STAGE') {
    return (
      <section
        className="panel-caramella"
        style={{
          padding: '12px 18px',
          background: '#bff0da',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'var(--font-title)', fontSize: '1.2rem' }}>
            🎲 I tuoi Dadi:
          </span>
          <div style={{ display: 'flex', gap: '6px' }}>
            {gameState.dice.map((d, i) => (
              <span
                key={i}
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  border: '2.5px solid #2b2350',
                  background: gameState.keptDice[i] ? '#ffd166' : '#fffdf6',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'var(--font-title)',
                  fontSize: '1.2rem',
                  boxShadow: '0 2px 0 #2b2350',
                }}
              >
                {d}
              </span>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {achievedCombos.map((combo) => (
              <span
                key={combo}
                style={{
                  background: '#2b2350',
                  color: '#bff0da',
                  padding: '4px 10px',
                  borderRadius: '999px',
                  fontSize: '0.84rem',
                  fontWeight: 800,
                }}
              >
                ✓ {COMBO_LABELS_IT[combo]}
              </span>
            ))}
          </div>
        </div>

        {!gameState.mainActionTaken && (
          <button
            type="button"
            className="btn-caramella btn-cream"
            style={{ minHeight: '42px', padding: '6px 14px', fontSize: '0.92rem' }}
            onClick={() => setTurnUiStage('DICE_STAGE')}
          >
            🎲 Torna al Vassoio Dadi ({gameState.rollsLeft} tiri rimasti)
          </button>
        )}
      </section>
    );
  }

  // ============================================================================
  // CASO 3: TOCCA A ME — FASE 1 GRANDE ED ANIMATA (Lancio dei Dadi)
  // ============================================================================
  const maxRolls = gameState.config.maxRollsPerTurn;
  const currentRollNumber = Math.min(maxRolls, maxRolls - gameState.rollsLeft);

  return (
    <section
      className="panel-caramella"
      style={{
        padding: '22px',
        background: 'linear-gradient(160deg, #fffdf6 0%, #eefbf5 100%)',
        border: '4px solid #2b2350',
      }}
    >
      {/* Intestazione Fase 1: Tocca a Te — Tira i Dadi */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px',
          marginBottom: '16px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span
              style={{
                background: '#22c55e',
                color: '#ffffff',
                border: '2px solid #2b2350',
                borderRadius: '999px',
                padding: '3px 12px',
                fontFamily: 'var(--font-effect)',
                fontSize: '0.9rem',
                fontWeight: 900,
              }}
            >
              🎯 TOCCA A TE • FASE 1: LANCIO DADI
            </span>
            <span
              style={{
                background: '#ffd166',
                color: '#2b2350',
                border: '2px solid #2b2350',
                borderRadius: '999px',
                padding: '3px 12px',
                fontFamily: 'var(--font-effect)',
                fontSize: '0.9rem',
                fontWeight: 900,
              }}
            >
              Tiro {currentRollNumber} di {maxRolls} ({gameState.rollsLeft} ritiri rimasti)
            </span>
          </div>

          <h3
            style={{
              margin: '8px 0 2px',
              fontFamily: 'var(--font-title)',
              fontSize: '1.55rem',
            }}
          >
            🎲 Tocca i dadi da TENERE e ritira gli altri!
          </h3>
          <div style={{ fontSize: '0.96rem', fontWeight: 700 }}>
            Cerca una combinazione per giocare una carta oppure tieni i <strong>5 e i 6</strong> per fare il pieno con <strong>Incassa</strong>!
          </div>
        </div>

        {/* Combinazioni sbloccate in tempo reale */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: '6px',
          }}
        >
          <span style={{ fontSize: '0.86rem', fontWeight: 900, opacity: 0.8 }}>
            Combinazioni attuali coi dadi:
          </span>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {achievedCombos.length > 0 ? (
              achievedCombos.map((combo) => (
                <span
                  key={combo}
                  style={{
                    background: '#2b2350',
                    color: '#bff0da',
                    padding: '5px 12px',
                    borderRadius: '999px',
                    fontSize: '0.9rem',
                    fontWeight: 900,
                    boxShadow: '0 2px 0 #000',
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
                  padding: '5px 12px',
                  borderRadius: '999px',
                  fontSize: '0.9rem',
                  fontWeight: 800,
                }}
              >
                Nessuna combinazione
              </span>
            )}
          </div>
        </div>
      </div>

      {/* VASSOIO DEI 5 DADI GRANDI ANIMATI */}
      <div
        style={{
          background: '#2b2350',
          borderRadius: '22px',
          padding: '20px 14px',
          marginBottom: '18px',
          display: 'flex',
          justifyContent: 'center',
          gap: '14px',
          flexWrap: 'wrap',
          boxShadow: 'inset 0 4px 12px rgba(0,0,0,0.45)',
        }}
      >
        {gameState.dice.map((val, idx) => {
          const kept = gameState.keptDice[idx];
          return (
            <div
              key={idx}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <div
                className={`die-box ${kept ? 'kept' : ''} ${
                  isRollingAnim && !kept ? 'rolling' : ''
                }`}
                onClick={() =>
                  dispatchGameAction({
                    type: 'TOGGLE_KEEP_DIE',
                    playerId: me.id,
                    dieIndex: idx,
                  })
                }
                title={kept ? 'Tocca per liberare questo dado' : 'Tocca per tenere questo dado'}
              >
                <span style={{ lineHeight: 1 }}>
                  {val} <small style={{ fontSize: '1.1rem' }}>{DIE_DOT_FACES[val]}</small>
                </span>
                <span
                  style={{
                    fontSize: '0.7rem',
                    fontFamily: 'var(--font-effect)',
                    fontWeight: 900,
                    marginTop: '2px',
                  }}
                >
                  {kept ? '🔒 TENUTO' : 'LIBERO'}
                </span>
              </div>

              {canUseLuckyDieFlip && (
                <button
                  type="button"
                  className="btn-caramella btn-mint"
                  style={{
                    minHeight: '34px',
                    padding: '4px 10px',
                    fontSize: '0.82rem',
                  }}
                  onClick={() =>
                    dispatchGameAction({
                      type: 'FLIP_DIE_OPPOSITE',
                      playerId: me.id,
                      dieIndex: idx,
                    })
                  }
                >
                  🔄 Gira in {flipDieOppositeFace(val)}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* AZIONI PRINCIPALI DELLA FASE DADI */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '12px',
        }}
      >
        <button
          type="button"
          className="btn-caramella btn-mint"
          style={{ fontSize: '1.08rem', padding: '14px' }}
          disabled={gameState.rollsLeft <= 0}
          onClick={() => {
            setIsRollingAnim(true);
            setTimeout(() => setIsRollingAnim(false), 500);
            dispatchGameAction({ type: 'ROLL_DICE', playerId: me.id });
          }}
        >
          {gameState.rollsLeft > 0
            ? `🎲 Ritira Dadi Liberi (${gameState.rollsLeft} rimasti)`
            : '🎲 Tiri Terminati (0 rimasti)'}
        </button>

        {gameState.config.paidExtraRollEnabled &&
          gameState.rollsLeft === 0 &&
          me.tokens >= gameState.config.paidExtraRollCost && (
            <button
              type="button"
              className="btn-caramella btn-cream"
              style={{ fontSize: '1.02rem', padding: '14px' }}
              onClick={() =>
                dispatchGameAction({
                  type: 'BUY_EXTRA_ROLL',
                  playerId: me.id,
                })
              }
            >
              ➕ Compra 4° Tiro Extra (-{gameState.config.paidExtraRollCost} 🪙)
            </button>
          )}

        <button
          type="button"
          className="btn-caramella btn-gold"
          style={{ fontSize: '1.08rem', padding: '14px' }}
          onClick={() =>
            dispatchGameAction({ type: 'CASH_IN_DICE', playerId: me.id })
          }
        >
          🪙 Incassa Subito (+{cashInPreview} Gettoni)
        </button>

        <button
          type="button"
          className="btn-caramella btn-coral"
          style={{ fontSize: '1.08rem', padding: '14px' }}
          onClick={() => {
            if (
              gameState.turnStep === 'ROLLING' &&
              gameState.rollsLeft === 0 &&
              !gameState.mainActionTaken
            ) {
              dispatchGameAction({ type: 'CONFIRM_DICE_ROLL', playerId: me.id });
            }
            setTurnUiStage('HAND_STAGE');
          }}
        >
          🃏 Usa questi Dadi / Vai alle Carte ({playableCardsCount} giocabili) ➔
        </button>
      </div>
    </section>
  );
};
