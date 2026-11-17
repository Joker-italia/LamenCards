import React from 'react';
import { CardData } from '../../engine/types';

interface CardComponentProps {
  card: CardData;
  faceDown?: boolean;
  size?: 'sm' | 'md' | 'lg';
  selectedBadge?: string;
  canPlayHighlight?: boolean;
  effectiveCost?: number;
  onClick?: () => void;
}

const EFFECT_TYPE_COLORS: Record<string, { bg: string; text: string; icon: string }> = {
  Aiuto: { bg: '#22c55e', text: '#ffffff', icon: '⚡' },
  Ostacolo: { bg: '#f97316', text: '#ffffff', icon: '🎯' },
  Caos: { bg: '#8b5cf6', text: '#ffffff', icon: '🌀' },
};

const CLASS_COLORS: Record<string, { bg: string; text: string }> = {
  Dormienti: { bg: '#60a5fa', text: '#ffffff' },
  Utenti: { bg: '#fbbf24', text: '#2b2350' },
  PROMO: { bg: '#ec4899', text: '#ffffff' },
};

function renderFriendStickerIllustration(card: CardData) {
  if (card.photoUrl && card.photoUrl.trim().length > 0) {
    return (
      <img
        src={card.photoUrl}
        alt={card.name}
        className="sticker-cutout"
        style={{
          width: '86%',
          height: '88%',
          objectFit: 'contain',
          display: 'block',
          margin: '0 auto',
        }}
      />
    );
  }

  // Illustrazione cartoon espressiva scontornata a sticker per ogni amico del set di prova
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
      {/* Busto / Maglia */}
      <path
        d="M30 148 C30 108, 130 108, 130 148 Z"
        fill={shirt}
        stroke="#2b2350"
        strokeWidth="6"
        strokeLinejoin="round"
      />
      {/* Collo */}
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
      {/* Orecchie */}
      <circle cx="38" cy="68" r="11" fill="#ffdbb5" stroke="#2b2350" strokeWidth="5" />
      <circle cx="122" cy="68" r="11" fill="#ffdbb5" stroke="#2b2350" strokeWidth="5" />
      {/* Viso */}
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
      {/* Capelli / Cappello */}
      <path
        d="M38 56 C36 22, 124 22, 122 56 C112 38, 85 36, 42 52 Z"
        fill={hair}
        stroke="#2b2350"
        strokeWidth="6"
        strokeLinejoin="round"
      />
      {/* Occhi (chiusi se Dormiente, occhiali da sole se Boss/Re) */}
      {card.cardClass === 'Dormienti' ? (
        <>
          <path d="M56 66 Q65 74 74 66" fill="none" stroke="#2b2350" strokeWidth="5" strokeLinecap="round" />
          <path d="M86 66 Q95 74 104 66" fill="none" stroke="#2b2350" strokeWidth="5" strokeLinecap="round" />
          <text x="115" y="34" fontSize="18" fontWeight="900" fill="#2b2350">
            Zzz
          </text>
        </>
      ) : seed === 'boss' || seed === 'partyking' ? (
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
      {/* Sorriso */}
      <path
        d="M64 84 Q80 96 96 84"
        fill="none"
        stroke="#2b2350"
        strokeWidth="5"
        strokeLinecap="round"
      />
      {/* Guance */}
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
}) => {
  const widthMap = {
    sm: '132px',
    md: '188px',
    lg: '246px',
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
            <span style={{ fontSize: size === 'sm' ? '1.4rem' : '2rem', lineHeight: 1 }}>🃏</span>
            <span
              style={{
                fontFamily: 'var(--font-bubbles)',
                fontSize: size === 'sm' ? '0.55rem' : '0.72rem',
                color: '#2b2350',
                marginTop: '3px',
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

  const isHolo = card.rarity === 'Olografica' || card.cardClass === 'PROMO';
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
          ? '4px solid #22c55e'
          : selectedBadge
          ? '4px solid #ffd166'
          : 'none',
      }}
      onClick={onClick}
    >
      {selectedBadge && (
        <div
          style={{
            position: 'absolute',
            top: '6px',
            right: '6px',
            zIndex: 10,
            background: '#ffd166',
            color: '#2b2350',
            border: '2px solid #2b2350',
            borderRadius: '999px',
            padding: '2px 8px',
            fontFamily: 'var(--font-effect)',
            fontSize: '0.68rem',
            fontWeight: 800,
            boxShadow: '0 2px 0 #2b2350',
          }}
        >
          {selectedBadge}
        </div>
      )}

      <div className="lamen-card-inner">
        {/* TOP BAR: Costo in Gettoni + Classe */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: size === 'sm' ? '4px 5px 0' : '6px 7px 0',
            zIndex: 2,
          }}
        >
          {/* Bollo Costo Gettoni */}
          <div
            title={`Costo: ${displayedCost} gettoni`}
            style={{
              width: size === 'sm' ? '26px' : '34px',
              height: size === 'sm' ? '26px' : '34px',
              borderRadius: '999px',
              background: hasDiscount ? '#22c55e' : '#ffd166',
              color: '#2b2350',
              border: '3px solid #2b2350',
              boxShadow: '0 2px 0 #2b2350',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--font-title)',
              fontSize: size === 'sm' ? '0.95rem' : '1.2rem',
              fontWeight: 900,
            }}
          >
            {displayedCost}
          </div>

          {/* Pill Classe */}
          <span
            style={{
              background: classStyle.bg,
              color: classStyle.text,
              border: '2px solid #2b2350',
              borderRadius: '999px',
              padding: size === 'sm' ? '1px 6px' : '2px 9px',
              fontFamily: 'var(--font-effect)',
              fontSize: size === 'sm' ? '0.58rem' : '0.68rem',
              fontWeight: 700,
              boxShadow: '0 2px 0 #2b2350',
            }}
          >
            {card.cardClass}
          </span>
        </div>

        {/* AREA FOTO AMICO SCONTORNATA (Domina la carta) */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2px 4px',
            position: 'relative',
          }}
        >
          {renderFriendStickerIllustration(card)}
        </div>

        {/* ETICHETTA NOME CORALLO #ea5444 (Scritta bianca) */}
        <div
          className="lamen-name-banner"
          style={{
            padding: size === 'sm' ? '2px 5px' : '4px 7px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontSize: size === 'sm' ? '0.72rem' : size === 'lg' ? '1.02rem' : '0.86rem',
              lineHeight: 1.1,
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
                fontSize: size === 'sm' ? '0.52rem' : '0.62rem',
                fontWeight: 700,
                opacity: 0.95,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {card.personName} • {card.version}
            </div>
          )}
        </div>

        {/* BOX EFFETTO (1 o 2 righe + Tipo Effetto) */}
        <div
          style={{
            background: '#fffdf6',
            color: '#2b2350',
            padding: size === 'sm' ? '4px 5px' : '6px 7px',
            minHeight: size === 'sm' ? '44px' : size === 'lg' ? '76px' : '60px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '2px',
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
                padding: '1px 5px',
                fontFamily: 'var(--font-effect)',
                fontSize: size === 'sm' ? '0.5rem' : '0.6rem',
                fontWeight: 700,
                border: '1.5px solid #2b2350',
              }}
            >
              {effectStyle.icon} {card.effectType.toUpperCase()}
            </span>

            <span
              style={{
                fontSize: size === 'sm' ? '0.48rem' : '0.56rem',
                fontWeight: 800,
                opacity: 0.65,
              }}
            >
              #{card.setNumber} • {card.rarity[0]}
            </span>
          </div>

          <div
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: size === 'sm' ? '0.52rem' : size === 'lg' ? '0.72rem' : '0.62rem',
              fontWeight: 700,
              lineHeight: 1.18,
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {card.effectText}
          </div>
        </div>
      </div>
    </div>
  );
};
