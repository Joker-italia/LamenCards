import React from 'react';
import { COMBO_LABELS_IT } from '../../engine/dice';
import { GameConfig } from '../../engine/types';

interface ReferenceCardModalProps {
  config: GameConfig;
  invertComboTableActive?: boolean;
  sponsorDiscount?: number;
  onClose: () => void;
}

const PROBABILITY_BY_COST: Record<number, string> = {
  2: '~100%',
  3: '77%',
  4: '59% (31% con 4 dadi)',
  5: '37%',
  6: '29% (10% con 4 dadi)',
};

export const ReferenceCardModal: React.FC<ReferenceCardModalProps> = ({
  config,
  invertComboTableActive = false,
  sponsorDiscount = 0,
  onClose,
}) => {
  const getEffectiveComboTier = (baseCost: number): number => {
    let tier = Math.min(6, Math.max(2, baseCost - sponsorDiscount));
    if (invertComboTableActive) {
      const inverted: Record<number, number> = { 2: 6, 3: 5, 4: 4, 5: 3, 6: 2 };
      tier = inverted[tier] || tier;
    }
    return tier;
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 185,
        background: 'rgba(18, 13, 40, 0.88)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '14px',
      }}
      onClick={onClose}
    >
      <div
        className="panel-caramella"
        style={{
          width: '100%',
          maxWidth: '540px',
          maxHeight: '92dvh',
          overflowY: 'auto',
          padding: '22px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '14px',
          }}
        >
          <h3 style={{ margin: 0, fontFamily: 'var(--font-title)', fontSize: '1.55rem' }}>
            📖 Carta di Riferimento &amp; Combinazioni
          </h3>
          <button
            type="button"
            className="btn-caramella btn-coral"
            style={{ padding: '6px 14px', minHeight: '42px' }}
            onClick={onClose}
          >
            ✕ Chiudi
          </button>
        </div>

        {(invertComboTableActive || sponsorDiscount > 0) && (
          <div
            style={{
              background: '#ffd166',
              border: '3px solid #2b2350',
              borderRadius: '14px',
              padding: '10px 12px',
              marginBottom: '12px',
              fontSize: '0.94rem',
              fontWeight: 900,
            }}
          >
            ⚡ Tabella aggiornata in tempo reale coi modificatori attivi in campo:
            {invertComboTableActive && ' [🌀 Il Trip: 2↔6, 3↔5]'}
            {sponsorDiscount > 0 && ` [🎉 Lo Sponsor: -${sponsorDiscount} costo/livello]`}
          </div>
        )}

        {/* Tabella Costo -> Combinazione + Probabilità su 200.000 turni */}
        <div
          style={{
            background: '#bff0da',
            border: '3px solid #2b2350',
            borderRadius: '18px',
            padding: '14px',
            marginBottom: '14px',
          }}
        >
          <div style={{ fontWeight: 900, fontSize: '1.02rem', marginBottom: '8px' }}>
            🎲 Combinazione dei 5 dadi richiesta per Costo
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.96rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #2b2350', textAlign: 'left' }}>
                <th style={{ padding: '6px 4px' }}>Costo Carta</th>
                <th style={{ padding: '6px 4px' }}>Combinazione Richiesta</th>
                <th style={{ padding: '6px 4px' }}>Prob. in 3 tiri</th>
              </tr>
            </thead>
            <tbody>
              {[2, 3, 4, 5, 6].map((cost) => {
                const effTier = getEffectiveComboTier(cost);
                const effTokenCost = Math.max(0, cost - sponsorDiscount);
                return (
                  <tr key={cost} style={{ borderBottom: '1px solid rgba(43,35,80,0.2)' }}>
                    <td style={{ padding: '7px 4px', fontWeight: 900 }}>
                      {effTokenCost !== cost ? `${effTokenCost} 🪙 (da ${cost})` : `${cost} 🪙`}
                    </td>
                    <td style={{ padding: '7px 4px', fontWeight: 800 }}>
                      {(config.costCombinationsTable[effTier] || [])
                        .map((c) => COMBO_LABELS_IT[c])
                        .join(' / ')}
                    </td>
                    <td style={{ padding: '7px 4px', fontSize: '0.88rem', fontWeight: 700 }}>
                      {PROBABILITY_BY_COST[effTier]}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Riassunto del Turno e Personaggi Doppi */}
        <div
          style={{
            background: '#ffffff',
            border: '3px solid #2b2350',
            borderRadius: '18px',
            padding: '14px 16px',
            fontSize: '0.96rem',
            lineHeight: 1.45,
          }}
        >
          <div style={{ fontWeight: 900, fontSize: '1.05rem', marginBottom: '8px' }}>
            🔄 Riassunto del Turno &amp; Regole Chiave
          </div>
          <ol
            style={{
              margin: 0,
              paddingLeft: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <li>
              <strong>Tiro:</strong> Tiri i 5 dadi fino a{' '}
              <strong>{config.maxRollsPerTurn} volte</strong>, tenendo i dadi che vuoi tra un tiro
              e l&apos;altro.
            </li>
            <li>
              <strong>Scelta (una delle due):</strong>
              <ul style={{ paddingLeft: '18px', marginTop: '4px' }}>
                <li>
                  <strong>Gioca:</strong> Paghi il costo in gettoni + mostri la combinazione di
                  dadi richiesta.
                </li>
                <li>
                  <strong>Incassa:</strong> Prendi{' '}
                  <strong>
                    1 gettone + 1 per ogni{' '}
                    {config.cashInHighFaces === 'ONLY_SIX' ? '6' : '5 o 6'}
                  </strong>{' '}
                  (media 4,5 🪙).
                </li>
              </ul>
            </li>
            <li>
              <strong>Personaggi doppi:</strong> Il primo che gioca una carta la{' '}
              <strong>blocca</strong> per tutti gli altri finché resta in gioco (se torna in mano,
              si sblocca).
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
};
