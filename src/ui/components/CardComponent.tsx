import React, { useRef } from 'react';
import { CardData } from '../../engine/types';
import { openCardZoom } from './CardZoomModal';

interface CardComponentProps {
  card: CardData;
  faceDown?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  selectedBadge?: string;
  canPlayHighlight?: boolean;
  effectiveCost?: number;
  onClick?: () => void;
  hideZoomButton?: boolean;
}

const EFFECT_TYPE_COLORS: Record<string, { bg: string; text: string; icon: string }> = {
  Aiuto: { bg: '#22c55e', text: '#ffffff', icon: '💡' },
  Ostacolo: { bg: '#f97316', text: '#ffffff', icon: '🎯' },
  Caos: { bg: '#8b5cf6', text: '#ffffff', icon: '🌀' },
};

const CLASS_COLORS: Record<string, { bg: string; text: string; icon: string }> = {
  Dormienti: { bg: '#60a5fa', text: '#ffffff', icon: '😴' },
  Utenti: { bg: '#fbbf24', text: '#2b2350', icon: '😵‍💫' },
  Festaioli: { bg: '#ec4899', text: '#ffffff', icon: '🥳' },
  Scrocconi: { bg: '#a855f7', text: '#ffffff', icon: '🦝' },
};

const EFFECT_HIGHLIGHT_REGEX =
  /(Quando entra|Finché è in gioco|All'inizio di ogni tuo turno:|Nel tuo prossimo turno|Fino al tuo prossimo turno|senza combinazione di dadi|rimanda in mano|non può scegliere|girare un dado|salta il suo prossimo turno|2↔6|3↔5|1↔6|2↔5|3↔4|\b\d+(?:[–-]\d+)?\s*(?:getton[ie]|dad[io]|volt[ae]|carte?)?|\b(?:Incassa|Gioca|Mercato|Obiettivo|ruba(?:gli|re)?|prend[ie]|prendono|perd[ie]|perdono|scambi(?:a|are)?|gratis|GRATIS|massimo|doppi[ao]?|4 dadi|5 o 6|6 o 7|1–2)\b)/gi;

function renderFormattedEffectText(text: string): React.ReactNode {
  const cleaned = text.replace(/(Quando entra|Finché è in gioco):/gi, '$1');
  const parts = cleaned.split(EFFECT_HIGHLIGHT_REGEX);
  return parts.map((part, idx) => {
    if (!part) return null;
    const isMatch = idx % 2 === 1;
    if (!isMatch) {
      return <React.Fragment key={idx}>{part}</React.Fragment>;
    }
    const lower = part.toLowerCase();
    const isQuandoEntra = lower.startsWith('quando entra');
    const isFincheInGioco = lower.startsWith('finché è in gioco');
    const isDanger =
      isQuandoEntra ||
      lower.includes('ruba') ||
      lower.includes('perd') ||
      lower.includes('salta') ||
      lower.includes('rimanda') ||
      lower.includes('non può');

    return (
      <strong
        key={idx}
        style={{
          fontWeight: 900,
          color: isDanger ? '#c93b2b' : isFincheInGioco ? '#1d4ed8' : '#2b2350',
        }}
      >
        {part}
      </strong>
    );
  });
}

function renderFriendStickerIllustration(card: CardData) {
  if (card.photoUrl && card.photoUrl.trim().length > 0) {
    return (
      <img
        src={card.photoUrl}
        alt={card.name}
        className="sticker-cutout"
        style={{
          width: '88%',
          height: '92%',
          objectFit: 'contain',
          display: 'block',
          margin: '0 auto',
        }}
      />
    );
  }

  const seed = card.avatarSeed || card.id;
  const hairColors: Record<string, string> = {
    coffee: '#4a2c11',
    gambler: '#1f2937',
    sleepy: '#6366f1',
    couch: '#92400e',
    forgetful: '#d97706',
    chips: '#b91c1c',
    lucky: '#059669',
    promo1: '#db2777',
    partyking: '#7c3aed',
    promo2: '#2563eb',
    alarm: '#ea580c',
    boss: '#111827',
  };
  const shirtColors: Record<string, string> = {
    coffee: '#ea5444',
    gambler: '#10b981',
    sleepy: '#38bdf8',
    couch: '#f59e0b',
    forgetful: '#a855f7',
    chips: '#ef4444',
    lucky: '#22c55e',
    promo1: '#ec4899',
    partyking: '#eab308',
    promo2: '#6366f1',
    alarm: '#f97316',
    boss: '#2b2350',
  };

  const hair = hairColors[seed] || '#4a2c11';
  const shirt = shirtColors[seed] || '#ea5444';

  return (
    <svg
      viewBox="0 0 160 155"
      className="sticker-cutout"
      style={{ width: '88%', height: '90%', display: 'block', margin: '0 auto' }}
    >
      <path
        d="M30 148 C30 108, 130 108, 130 148 Z"
        fill={shirt}
        stroke="#2b2350"
        strokeWidth="6"
        strokeLinejoin="round"
      />
      <rect
        x="68"
        y="92"
        width="24"
        height="22"
        rx="8"
        fill="#ffdbb5"
        stroke="#2b2350"
        strokeWidth="5"
      />
      <circle cx="38" cy="68" r="11" fill="#ffdbb5" stroke="#2b2350" strokeWidth="5" />
      <circle cx="122" cy="68" r="11" fill="#ffdbb5" stroke="#2b2350" strokeWidth="5" />
      <rect
        x="42"
        y="30"
        width="76"
        height="72"
        rx="34"
        fill="#ffdbb5"
        stroke="#2b2350"
        strokeWidth="6"
      />
      <path
        d="M38 56 C36 22, 124 22, 122 56 C112 38, 85 36, 42 52 Z"
        fill={hair}
        stroke="#2b2350"
        strokeWidth="6"
        strokeLinejoin="round"
      />
      {card.cardClass === 'Dormienti' ? (
        <>
          <path d="M56 66 Q65 74 74 66" fill="none" stroke="#2b2350" strokeWidth="5" strokeLinecap="round" />
          <path d="M86 66 Q95 74 104 66" fill="none" stroke="#2b2350" strokeWidth="5" strokeLinecap="round" />
          <text x="115" y="34" fontSize="18" fontWeight="900" fill="#2b2350">
            Zzz
          </text>
        </>
      ) : seed === 'boss' || seed === 'partyking' || card.cardClass === 'Festaioli' ? (
        <>
          <rect x="50" y="56" width="27" height="16" rx="4" fill="#2b2350" />
          <rect x="83" y="56" width="27" height="16" rx="4" fill="#2b2350" />
          <line x1="77" y1="62" x2="83" y2="62" stroke="#2b2350" strokeWidth="5" />
        </>
      ) : (
        <>
          <circle cx="64" cy="64" r="6" fill="#2b2350" />
          <circle cx="96" cy="64" r="6" fill="#2b2350" />
          <circle cx="62" cy="62" r="2" fill="#ffffff" />
          <circle cx="94" cy="62" r="2" fill="#ffffff" />
        </>
      )}
      <path
        d="M64 84 Q80 96 96 84"
        fill="none"
        stroke="#2b2350"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <ellipse cx="54" cy="76" rx="6" ry="3.5" fill="#ea5444" opacity="0.55" />
      <ellipse cx="106" cy="76" rx="6" ry="3.5" fill="#ea5444" opacity="0.55" />
    </svg>
  );
}

export const CardComponent: React.FC<CardComponentProps> = React.memo(({
  card,
  faceDown = false,
  size = 'md',
  selectedBadge,
  canPlayHighlight = false,
  effectiveCost,
  onClick,
  hideZoomButton = false,
}) => {
  // Dimensioni carte leggibili (xs compatta sul tavolo avversario, sm/md/lg grandi)
  const widthMap = {
    xs: '118px',
    sm: '182px',
    md: '238px',
    lg: '312px',
  };

  const longPressTimerRef = useRef<number | null>(null);

  const triggerZoom = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (faceDown) return;
    openCardZoom({
      card,
      effectiveCost,
      badge: selectedBadge,
      canPlay: canPlayHighlight,
    });
  };

  const handlePointerDown = () => {
    if (faceDown || hideZoomButton) return;
    longPressTimerRef.current = window.setTimeout(() => {
      openCardZoom({
        card,
        effectiveCost,
        badge: selectedBadge,
        canPlay: canPlayHighlight,
      });
    }, 480);
  };

  const clearLongPress = () => {
    if (longPressTimerRef.current !== null) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  if (faceDown) {
    return (
      <div
        className="lamen-card-back"
        style={{ width: widthMap[size], cursor: onClick ? 'pointer' : 'default' }}
        onClick={onClick}
      >
        <div className="lamen-card-back-inner">
          <div className="lamen-medallion">
            <span style={{ fontSize: size === 'sm' ? '1.8rem' : '2.3rem', lineHeight: 1 }}>🃏</span>
            <span
              style={{
                fontFamily: 'var(--font-bubbles)',
                fontSize: size === 'sm' ? '0.78rem' : '0.92rem',
                color: '#2b2350',
                marginTop: '4px',
                lineHeight: 1.05,
              }}
            >
              LAMEN
              <br />
              CARDS
            </span>
          </div>
        </div>
      </div>
    );
  }

  const isHolo = card.rarity === 'PROMO';
  const effectStyle = EFFECT_TYPE_COLORS[card.effectType] || EFFECT_TYPE_COLORS.Aiuto;
  const classStyle = CLASS_COLORS[card.cardClass] || { bg: '#e2e8f0', text: '#2b2350', icon: '🃏' };
  const displayedCost = effectiveCost !== undefined ? effectiveCost : card.cost;
  const hasDiscount = effectiveCost !== undefined && effectiveCost < card.cost;

  return (
    <div
      className={`lamen-card ${isHolo ? 'is-holo' : ''} ${onClick ? 'interactive' : ''}`}
      style={{
        width: widthMap[size],
        cursor: onClick ? 'pointer' : 'default',
        outline: canPlayHighlight
          ? '5px solid #22c55e'
          : selectedBadge
          ? '4px solid #ffd166'
          : 'none',
      }}
      onClick={onClick}
      onPointerDown={handlePointerDown}
      onPointerUp={clearLongPress}
      onPointerLeave={clearLongPress}
      onPointerCancel={clearLongPress}
    >
      {selectedBadge && (
        <div
          style={{
            position: 'absolute',
            top: '6px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 12,
            background: selectedBadge.includes('BLOCCATA')
              ? '#ea5444'
              : selectedBadge.includes('GIOCABILE')
              ? '#22c55e'
              : '#ffd166',
            color:
              selectedBadge.includes('BLOCCATA') || selectedBadge.includes('GIOCABILE')
                ? '#ffffff'
                : '#2b2350',
            border: '2px solid #2b2350',
            borderRadius: '999px',
            padding: '2px 10px',
            fontFamily: 'var(--font-effect)',
            fontSize: size === 'sm' ? '0.72rem' : '0.8rem',
            fontWeight: 800,
            boxShadow: '0 2px 0 #2b2350',
            whiteSpace: 'nowrap',
          }}
        >
          {selectedBadge}
        </div>
      )}

      <div className="lamen-card-inner">
        {/* TOP BAR: Costo in Gettoni + Classe + Lente Zoom */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: size === 'xs' ? '4px 4px 0' : size === 'sm' ? '5px 6px 0' : '7px 8px 0',
            zIndex: 2,
            gap: '4px',
            flexShrink: 0,
          }}
        >
          <div
            title={`Costo: ${displayedCost} gettoni`}
            style={{
              position: 'relative',
              width:
                size === 'xs'
                  ? '28px'
                  : size === 'sm'
                  ? '36px'
                  : size === 'lg'
                  ? '46px'
                  : '40px',
              height:
                size === 'xs'
                  ? '28px'
                  : size === 'sm'
                  ? '36px'
                  : size === 'lg'
                  ? '46px'
                  : '40px',
              borderRadius: '999px',
              background: hasDiscount ? '#22c55e' : '#ffd166',
              color: '#2b2350',
              border: size === 'xs' ? '2px solid #2b2350' : '3px solid #2b2350',
              boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.65), 0 2px 0 #2b2350',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--font-title)',
              fontSize:
                size === 'xs'
                  ? '0.96rem'
                  : size === 'sm'
                  ? '1.2rem'
                  : size === 'lg'
                  ? '1.52rem'
                  : '1.35rem',
              fontWeight: 900,
              flexShrink: 0,
              overflow: 'hidden',
            }}
          >
            {/* Layer sottostante con simbolo coin */}
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize:
                  size === 'xs'
                    ? '1.35rem'
                    : size === 'sm'
                    ? '1.75rem'
                    : size === 'lg'
                    ? '2.25rem'
                    : '1.95rem',
                opacity: 0.42,
                pointerEvents: 'none',
                zIndex: 1,
                lineHeight: 1,
              }}
            >
              🪙
            </span>
            <span
              style={{
                position: 'relative',
                zIndex: 2,
                lineHeight: 1,
                textShadow:
                  '0 1px 0 #fffdf6, 0 -1px 0 #fffdf6, 1px 0 0 #fffdf6, -1px 0 0 #fffdf6',
              }}
            >
              {displayedCost}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', minWidth: 0 }}>
            <span
              title={`Classe: ${card.cardClass}`}
              style={{
                background: classStyle.bg,
                color: classStyle.text,
                border: '2px solid #2b2350',
                borderRadius: '999px',
                width: size === 'xs' ? '26px' : size === 'sm' ? '32px' : '36px',
                height: size === 'xs' ? '26px' : size === 'sm' ? '32px' : '36px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: size === 'xs' ? '0.9rem' : size === 'sm' ? '1.1rem' : '1.22rem',
                boxShadow: '0 2px 0 #2b2350',
                flexShrink: 0,
              }}
            >
              {classStyle.icon}
            </span>

            {!hideZoomButton && size !== 'xs' && (
              <button
                type="button"
                title="Ingrandisci e leggi la carta"
                onClick={triggerZoom}
                style={{
                  width: size === 'sm' ? '28px' : '32px',
                  height: size === 'sm' ? '28px' : '32px',
                  borderRadius: '999px',
                  border: '2px solid #2b2350',
                  background: '#fffdf6',
                  color: '#2b2350',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: size === 'sm' ? '0.8rem' : '0.9rem',
                  cursor: 'pointer',
                  boxShadow: '0 2px 0 #2b2350',
                  padding: 0,
                  flexShrink: 0,
                }}
              >
                🔍
              </button>
            )}
          </div>
        </div>

        {/* AREA FOTO AMICO SCONTORNATA (Flessibile per non far strabordare mai il box effetto) */}
        <div
          style={{
            flex: '1 1 0%',
            minHeight: size === 'xs' ? '34px' : size === 'sm' ? '48px' : '72px',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2px 4px',
            position: 'relative',
          }}
        >
          {renderFriendStickerIllustration(card)}
        </div>

        {/* ETICHETTA NOME CORALLO #ea5444 (Titolo ben visibile e leggibile) */}
        <div
          className="lamen-name-banner"
          style={{
            padding: size === 'xs' ? '3px 4px' : size === 'sm' ? '5px 7px' : '6px 9px',
            textAlign: 'center',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              fontSize:
                size === 'xs'
                  ? '0.78rem'
                  : size === 'sm'
                  ? '0.96rem'
                  : size === 'lg'
                  ? '1.3rem'
                  : '1.12rem',
              lineHeight: 1.08,
              letterSpacing: '0.01em',
              wordBreak: 'break-word',
            }}
          >
            {card.name}
          </div>
          {card.version && size !== 'xs' && (
            <div
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: size === 'sm' ? '0.68rem' : size === 'lg' ? '0.84rem' : '0.75rem',
                fontWeight: 800,
                opacity: 0.96,
                marginTop: '1px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {card.personName} • {card.version}
            </div>
          )}
        </div>

        {/* BOX EFFETTO COMPATTO, DETTAGLIATO E CON PAROLE CHIAVE IN GRASSETTO */}
        <div
          style={{
            background: '#fffdf6',
            color: '#2b2350',
            padding: size === 'xs' ? '4px 5px' : size === 'sm' ? '5px 7px' : '7px 9px',
            flexShrink: 0,
            maxHeight: size === 'xs' ? '46%' : size === 'sm' ? '44%' : '42%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-start',
            gap: '3px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '4px',
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span
                title={`Tipo: ${card.effectType}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: size === 'xs' ? '0.9rem' : size === 'sm' ? '1.05rem' : '1.15rem',
                  lineHeight: 1,
                }}
              >
                {effectStyle.icon}
              </span>
            </div>

            {size !== 'xs' && (
              <span
                title={`Carta #${card.setNumber} • ${card.rarity}`}
                style={{
                  fontSize: size === 'sm' ? '0.68rem' : '0.74rem',
                  fontWeight: 900,
                  opacity: 0.78,
                }}
              >
                #{card.setNumber}
                {card.rarity === 'PROMO' ? ' ✨' : card.rarity === 'Rara' ? ' ⭐' : ''}
              </span>
            )}
          </div>

          <div
            style={{
              fontFamily: 'var(--font-body)',
              fontSize:
                size === 'xs'
                  ? '0.66rem'
                  : size === 'sm'
                  ? '0.78rem'
                  : size === 'lg'
                  ? '0.96rem'
                  : '0.85rem',
              fontWeight: 600,
              lineHeight: 1.2,
              color: '#2b2350',
              wordBreak: 'break-word',
              overflowY: 'auto',
              display: size === 'xs' ? '-webkit-box' : 'block',
              WebkitLineClamp: size === 'xs' ? 2 : undefined,
              WebkitBoxOrient: size === 'xs' ? 'vertical' : undefined,
            }}
          >
            {renderFormattedEffectText(card.effectText)}
          </div>
        </div>
      </div>
    </div>
  );
});
