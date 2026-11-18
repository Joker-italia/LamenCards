import React, { useEffect, useRef, useState } from 'react';
import { CardData } from '../../engine/types';
import { CardComponent } from './CardComponent';
import { openCardZoom } from './CardZoomModal';

interface PackOpeningTearProps {
  packNumber: number;
  totalPacks: number;
  nextPackCards: CardData[];
  onPackTornOpen: () => void;
}

export const PackOpeningTear: React.FC<PackOpeningTearProps> = ({
  packNumber,
  totalPacks,
  nextPackCards,
  onPackTornOpen,
}) => {
  const [tearProgress, setTearProgress] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [revealedCards, setRevealedCards] = useState<CardData[] | null>(null);
  const [openedPackIndex, setOpenedPackIndex] = useState<number>(packNumber);

  const packRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef<boolean>(false);
  const startXRef = useRef<number>(0);
  const progressRef = useRef<number>(0);
  const hasTriggeredRef = useRef<boolean>(false);

  // Ogni volta che cambia la bustina (es. da #1 a #2), azzera lo stato dello strappo
  useEffect(() => {
    progressRef.current = 0;
    isDraggingRef.current = false;
    hasTriggeredRef.current = false;
    setTearProgress(0);
    setIsDragging(false);
    setRevealedCards(null);
  }, [packNumber]);

  // Calcola il colore del bagliore interno in base alla rarità massima contenuta nella bustina
  const hasPromo = nextPackCards.some((c) => c.rarity === 'PROMO');
  const hasRare = nextPackCards.some((c) => c.rarity === 'Rara');

  const glowColor = hasPromo
    ? 'linear-gradient(90deg, #ff6ec7, #ffd166, #5ce1e6, #a855f7)'
    : hasRare
    ? 'linear-gradient(90deg, #ffd166, #ff9f1c, #ffe66d)'
    : 'linear-gradient(90deg, #bff0da, #5ce1e6, #8ce0bc)';

  const glowShadowColor = hasPromo
    ? 'rgba(236, 72, 153, 0.85)'
    : hasRare
    ? 'rgba(255, 209, 102, 0.85)'
    : 'rgba(92, 225, 230, 0.8)';

  const triggerCompleteTear = () => {
    if (hasTriggeredRef.current) return;
    hasTriggeredRef.current = true;
    isDraggingRef.current = false;
    progressRef.current = 100;

    setIsDragging(false);
    setTearProgress(100);
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([30, 40, 70]);
    }
    setOpenedPackIndex(packNumber);
    setRevealedCards([...nextPackCards]);
  };

  const updateDragFromClientX = (clientX: number) => {
    if (!packRef.current || hasTriggeredRef.current) return;
    const rect = packRef.current.getBoundingClientRect();
    const width = Math.max(1, rect.width);

    // Calcola sia la posizione lungo la bustina sia la distanza trascinata dal punto iniziale
    const absPct = ((clientX - rect.left) / width) * 100;
    const deltaPct = ((clientX - startXRef.current) / (width * 0.65)) * 100;
    const rawPct = Math.max(0, Math.min(100, Math.max(absPct, deltaPct)));
    const pct = Math.round(rawPct);

    if (pct > progressRef.current) {
      progressRef.current = pct;
      setTearProgress(pct);
      if (pct % 20 === 0 && typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(10);
      }
    }

    if (pct >= 72) {
      triggerCompleteTear();
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (hasTriggeredRef.current) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore on unsupported browsers
    }
    isDraggingRef.current = true;
    startXRef.current = e.clientX;
    setIsDragging(true);
    updateDragFromClientX(e.clientX);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || hasTriggeredRef.current) return;
    updateDragFromClientX(e.clientX);
  };

  const handlePointerUp = () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setIsDragging(false);
    if (!hasTriggeredRef.current && progressRef.current < 72) {
      progressRef.current = 0;
      setTearProgress(0);
    }
  };

  const handleContinueAfterReveal = () => {
    // Sposta effettivamente le carte nel pool del giocatore e passa alla bustina #2 (o al Draft)
    progressRef.current = 0;
    isDraggingRef.current = false;
    hasTriggeredRef.current = false;
    setTearProgress(0);
    setRevealedCards(null);
    onPackTornOpen();
  };

  // Se abbiamo appena strappato una bustina, mostra le 5 carte rivelate con animazione!
  if (revealedCards && revealedCards.length > 0) {
    return (
      <div
        style={{
          background: 'linear-gradient(165deg, #2b2350 0%, #1c163a 100%)',
          border: '4px solid #ffd166',
          borderRadius: '24px',
          padding: '22px',
          textAlign: 'center',
          color: '#fffdf6',
          boxShadow: `0 0 30px ${glowShadowColor}`,
        }}
      >
        <div
          style={{
            display: 'inline-block',
            background: '#ffd166',
            color: '#2b2350',
            borderRadius: '999px',
            padding: '4px 16px',
            fontFamily: 'var(--font-effect)',
            fontWeight: 900,
            fontSize: '0.95rem',
            marginBottom: '8px',
          }}
        >
          🎉 BUSTINA #{openedPackIndex} APERTA!
        </div>

        <h3 style={{ margin: '0 0 6px', fontFamily: 'var(--font-title)', fontSize: '1.65rem' }}>
          Ecco i 5 Amici usciti dal pacchetto!
        </h3>
        <p style={{ margin: '0 0 16px', fontSize: '0.98rem', opacity: 0.9 }}>
          Tocca una carta per ingrandirla. (1 per classe + 1 carta jolly!)
        </p>

        <div
          style={{
            display: 'flex',
            gap: '16px',
            justifyContent: 'center',
            flexWrap: 'wrap',
            marginBottom: '20px',
          }}
        >
          {revealedCards.map((c, i) => (
            <div
              key={c.id}
              style={{
                animation: 'cardPopIn 0.42s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
                animationDelay: `${i * 0.07}s`,
              }}
            >
              <CardComponent
                card={c}
                size="sm"
                onClick={() => openCardZoom({ card: c })}
              />
            </div>
          ))}
        </div>

        <button
          type="button"
          className="btn-caramella btn-coral"
          style={{ fontSize: '1.1rem', padding: '12px 26px' }}
          onClick={handleContinueAfterReveal}
        >
          {openedPackIndex < totalPacks
            ? `📦 Passa alla Bustina #${openedPackIndex + 1} di ${totalPacks} ➔`
            : '✓ Vai alla Scelta dei 4 Titolari e 2 Riserve ➔'}
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        background: 'linear-gradient(165deg, #2b2350 0%, #191336 100%)',
        border: '4px solid #fffdf6',
        borderRadius: '24px',
        padding: '24px 16px',
        textAlign: 'center',
        color: '#fffdf6',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '16px',
      }}
    >
      <div>
        <span
          style={{
            background: '#ffd166',
            color: '#2b2350',
            border: '2px solid #2b2350',
            borderRadius: '999px',
            padding: '4px 14px',
            fontFamily: 'var(--font-effect)',
            fontWeight: 900,
            fontSize: '0.92rem',
          }}
        >
          BUSTINA {packNumber} DI {totalPacks}
        </span>

        <h3
          style={{
            margin: '10px 0 4px',
            fontFamily: 'var(--font-title)',
            fontSize: '1.65rem',
            color: '#bff0da',
          }}
        >
          👆 Trascina il dito lungo la linea per strappare la bustina!
        </h3>
        <div style={{ fontSize: '0.96rem', fontWeight: 700, opacity: 0.9 }}>
          Scorri da sinistra a destra sulla cima della busta per rivelare le 5 carte!
        </div>
      </div>

      {/* BUSTINA GRANDE STILE RAINBOW SIX SIEGE */}
      <div
        ref={packRef}
        className="booster-pack"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          width: '268px',
          padding: '0',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          cursor: 'ew-resize',
          boxShadow:
            tearProgress > 5
              ? `0 12px 0 #2b2350, 0 0 ${18 + tearProgress * 0.45}px ${glowShadowColor}`
              : '0 10px 0 #2b2350, 0 18px 34px rgba(0,0,0,0.5)',
          transform: isDragging ? 'scale(1.03)' : 'scale(1)',
          transition: isDragging ? 'none' : 'transform 0.2s ease, box-shadow 0.2s ease',
        }}
      >
        {/* FASCIA SUPERIORE DI STRAPPO (si piega e rivela la luce interna) */}
        <div
          style={{
            position: 'relative',
            height: '72px',
            background: 'linear-gradient(135deg, #2b2350 0%, #3d326e 100%)',
            borderBottom: '3px dashed #ffd166',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          {/* Bagliore che cresce mentre strappi (Rarità della bustina) */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              width: `${tearProgress}%`,
              background: glowColor,
              boxShadow: `0 0 24px ${glowShadowColor}`,
            }}
          />

          {/* Linguetta visiva */}
          <div
            style={{
              position: 'relative',
              zIndex: 3,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontFamily: 'var(--font-effect)',
              fontWeight: 900,
              fontSize: '0.94rem',
              color: tearProgress > 45 ? '#2b2350' : '#ffd166',
              textShadow: tearProgress > 45 ? 'none' : '0 2px 0 #000',
              pointerEvents: 'none',
            }}
          >
            <span>✂️</span>
            <span>
              {tearProgress > 0
                ? `STRAPPO: ${tearProgress}%`
                : 'TRASCINA QUI ➔ ➔ ➔'}
            </span>
          </div>

          {/* Scintilla sul punto di taglio */}
          {tearProgress > 2 && (
            <div
              style={{
                position: 'absolute',
                left: `calc(${tearProgress}% - 14px)`,
                top: '50%',
                transform: 'translateY(-50%)',
                fontSize: '1.5rem',
                zIndex: 5,
                pointerEvents: 'none',
              }}
            >
              ✨
            </div>
          )}
        </div>

        {/* CORPO CENTRALE DELLA BUSTINA */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '18px',
            position: 'relative',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              width: '126px',
              height: '126px',
              borderRadius: '999px',
              border: '4px solid #2b2350',
              background: 'radial-gradient(circle at 30% 30%, #fffdf6 0%, #bff0da 50%, #52d68a 100%)',
              boxShadow: '0 6px 0 #2b2350',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '12px',
            }}
          >
            <span style={{ fontSize: '3rem', lineHeight: 1 }}>🃏</span>
            <span
              style={{
                fontFamily: 'var(--font-bubbles)',
                fontSize: '0.95rem',
                color: '#2b2350',
                lineHeight: 1.05,
                marginTop: '4px',
              }}
            >
              LAMEN
              <br />
              PACK
            </span>
          </div>

          <div
            style={{
              fontFamily: 'var(--font-title)',
              fontSize: '1.35rem',
              color: '#fffdf6',
              textShadow: '0 3px 0 #2b2350',
            }}
          >
            BUSTINA #{packNumber}
          </div>

          <div
            style={{
              marginTop: '6px',
              background: '#ffd166',
              color: '#2b2350',
              border: '2px solid #2b2350',
              borderRadius: '999px',
              padding: '3px 12px',
              fontSize: '0.84rem',
              fontWeight: 900,
            }}
          >
            5 CARTE (1 per Classe + 1 Jolly)
          </div>
        </div>
      </div>

      {/* Bottone secondario per apertura rapida al tap */}
      <button
        type="button"
        className="btn-caramella btn-gold"
        style={{ fontSize: '0.96rem', padding: '10px 20px' }}
        onClick={triggerCompleteTear}
      >
        ⚡ Oppure tocca qui per strappare subito
      </button>
    </div>
  );
};
