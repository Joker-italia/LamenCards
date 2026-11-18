import React from 'react';
import { useGame } from '../state/GameContext';

export const LogDrawer: React.FC = () => {
  const { gameState, showLogDrawer, setShowLogDrawer } = useGame();

  if (!showLogDrawer) return null;

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
      onClick={() => setShowLogDrawer(false)}
    >
      <div
        className="panel-caramella"
        style={{
          width: '100%',
          maxWidth: '640px',
          maxHeight: '88dvh',
          display: 'flex',
          flexDirection: 'column',
          padding: '20px',
          gap: '12px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontFamily: 'var(--font-title)', fontSize: '1.5rem' }}>
            📜 Registro delle Mosse ({gameState.actionLog.length})
          </h3>
          <button
            type="button"
            className="btn-caramella btn-coral"
            style={{ padding: '6px 14px', minHeight: '42px' }}
            onClick={() => setShowLogDrawer(false)}
          >
            ✕ Chiudi
          </button>
        </div>

        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            paddingRight: '4px',
          }}
        >
          {gameState.actionLog.length === 0 ? (
            <div
              style={{
                background: '#f5f2eb',
                border: '2px solid #2b2350',
                borderRadius: '14px',
                padding: '16px',
                fontSize: '1rem',
                fontWeight: 700,
              }}
            >
              Nessuna mossa ancora registrata.
            </div>
          ) : (
            gameState.actionLog.map((entry) => (
              <div
                key={entry.id}
                style={{
                  background: '#ffffff',
                  border: '2px solid #2b2350',
                  borderRadius: '12px',
                  padding: '10px 14px',
                  fontSize: '0.96rem',
                  fontWeight: 700,
                  lineHeight: 1.35,
                }}
              >
                <span
                  style={{
                    fontWeight: 900,
                    color: '#ea5444',
                    marginRight: '6px',
                  }}
                >
                  [Giro {entry.turnNumber}]
                </span>
                {entry.message}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
