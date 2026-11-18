import React, { useState } from 'react';
import { CardComponent } from '../components/CardComponent';
import { openCardZoom } from '../components/CardZoomModal';
import { useGame } from '../state/GameContext';
import { CLASS_THEME } from '../theme/caramellaTheme';

export const HomeScreen: React.FC = () => {
  const {
    myPlayerName,
    setMyPlayerName,
    joinCodeInput,
    setJoinCodeInput,
    catalog,
    handleCreateHostRoom,
    handleJoinRoomAsClient,
    setShowCardEditor,
    setShowRulesModal,
  } = useGame();

  const [classFilter, setClassFilter] = useState<string>('ALL');

  const heroCards = [
    catalog.find((c) => c.personName.toLowerCase().includes('giorgio')) || catalog[0],
    catalog.find((c) => c.personName.toLowerCase().includes('mariong')) || catalog[1],
    catalog.find((c) => c.rarity === 'PROMO') || catalog[2],
  ].filter(Boolean);

  const filteredCatalog =
    classFilter === 'ALL'
      ? catalog
      : catalog.filter((c) => c.cardClass === classFilter);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* HERO SPLASH CARD CARAMELLA + BOX GIOCA SUBITO */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '20px',
          alignItems: 'stretch',
        }}
      >
        {/* Colonna Sinistra: Hero Caramella con Ventaglio Carte e Introduzione Simpatica */}
        <div
          className="panel-caramella"
          style={{
            padding: '24px',
            background:
              'linear-gradient(155deg, #fffdf6 0%, #eefbf5 55%, #dff8ec 100%)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '18px',
          }}
        >
          <div>
            <div
              style={{
                display: 'inline-block',
                background: '#ffd166',
                color: '#2b2350',
                border: '2px solid #2b2350',
                borderRadius: '999px',
                padding: '4px 14px',
                fontFamily: 'var(--font-effect)',
                fontSize: '0.9rem',
                fontWeight: 800,
                boxShadow: '0 2px 0 #2b2350',
                marginBottom: '10px',
              }}
            >
              🍬 IL GIOCO DI CARTE DELLA COMPAGNIA (3–6 AMICI)
            </div>

            <h1
              style={{
                margin: '0 0 10px',
                fontFamily: 'var(--font-title)',
                fontSize: 'clamp(1.9rem, 4vw, 2.45rem)',
                color: '#2b2350',
                lineHeight: 1.08,
              }}
            >
              Pronti a Spacchettare gli Amici?
            </h1>

            <p
              style={{
                margin: 0,
                fontSize: '1.08rem',
                fontWeight: 800,
                lineHeight: 1.45,
                color: '#2b2350',
              }}
            >
              I tuoi amici sono finiti dentro le bustine! Apri <strong>2 pacchetti</strong>, tira i dadi, ruba gettoni agli <em>Scrocconi</em> e schiera per primo la tua squadra di <strong>4 leggende</strong>!
            </p>
          </div>

          {/* Piccolo ventaglio decorativo di 3 carte cliccabili */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              padding: '10px 0 4px',
              minHeight: '220px',
            }}
          >
            {heroCards.map((hc, idx) => {
              const angles = [-9, 0, 9];
              const offsetsY = [8, -4, 8];
              return (
                <div
                  key={hc.id}
                  style={{
                    transform: `rotate(${angles[idx] || 0}deg) translateY(${offsetsY[idx] || 0}px)`,
                    marginLeft: idx === 0 ? '0' : '-56px',
                    zIndex: idx === 1 ? 5 : idx + 1,
                    transition: 'transform 0.2s ease',
                  }}
                >
                  <CardComponent
                    card={hc}
                    size="sm"
                    onClick={() => openCardZoom({ card: hc })}
                  />
                </div>
              );
            })}
          </div>

          {/* 3 Mini-Badge Visivi "Come si gioca in 10 secondi" */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: '10px',
            }}
          >
            <div
              style={{
                background: '#ffffff',
                border: '3px solid #2b2350',
                borderRadius: '16px',
                padding: '10px 12px',
                boxShadow: '0 3px 0 #2b2350',
              }}
            >
              <div style={{ fontWeight: 900, fontSize: '0.96rem', color: '#ea5444' }}>
                📦 1. Apri 2 Bustine
              </div>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, marginTop: '2px' }}>
                Scegli 4 titolari in mano + 2 riserve per il Mercato
              </div>
            </div>

            <div
              style={{
                background: '#ffffff',
                border: '3px solid #2b2350',
                borderRadius: '16px',
                padding: '10px 12px',
                boxShadow: '0 3px 0 #2b2350',
              }}
            >
              <div style={{ fontWeight: 900, fontSize: '0.96rem', color: '#2b2350' }}>
                🎲 2. Tira i Dadi o Incassa
              </div>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, marginTop: '2px' }}>
                Combina i 5 dadi per giocare o fai cassa di gettoni
              </div>
            </div>

            <div
              style={{
                background: '#ffffff',
                border: '3px solid #2b2350',
                borderRadius: '16px',
                padding: '10px 12px',
                boxShadow: '0 3px 0 #2b2350',
              }}
            >
              <div style={{ fontWeight: 900, fontSize: '0.96rem', color: '#158046' }}>
                🏆 3. 4 Carte + Obiettivo
              </div>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, marginTop: '2px' }}>
                Blocca i doppioni agli amici e vinci la partita!
              </div>
            </div>
          </div>
        </div>

        {/* Colonna Destra: Box GIOCA SUBITO */}
        <div
          className="panel-caramella"
          style={{
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '16px',
          }}
        >
          <div>
            <h2
              style={{
                margin: '0 0 6px',
                fontFamily: 'var(--font-title)',
                fontSize: '1.75rem',
                color: '#2b2350',
              }}
            >
              🚀 Gioca Subito!
            </h2>
            <p style={{ margin: '0 0 16px', fontSize: '0.98rem', fontWeight: 700 }}>
              Ognuno gioca dal proprio telefono: uno crea la stanza e gli altri entrano col codice o col QR Code!
            </p>

            <label
              style={{
                display: 'block',
                fontSize: '1rem',
                fontWeight: 900,
                marginBottom: '16px',
              }}
            >
              😎 Come ti chiamano nel gruppo?
              <input
                type="text"
                placeholder="Es. Giorgio, Mariong, Fra..."
                value={myPlayerName}
                onChange={(e) => setMyPlayerName(e.target.value)}
                style={{
                  width: '100%',
                  marginTop: '6px',
                  padding: '12px 14px',
                  borderRadius: '14px',
                  border: '3px solid #2b2350',
                  fontSize: '1.08rem',
                  fontWeight: 800,
                  background: '#ffffff',
                  color: '#2b2350',
                }}
              />
            </label>

            <button
              type="button"
              className="btn-caramella btn-coral"
              style={{
                width: '100%',
                fontSize: '1.15rem',
                padding: '14px 18px',
                marginBottom: '18px',
              }}
              onClick={handleCreateHostRoom}
            >
              🏠 Crea Stanza con gli Amici
            </button>

            {/* Riquadro Verde Menta: Entra con Codice Stanza */}
            <div
              style={{
                background: '#bff0da',
                border: '3px solid #2b2350',
                borderRadius: '20px',
                padding: '16px',
                boxShadow: '0 4px 0 #2b2350',
              }}
            >
              <div
                style={{
                  fontFamily: 'var(--font-title)',
                  fontSize: '1.2rem',
                  marginBottom: '8px',
                  color: '#2b2350',
                }}
              >
                🔑 Entra con Codice Stanza
              </div>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  placeholder="CODICE (es. K7M4P)"
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                  style={{
                    flex: 1,
                    minWidth: '140px',
                    padding: '12px 14px',
                    borderRadius: '14px',
                    border: '3px solid #2b2350',
                    fontSize: '1.12rem',
                    fontWeight: 900,
                    textTransform: 'uppercase',
                    background: '#fffdf6',
                    color: '#2b2350',
                    letterSpacing: '0.06em',
                  }}
                />
                <button
                  type="button"
                  className="btn-caramella btn-gold"
                  style={{ padding: '12px 20px', fontSize: '1.05rem' }}
                  onClick={() => handleJoinRoomAsClient()}
                >
                  ➔ Entra
                </button>
              </div>
            </div>
          </div>

          {/* Accesso rapido a Editor e Simulatore */}
          <div
            style={{
              display: 'flex',
              gap: '10px',
              flexWrap: 'wrap',
              paddingTop: '8px',
              borderTop: '2px dashed rgba(43,35,80,0.25)',
            }}
          >
            <button
              type="button"
              className="btn-caramella btn-cream"
              style={{ flex: 1, fontSize: '0.95rem' }}
              onClick={() => setShowCardEditor(true)}
            >
              🎨 Personalizza le {catalog.length} Carte
            </button>
            <button
              type="button"
              className="btn-caramella btn-cream"
              style={{ flex: 1, fontSize: '0.95rem' }}
              onClick={() => setShowRulesModal(true)}
            >
              🤖 Regole &amp; Simulatore
            </button>
          </div>
        </div>
      </div>

      {/* GALLERIA DELLE 32 CARTE DEGLI AMICI (Grandi e Filtrabili per Classe) */}
      <div className="panel-night" style={{ padding: '22px' }}>
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
            <h2 style={{ margin: 0, fontFamily: 'var(--font-title)', fontSize: '1.6rem' }}>
              ✨ Galleria delle {catalog.length} Carte degli Amici
            </h2>
            <div style={{ fontSize: '0.96rem', opacity: 0.9, marginTop: '2px' }}>
              Tocca qualsiasi carta (o la lente 🔍) per leggerla in grande formato oppure aprila nell&apos;Editor!
            </div>
          </div>

          <button
            type="button"
            className="btn-caramella btn-mint"
            onClick={() => setShowCardEditor(true)}
          >
            🎨 Apri Editor Carte
          </button>
        </div>

        {/* Filtri Classe con spiegazione */}
        <div
          style={{
            display: 'flex',
            gap: '10px',
            flexWrap: 'wrap',
            marginBottom: '14px',
          }}
        >
          {['ALL', 'Dormienti', 'Utenti', 'Festaioli', 'Scrocconi'].map((cls) => {
            const active = classFilter === cls;
            const theme = CLASS_THEME[cls];
            const count =
              cls === 'ALL'
                ? catalog.length
                : catalog.filter((c) => c.cardClass === cls).length;

            return (
              <button
                key={cls}
                type="button"
                onClick={() => setClassFilter(cls)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '999px',
                  border: '3px solid #fffdf6',
                  background: active ? '#ffd166' : 'rgba(255, 253, 246, 0.14)',
                  color: active ? '#2b2350' : '#fffdf6',
                  fontFamily: 'var(--font-effect)',
                  fontWeight: 800,
                  fontSize: '0.96rem',
                  cursor: 'pointer',
                }}
              >
                {cls === 'ALL' ? `🃏 Tutte (${count})` : `${theme?.emoji || ''} ${cls} (${count})`}
              </button>
            );
          })}
        </div>

        {classFilter !== 'ALL' && CLASS_THEME[classFilter] && (
          <div
            style={{
              background: 'rgba(191, 240, 218, 0.16)',
              border: '2px solid rgba(255, 253, 246, 0.3)',
              borderRadius: '14px',
              padding: '10px 14px',
              marginBottom: '16px',
              fontSize: '0.96rem',
              fontWeight: 700,
            }}
          >
            {CLASS_THEME[classFilter].emoji} <strong>{classFilter}:</strong>{' '}
            {CLASS_THEME[classFilter].tagline}
          </div>
        )}

        {/* Griglia di Carte Grandi (size="md") */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(238px, 1fr))',
            gap: '18px',
            justifyItems: 'center',
          }}
        >
          {filteredCatalog.map((card) => (
            <CardComponent
              key={card.id}
              card={card}
              size="md"
              onClick={() => openCardZoom({ card })}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
