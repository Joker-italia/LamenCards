import React, { useState } from 'react';
import { DEFAULT_GAME_CONFIG } from '../../data/defaultData';
import {
  BotStrategy,
  runSimulation,
  SimulationReport,
} from '../../engine/botSimulator';
import { COMBO_LABELS_IT } from '../../engine/dice';
import { CardData, DiceComboId, GameConfig } from '../../engine/types';

interface RulesConfigModalProps {
  config: GameConfig;
  catalog: CardData[];
  readOnly?: boolean;
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
  readOnly = false,
  onSaveConfig,
  onClose,
}) => {
  const [draft, setDraft] = useState<GameConfig>(() => JSON.parse(JSON.stringify(config)));
  const [simGamesCount, setSimGamesCount] = useState<number>(300);
  const [simPlayerCount, setSimPlayerCount] = useState<number>(4);
  const [simStrategy, setSimStrategy] = useState<BotStrategy>('GREEDY');
  const [simRunning, setSimRunning] = useState<boolean>(false);
  const [simReport, setSimReport] = useState<SimulationReport | null>(null);

  const toggleComboForCost = (cost: number, combo: DiceComboId) => {
    if (readOnly) return;
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

  const handleRunSimulationAsync = async () => {
    setSimRunning(true);
    await new Promise((r) => setTimeout(r, 25));
    try {
      const report = runSimulation({
        games: simGamesCount,
        players: simPlayerCount,
        botStrategy: simStrategy,
        config: draft,
        catalog,
        includeDiceMonteCarlo: true,
        diceTrials: 3000,
      });
      setSimReport(report);
    } finally {
      setSimRunning(false);
    }
  };

  const handleExportReport = () => {
    if (!simReport) return;
    const blob = new Blob([JSON.stringify(simReport, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lamencards_simulazione_${simReport.gamesSimulated}partite.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 180,
        background: 'rgba(18, 13, 40, 0.9)',
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
          maxWidth: '980px',
          maxHeight: '94dvh',
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
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontFamily: 'var(--font-title)', fontSize: '1.5rem' }}>
              ⚙️ Regole Configurabili (&quot;In forse&quot; dal GDD) &amp; Simulatore Bot
            </h2>
            <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>
              {readOnly
                ? 'Stai visualizzando le regole attive della stanza (solo l’Host può modificarle).'
                : 'Personalizza qualsiasi regola aperta del GDD o lancia fino a 1.000 partite simulate.'}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {!readOnly && (
              <button
                type="button"
                className="btn-caramella btn-mint"
                style={{ padding: '8px 14px', minHeight: '42px', fontSize: '0.9rem' }}
                onClick={() => setDraft(JSON.parse(JSON.stringify(DEFAULT_GAME_CONFIG)))}
              >
                ↺ Ripristina GDD
              </button>
            )}
            <button
              type="button"
              className="btn-caramella btn-cream"
              style={{ padding: '8px 14px', minHeight: '42px', fontSize: '0.9rem' }}
              onClick={onClose}
            >
              Chiudi
            </button>
            {!readOnly && (
              <button
                type="button"
                className="btn-caramella btn-coral"
                style={{ padding: '8px 16px', minHeight: '42px', fontSize: '0.95rem' }}
                onClick={() => {
                  onSaveConfig(draft);
                  onClose();
                }}
              >
                ✓ Applica Regole
              </button>
            )}
          </div>
        </div>

        {/* Body */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '18px',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
          }}
        >
          {/* Sezione 1: Parametri Numerici e Modalità */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '12px',
            }}
          >
            <label style={boxLabelStyle}>
              <span>🪙 Gettoni iniziali (Proposta GDD: 3)</span>
              <input
                type="number"
                min={0}
                max={15}
                disabled={readOnly}
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
                disabled={readOnly}
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
                disabled={readOnly}
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
                disabled={readOnly}
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
                disabled={readOnly}
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
                disabled={readOnly}
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
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '12px',
            }}
          >
            <label style={toggleRowStyle}>
              <input
                type="checkbox"
                disabled={readOnly}
                checked={draft.blockDuplicateCardsInPlay}
                onChange={(e) =>
                  setDraft({ ...draft, blockDuplicateCardsInPlay: e.target.checked })
                }
                style={{ width: '20px', height: '20px' }}
              />
              <span>
                <strong>Personaggi Doppi (GDD p.5):</strong> Il primo che gioca una carta la blocca per tutti gli altri
              </span>
            </label>

            <label style={toggleRowStyle}>
              <input
                type="checkbox"
                disabled={readOnly}
                checked={draft.blockAllVersionsOfSamePersonInPlay}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    blockAllVersionsOfSamePersonInPlay: e.target.checked,
                  })
                }
                style={{ width: '20px', height: '20px' }}
              />
              <span>
                <strong>Blocco Esteso per Persona:</strong> Blocca anche versioni diverse della stessa persona in campo
              </span>
            </label>

            <label style={toggleRowStyle}>
              <input
                type="checkbox"
                disabled={readOnly}
                checked={draft.uniquePersonPerTeam}
                onChange={(e) =>
                  setDraft({ ...draft, uniquePersonPerTeam: e.target.checked })
                }
                style={{ width: '20px', height: '20px' }}
              />
              <span>
                <strong>Unicità Persona in Squadra:</strong> Max 1 versione dello stesso amico nei propri 4 titolari
              </span>
            </label>

            <label style={toggleRowStyle}>
              <input
                type="checkbox"
                disabled={readOnly}
                checked={draft.paidExtraRollEnabled}
                onChange={(e) =>
                  setDraft({ ...draft, paidExtraRollEnabled: e.target.checked })
                }
                style={{ width: '20px', height: '20px' }}
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
              borderRadius: '18px',
              padding: '14px',
            }}
          >
            <div style={{ fontWeight: 900, fontSize: '1rem', marginBottom: '10px' }}>
              🎲 Tabella Combinazioni Dadi per Costo (Default GDD v2: 2=Coppia, 3=Doppia Coppia, 4=Scala di 4, 5=Full, 6=Poker)
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
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
                        width: '86px',
                        fontWeight: 900,
                        fontSize: '0.94rem',
                        background: '#ffd166',
                        padding: '5px 10px',
                        borderRadius: '10px',
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
                            padding: '6px 12px',
                            borderRadius: '999px',
                            border: '2px solid #2b2350',
                            background: active ? '#2b2350' : '#ffffff',
                            color: active ? '#fffdf6' : '#2b2350',
                            fontWeight: 800,
                            fontSize: '0.88rem',
                            cursor: readOnly ? 'default' : 'pointer',
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

          {/* Sezione 4: Simulatore Automatico Partite (fino a 1.000 partite) */}
          <div
            style={{
              background: '#eefbf5',
              border: '3px solid #2b2350',
              borderRadius: '20px',
              padding: '16px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontFamily: 'var(--font-title)', fontSize: '1.3rem' }}>
                  🤖 Simulatore Automatico Partite (Playtest 32 Carte)
                </h3>
                <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>
                  Verifica durata media, probabilità dadi e Watchlist GDD (<em>Il Letargo</em>,{' '}
                  <em>After Party</em>, ecc.) fino a 1.000 partite!
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
                  value={simStrategy}
                  onChange={(e) => setSimStrategy(e.target.value as BotStrategy)}
                  style={{ ...fieldStyle, width: 'auto', marginTop: 0 }}
                >
                  <option value="GREEDY">Bot Intelligenti (Greedy)</option>
                  <option value="RANDOM">Bot Casuali (Random)</option>
                </select>

                <select
                  value={simGamesCount}
                  onChange={(e) => setSimGamesCount(Number(e.target.value))}
                  style={{ ...fieldStyle, width: 'auto', marginTop: 0 }}
                >
                  <option value={100}>100 Partite</option>
                  <option value={300}>300 Partite</option>
                  <option value={500}>500 Partite</option>
                  <option value={1000}>1.000 Partite</option>
                </select>

                <button
                  type="button"
                  className="btn-caramella btn-coral"
                  style={{ padding: '8px 16px', minHeight: '42px', fontSize: '0.94rem' }}
                  disabled={simRunning}
                  onClick={handleRunSimulationAsync}
                >
                  {simRunning ? '⏳ Simulazione in corso...' : '▶ Avvia Simulazione'}
                </button>
              </div>
            </div>

            {simReport && (
              <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div
                  style={{
                    display: 'flex',
                    gap: '10px',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <div style={statBadgeStyle}>
                      Partite: <strong>{simReport.gamesSimulated}</strong>
                    </div>
                    <div style={statBadgeStyle}>
                      Giri medi: <strong>{simReport.averageRounds}</strong> (p90:{' '}
                      {simReport.roundsDistribution?.p90 ?? '-'})
                    </div>
                    <div style={statBadgeStyle}>
                      Durata stimata: <strong>~{simReport.estimatedMinutesPerGame} min</strong>
                    </div>
                    <div style={statBadgeStyle}>
                      Resa media Incassa:{' '}
                      <strong>{simReport.averageCashInTokens ?? 4.5} 🪙</strong>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="btn-caramella btn-mint"
                    style={{ minHeight: '38px', padding: '6px 12px', fontSize: '0.88rem' }}
                    onClick={handleExportReport}
                  >
                    ⬇ Esporta Report JSON
                  </button>
                </div>

                {/* Watchlist GDD */}
                {simReport.watchlist && simReport.watchlist.length > 0 && (
                  <div
                    style={{
                      background: '#ffffff',
                      border: '2px solid #2b2350',
                      borderRadius: '14px',
                      padding: '10px 12px',
                      fontSize: '0.88rem',
                    }}
                  >
                    <div style={{ fontWeight: 900, marginBottom: '6px' }}>
                      👁️ Watchlist Bilanciamento GDD:
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {simReport.watchlist.map((w) => (
                        <span
                          key={w.cardName}
                          style={{
                            background:
                              w.alertLevel === 'DOMINANTE'
                                ? '#ffe8e5'
                                : w.alertLevel === 'OSSERVAZIONE'
                                ? '#fff8db'
                                : '#dfffe9',
                            border: '1.5px solid #2b2350',
                            borderRadius: '10px',
                            padding: '4px 10px',
                            fontWeight: 800,
                          }}
                        >
                          <strong>{w.cardName}</strong> ({w.cost} 🪙): {w.winRate4pPercent}% win-rate [{w.alertLevel}]
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
                  <table
                    style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      fontSize: '0.9rem',
                    }}
                  >
                    <thead>
                      <tr style={{ background: '#2b2350', color: '#fffdf6', textAlign: 'left' }}>
                        <th style={{ padding: '8px' }}>Carta</th>
                        <th style={{ padding: '8px' }}>Classe</th>
                        <th style={{ padding: '8px' }}>Costo</th>
                        <th style={{ padding: '8px' }}>Giocata</th>
                        <th style={{ padding: '8px' }}>Giro Medio</th>
                        <th style={{ padding: '8px' }}>Win-Rate giocata</th>
                      </tr>
                    </thead>
                    <tbody>
                      {simReport.cardStats.map((st) => (
                        <tr
                          key={st.cardName}
                          style={{ borderBottom: '1px solid rgba(43,35,80,0.2)' }}
                        >
                          <td style={{ padding: '6px 8px', fontWeight: 800 }}>{st.cardName}</td>
                          <td style={{ padding: '6px 8px' }}>{st.cardClass}</td>
                          <td style={{ padding: '6px 8px', fontWeight: 800 }}>{st.cost} 🪙</td>
                          <td style={{ padding: '6px 8px' }}>{st.timesPlayed}</td>
                          <td style={{ padding: '6px 8px' }}>{st.averageTurnPlayed}</td>
                          <td style={{ padding: '6px 8px', fontWeight: 900 }}>
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
  fontSize: '0.9rem',
  fontWeight: 800,
  background: '#ffffff',
  padding: '10px 12px',
  borderRadius: '14px',
  border: '2px solid #2b2350',
};

const fieldStyle: React.CSSProperties = {
  width: '100%',
  marginTop: '6px',
  padding: '8px 10px',
  borderRadius: '10px',
  border: '2px solid #2b2350',
  fontWeight: 800,
  fontSize: '0.95rem',
  background: '#fffdf6',
  color: '#2b2350',
};

const toggleRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  background: '#ffffff',
  padding: '10px 12px',
  borderRadius: '14px',
  border: '2px solid #2b2350',
  fontSize: '0.9rem',
  cursor: 'pointer',
};

const statBadgeStyle: React.CSSProperties = {
  background: '#ffffff',
  border: '2px solid #2b2350',
  borderRadius: '12px',
  padding: '6px 12px',
  fontSize: '0.92rem',
};
