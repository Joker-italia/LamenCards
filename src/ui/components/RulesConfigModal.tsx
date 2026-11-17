import React, { useState } from 'react';
import {
  runMonteCarloSimulation,
  SimulationReport,
} from '../../engine/botSimulator';
import { COMBO_LABELS_IT } from '../../engine/dice';
import { CardData, DiceComboId, GameConfig } from '../../engine/types';

interface RulesConfigModalProps {
  config: GameConfig;
  catalog: CardData[];
  onSaveConfig: (newConfig: GameConfig) => void;
  onClose: () => void;
}

const ALL_COMBO_OPTIONS: DiceComboId[] = [
  'ONE_PAIR',
  'TWO_PAIR',
  'STRAIGHT_4',
  'THREE_OF_A_KIND',
  'FULL_HOUSE',
  'FOUR_OF_A_KIND',
  'STRAIGHT_5',
];

export const RulesConfigModal: React.FC<RulesConfigModalProps> = ({
  config,
  catalog,
  onSaveConfig,
  onClose,
}) => {
  const [draft, setDraft] = useState<GameConfig>(() => JSON.parse(JSON.stringify(config)));
  const [simGamesCount, setSimGamesCount] = useState<number>(100);
  const [simPlayerCount, setSimPlayerCount] = useState<number>(4);
  const [simReport, setSimReport] = useState<SimulationReport | null>(null);

  const toggleComboForCost = (cost: number, combo: DiceComboId) => {
    setDraft((prev) => {
      const current = prev.costCombinationsTable[cost] || [];
      const exists = current.includes(combo);
      const next = exists
        ? current.filter((c) => c !== combo)
        : [...current, combo];
      return {
        ...prev,
        costCombinationsTable: {
          ...prev.costCombinationsTable,
          [cost]: next.length > 0 ? next : [combo],
        },
      };
    });
  };

  const handleRunSimulation = () => {
    const report = runMonteCarloSimulation(catalog, draft, simGamesCount, simPlayerCount);
    setSimReport(report);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'rgba(20, 15, 45, 0.88)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '12px',
      }}
    >
      <div
        className="panel-caramella"
        style={{
          width: '100%',
          maxWidth: '890px',
          maxHeight: '92dvh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            background: '#2b2350',
            color: '#fffdf6',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontFamily: 'var(--font-title)', fontSize: '1.3rem' }}>
              ⚙️ Regole Configurabili (&quot;In forse&quot; dal GDD) &amp; Simulatore
            </h2>
            <div style={{ fontSize: '0.76rem', opacity: 0.85 }}>
              Modifica qualsiasi parametro aperto del GDD e lancia simulazioni Bot da 50–300 partite.
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="btn-caramella btn-cream"
              style={{ padding: '6px 12px', fontSize: '0.8rem' }}
              onClick={onClose}
            >
              Annulla
            </button>
            <button
              className="btn-caramella btn-coral"
              style={{ padding: '6px 14px', fontSize: '0.84rem' }}
              onClick={() => {
                onSaveConfig(draft);
                onClose();
              }}
            >
              ✓ Applica Regole
            </button>
          </div>
        </div>

        {/* Body */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          {/* Sezione 1: Parametri Numerici e Modalità */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
              gap: '10px',
            }}
          >
            <label style={boxLabelStyle}>
              <span>🪙 Gettoni iniziali (Proposta GDD: 3)</span>
              <input
                type="number"
                min={0}
                max={15}
                value={draft.startingTokens}
                onChange={(e) =>
                  setDraft({ ...draft, startingTokens: Number(e.target.value) })
                }
                style={fieldStyle}
              />
            </label>

            <label style={boxLabelStyle}>
              <span>🎲 Tiri massimi per turno (GDD: 3)</span>
              <input
                type="number"
                min={1}
                max={5}
                value={draft.maxRollsPerTurn}
                onChange={(e) =>
                  setDraft({ ...draft, maxRollsPerTurn: Number(e.target.value) })
                }
                style={fieldStyle}
              />
            </label>

            <label style={boxLabelStyle}>
              <span>💰 Resa azione &quot;Incassa&quot; (Watchlist GDD)</span>
              <select
                value={draft.cashInHighFaces}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    cashInHighFaces: e.target.value as 'FIVE_AND_SIX' | 'ONLY_SIX',
                  })
                }
                style={fieldStyle}
              >
                <option value="FIVE_AND_SIX">1 + ogni 5 o 6 (Media 4,5 🪙)</option>
                <option value="ONLY_SIX">1 + solo ogni 6 (Partite più lunghe)</option>
              </select>
            </label>

            <label style={boxLabelStyle}>
              <span>🏪 Prezzo scambio Mercato (Gettoni)</span>
              <input
                type="number"
                min={0}
                max={5}
                value={draft.marketSwapCost}
                onChange={(e) =>
                  setDraft({ ...draft, marketSwapCost: Number(e.target.value) })
                }
                style={fieldStyle}
              />
            </label>

            <label style={boxLabelStyle}>
              <span>⏱️ Momento scambio Mercato</span>
              <select
                value={draft.marketSwapTiming}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    marketSwapTiming: e.target.value as GameConfig['marketSwapTiming'],
                  })
                }
                style={fieldStyle}
              >
                <option value="FREE_IN_TURN">Azione extra nel turno (1 volta)</option>
                <option value="REPLACES_MAIN_ACTION">Al posto di Gioca/Incassa</option>
              </select>
            </label>

            <label style={boxLabelStyle}>
              <span>🎯 Visibilità Obiettivo</span>
              <select
                value={draft.objectiveVisibility}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    objectiveVisibility: e.target.value as 'SECRET' | 'PUBLIC',
                  })
                }
                style={fieldStyle}
              >
                <option value="SECRET">Coperto / Segreto (Default GDD)</option>
                <option value="PUBLIC">Scoperto / Visibile a tutti</option>
              </select>
            </label>
          </div>

          {/* Sezione 2: Interruttori "In forse" e Regola Personaggi Doppi */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '10px',
            }}
          >
            <label style={toggleRowStyle}>
              <input
                type="checkbox"
                checked={draft.blockDuplicateCardsInPlay}
                onChange={(e) =>
                  setDraft({ ...draft, blockDuplicateCardsInPlay: e.target.checked })
                }
              />
              <span>
                <strong>Personaggi Doppi (GDD p.5):</strong> Il primo che gioca una carta la blocca per tutti gli altri
              </span>
            </label>

            <label style={toggleRowStyle}>
              <input
                type="checkbox"
                checked={draft.blockAllVersionsOfSamePersonInPlay}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    blockAllVersionsOfSamePersonInPlay: e.target.checked,
                  })
                }
              />
              <span>
                <strong>Blocco Esteso per Persona:</strong> Blocca anche versioni diverse della stessa persona in campo
              </span>
            </label>

            <label style={toggleRowStyle}>
              <input
                type="checkbox"
                checked={draft.uniquePersonPerTeam}
                onChange={(e) =>
                  setDraft({ ...draft, uniquePersonPerTeam: e.target.checked })
                }
              />
              <span>
                <strong>Unicità Persona in Squadra:</strong> Max 1 versione dello stesso amico nei propri 4 titolari
              </span>
            </label>

            <label style={toggleRowStyle}>
              <input
                type="checkbox"
                checked={draft.paidExtraRollEnabled}
                onChange={(e) =>
                  setDraft({ ...draft, paidExtraRollEnabled: e.target.checked })
                }
              />
              <span>
                <strong>In forse — 4° Tiro a pagamento:</strong> Paga {draft.paidExtraRollCost} gettone per un 4° tiro
              </span>
            </label>
          </div>

          {/* Sezione 3: Tabella Combinazioni Dadi per Costo */}
          <div
            style={{
              background: '#f5f2eb',
              border: '2px solid #2b2350',
              borderRadius: '16px',
              padding: '12px',
            }}
          >
            <div style={{ fontWeight: 900, fontSize: '0.88rem', marginBottom: '8px' }}>
              🎲 Tabella Combinazioni Dadi per Costo (Default GDD v2: 2=Coppia, 3=Doppia Coppia, 4=Scala di 4, 5=Full, 6=Poker)
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[2, 3, 4, 5, 6].map((cost) => {
                const activeCombos = draft.costCombinationsTable[cost] || [];
                return (
                  <div
                    key={cost}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      flexWrap: 'wrap',
                    }}
                  >
                    <span
                      style={{
                        width: '74px',
                        fontWeight: 900,
                        fontSize: '0.82rem',
                        background: '#ffd166',
                        padding: '3px 8px',
                        borderRadius: '8px',
                        border: '2px solid #2b2350',
                      }}
                    >
                      Costo {cost}:
                    </span>
                    {ALL_COMBO_OPTIONS.map((combo) => {
                      const active = activeCombos.includes(combo);
                      return (
                        <button
                          key={combo}
                          type="button"
                          onClick={() => toggleComboForCost(cost, combo)}
                          style={{
                            padding: '4px 9px',
                            borderRadius: '999px',
                            border: '2px solid #2b2350',
                            background: active ? '#2b2350' : '#ffffff',
                            color: active ? '#fffdf6' : '#2b2350',
                            fontWeight: 800,
                            fontSize: '0.73rem',
                            cursor: 'pointer',
                          }}
                        >
                          {COMBO_LABELS_IT[combo]}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sezione 4: Simulatore Headless Bot (32 carte) */}
          <div
            style={{
              background: '#eefbf5',
              border: '3px solid #2b2350',
              borderRadius: '18px',
              padding: '14px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '10px',
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontFamily: 'var(--font-title)', fontSize: '1.1rem' }}>
                  🤖 Simulatore Automatico Partite (Verifica le 32 carte)
                </h3>
                <div style={{ fontSize: '0.76rem' }}>
                  Controlla se <em>Il Letargo</em> o <em>After Party</em> dominano troppo e misura la durata media in 3–6 giocatori.
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <select
                  value={simPlayerCount}
                  onChange={(e) => setSimPlayerCount(Number(e.target.value))}
                  style={{ ...fieldStyle, width: 'auto', marginTop: 0 }}
                >
                  {[3, 4, 5, 6].map((n) => (
                    <option key={n} value={n}>
                      {n} Giocatori
                    </option>
                  ))}
                </select>

                <select
                  value={simGamesCount}
                  onChange={(e) => setSimGamesCount(Number(e.target.value))}
                  style={{ ...fieldStyle, width: 'auto', marginTop: 0 }}
                >
                  <option value={50}>50 Partite</option>
                  <option value={150}>150 Partite</option>
                  <option value={300}>300 Partite</option>
                </select>

                <button
                  type="button"
                  className="btn-caramella btn-coral"
                  style={{ padding: '7px 14px', fontSize: '0.82rem' }}
                  onClick={handleRunSimulation}
                >
                  ▶ Avvia Simulazione
                </button>
              </div>
            </div>

            {simReport && (
              <div style={{ marginTop: '12px' }}>
                <div
                  style={{
                    display: 'flex',
                    gap: '12px',
                    flexWrap: 'wrap',
                    marginBottom: '10px',
                  }}
                >
                  <div style={statBadgeStyle}>
                    Partite simulate: <strong>{simReport.gamesSimulated}</strong>
                  </div>
                  <div style={statBadgeStyle}>
                    Giri medi per partita: <strong>{simReport.averageRounds} giri</strong>
                  </div>
                  <div style={statBadgeStyle}>
                    Durata stimata dal vivo:{' '}
                    <strong>~{simReport.estimatedMinutesPerGame} min</strong>
                  </div>
                </div>

                <div style={{ maxHeight: '210px', overflowY: 'auto' }}>
                  <table
                    style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      fontSize: '0.76rem',
                    }}
                  >
                    <thead>
                      <tr style={{ background: '#2b2350', color: '#fffdf6', textAlign: 'left' }}>
                        <th style={{ padding: '6px' }}>Carta</th>
                        <th style={{ padding: '6px' }}>Classe</th>
                        <th style={{ padding: '6px' }}>Costo</th>
                        <th style={{ padding: '6px' }}>Volte Giocata</th>
                        <th style={{ padding: '6px' }}>Win-Rate quando giocata</th>
                      </tr>
                    </thead>
                    <tbody>
                      {simReport.cardStats.map((st) => (
                        <tr
                          key={st.cardName}
                          style={{ borderBottom: '1px solid rgba(43,35,80,0.18)' }}
                        >
                          <td style={{ padding: '5px 6px', fontWeight: 800 }}>{st.cardName}</td>
                          <td style={{ padding: '5px 6px' }}>{st.cardClass}</td>
                          <td style={{ padding: '5px 6px', fontWeight: 800 }}>{st.cost}</td>
                          <td style={{ padding: '5px 6px' }}>{st.timesPlayed}</td>
                          <td style={{ padding: '5px 6px', fontWeight: 900 }}>
                            {st.winRatePercent}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const boxLabelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  fontSize: '0.76rem',
  fontWeight: 800,
  background: '#ffffff',
  padding: '8px 10px',
  borderRadius: '12px',
  border: '2px solid #2b2350',
};

const fieldStyle: React.CSSProperties = {
  width: '100%',
  marginTop: '4px',
  padding: '6px 8px',
  borderRadius: '8px',
  border: '2px solid #2b2350',
  fontWeight: 800,
  fontSize: '0.82rem',
  background: '#fffdf6',
  color: '#2b2350',
};

const toggleRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  background: '#ffffff',
  padding: '8px 10px',
  borderRadius: '12px',
  border: '2px solid #2b2350',
  fontSize: '0.76rem',
  cursor: 'pointer',
};

const statBadgeStyle: React.CSSProperties = {
  background: '#ffffff',
  border: '2px solid #2b2350',
  borderRadius: '10px',
  padding: '6px 10px',
  fontSize: '0.8rem',
};
