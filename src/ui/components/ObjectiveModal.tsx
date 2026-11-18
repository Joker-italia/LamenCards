import React from 'react';
import { evaluateObjective } from '../../engine/objectives';
import { useGame } from '../state/GameContext';

export const ObjectiveModal: React.FC = () => {
  const { gameState, me, showObjectiveModal, setShowObjectiveModal, dispatchGameAction } =
    useGame();

  if (!showObjectiveModal || !me) return null;

  const myEval = evaluateObjective(me.played, me.objective, gameState.config.teamSize);
  const revealedOpponents = gameState.players.filter(
    (p) =>
      p.id !== me.id &&
      (gameState.config.objectiveVisibility === 'PUBLIC' ||
        me.modifiers.revealedObjectivePlayerIds.includes(p.id))
  );

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 160,
        background: 'rgba(18, 13, 40, 0.86)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={() => setShowObjectiveModal(false)}
    >
      <div
        className="panel-caramella"
        style={{
          width: '100%',
          maxWidth: '540px',
          padding: '22px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontFamily: 'var(--font-title)', fontSize: '1.5rem' }}>
            🎯 Il Tuo Obiettivo di Vittoria
          </h3>
          <button
            type="button"
            className="btn-caramella btn-coral"
            style={{ padding: '6px 14px', minHeight: '42px' }}
            onClick={() => setShowObjectiveModal(false)}
          >
            Chiudi
          </button>
        </div>

        {me.objective ? (
          <div
            style={{
              background: '#bff0da',
              border: '3px solid #2b2350',
              borderRadius: '18px',
              padding: '16px',
              boxShadow: '0 4px 0 #2b2350',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '8px',
                flexWrap: 'wrap',
                marginBottom: '8px',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-title)',
                  fontSize: '1.35rem',
                  color: '#2b2350',
                }}
              >
                {me.objective.title}
              </span>
              <span
                style={{
                  background: myEval.satisfied ? '#22c55e' : '#ea5444',
                  color: '#ffffff',
                  border: '2px solid #2b2350',
                  borderRadius: '999px',
                  padding: '3px 12px',
                  fontSize: '0.88rem',
                  fontWeight: 900,
                }}
              >
                {myEval.progressText}
              </span>
            </div>

            <p style={{ margin: '0 0 10px', fontSize: '1.08rem', fontWeight: 800 }}>
              {me.objective.description}
            </p>

            <div
              style={{
                background: '#fffdf6',
                border: '2px solid #2b2350',
                borderRadius: '12px',
                padding: '10px 12px',
                fontSize: '0.94rem',
                fontWeight: 700,
              }}
            >
              🏆 <strong>Condizione per vincere:</strong> Avere tutte e{' '}
              <strong>{gameState.config.teamSize} le carte</strong> della tua squadra scoperte in
              gioco davanti a te <strong>E</strong> rispettare questo Obiettivo.
            </div>
          </div>
        ) : (
          <div
            style={{
              background: '#f5f2eb',
              border: '2px solid #2b2350',
              borderRadius: '14px',
              padding: '14px',
              fontSize: '1rem',
              fontWeight: 800,
            }}
          >
            Non hai ancora pescato la tua Carta Obiettivo (si pesca subito dopo aver confermato i 4
            titolari e le 2 riserve).
          </div>
        )}

        {myEval.mismatchedCardIds.length > 0 &&
          gameState.config.onObjectiveMismatch === 'ALLOW_RETURN_TO_HAND' && (
            <div
              style={{
                background: '#ffd166',
                border: '3px solid #2b2350',
                borderRadius: '14px',
                padding: '12px',
                fontSize: '0.95rem',
                fontWeight: 800,
              }}
            >
              ⚠️ Hai carte giocate che violano il tuo Obiettivo! Puoi riprenderle in mano:
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
                {me.played
                  .filter((c) => myEval.mismatchedCardIds.includes(c.id))
                  .map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className="btn-caramella btn-coral"
                      onClick={() =>
                        dispatchGameAction({
                          type: 'RETURN_MISMATCHED_CARD_TO_HAND',
                          playerId: me.id,
                          playedCardId: c.id,
                        })
                      }
                    >
                      ↩ Riprendi &quot;{c.name}&quot;
                    </button>
                  ))}
              </div>
            </div>
          )}

        {revealedOpponents.length > 0 && (
          <div
            style={{
              background: '#ffffff',
              border: '2px solid #2b2350',
              borderRadius: '16px',
              padding: '14px',
            }}
          >
            <div style={{ fontWeight: 900, fontSize: '1rem', marginBottom: '8px' }}>
              👁️ Obiettivi degli Avversari ({gameState.config.objectiveVisibility === 'PUBLIC' ? 'Pubblici' : 'Spiati con Il Ficcanaso'}):
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {revealedOpponents.map((opp) => (
                <div
                  key={opp.id}
                  style={{
                    background: '#f5f2eb',
                    border: '2px solid #2b2350',
                    borderRadius: '10px',
                    padding: '8px 12px',
                    fontSize: '0.94rem',
                  }}
                >
                  <strong>{opp.name}:</strong>{' '}
                  {opp.objective ? `${opp.objective.title} — ${opp.objective.description}` : 'Non ancora scelto'}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
