import React, { useEffect, useState } from 'react';
import { COMBO_LABELS_IT } from '../../engine/dice';
import { DEFAULT_GAME_CONFIG } from '../../data/defaultData';
import { CardData, GameConfig } from '../../engine/types';
import { CLASS_THEME, EFFECT_TYPE_THEME } from '../theme/caramellaTheme';
import { CardComponent } from './CardComponent';

export interface ZoomedCardPayload {
  card: CardData;
  effectiveCost?: number;
  badge?: string;
  canPlay?: boolean;
  onPlayCard?: () => void;
}

type ZoomListener = (payload: ZoomedCardPayload | null) => void;
const listeners = new Set<ZoomListener>();

export function openCardZoom(payload: ZoomedCardPayload) {
  listeners.forEach((fn) => fn(payload));
}

export function closeCardZoom() {
  listeners.forEach((fn) => fn(null));
}

interface CardZoomModalProps {
  config?: GameConfig;
}

export const CardZoomModal: React.FC<CardZoomModalProps> = ({
  config = DEFAULT_GAME_CONFIG,
}) => {
  const [zoomed, setZoomed] = useState<ZoomedCardPayload | null>(null);

  useEffect(() => {
    const handler: ZoomListener = (payload) => setZoomed(payload);
    listeners.add(handler);
    return () => {
      listeners.delete(handler);
    };
  }, []);

  if (!zoomed) return null;

  const { card, effectiveCost, badge, canPlay, onPlayCard } = zoomed;
  const classInfo = CLASS_THEME[card.cardClass] || {
    bg: '#60a5fa',
    text: '#ffffff',
    emoji: '🃏',
    tagline: 'Classe speciale del gruppo',
  };
  const effectInfo = EFFECT_TYPE_THEME[card.effectType] || EFFECT_TYPE_THEME.Aiuto;
  const requiredCombos = (config.costCombinationsTable[card.cost] || ['ONE_PAIR'])
    .map((c) => COMBO_LABELS_IT[c])
    .join(' oppure ');

  const timingLabel =
    card.effectModel.timing === 'ON_ENTER'
      ? 'Quando entra in gioco (si attiva appena giocata)'
      : card.effectModel.timing === 'WHILE_IN_PLAY'
      ? 'Finché è in gioco (attivo finché resta scoperta davanti a te)'
      : 'Passivo / Regola speciale della carta';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 250,
        background: 'rgba(18, 13, 40, 0.86)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={() => setZoomed(null)}
    >
      <div
        className="panel-caramella"
        style={{
          width: '100%',
          maxWidth: '720px',
          maxHeight: '92dvh',
          overflowY: 'auto',
          padding: '22px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))',
          gap: '22px',
          alignItems: 'center',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Colonna Carta Grande */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <CardComponent
            card={card}
            size="lg"
            effectiveCost={effectiveCost}
            selectedBadge={badge}
            canPlayHighlight={canPlay}
            hideZoomButton
          />
        </div>

        {/* Colonna Dettagli Leggibili */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '8px' }}>
            <div>
              <span
                style={{
                  display: 'inline-block',
                  background: classInfo.bg,
                  color: classInfo.text,
                  border: '2px solid #2b2350',
                  borderRadius: '999px',
                  padding: '3px 12px',
                  fontFamily: 'var(--font-effect)',
                  fontSize: '0.9rem',
                  fontWeight: 800,
                  marginBottom: '6px',
                }}
              >
                {classInfo.emoji} {card.cardClass} • #{card.setNumber} ({card.rarity})
              </span>
              <h2
                style={{
                  margin: 0,
                  fontFamily: 'var(--font-title)',
                  fontSize: '1.65rem',
                  color: '#2b2350',
                  lineHeight: 1.15,
                }}
              >
                {card.name}
              </h2>
              <div style={{ fontSize: '1rem', fontWeight: 800, opacity: 0.85, marginTop: '2px' }}>
                Amico: <strong>{card.personName}</strong>
                {card.version ? ` • ${card.version}` : ''}
              </div>
            </div>

            <button
              type="button"
              className="btn-caramella btn-coral"
              style={{ padding: '8px 14px', minHeight: '42px' }}
              onClick={() => setZoomed(null)}
            >
              ✕ Chiudi
            </button>
          </div>

          {/* Box Costo e Combinazione Dadi */}
          <div
            style={{
              background: '#bff0da',
              border: '3px solid #2b2350',
              borderRadius: '18px',
              padding: '12px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            <div style={{ fontSize: '1.05rem', fontWeight: 900 }}>
              Costo:{' '}
              <span style={{ color: '#c93b2b', fontSize: '1.2rem' }}>
                {effectiveCost !== undefined ? effectiveCost : card.cost} 🪙
              </span>
              {effectiveCost !== undefined && effectiveCost < card.cost && (
                <span style={{ marginLeft: '6px', fontSize: '0.9rem', color: '#158046' }}>
                  (Scontato da {card.cost}!)
                </span>
              )}
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 800 }}>
              🎲 Combinazione Dadi richiesta: <strong>{requiredCombos}</strong>
            </div>
          </div>

          {/* Box Effetto Grande */}
          <div
            style={{
              background: '#ffffff',
              border: '3px solid #2b2350',
              borderRadius: '18px',
              padding: '14px 16px',
              boxShadow: '0 4px 0 #2b2350',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '8px',
                flexWrap: 'wrap',
              }}
            >
              <span
                style={{
                  color: '#2b2350',
                  fontFamily: 'var(--font-effect)',
                  fontSize: '0.95rem',
                  fontWeight: 900,
                }}
              >
                {effectInfo.icon} {effectInfo.label}
              </span>
              <span style={{ fontSize: '0.9rem', fontWeight: 800, opacity: 0.85 }}>
                {timingLabel}
              </span>
            </div>

            <p
              style={{
                margin: 0,
                fontSize: '1.12rem',
                fontWeight: 800,
                lineHeight: 1.4,
                color: '#2b2350',
              }}
            >
              {card.effectText}
            </p>
          </div>

          {/* Regola Personaggi Doppi promemoria */}
          <div
            style={{
              fontSize: '0.9rem',
              fontWeight: 700,
              background: '#f5f2eb',
              border: '2px solid #2b2350',
              borderRadius: '12px',
              padding: '10px 12px',
            }}
          >
            💡 <strong>Regola Personaggi Doppi:</strong> Il primo giocatore che mette in gioco questa carta la blocca per tutti gli altri finché resta in tavola!
          </div>

          {onPlayCard && canPlay && (
            <button
              type="button"
              className="btn-caramella btn-coral"
              style={{ width: '100%', fontSize: '1.1rem', padding: '14px' }}
              onClick={() => {
                onPlayCard();
                setZoomed(null);
              }}
            >
              ▶ Gioca Subito Questa Carta ({effectiveCost ?? card.cost} 🪙)
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
