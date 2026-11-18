import React from 'react';
import { DiceStage } from '../components/DiceStage';
import { PendingChoiceModal } from '../components/PendingChoiceModal';
import { PlayerHandFan } from '../components/PlayerHandFan';
import { TableBoard } from '../components/TableBoard';
import { useGame } from '../state/GameContext';
import { GameOverScreen } from './GameOverScreen';

export const GameScreen: React.FC = () => {
  const { gameState, me, isMyTurn, setShowMarketDrawer } = useGame();

  if (!me) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {gameState.phase === 'GAME_OVER' && <GameOverScreen />}

      {/* Eventuale scelta interattiva in sospeso (es. Giro di Shot, Sfattonata Collettiva, Il DJ, Lo Sfratto) */}
      <PendingChoiceModal />

      {/* Avvisi rapidi sul tuo giocatore (es. Chiamata Persa o Scambio Mercato Gratis) */}
      {isMyTurn && (me.modifiers.forbidPlayNextTurn || me.modifiers.freeMarketSwapsCount > 0) && (
        <div
          style={{
            display: 'flex',
            gap: '10px',
            flexWrap: 'wrap',
          }}
        >
          {me.modifiers.forbidPlayNextTurn && (
            <div
              style={{
                flex: 1,
                background: '#ea5444',
                color: '#ffffff',
                border: '3px solid #2b2350',
                borderRadius: '16px',
                padding: '10px 14px',
                fontSize: '0.96rem',
                fontWeight: 900,
              }}
            >
              📵 <strong>La Chiamata Persa attiva:</strong> In questo turno non puoi scegliere
              Gioca (puoi solo usare Incassa)!
            </div>
          )}

          {me.modifiers.freeMarketSwapsCount > 0 && (
            <div
              style={{
                flex: 1,
                background: '#bff0da',
                color: '#2b2350',
                border: '3px solid #2b2350',
                borderRadius: '16px',
                padding: '10px 14px',
                fontSize: '0.96rem',
                fontWeight: 900,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px',
              }}
            >
              <span>
                🏪 Hai <strong>{me.modifiers.freeMarketSwapsCount} scambio/i GRATIS</strong> col
                Mercato!
              </span>
              <button
                type="button"
                className="btn-caramella btn-gold"
                style={{ minHeight: '38px', padding: '4px 12px', fontSize: '0.9rem' }}
                onClick={() => setShowMarketDrawer(true)}
              >
                Apri Mercato
              </button>
            </div>
          )}
        </div>
      )}

      {/* 1. PALCO LANCIO DADI (Fase 1 animata quando tocca a te, o vista live avversario) */}
      {gameState.phase === 'PLAYING' && <DiceStage />}

      {/* 2. TAVOLO SEMPRE VISIBILE CON LE CARTE SCOPERTE DI TUTTI */}
      <TableBoard />

      {/* 3. MANO DI CARTE A VENTAGLIO IN BASSO */}
      <PlayerHandFan />
    </div>
  );
};
