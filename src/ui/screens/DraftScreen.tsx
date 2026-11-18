import React, { useState } from 'react';
import { evaluateObjective } from '../../engine/objectives';
import { CardComponent } from '../components/CardComponent';
import { PackOpeningTear } from '../components/PackOpeningTear';
import { useGame } from '../state/GameContext';

export const DraftScreen: React.FC = () => {
  const { gameState, me, dispatchGameAction } = useGame();
  const [draftSelectionMode, setDraftSelectionMode] = useState<'STARTER' | 'RESERVE'>('STARTER');
  const [tradePartnerId, setTradePartnerId] = useState<string>('');
  const [myTradeCardId, setMyTradeCardId] = useState<string>('');
  const [partnerTradeCardId, setPartnerTradeCardId] = useState<string>('');
  const [showPreGameTradeBox, setShowPreGameTradeBox] = useState<boolean>(false);

  if (!me) return null;

  // FASE 2 DEL SETUP: Scelta Carta Obiettivo (pescane 2, tienine 1 coperta)
  if (gameState.phase === 'OBJECTIVE_PICK') {
    return (
      <div className="panel-caramella" style={{ padding: '24px', textAlign: 'center' }}>
        <div
          style={{
            display: 'inline-block',
            background: '#ffd166',
            color: '#2b2350',
            border: '2px solid #2b2350',
            borderRadius: '999px',
            padding: '4px 14px',
            fontFamily: 'var(--font-effect)',
            fontWeight: 900,
            fontSize: '0.9rem',
            marginBottom: '8px',
          }}
        >
          FASE 2 DI 2 • PREPARAZIONE PARTITA
        </div>

        <h2 style={{ margin: '0 0 8px', fontFamily: 'var(--font-title)', fontSize: '1.85rem' }}>
          🎯 Scegli il tuo Obiettivo Coperto!
        </h2>
        <p
          style={{
            margin: '0 auto 20px',
            maxWidth: '640px',
            fontSize: '1.05rem',
            fontWeight: 700,
          }}
        >
          Le squadre sono pronte e le riserve sono nel Mercato! Hai pescato{' '}
          <strong>2 carte Obiettivo</strong>: toccane <strong>1</strong> per tenerla coperta e
          scartare l&apos;altra.
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))',
            gap: '18px',
            marginBottom: '20px',
          }}
        >
          {me.objectiveCandidates.map((obj) => {
            const isSelected = me.objective?.id === obj.id;
            const previewEval = evaluateObjective(me.hand, obj, gameState.config.teamSize);

            return (
              <div
                key={obj.id}
                onClick={() =>
                  dispatchGameAction({
                    type: 'PICK_OBJECTIVE',
                    playerId: me.id,
                    objectiveId: obj.id,
                  })
                }
                style={{
                  background: isSelected ? '#bff0da' : '#ffffff',
                  border: '4px solid #2b2350',
                  borderRadius: '22px',
                  padding: '20px',
                  cursor: 'pointer',
                  boxShadow: '0 6px 0 #2b2350',
                  textAlign: 'left',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '12px',
                }}
              >
                <div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '8px',
                    }}
                  >
                    <span
                      style={{
                        fontFamily: 'var(--font-title)',
                        fontSize: '1.4rem',
                        color: '#ea5444',
                      }}
                    >
                      🎯 {obj.title}
                    </span>
                    {isSelected && (
                      <span
                        style={{
                          background: '#22c55e',
                          color: '#ffffff',
                          padding: '4px 12px',
                          borderRadius: '999px',
                          fontSize: '0.88rem',
                          fontWeight: 900,
                          border: '2px solid #2b2350',
                        }}
                      >
                        SCELTO ✓
                      </span>
                    )}
                  </div>

                  <p style={{ margin: 0, fontWeight: 800, fontSize: '1.08rem', lineHeight: 1.4 }}>
                    {obj.description}
                  </p>
                </div>

                <div
                  style={{
                    fontSize: '0.94rem',
                    background: '#f5f2eb',
                    padding: '10px 12px',
                    borderRadius: '12px',
                    border: '2px solid #2b2350',
                    fontWeight: 800,
                  }}
                >
                  🔍 Compatibilità coi tuoi 4 titolari in mano:{' '}
                  <strong style={{ color: previewEval.satisfied ? '#158046' : '#c93b2b' }}>
                    {previewEval.progressText}
                  </strong>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ fontSize: '0.96rem', fontWeight: 800 }}>
          {me.objective
            ? '✓ Obiettivo scelto! In attesa che tutti gli altri giocatori confermino il proprio...'
            : '👆 Tocca una delle 2 carte Obiettivo qui sopra per confermare!'}
        </div>
      </div>
    );
  }

  // FASE 1 DEL SETUP: Apertura 2 Bustine stile Rainbow Six + Scelta 4 Titolari e 2 Riserve
  const totalPacks = gameState.config.packsPerPlayer;
  const currentPackNumber = totalPacks - me.unopenedPacks.length + 1;
  const nextPackCards = me.unopenedPacks[0] || [];

  const incomingDraftTrades = gameState.pendingDraftTrades.filter(
    (t) => t.toPlayerId === me.id
  );
  const selectedPartner = gameState.players.find((p) => p.id === tradePartnerId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <div className="panel-caramella" style={{ padding: '22px' }}>
        {/* Header Spacchettamento */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            marginBottom: '16px',
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontFamily: 'var(--font-title)', fontSize: '1.65rem' }}>
              📦 Spacchettamento &amp; Scelta Squadra
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '0.98rem', fontWeight: 700 }}>
              Apri le tue <strong>2 bustine da 5 carte</strong>, poi scegli{' '}
              <strong>{gameState.config.teamSize} Titolari</strong> (la tua mano coperta) e{' '}
              <strong>{gameState.config.reserveSize} Riserve</strong> (che andranno nel Mercato).
            </p>
          </div>

          {!me.draftReady && (
            <button
              type="button"
              className="btn-caramella btn-gold"
              onClick={() =>
                dispatchGameAction({ type: 'AUTO_SELECT_DRAFT', playerId: me.id })
              }
            >
              ⚡ Apri Tutto &amp; Scelta Automatica
            </button>
          )}
        </div>

        {/* COMPONENTE RAINBOW SIX SIEGE DRAG-TO-TEAR SE CI SONO BUSTINE DA APRIRE */}
        {me.unopenedPacks.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <PackOpeningTear
              packNumber={currentPackNumber}
              totalPacks={totalPacks}
              nextPackCards={nextPackCards}
              onPackTornOpen={() =>
                dispatchGameAction({ type: 'OPEN_NEXT_PACK', playerId: me.id })
              }
            />
          </div>
        )}

        {/* OFFERTE DI SCAMBIO PRE-PARTITA RICEVUTE */}
        {incomingDraftTrades.length > 0 && (
          <div
            style={{
              background: '#ffd166',
              border: '3px solid #2b2350',
              borderRadius: '18px',
              padding: '14px 16px',
              marginBottom: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <div style={{ fontWeight: 900, fontSize: '1.05rem' }}>
              🤝 Proposte di Scambio Pre-Partita ricevute:
            </div>
            {incomingDraftTrades.map((offer) => {
              const fromP = gameState.players.find((p) => p.id === offer.fromPlayerId);
              const offeredCard = fromP?.pulledPool.find((c) => c.id === offer.fromCardId);
              const wantedCard = me.pulledPool.find((c) => c.id === offer.toCardId);
              return (
                <div
                  key={offer.id}
                  style={{
                    background: '#fffdf6',
                    border: '2px solid #2b2350',
                    borderRadius: '12px',
                    padding: '10px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '10px',
                  }}
                >
                  <span style={{ fontSize: '0.96rem', fontWeight: 800 }}>
                    <strong>{fromP?.name}</strong> ti offre{' '}
                    <strong>&quot;{offeredCard?.name}&quot;</strong> in cambio della tua{' '}
                    <strong>&quot;{wantedCard?.name}&quot;</strong>!
                  </span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      className="btn-caramella btn-mint"
                      style={{ minHeight: '40px', padding: '6px 12px' }}
                      onClick={() =>
                        dispatchGameAction({
                          type: 'ACCEPT_DRAFT_TRADE',
                          tradeId: offer.id,
                        })
                      }
                    >
                      ✓ Accetta
                    </button>
                    <button
                      type="button"
                      className="btn-caramella btn-coral"
                      style={{ minHeight: '40px', padding: '6px 12px' }}
                      onClick={() =>
                        dispatchGameAction({
                          type: 'REJECT_DRAFT_TRADE',
                          tradeId: offer.id,
                        })
                      }
                    >
                      ✕ Rifiuta
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* SELEZIONE 4 TITOLARI + 2 RISERVE DALLE CARTE TROVATE */}
        {me.pulledPool.length > 0 && (
          <div>
            {/* Barra Controlli Selezione */}
            <div
              style={{
                background: '#f5f2eb',
                border: '3px solid #2b2350',
                borderRadius: '18px',
                padding: '14px',
                marginBottom: '18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setDraftSelectionMode('STARTER')}
                  style={{
                    padding: '10px 16px',
                    borderRadius: '14px',
                    border: '3px solid #2b2350',
                    background: draftSelectionMode === 'STARTER' ? '#22c55e' : '#ffffff',
                    color: draftSelectionMode === 'STARTER' ? '#ffffff' : '#2b2350',
                    fontFamily: 'var(--font-effect)',
                    fontWeight: 800,
                    fontSize: '0.98rem',
                    cursor: 'pointer',
                    boxShadow: '0 3px 0 #2b2350',
                  }}
                >
                  ★ 1. Scegli Titolari ({me.selectedStarterIds.length}/{gameState.config.teamSize})
                </button>

                <button
                  type="button"
                  onClick={() => setDraftSelectionMode('RESERVE')}
                  style={{
                    padding: '10px 16px',
                    borderRadius: '14px',
                    border: '3px solid #2b2350',
                    background: draftSelectionMode === 'RESERVE' ? '#ffd166' : '#ffffff',
                    color: '#2b2350',
                    fontFamily: 'var(--font-effect)',
                    fontWeight: 800,
                    fontSize: '0.98rem',
                    cursor: 'pointer',
                    boxShadow: '0 3px 0 #2b2350',
                  }}
                >
                  🏪 2. Scegli Riserve Mercato ({me.selectedReserveIds.length}/
                  {gameState.config.reserveSize})
                </button>

                {!me.draftReady && gameState.players.length > 1 && (
                  <button
                    type="button"
                    className="btn-caramella btn-cream"
                    onClick={() => setShowPreGameTradeBox((prev) => !prev)}
                  >
                    🤝 Scambio Libero Pre-Partita
                  </button>
                )}
              </div>

              <button
                type="button"
                className="btn-caramella btn-coral"
                style={{ fontSize: '1.05rem', padding: '12px 20px' }}
                disabled={
                  me.draftReady ||
                  me.selectedStarterIds.length !== gameState.config.teamSize ||
                  me.selectedReserveIds.length !== gameState.config.reserveSize
                }
                onClick={() =>
                  dispatchGameAction({ type: 'CONFIRM_DRAFT_TEAM', playerId: me.id })
                }
              >
                {me.draftReady
                  ? '✓ Squadra Confermata! (In attesa degli altri...)'
                  : `✓ Conferma ${gameState.config.teamSize} Titolari + ${gameState.config.reserveSize} Riserve`}
              </button>
            </div>

            {/* Box Scambi Liberi Pre-Partita (GDD p.2 punto 3) */}
            {showPreGameTradeBox && !me.draftReady && (
              <div
                style={{
                  background: '#eefbf5',
                  border: '3px solid #2b2350',
                  borderRadius: '18px',
                  padding: '16px',
                  marginBottom: '18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                <div style={{ fontWeight: 900, fontSize: '1rem' }}>
                  🤝 Proponi uno Scambio Libero Pre-Partita con un amico:
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '10px',
                  }}
                >
                  <select
                    value={myTradeCardId}
                    onChange={(e) => setMyTradeCardId(e.target.value)}
                    style={tradeSelectStyle}
                  >
                    <option value="">-- Tua carta da dare --</option>
                    {me.pulledPool.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.cardClass}, {c.cost} 🪙)
                      </option>
                    ))}
                  </select>

                  <select
                    value={tradePartnerId}
                    onChange={(e) => {
                      setTradePartnerId(e.target.value);
                      setPartnerTradeCardId('');
                    }}
                    style={tradeSelectStyle}
                  >
                    <option value="">-- Scegli Amico --</option>
                    {gameState.players
                      .filter((p) => p.id !== me.id && !p.isBot && p.pulledPool.length > 0)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                  </select>

                  <select
                    value={partnerTradeCardId}
                    onChange={(e) => setPartnerTradeCardId(e.target.value)}
                    style={tradeSelectStyle}
                    disabled={!selectedPartner}
                  >
                    <option value="">-- Carta dell&apos;amico --</option>
                    {(selectedPartner?.pulledPool || []).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.cardClass}, {c.cost} 🪙)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <button
                    type="button"
                    className="btn-caramella btn-coral"
                    disabled={!myTradeCardId || !tradePartnerId || !partnerTradeCardId}
                    onClick={() => {
                      dispatchGameAction({
                        type: 'PROPOSE_DRAFT_TRADE',
                        fromPlayerId: me.id,
                        toPlayerId: tradePartnerId,
                        fromCardId: myTradeCardId,
                        toCardId: partnerTradeCardId,
                      });
                      setShowPreGameTradeBox(false);
                    }}
                  >
                    📤 Invia Proposta di Scambio
                  </button>
                </div>
              </div>
            )}

            {/* Griglia Carte Pescate Grandi (size="md") */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(238px, 1fr))',
                gap: '18px',
                justifyItems: 'center',
              }}
            >
              {me.pulledPool.map((card) => {
                const isStarter = me.selectedStarterIds.includes(card.id);
                const isReserve = me.selectedReserveIds.includes(card.id);
                const badge = isStarter
                  ? '★ TITOLARE (IN MANO)'
                  : isReserve
                  ? '🏪 RISERVA (MERCATO)'
                  : undefined;

                const handleSelectRole = (role: 'STARTER' | 'RESERVE') => {
                  if (
                    role === 'STARTER' &&
                    me.selectedStarterIds.length >= gameState.config.teamSize &&
                    !isStarter
                  ) {
                    setDraftSelectionMode('RESERVE');
                    dispatchGameAction({
                      type: 'TOGGLE_DRAFT_SELECTION',
                      playerId: me.id,
                      cardId: card.id,
                      role: 'RESERVE',
                    });
                    return;
                  }
                  dispatchGameAction({
                    type: 'TOGGLE_DRAFT_SELECTION',
                    playerId: me.id,
                    cardId: card.id,
                    role,
                  });
                };

                return (
                  <div
                    key={card.id}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <CardComponent
                      card={card}
                      size="md"
                      selectedBadge={badge}
                      canPlayHighlight={isStarter}
                      onClick={() => handleSelectRole(draftSelectionMode)}
                    />

                    {/* Bottoni rapidi sotto ogni carta per scegliere subito Titolare o Riserva */}
                    {!me.draftReady && (
                      <div style={{ display: 'flex', gap: '6px', width: '100%' }}>
                        <button
                          type="button"
                          onClick={() => handleSelectRole('STARTER')}
                          style={{
                            flex: 1,
                            padding: '6px 8px',
                            borderRadius: '10px',
                            border: '2px solid #2b2350',
                            background: isStarter ? '#22c55e' : '#ffffff',
                            color: isStarter ? '#ffffff' : '#2b2350',
                            fontWeight: 900,
                            fontSize: '0.84rem',
                            cursor: 'pointer',
                          }}
                        >
                          {isStarter ? '★ Titolare ✓' : '★ Titolare'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSelectRole('RESERVE')}
                          style={{
                            flex: 1,
                            padding: '6px 8px',
                            borderRadius: '10px',
                            border: '2px solid #2b2350',
                            background: isReserve ? '#ffd166' : '#ffffff',
                            color: '#2b2350',
                            fontWeight: 900,
                            fontSize: '0.84rem',
                            cursor: 'pointer',
                          }}
                        >
                          {isReserve ? '🏪 Riserva ✓' : '🏪 Riserva'}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Stato avanzamento di tutti i giocatori */}
        <div
          style={{
            marginTop: '20px',
            paddingTop: '14px',
            borderTop: '2px solid rgba(43,35,80,0.2)',
            display: 'flex',
            gap: '10px',
            flexWrap: 'wrap',
            alignItems: 'center',
            fontSize: '0.92rem',
            fontWeight: 800,
          }}
        >
          <span>Stato compagnia:</span>
          {gameState.players.map((p) => (
            <span
              key={p.id}
              style={{
                padding: '4px 12px',
                borderRadius: '999px',
                background: p.draftReady ? '#22c55e' : '#ffd166',
                color: p.draftReady ? '#ffffff' : '#2b2350',
                border: '2px solid #2b2350',
              }}
            >
              {p.name}: {p.draftReady ? 'Pronto ✓' : 'Sta scegliendo...'}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

const tradeSelectStyle: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: '12px',
  border: '2px solid #2b2350',
  background: '#ffffff',
  color: '#2b2350',
  fontWeight: 800,
  fontSize: '0.94rem',
};
