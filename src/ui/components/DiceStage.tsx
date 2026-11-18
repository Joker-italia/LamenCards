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
      const timer = setTimeout(() => setIsRollingAnim(false), 480);
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
  // CASO 1: NON TOCCA A ME (Osservazione pulita sul panno del tavolo)
  // ============================================================================
  if (!isMyTurn) {
    const statusLabel = gameState.mainActionTaken
      ? 'Ha giocato la sua mossa e sta chiudendo il turno...'
      : gameState.rollsLeft > 0
      ? `Sta tirando i dadi (${gameState.rollsLeft} ritiri rimasti)`
      : 'Ha finito i tiri e sta scegliendo la mossa...';

    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px',
          padding: '10px 14px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}
        >
          <span
            style={{
              background: '#2b2350',
              color: '#ffd166',
              border: '2px solid #ffd166',
              borderRadius: '999px',
              padding: '4px 14px',
              fontFamily: 'var(--font-title)',
              fontSize: '1rem',
            }}
          >
            ⏳ Turno di {activePlayer.name} — {statusLabel}
          </span>

          {achievedCombos.map((combo) => (
            <span
              key={combo}
              style={{
                background: 'rgba(15, 11, 35, 0.78)',
                color: '#bff0da',
                border: '1.5px solid #bff0da',
                padding: '4px 12px',
                borderRadius: '999px',
                fontSize: '0.88rem',
                fontWeight: 800,
              }}
            >
              ✓ {COMBO_LABELS_IT[combo]}
            </span>
          ))}
        </div>

        {/* Dadi dell'avversario direttamente sul feltro */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '12px',
            flexWrap: 'wrap',
            padding: '10px 18px',
            borderRadius: '22px',
            background: 'rgba(0, 0, 0, 0.22)',
            border: '2px solid rgba(255, 253, 246, 0.14)',
          }}
        >
          {gameState.dice.map((val, idx) => {
            const kept = gameState.keptDice[idx];
            return (
              <div
                key={idx}
                className={`die-box ${kept ? 'kept' : ''} ${
                  isRollingAnim && !kept ? 'rolling' : ''
                }`}
                style={{ cursor: 'default', width: '60px', height: '60px', fontSize: '1.7rem' }}
              >
                <span style={{ lineHeight: 1 }}>{val}</span>
                <span
                  style={{
                    fontSize: '0.6rem',
                    fontFamily: 'var(--font-effect)',
                    fontWeight: 800,
                  }}
                >
                  {kept ? '🔒' : DIE_DOT_FACES[val]}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ============================================================================
  // CASO 2: TOCCA A ME — FASE 2 COMPATTA SUL TAVOLO (Mano in primo piano)
  // ============================================================================
  if (turnUiStage === 'HAND_STAGE') {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexWrap: 'wrap',
          gap: '10px',
          padding: '8px 14px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexWrap: 'wrap',
            justifyContent: 'center',
            background: 'rgba(11, 20, 26, 0.55)',
            border: '2px solid rgba(191, 240, 218, 0.55)',
            borderRadius: '20px',
            padding: '8px 14px',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-title)',
              fontSize: '1rem',
              color: '#bff0da',
            }}
          >
            🎲 I tuoi dadi:
          </span>

          <div style={{ display: 'flex', gap: '6px' }}>
            {gameState.dice.map((d, i) => (
              <span
                key={i}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  border: '2.5px solid #2b2350',
                  background: gameState.keptDice[i] ? '#ffd166' : '#fffdf6',
                  color: '#2b2350',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'var(--font-title)',
                  fontSize: '1.15rem',
                  boxShadow: '0 2px 0 #2b2350',
                }}
              >
                {d}
              </span>
            ))}
          </div>

          {achievedCombos.map((combo) => (
            <span
              key={combo}
              style={{
                background: '#bff0da',
                color: '#2b2350',
                padding: '3px 10px',
                borderRadius: '999px',
                fontSize: '0.84rem',
                fontWeight: 900,
              }}
            >
              ✓ {COMBO_LABELS_IT[combo]}
            </span>
          ))}

          {!gameState.mainActionTaken && gameState.rollsLeft > 0 && (
            <button
              type="button"
              className="btn-caramella btn-cream"
              style={{ minHeight: '36px', padding: '4px 12px', fontSize: '0.88rem' }}
              onClick={() => setTurnUiStage('DICE_STAGE')}
            >
              🎲 Torna ai Dadi ({gameState.rollsLeft})
            </button>
          )}
        </div>
      </div>
    );
  }

  // ============================================================================
  // CASO 3: TOCCA A ME — FASE 1 LANCIO DADI DIRETTAMENTE SUL TAVOLO
  // ============================================================================
  const maxRolls = gameState.config.maxRollsPerTurn;
  const currentRollNumber = Math.min(maxRolls, maxRolls - gameState.rollsLeft);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        padding: '10px 14px',
      }}
    >
      {/* Pillole Stato Turno & Combinazioni Sbloccate */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        <span
          style={{
            background: '#22c55e',
            color: '#ffffff',
            border: '2.5px solid #2b2350',
            borderRadius: '999px',
            padding: '4px 14px',
            fontFamily: 'var(--font-title)',
            fontSize: '1.05rem',
            boxShadow: '0 3px 0 #2b2350',
          }}
        >
          🎯 TOCCA A TE • Tiro {currentRollNumber}/{maxRolls}
        </span>

        {achievedCombos.length > 0 ? (
          achievedCombos.map((combo) => (
            <span
              key={combo}
              style={{
                background: '#ffd166',
                color: '#2b2350',
                border: '2.5px solid #2b2350',
                padding: '4px 12px',
                borderRadius: '999px',
                fontSize: '0.92rem',
                fontWeight: 900,
                boxShadow: '0 3px 0 #2b2350',
              }}
            >
              ✓ {COMBO_LABELS_IT[combo]}
            </span>
          ))
        ) : (
          <span
            style={{
              background: 'rgba(15, 11, 35, 0.65)',
              color: '#fffdf6',
              border: '1.5px solid rgba(255, 253, 246, 0.3)',
              padding: '4px 12px',
              borderRadius: '999px',
              fontSize: '0.88rem',
              fontWeight: 800,
            }}
          >
            Tocca i dadi per tenerli
          </span>
        )}
      </div>

      {/* I 5 DADI SUL FELTRO DEL TAVOLO */}
      <div
        style={{
          background: 'rgba(0, 0, 0, 0.25)',
          border: '2px solid rgba(255, 253, 246, 0.18)',
          borderRadius: '24px',
          padding: '14px 20px',
          display: 'flex',
          justifyContent: 'center',
          gap: '14px',
          flexWrap: 'wrap',
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
                    minHeight: '32px',
                    padding: '3px 10px',
                    fontSize: '0.8rem',
                  }}
                  onClick={() =>
                    dispatchGameAction({
                      type: 'FLIP_DIE_OPPOSITE',
                      playerId: me.id,
                      dieIndex: idx,
                    })
                  }
                >
                  🔄 {flipDieOppositeFace(val)}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* PULSANTI AZIONE FLUTTUANTI SUL TAVOLO */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '10px',
          flexWrap: 'wrap',
        }}
      >
        <button
          type="button"
          className="btn-caramella btn-mint"
          style={{ fontSize: '1.02rem', padding: '11px 18px' }}
          disabled={gameState.rollsLeft <= 0}
          onClick={() => {
            setIsRollingAnim(true);
            setTimeout(() => setIsRollingAnim(false), 480);
            dispatchGameAction({ type: 'ROLL_DICE', playerId: me.id });
          }}
        >
          {gameState.rollsLeft > 0
            ? `🎲 Ritira (${gameState.rollsLeft} rimasti)`
            : '🎲 Tiri Terminati'}
        </button>

        {gameState.config.paidExtraRollEnabled &&
          gameState.rollsLeft === 0 &&
          me.tokens >= gameState.config.paidExtraRollCost && (
            <button
              type="button"
              className="btn-caramella btn-cream"
              style={{ fontSize: '0.98rem', padding: '11px 16px' }}
              onClick={() =>
                dispatchGameAction({
                  type: 'BUY_EXTRA_ROLL',
                  playerId: me.id,
                })
              }
            >
              ➕ 4° Tiro (-{gameState.config.paidExtraRollCost} 🪙)
            </button>
          )}

        <button
          type="button"
          className="btn-caramella btn-gold"
          style={{ fontSize: '1.02rem', padding: '11px 18px' }}
          onClick={() =>
            dispatchGameAction({ type: 'CASH_IN_DICE', playerId: me.id })
          }
        >
          🪙 Incassa (+{cashInPreview})
        </button>

        <button
          type="button"
          className="btn-caramella btn-coral"
          style={{ fontSize: '1.02rem', padding: '11px 20px' }}
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
          🃏 Vai alle Carte ({playableCardsCount} giocabili) ➔
        </button>
      </div>
    </div>
  );
};
