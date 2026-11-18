import React from 'react';
import { getLoSponsorDiscount } from './engine/gameEngine';
import { CardEditorModal } from './ui/components/CardEditorModal';
import { CardZoomModal } from './ui/components/CardZoomModal';
import { GameHudBar } from './ui/components/GameHudBar';
import { LogDrawer } from './ui/components/LogDrawer';
import { MarketDrawer } from './ui/components/MarketDrawer';
import { ObjectiveModal } from './ui/components/ObjectiveModal';
import { ReferenceCardModal } from './ui/components/ReferenceCardModal';
import { RulesConfigModal } from './ui/components/RulesConfigModal';
import { TradeModal } from './ui/components/TradeModal';
import { DraftScreen } from './ui/screens/DraftScreen';
import { GameScreen } from './ui/screens/GameScreen';
import { HomeScreen } from './ui/screens/HomeScreen';
import { LobbyScreen } from './ui/screens/LobbyScreen';
import { GameProvider, useGame } from './ui/state/GameContext';

const AppShell: React.FC = () => {
  const {
    inRoom,
    roomRole,
    gameState,
    me,
    catalog,
    savedConfig,
    showCardEditor,
    setShowCardEditor,
    showRulesModal,
    setShowRulesModal,
    showReferenceModal,
    setShowReferenceModal,
    handleSaveCatalog,
    handleSaveConfig,
  } = useGame();

  const activeConfig = inRoom ? gameState.config : savedConfig;
  const sponsorDiscount = me
    ? getLoSponsorDiscount(me, activeConfig.enableCardEffects)
    : 0;
  const isTripActive = Boolean(inRoom && gameState.invertComboTableUntilPlayerId !== null);

  const isTabletopMode =
    inRoom && (gameState.phase === 'PLAYING' || gameState.phase === 'GAME_OVER');

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      {/* BARRA SUPERIORE FISSA SEMPRE A SCHERMO (Contatore Gettoni + Info Partita + Impostazioni) */}
      <GameHudBar />

      {/* CONTENUTO PRINCIPALE (Router Schermate) */}
      <main
        style={{
          flex: 1,
          width: '100%',
          maxWidth: isTabletopMode ? '1440px' : '1180px',
          margin: '0 auto',
          padding: isTabletopMode ? '8px 10px 0' : '16px 14px 40px',
          display: 'flex',
          flexDirection: 'column',
          gap: isTabletopMode ? '8px' : '18px',
        }}
      >
        {!inRoom && <HomeScreen />}
        {inRoom && gameState.phase === 'LOBBY' && <LobbyScreen />}
        {inRoom &&
          (gameState.phase === 'PACK_OPENING' || gameState.phase === 'OBJECTIVE_PICK') && (
            <DraftScreen />
          )}
        {inRoom &&
          (gameState.phase === 'PLAYING' || gameState.phase === 'GAME_OVER') && (
            <GameScreen />
          )}
      </main>

      {/* DRAWER & MODALI GLOBALI */}
      <CardZoomModal config={activeConfig} />
      <ObjectiveModal />
      <MarketDrawer />
      <LogDrawer />
      <TradeModal />

      {showCardEditor && (
        <CardEditorModal
          catalog={catalog}
          onSaveCatalog={handleSaveCatalog}
          onClose={() => setShowCardEditor(false)}
        />
      )}

      {showRulesModal && (
        <RulesConfigModal
          config={activeConfig}
          catalog={catalog}
          readOnly={inRoom && roomRole === 'CLIENT'}
          onSaveConfig={handleSaveConfig}
          onClose={() => setShowRulesModal(false)}
        />
      )}

      {showReferenceModal && (
        <ReferenceCardModal
          config={activeConfig}
          invertComboTableActive={isTripActive}
          sponsorDiscount={sponsorDiscount}
          onClose={() => setShowReferenceModal(false)}
        />
      )}
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <GameProvider>
      <AppShell />
    </GameProvider>
  );
};
