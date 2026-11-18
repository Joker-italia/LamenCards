import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { useGame } from '../state/GameContext';

export const LobbyScreen: React.FC = () => {
  const {
    myPlayerId,
    roomRole,
    netStatus,
    gameState,
    dispatchGameAction,
    shareInviteLink,
    setShowRulesModal,
    setShowCardEditor,
  } = useGame();

  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedBanner, setCopiedBanner] = useState<boolean>(false);

  const inviteUrl = `${window.location.origin}${window.location.pathname}?room=${gameState.roomCode}`;

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(inviteUrl, {
      width: 200,
      margin: 2,
      color: {
        dark: '#2b2350',
        light: '#fffdf6',
      },
    })
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch(() => {
        // ignore QR error
      });
    return () => {
      active = false;
    };
  }, [inviteUrl]);

  const handleShare = async () => {
    await shareInviteLink();
    setCopiedBanner(true);
    setTimeout(() => setCopiedBanner(false), 2500);
  };

  const minPlayersRequired = gameState.config.allow2PlayersTestMode
    ? 2
    : gameState.config.minPlayers;

  return (
    <div className="panel-caramella" style={{ padding: '24px' }}>
      {/* TOP LOBBY: Codice Stanza Gigante + QR Code + Pulsanti Invito */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '20px',
          borderBottom: '3px solid #2b2350',
          paddingBottom: '20px',
          marginBottom: '20px',
          alignItems: 'center',
        }}
      >
        <div>
          <div
            style={{
              display: 'inline-block',
              background: '#bff0da',
              color: '#2b2350',
              border: '2px solid #2b2350',
              borderRadius: '999px',
              padding: '4px 12px',
              fontSize: '0.88rem',
              fontWeight: 800,
              marginBottom: '8px',
            }}
          >
            📡 {netStatus}
          </div>

          <h2
            style={{
              margin: '0 0 6px',
              fontFamily: 'var(--font-title)',
              fontSize: '2rem',
              lineHeight: 1.1,
            }}
          >
            Codice Stanza:{' '}
            <span
              style={{
                background: '#ffd166',
                color: '#2b2350',
                padding: '2px 14px',
                borderRadius: '14px',
                border: '3px solid #2b2350',
                letterSpacing: '0.08em',
              }}
            >
              {gameState.roomCode}
            </span>
          </h2>

          <p style={{ margin: '8px 0 14px', fontSize: '1rem', fontWeight: 700 }}>
            Fai inquadrare il QR Code agli amici o invia loro il link diretto su WhatsApp/Telegram!
          </p>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn-caramella btn-mint"
              onClick={handleShare}
            >
              {copiedBanner
                ? '✓ Link Copiato negli Appunti!'
                : '📲 Condividi / Copia Link Invito'}
            </button>

            {roomRole === 'HOST' &&
              gameState.players.length < gameState.config.maxPlayers && (
                <button
                  type="button"
                  className="btn-caramella btn-gold"
                  onClick={() =>
                    dispatchGameAction({
                      type: 'ADD_PLAYER',
                      id: `bot-${Date.now()}-${Math.floor(Math.random() * 99)}`,
                      name: `Amico Bot #${gameState.players.length + 1}`,
                      isBot: true,
                    })
                  }
                >
                  🤖 + Aggiungi Bot
                </button>
              )}
          </div>
        </div>

        {/* QR Code per ingresso immediato da iOS / Android */}
        {qrDataUrl && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#fffdf6',
              border: '3px solid #2b2350',
              borderRadius: '20px',
              padding: '12px',
              boxShadow: '0 5px 0 #2b2350',
              justifySelf: 'center',
            }}
          >
            <img
              src={qrDataUrl}
              alt={`QR Code Stanza ${gameState.roomCode}`}
              style={{ width: '164px', height: '164px', borderRadius: '10px' }}
            />
            <span
              style={{
                fontSize: '0.88rem',
                fontWeight: 900,
                marginTop: '6px',
                color: '#2b2350',
              }}
            >
              📷 Inquadra col Telefono per Entrare
            </span>
          </div>
        )}
      </div>

      {/* LISTA GIOCATORI CONNESSI */}
      <h3
        style={{
          margin: '0 0 12px',
          fontFamily: 'var(--font-title)',
          fontSize: '1.4rem',
        }}
      >
        👥 Compagnia al Tavolo ({gameState.players.length}/{gameState.config.maxPlayers} giocatori)
      </h3>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))',
          gap: '12px',
          marginBottom: '20px',
        }}
      >
        {gameState.players.map((p, idx) => (
          <div
            key={p.id}
            style={{
              background: p.id === myPlayerId ? '#bff0da' : '#ffffff',
              border: '3px solid #2b2350',
              borderRadius: '16px',
              padding: '12px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 4px 0 #2b2350',
            }}
          >
            <div>
              <div style={{ fontWeight: 900, fontSize: '1.05rem' }}>
                {idx + 1}. {p.name} {p.id === myPlayerId ? '(Tu)' : ''}
              </div>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, opacity: 0.85, marginTop: '2px' }}>
                {p.isHost
                  ? '👑 Capitano (Host)'
                  : p.isBot
                  ? '🤖 Bot Automatico'
                  : '📱 Smartphone Connesso'}
              </div>
            </div>

            {roomRole === 'HOST' && !p.isHost && (
              <button
                type="button"
                title="Rimuovi giocatore"
                onClick={() =>
                  dispatchGameAction({ type: 'REMOVE_PLAYER', playerId: p.id })
                }
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  border: '2px solid #2b2350',
                  background: '#fffdf6',
                  color: '#c93b2b',
                  fontWeight: 900,
                  fontSize: '1rem',
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>

      {/* RIEPILOGO REGOLE ATTIVE NELLA STANZA */}
      <div
        style={{
          background: '#f5f2eb',
          border: '3px solid #2b2350',
          borderRadius: '18px',
          padding: '14px 16px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ fontSize: '0.96rem', lineHeight: 1.45 }}>
          <div>
            📦 <strong>Spacchettamento:</strong> {gameState.config.packsPerPlayer} bustine da{' '}
            {gameState.config.cardsPerPack} carte → tieni{' '}
            <strong>{gameState.config.teamSize} titolari</strong> +{' '}
            <strong>{gameState.config.reserveSize} riserve</strong> per il Mercato.
          </div>
          <div>
            🪙 <strong>Gettoni iniziali:</strong> {gameState.config.startingTokens} •{' '}
            <strong>Tiri dadi:</strong> {gameState.config.maxRollsPerTurn} •{' '}
            <strong>Obiettivo:</strong>{' '}
            {gameState.config.objectiveVisibility === 'SECRET' ? 'Segreto 🔒' : 'Pubblico 👁️'} •{' '}
            <strong>Blocco doppi:</strong>{' '}
            {gameState.config.blockDuplicateCardsInPlay ? 'Attivo ✓' : 'Disattivato'}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn-caramella btn-cream"
            style={{ fontSize: '0.92rem' }}
            onClick={() => setShowRulesModal(true)}
          >
            ⚙️ {roomRole === 'HOST' ? 'Modifica Regole' : 'Vedi Regole'}
          </button>
          {roomRole === 'HOST' && (
            <button
              type="button"
              className="btn-caramella btn-cream"
              style={{ fontSize: '0.92rem' }}
              onClick={() => setShowCardEditor(true)}
            >
              🎨 Mazzo ({gameState.catalog.length})
            </button>
          )}
        </div>
      </div>

      {/* BOTTONE AVVIO PARTITA */}
      {roomRole === 'HOST' ? (
        <button
          type="button"
          className="btn-caramella btn-coral"
          style={{ width: '100%', padding: '16px', fontSize: '1.2rem' }}
          disabled={gameState.players.length < minPlayersRequired}
          onClick={() => dispatchGameAction({ type: 'START_PACK_OPENING' })}
        >
          {gameState.players.length < minPlayersRequired
            ? `Servono almeno ${minPlayersRequired} giocatori (aggiungi un amico o un Bot!)`
            : '📦 Distribuisci le 2 Bustine da 5 Carte e Inizia!'}
        </button>
      ) : (
        <div
          style={{
            textAlign: 'center',
            fontWeight: 900,
            fontSize: '1.1rem',
            padding: '14px',
            background: '#bff0da',
            borderRadius: '16px',
            border: '3px solid #2b2350',
          }}
        >
          ⏳ Sei dentro! In attesa che l&apos;Host distribuisca le 2 bustine...
        </div>
      )}
    </div>
  );
};
