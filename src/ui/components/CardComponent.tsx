import React, { useRef } from 'react';
import { CardData } from '../../engine/types';
import { openCardZoom } from './CardZoomModal';

interface CardComponentProps {
  card: CardData;
  faceDown?: boolean;
  size?: 'sm' | 'md' | 'lg';
  selectedBadge?: string;
  canPlayHighlight?: boolean;
  effectiveCost?: number;
  onClick?: () => void;
  hideZoomButton?: boolean;
}

const EFFECT_TYPE_COLORS: Record<string, { bg: string; text: string; icon: string }> = {
  Aiuto: { bg: '#22c55e', text: '#ffffff', icon: '⚡' },
  Ostacolo: { bg: '#f97316', text: '#ffffff', icon: '🎯' },
  Caos: { bg: '#8b5cf6', text: '#ffffff', icon: '🌀' },
};

const CLASS_COLORS: Record<string, { bg: string; text: string }> = {
  Dormienti: { bg: '#60a5fa', text: '#ffffff' },
  Utenti: { bg: '#fbbf24', text: '#2b2350' },
  Festaioli: { bg: '#ec4899', text: '#ffffff' },
  Scrocconi: { bg: '#a855f7', text: '#ffffff' },
};

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

export const CardComponent: React.FC<CardComponentProps> = ({
  card,
  faceDown = false,
  size = 'md',
  selectedBadge,
  canPlayHighlight = false,
  effectiveCost,
  onClick,
  hideZoomButton = false,
}) => {
  // Dimensioni carte molto più grandi e leggibili (Step 1)
  const widthMap = {
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
  const classStyle = CLASS_COLORS[card.cardClass] || { bg: '#e2e8f0', text: '#2b2350' };
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
            padding: size === 'sm' ? '5px 6px 0' : '7px 8px 0',
            zIndex: 2,
            gap: '4px',
          }}
        >
          <div
            title={`Costo: ${displayedCost} gettoni`}
            style={{
              width: size === 'sm' ? '34px' : size === 'lg' ? '44px' : '38px',
              height: size === 'sm' ? '34px' : size === 'lg' ? '44px' : '38px',
              borderRadius: '999px',
              background: hasDiscount ? '#22c55e' : '#ffd166',
              color: '#2b2350',
              border: '3px solid #2b2350',
              boxShadow: '0 2px 0 #2b2350',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--font-title)',
              fontSize: size === 'sm' ? '1.15rem' : size === 'lg' ? '1.45rem' : '1.3rem',
              fontWeight: 900,
              flexShrink: 0,
            }}
          >
            {displayedCost}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span
              style={{
                background: classStyle.bg,
                color: classStyle.text,
                border: '2px solid #2b2350',
                borderRadius: '999px',
                padding: size === 'sm' ? '2px 8px' : '3px 10px',
                fontFamily: 'var(--font-effect)',
                fontSize: size === 'sm' ? '0.74rem' : size === 'lg' ? '0.9rem' : '0.82rem',
                fontWeight: 800,
                boxShadow: '0 2px 0 #2b2350',
              }}
            >
              {card.cardClass}
            </span>

            {!hideZoomButton && (
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

        {/* AREA FOTO AMICO SCONTORNATA */}
        <div
          style={{
            flex: 1,
            minHeight: size === 'sm' ? '64px' : size === 'lg' ? '125px' : '88px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2px 4px',
            position: 'relative',
          }}
        >
          {renderFriendStickerIllustration(card)}
        </div>

        {/* ETICHETTA NOME CORALLO #ea5444 */}
        <div
          className="lamen-name-banner"
          style={{
            padding: size === 'sm' ? '4px 6px' : '5px 8px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontSize: size === 'sm' ? '0.86rem' : size === 'lg' ? '1.15rem' : '0.98rem',
              lineHeight: 1.12,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {card.name}
          </div>
          {card.version && (
            <div
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: size === 'sm' ? '0.68rem' : size === 'lg' ? '0.82rem' : '0.74rem',
                fontWeight: 800,
                opacity: 0.96,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {card.personName} • {card.version}
            </div>
          )}
        </div>

        {/* BOX EFFETTO GRANDE E SEMPRE LEGGIBILE (Nessun troncamento illeggibile) */}
        <div
          style={{
            background: '#fffdf6',
            color: '#2b2350',
            padding: size === 'sm' ? '6px 7px' : size === 'lg' ? '9px 11px' : '7px 9px',
            minHeight: size === 'sm' ? '74px' : size === 'lg' ? '114px' : '92px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-start',
            gap: '4px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '4px',
            }}
          >
            <span
              style={{
                background: effectStyle.bg,
                color: effectStyle.text,
                borderRadius: '6px',
                padding: '1px 6px',
                fontFamily: 'var(--font-effect)',
                fontSize: size === 'sm' ? '0.68rem' : size === 'lg' ? '0.8rem' : '0.74rem',
                fontWeight: 700,
                border: '1.5px solid #2b2350',
              }}
            >
              {effectStyle.icon} {card.effectType.toUpperCase()}
            </span>

            <span
              style={{
                fontSize: size === 'sm' ? '0.66rem' : '0.72rem',
                fontWeight: 800,
                opacity: 0.8,
              }}
            >
              #{card.setNumber} {card.rarity === 'PROMO' ? '✨ PROMO' : ''}
            </span>
          </div>

          <div
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: size === 'sm' ? '0.82rem' : size === 'lg' ? '0.98rem' : '0.88rem',
              fontWeight: 800,
              lineHeight: 1.24,
              color: '#2b2350',
              wordBreak: 'break-word',
            }}
          >
            {card.effectText}
          </div>
        </div>
      </div>
    </div>
  );
};
