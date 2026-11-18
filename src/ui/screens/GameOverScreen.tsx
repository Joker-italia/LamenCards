import React from 'react';
import { CardComponent } from '../components/CardComponent';
import { openCardZoom } from '../components/CardZoomModal';
import { useGame } from '../state/GameContext';

export const GameOverScreen: React.FC = () => {
  const { gameState, roomRole, dispatchGameAction } = useGame();

  const winner = gameState.players.find((p) => p.id === gameState.winnerPlayerId);

  return (
    <div
      className="panel-caramella"
      style={{
        background: 'linear-gradient(155deg, #ffd166 0%, #fffdf6 65%, #bff0da 100%)',
        padding: '24px',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '16px',
      }}
    >
      <div
        style={{
          background: '#2b2350',
          color: '#ffd166',
          borderRadius: '999px',
          padding: '6px 18px',
          fontFamily: 'var(--font-effect)',
          fontWeight: 900,
          fontSize: '0.96rem',
        }}
      >
        🏆 PARTITA CONCLUSA AL GIRO #{gameState.turnNumber}!
      </div>

      <h2
        style={{
          margin: 0,
          fontFamily: 'var(--font-title)',
          fontSize: '2.2rem',
          color: '#2b2350',
        }}
      >
        🎉 Vincitore: {winner?.name || 'Compagnia'}!
      </h2>

      <p style={{ margin: 0, fontSize: '1.08rem', fontWeight: 800, maxWidth: '640px' }}>
        Ha schierato tutte e <strong>{gameState.config.teamSize} le carte</strong> della sua squadra
        rispettando l&apos;Obiettivo coperto:{' '}
        <strong style={{ color: '#c93b2b' }}>
          &quot;{winner?.objective?.title}&quot; ({winner?.objective?.description})
        </strong>
        !
      </p>

      {winner && winner.played.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: '14px',
            justifyContent: 'center',
            flexWrap: 'wrap',
            padding: '8px 0',
          }}
        >
          {winner.played.map((c) => (
            <CardComponent
              key={c.id}
              card={c}
              size="sm"
              selectedBadge="🏆 SQUADRA VINCENTE"
              onClick={() => openCardZoom({ card: c })}
            />
          ))}
        </div>
      )}

      {roomRole === 'HOST' ? (
        <button
          type="button"
          className="btn-caramella btn-coral"
          style={{ fontSize: '1.15rem', padding: '14px 28px' }}
          onClick={() => dispatchGameAction({ type: 'RESET_TO_LOBBY' })}
        >
          ↺ Torna alla Lobby per una Nuova Partita
        </button>
      ) : (
        <div style={{ fontSize: '1rem', fontWeight: 800 }}>
          ⏳ In attesa che l&apos;Host avvii la rivincita...
        </div>
      )}
    </div>
  );
};
