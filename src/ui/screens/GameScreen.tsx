import React from 'react';
import { DiceStage } from '../components/DiceStage';
import { PendingChoiceModal } from '../components/PendingChoiceModal';
import { PlayerHandFan } from '../components/PlayerHandFan';
import { MyTableZone, OpponentsTableZone } from '../components/TableBoard';
import { useGame } from '../state/GameContext';
import { GameOverScreen } from './GameOverScreen';

export const GameScreen: React.FC = () => {
  const { gameState, me, isMyTurn, setShowMarketDrawer } = useGame();

  if (!me) return null;

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        paddingBottom: '8px',
      }}
    >
      {gameState.phase === 'GAME_OVER' && <GameOverScreen />}

      {/* Eventuale scelta interattiva in sospeso (es. Giro di Shot, Sfattonata Collettiva, Il DJ, Lo Sfratto) */}
      <PendingChoiceModal />

      {/* TAVOLO DA GIOCO REALE (Panno verde con giocatori disposti attorno e mano sul bordo inferiore) */}
      <div
        className="game-table-surface"
        style={{
          minHeight: 'calc(100dvh - 86px)',
        }}
      >
        {/* 1. AVVERSARI DISPOSTI ATTORNO AL LATO SUPERIORE DEL TAVOLO */}
        <OpponentsTableZone />

        {/* 2. AVVISI ATTIVI RAPIDI SUL TAVOLO (se presenti) */}
        {isMyTurn && (me.modifiers.forbidPlayNextTurn || me.modifiers.freeMarketSwapsCount > 0) && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '10px',
              flexWrap: 'wrap',
              padding: '0 14px',
            }}
          >
            {me.modifiers.forbidPlayNextTurn && (
              <div
                style={{
                  background: '#ea5444',
                  color: '#ffffff',
                  border: '2.5px solid #2b2350',
                  borderRadius: '999px',
                  padding: '5px 14px',
                  fontSize: '0.9rem',
                  fontWeight: 900,
                }}
              >
                📵 La Chiamata Persa: in questo turno puoi solo usare Incassa!
              </div>
            )}

            {me.modifiers.freeMarketSwapsCount > 0 && (
              <div
                style={{
                  background: '#bff0da',
                  color: '#2b2350',
                  border: '2.5px solid #2b2350',
                  borderRadius: '999px',
                  padding: '4px 14px',
                  fontSize: '0.9rem',
                  fontWeight: 900,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <span>🏪 {me.modifiers.freeMarketSwapsCount} scambio/i GRATIS col Mercato!</span>
                <button
                  type="button"
                  className="btn-caramella btn-gold"
                  style={{ minHeight: '30px', padding: '2px 10px', fontSize: '0.82rem' }}
                  onClick={() => setShowMarketDrawer(true)}
                >
                  Apri
                </button>
              </div>
            )}
          </div>
        )}

        {/* 3. CENTRO DEL TAVOLO: PALCO LANCIO DADI */}
        {gameState.phase === 'PLAYING' && <DiceStage />}

        {/* 4. LE TUE CARTE SCOPERTE SUL TAVOLO (davanti a te) */}
        <MyTableZone />

        {/* 5. LA TUA MANO A VENTAGLIO SUL BORDO INFERIORE (nessun riquadro, nessuna intestazione) */}
        <PlayerHandFan />
      </div>
    </div>
  );
};
