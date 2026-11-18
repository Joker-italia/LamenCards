import React from 'react';
import { useGame } from '../state/GameContext';

export const PendingChoiceModal: React.FC = () => {
  const { gameState, me, dispatchGameAction } = useGame();

  const choice = gameState.pendingChoice;
  if (!choice || !me) return null;

  // Se la scelta spetta a un altro giocatore, mostriamo un banner pubblico non bloccante in alto nel GameScreen
  if (choice.playerId !== me.id) {
    const chooser = gameState.players.find((p) => p.id === choice.playerId);
    return (
      <div
        className="panel-caramella"
        style={{
          background: '#ffd166',
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ fontWeight: 900, fontSize: '1.02rem' }}>
          ⏳ Effetto <strong>&quot;{choice.sourceCardName}&quot;</strong> in corso:{' '}
          {choice.publicMessage || `In attesa della scelta di ${chooser?.name || 'un giocatore'}...`}
        </div>
      </div>
    );
  }

  // Se la scelta spetta a ME, apriamo la modale interattiva grande a centro schermo
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 195,
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
          maxWidth: '540px',
          maxHeight: '90dvh',
          overflowY: 'auto',
          padding: '22px',
          background: '#fffdf6',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}
      >
        <div
          style={{
            display: 'inline-block',
            alignSelf: 'flex-start',
            background: '#ea5444',
            color: '#ffffff',
            border: '2px solid #2b2350',
            borderRadius: '999px',
            padding: '4px 14px',
            fontFamily: 'var(--font-effect)',
            fontSize: '0.88rem',
            fontWeight: 900,
          }}
        >
          ⚡ EFFETTO CARTA: {choice.sourceCardName.toUpperCase()}
        </div>

        <h3 style={{ margin: 0, fontFamily: 'var(--font-title)', fontSize: '1.55rem' }}>
          Tocca a te scegliere!
        </h3>

        <p style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, lineHeight: 1.4 }}>
          {choice.promptText}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
          {choice.options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={
                opt.decision === 'SKIP'
                  ? 'btn-caramella btn-cream'
                  : 'btn-caramella btn-mint'
              }
              style={{
                width: '100%',
                justifyContent: 'flex-start',
                textAlign: 'left',
                fontSize: '1rem',
                padding: '12px 16px',
              }}
              onClick={() =>
                dispatchGameAction({
                  type: 'RESOLVE_PENDING_CHOICE',
                  playerId: me.id,
                  choiceId: choice.id,
                  optionId: opt.id,
                  targetPlayerId: opt.targetPlayerId,
                  cardId: opt.cardId,
                  marketCardId: opt.marketCardId,
                  targetPlayedCardId: opt.targetPlayedCardId,
                  decision: opt.decision,
                })
              }
            >
              ➔ {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
