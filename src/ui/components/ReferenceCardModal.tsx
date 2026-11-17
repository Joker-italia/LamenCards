import React from 'react';
import { COMBO_LABELS_IT } from '../../engine/dice';
import { GameConfig } from '../../engine/types';

interface ReferenceCardModalProps {
  config: GameConfig;
  onClose: () => void;
}

const PROBABILITY_BY_COST: Record<number, string> = {
  2: 'circa 100%',
  3: '77%',
  4: '59% (31% con 4 dadi)',
  5: '37%',
  6: '29% (10% con 4 dadi)',
};

export const ReferenceCardModal: React.FC<ReferenceCardModalProps> = ({
  config,
  onClose,
}) => {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 110,
        background: 'rgba(20, 15, 45, 0.85)',
        backdropFilter: 'blur(5px)',
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
          maxWidth: '460px',
          padding: '18px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '12px',
          }}
        >
          <h3 style={{ margin: 0, fontFamily: 'var(--font-title)', fontSize: '1.35rem' }}>
            📋 Carta di Riferimento
          </h3>
          <button
            className="btn-caramella btn-coral"
            style={{ padding: '4px 10px', fontSize: '0.78rem' }}
            onClick={onClose}
          >
            Chiudi
          </button>
        </div>

        {/* Tabella Costo -> Combinazione + Probabilità su 200.000 turni */}
        <div
          style={{
            background: '#bff0da',
            border: '3px solid #2b2350',
            borderRadius: '16px',
            padding: '10px',
            marginBottom: '12px',
          }}
        >
          <div style={{ fontWeight: 900, fontSize: '0.84rem', marginBottom: '6px' }}>
            🎲 Combinazione dei 5 dadi richiesta per Costo
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #2b2350', textAlign: 'left' }}>
                <th style={{ padding: '4px' }}>Costo</th>
                <th style={{ padding: '4px' }}>Combinazione</th>
                <th style={{ padding: '4px' }}>Prob. in 3 tiri</th>
              </tr>
            </thead>
            <tbody>
              {[2, 3, 4, 5, 6].map((cost) => (
                <tr key={cost} style={{ borderBottom: '1px solid rgba(43,35,80,0.2)' }}>
                  <td style={{ padding: '5px 4px', fontWeight: 900 }}>{cost} 🪙</td>
                  <td style={{ padding: '5px 4px', fontWeight: 800 }}>
                    {(config.costCombinationsTable[cost] || [])
                      .map((c) => COMBO_LABELS_IT[c])
                      .join(' / ')}
                  </td>
                  <td style={{ padding: '5px 4px', fontSize: '0.74rem', fontWeight: 700 }}>
                    {PROBABILITY_BY_COST[cost]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Riassunto del Turno e Personaggi Doppi */}
        <div
          style={{
            background: '#ffffff',
            border: '3px solid #2b2350',
            borderRadius: '16px',
            padding: '12px',
            fontSize: '0.79rem',
            lineHeight: 1.4,
          }}
        >
          <div style={{ fontWeight: 900, fontSize: '0.88rem', marginBottom: '6px' }}>
            🔄 Riassunto del Turno &amp; Regole Chiave
          </div>
          <ol style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <li>
              <strong>Tiro:</strong> Tiri i 5 dadi fino a <strong>{config.maxRollsPerTurn} volte</strong>, tenendo i dadi che vuoi tra un tiro e l&apos;altro.
            </li>
            <li>
              <strong>Scelta (una delle due):</strong>
              <ul style={{ paddingLeft: '16px', marginTop: '3px' }}>
                <li>
                  <strong>Gioca:</strong> Paghi il costo in gettoni + mostri la combinazione di dadi richiesta.
                </li>
                <li>
                  <strong>Incassa:</strong> Prendi <strong>1 gettone + 1 per ogni {config.cashInHighFaces === 'ONLY_SIX' ? '6' : '5 o 6'}</strong> (media 4,5 🪙).
                </li>
              </ul>
            </li>
            <li>
              <strong>Personaggi doppi:</strong> Il primo che gioca una carta la <strong>blocca</strong> per tutti gli altri finché resta in gioco (se torna in mano, si sblocca).
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
};
