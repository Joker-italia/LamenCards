import React, { useState } from 'react';
import { DEFAULT_CARDS } from '../../data/defaultData';
import {
  CardData,
  CardRarity,
  EffectCategory,
  EffectTemplateId,
  EffectTiming,
} from '../../engine/types';
import { CardComponent } from './CardComponent';

interface CardEditorModalProps {
  catalog: CardData[];
  onSaveCatalog: (newCatalog: CardData[]) => void;
  onClose: () => void;
}

const EFFECT_TEMPLATES: Array<{
  id: EffectTemplateId;
  label: string;
  defaultTiming: EffectTiming;
  hasParam: boolean;
  paramLabel?: string;
  requiresTarget?: boolean;
}> = [
  { id: 'NONE', label: 'Nessun automatismo (Solo testo)', defaultTiming: 'PASSIVE_NONE', hasParam: false },
  { id: 'GAIN_TOKENS', label: 'Quando entra: Prendi N gettoni', defaultTiming: 'ON_ENTER', hasParam: true, paramLabel: 'Gettoni guadagnati (N)' },
  { id: 'SET_TARGET_NEXT_ROLLS', label: 'Quando entra: Avversario tira solo N volte nel prossimo turno (Russa Forte)', defaultTiming: 'ON_ENTER', hasParam: true, paramLabel: 'Tiri massimi avversario (N)', requiresTarget: true },
  { id: 'GAIN_TOKENS_AND_NEXT_ROLLS', label: 'Quando entra: Prendi N gettoni e tiri 4 volte al prossimo turno (Sveglia alle 7)', defaultTiming: 'ON_ENTER', hasParam: true, paramLabel: 'Gettoni guadagnati (N)' },
  { id: 'PROTECT_FROM_BUY_AND_BOUNCE', label: 'Finché in gioco: Protetto da acquisti e sfratti (Il Piumone)', defaultTiming: 'WHILE_IN_PLAY', hasParam: false },
  { id: 'CASH_IN_BONUS', label: 'Finché in gioco: Quando scegli Incassa prendi +N gettoni (Coma sul Divano)', defaultTiming: 'WHILE_IN_PLAY', hasParam: true, paramLabel: 'Gettoni extra (N)' },
  { id: 'OTHERS_FOUR_DICE_ONE_ROUND', label: 'Quando entra: Tutti gli altri tirano 4 dadi fino al tuo prossimo turno (Sonno Contagioso)', defaultTiming: 'ON_ENTER', hasParam: false },
  { id: 'SKIP_TARGET_NEXT_TURN', label: 'Quando entra: Avversario salta il prossimo turno (Il Letargo)', defaultTiming: 'ON_ENTER', hasParam: false, requiresTarget: true },
  { id: 'TURN_START_GAIN_TOKENS', label: 'Finché in gioco: A inizio turno prendi +N gettoni (Il Dormiente Supremo)', defaultTiming: 'WHILE_IN_PLAY', hasParam: true, paramLabel: 'Gettoni a inizio turno (N)' },
  { id: 'GAMBLE_DICE_SWAP', label: 'Quando entra: Dado 1-2 perdi N gettoni, 6 scambi carta (Giorgio)', defaultTiming: 'ON_ENTER', hasParam: true, paramLabel: 'Gettoni persi su 1-2 (N)', requiresTarget: true },
  { id: 'LOSE_TARGET_TOKENS', label: 'Quando entra: Avversario perde N gettoni nella scorta (Dove ho messo le chiavi?)', defaultTiming: 'ON_ENTER', hasParam: true, paramLabel: 'Gettoni persi (N)', requiresTarget: true },
  { id: 'ROLL_2D6_JACKPOT_TOKENS', label: 'Quando entra: Lancia 2 dadi, se somma 6 o 7 prendi N gettoni altrimenti 1 (Mariong)', defaultTiming: 'ON_ENTER', hasParam: true, paramLabel: 'Gettoni su 6 o 7 (N)' },
  { id: 'ALL_ROLL_LOWEST_LOSES_TOKENS', label: 'Quando entra: Tutti tirano 1 dado, il più basso perde N gettoni (Effetto Ritardo)', defaultTiming: 'ON_ENTER', hasParam: true, paramLabel: 'Gettoni persi dal minimo (N)' },
  { id: 'FLIP_DIE_OPPOSITE_ONCE_PER_TURN', label: 'Finché in gioco: 1 volta per turno gira 1 dado sulla faccia opposta (Il Dado Fortunato)', defaultTiming: 'WHILE_IN_PLAY', hasParam: false },
  { id: 'PASS_UNPLAYED_LEFT', label: 'Quando entra: Tutti passano 1 carta non giocata a sinistra (Sfattonata Collettiva)', defaultTiming: 'ON_ENTER', hasParam: false },
  { id: 'FORBID_TARGET_PLAY_NEXT_TURN', label: 'Quando entra: Avversario non può scegliere Gioca nel prossimo turno (La Chiamata Persa)', defaultTiming: 'ON_ENTER', hasParam: false, requiresTarget: true },
  { id: 'INVERT_COMBO_TABLE_ONE_ROUND', label: 'Quando entra: Scambia combinazioni 2↔6 e 3↔5 per 1 giro (Il Trip)', defaultTiming: 'ON_ENTER', hasParam: false },
  { id: 'ALL_GAIN_TOKENS_SELF_MORE', label: 'Quando entra: Tu prendi N gettoni, tutti gli altri +1 (Offro Io)', defaultTiming: 'ON_ENTER', hasParam: true, paramLabel: 'Gettoni per te (N)' },
  { id: 'NO_COMBO_ALTERNATE_COST', label: 'Passivo: Giocabile senza combinazione dadi pagando N gettoni (Il Ritardatario)', defaultTiming: 'PASSIVE_NONE', hasParam: true, paramLabel: 'Costo senza combinazione (N)' },
  { id: 'GAIN_TOKENS_AND_FREE_MARKET', label: 'Quando entra: Prendi N gettoni + prossimo scambio Mercato gratis (Il PR)', defaultTiming: 'ON_ENTER', hasParam: true, paramLabel: 'Gettoni guadagnati (N)' },
  { id: 'OTHERS_PAY_TOKEN_OR_4_DICE', label: 'Quando entra: Gli altri ti danno 1 gettone o tirano 4 dadi (Giro di Shot)', defaultTiming: 'ON_ENTER', hasParam: false },
  { id: 'ON_OTHER_PLAY_GAIN_TOKEN', label: 'Finché in gioco: Quando un altro gioca una carta prendi +1 gettone, max 2/giro (Anima della Festa)', defaultTiming: 'WHILE_IN_PLAY', hasParam: false },
  { id: 'ALL_FREE_MARKET_SWAP', label: 'Quando entra: Ogni giocatore può scambiare gratis 1 carta col Mercato (Il DJ)', defaultTiming: 'ON_ENTER', hasParam: false },
  { id: 'PLAY_EXTRA_CARD_NO_COMBO', label: 'Quando entra: Gioca subito un’altra carta pagando solo i gettoni (After Party)', defaultTiming: 'ON_ENTER', hasParam: false },
  { id: 'DISCOUNT_COST_AND_COMBO_TIER', label: 'Finché in gioco: Tue carte costano -N e chiedono combinazione costo inferiore (Lo Sponsor)', defaultTiming: 'WHILE_IN_PLAY', hasParam: true, paramLabel: 'Riduzione costo/livello (N)' },
  { id: 'STEAL_TOKENS', label: 'Quando entra: Ruba N gettoni a un giocatore (Lo Scroccone / Ladro di Patatine)', defaultTiming: 'ON_ENTER', hasParam: true, paramLabel: 'Gettoni rubati (N)', requiresTarget: true },
  { id: 'BORROW_TOKENS_REPAY_NEXT_TURN', label: 'Quando entra: Prendi N gettoni da un giocatore e restituiscine 1 al prossimo turno (Mi Presti 2 Euro?)', defaultTiming: 'ON_ENTER', hasParam: true, paramLabel: 'Gettoni presi (N)', requiresTarget: true },
  { id: 'FREE_IMMEDIATE_MARKET_SWAP', label: 'Quando entra: Scambia gratis una carta col Mercato (L’Imbucato)', defaultTiming: 'ON_ENTER', hasParam: false },
  { id: 'LEFT_NEIGHBOR_CASH_IN_BONUS', label: 'Finché in gioco: Quando il vicino a sinistra sceglie Incassa prendi +N gettoni (Il Parassita)', defaultTiming: 'WHILE_IN_PLAY', hasParam: true, paramLabel: 'Gettoni guadagnati (N)' },
  { id: 'PEEK_OBJECTIVE_AND_STEAL', label: 'Quando entra: Guarda l’Obiettivo di un giocatore e rubagli N gettoni (Il Ficcanaso)', defaultTiming: 'ON_ENTER', hasParam: true, paramLabel: 'Gettoni rubati (N)', requiresTarget: true },
  { id: 'RETURN_PLAYED_CARD', label: 'Quando entra: Rimanda in mano una carta giocata di costo <= N (Lo Sfratto)', defaultTiming: 'ON_ENTER', hasParam: true, paramLabel: 'Costo massimo bersaglio (N)', requiresTarget: true },
  { id: 'TURN_START_STEAL_FROM_RICHEST', label: 'Finché in gioco: A inizio turno ruba N gettoni a chi ne ha di più (Il Mantenuto)', defaultTiming: 'WHILE_IN_PLAY', hasParam: true, paramLabel: 'Gettoni rubati (N)' },
];

export const CardEditorModal: React.FC<CardEditorModalProps> = ({
  catalog,
  onSaveCatalog,
  onClose,
}) => {
  const [cards, setCards] = useState<CardData[]>(() => [...catalog]);
  const [selectedIdx, setSelectedIdx] = useState<number>(0);
  const [classFilter, setClassFilter] = useState<string>('ALL');

  const activeCard = cards[selectedIdx] || cards[0];

  const updateActiveCard = (patch: Partial<CardData>) => {
    setCards((prev) =>
      prev.map((c, idx) => (idx === selectedIdx ? { ...c, ...patch } : c))
    );
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        updateActiveCard({ photoUrl: reader.result });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAddNewCard = () => {
    const nextNumber = cards.length + 1;
    const newId = `custom-${Date.now()}`;
    const newCard: CardData = {
      id: newId,
      baseCardId: newId,
      setNumber: nextNumber,
      personName: 'Nuovo Amico',
      name: `Nuova Carta #${nextNumber}`,
      version: 'Versione Base',
      cardClass: classFilter !== 'ALL' ? classFilter : 'Dormienti',
      rarity: 'Comune',
      cost: 3,
      effectType: 'Aiuto',
      effectText: 'Quando entra: prendi 1 gettone.',
      effectModel: {
        templateId: 'GAIN_TOKENS',
        timing: 'ON_ENTER',
        value: 1,
      },
      avatarSeed: 'coffee',
    };
    const updated = [...cards, newCard];
    setCards(updated);
    setSelectedIdx(updated.length - 1);
  };

  const handleDeleteCard = () => {
    if (cards.length <= 8) {
      alert('Servono almeno 8 carte nel catalogo!');
      return;
    }
    const updated = cards.filter((_, idx) => idx !== selectedIdx);
    setCards(updated);
    setSelectedIdx(Math.max(0, selectedIdx - 1));
  };

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(cards, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lamencards_32_cards.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (Array.isArray(parsed) && parsed.length > 0) {
          setCards(parsed);
          setSelectedIdx(0);
        }
      } catch {
        alert('File JSON non valido.');
      }
    };
    reader.readAsText(file);
  };

  const currentTemplateMeta =
    EFFECT_TEMPLATES.find((t) => t.id === activeCard?.effectModel?.templateId) ||
    EFFECT_TEMPLATES[0];

  // Calcolo budget di riferimento secondo le linee guida GDD (costo - 1)
  const gddBudgetRef = activeCard ? activeCard.cost - 1 : 1;

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
          maxWidth: '960px',
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
            <h2
              style={{
                margin: 0,
                fontFamily: 'var(--font-title)',
                fontSize: '1.35rem',
                letterSpacing: '0.02em',
              }}
            >
              🎨 Editor Carte LAMENCARDS ({cards.length} carte — 4 Classi)
            </h2>
            <div style={{ fontSize: '0.76rem', opacity: 0.85 }}>
              Set di prova: 32 carte (8 per classe: Dormienti, Utenti, Festaioli, Scrocconi). Budget GDD effetto = Costo - 1.
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              className="btn-caramella btn-mint"
              style={{ padding: '6px 12px', fontSize: '0.8rem' }}
              onClick={handleExportJson}
            >
              ⬇ Esporta JSON
            </button>
            <label
              className="btn-caramella btn-cream"
              style={{ padding: '6px 12px', fontSize: '0.8rem' }}
            >
              ⬆ Importa JSON
              <input type="file" accept=".json" onChange={handleImportJson} hidden />
            </label>
            <button
              className="btn-caramella btn-coral"
              style={{ padding: '6px 14px', fontSize: '0.85rem' }}
              onClick={() => {
                onSaveCatalog(cards);
                onClose();
              }}
            >
              ✓ Salva e Usa Set
            </button>
          </div>
        </div>

        {/* Body */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '14px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))',
            gap: '16px',
          }}
        >
          {/* Colonna Sinistra: Filtro Classe + Lista Carte + Anteprima Live */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center' }}>
            {/* Filtro per le 4 Classi */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', width: '100%' }}>
              {['ALL', 'Dormienti', 'Utenti', 'Festaioli', 'Scrocconi'].map((cls) => (
                <button
                  key={cls}
                  type="button"
                  onClick={() => setClassFilter(cls)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '999px',
                    border: '2px solid #2b2350',
                    background: classFilter === cls ? '#2b2350' : '#ffffff',
                    color: classFilter === cls ? '#fffdf6' : '#2b2350',
                    fontWeight: 800,
                    fontSize: '0.72rem',
                    cursor: 'pointer',
                  }}
                >
                  {cls === 'ALL' ? 'Tutte (32)' : cls}
                </button>
              ))}
            </div>

            <div
              style={{
                width: '100%',
                display: 'flex',
                gap: '6px',
                overflowX: 'auto',
                paddingBottom: '6px',
              }}
            >
              {cards.map((c, idx) => {
                if (classFilter !== 'ALL' && c.cardClass !== classFilter) return null;
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedIdx(idx)}
                    style={{
                      flexShrink: 0,
                      padding: '6px 10px',
                      borderRadius: '12px',
                      border: '2px solid #2b2350',
                      background: idx === selectedIdx ? '#ea5444' : '#bff0da',
                      color: idx === selectedIdx ? '#ffffff' : '#2b2350',
                      fontWeight: 800,
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                    }}
                  >
                    #{c.setNumber} {c.name} ({c.cost})
                  </button>
                );
              })}
              <button
                onClick={handleAddNewCard}
                style={{
                  flexShrink: 0,
                  padding: '6px 12px',
                  borderRadius: '12px',
                  border: '2px dashed #2b2350',
                  background: '#ffd166',
                  color: '#2b2350',
                  fontWeight: 900,
                  fontSize: '0.76rem',
                  cursor: 'pointer',
                }}
              >
                + Nuova Carta
              </button>
            </div>

            {activeCard && <CardComponent card={activeCard} size="lg" />}

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
              <label
                className="btn-caramella btn-mint"
                style={{ padding: '6px 12px', fontSize: '0.78rem' }}
              >
                📷 Carica Foto Amico (Scontornata)
                <input type="file" accept="image/*" onChange={handlePhotoUpload} hidden />
              </label>
              {activeCard?.photoUrl && (
                <button
                  className="btn-caramella btn-cream"
                  style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                  onClick={() => updateActiveCard({ photoUrl: undefined })}
                >
                  Usa Avatar Cartoon
                </button>
              )}
            </div>
          </div>

          {/* Colonna Destra: Campi Modificabili */}
          {activeCard && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 800 }}>
                  Titolo Carta
                  <input
                    type="text"
                    value={activeCard.name}
                    onChange={(e) => updateActiveCard({ name: e.target.value })}
                    style={inputStyle}
                  />
                </label>

                <label style={{ fontSize: '0.78rem', fontWeight: 800 }}>
                  Nome Amico (Persona)
                  <input
                    type="text"
                    value={activeCard.personName}
                    onChange={(e) => updateActiveCard({ personName: e.target.value })}
                    style={inputStyle}
                  />
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 800 }}>
                  Versione / Sottotitolo
                  <input
                    type="text"
                    value={activeCard.version}
                    onChange={(e) => updateActiveCard({ version: e.target.value })}
                    style={inputStyle}
                  />
                </label>

                <label style={{ fontSize: '0.78rem', fontWeight: 800 }}>
                  Classe (4 Classi GDD)
                  <select
                    value={activeCard.cardClass}
                    onChange={(e) => updateActiveCard({ cardClass: e.target.value })}
                    style={inputStyle}
                  >
                    <option value="Dormienti">Dormienti (Confermata)</option>
                    <option value="Utenti">Utenti (Confermata)</option>
                    <option value="Festaioli">Festaioli (Provvisorio)</option>
                    <option value="Scrocconi">Scrocconi (Provvisorio)</option>
                  </select>
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 800 }}>
                  Costo (Budget ≈ {gddBudgetRef} 🪙)
                  <select
                    value={activeCard.cost}
                    onChange={(e) =>
                      updateActiveCard({ cost: Number(e.target.value) as 2 | 3 | 4 | 5 | 6 })
                    }
                    style={inputStyle}
                  >
                    {[2, 3, 4, 5, 6].map((c) => (
                      <option key={c} value={c}>
                        {c} Gettoni
                      </option>
                    ))}
                  </select>
                </label>

                <label style={{ fontSize: '0.78rem', fontWeight: 800 }}>
                  Tipo Effetto
                  <select
                    value={activeCard.effectType}
                    onChange={(e) =>
                      updateActiveCard({ effectType: e.target.value as EffectCategory })
                    }
                    style={inputStyle}
                  >
                    <option value="Aiuto">⚡ Aiuto</option>
                    <option value="Ostacolo">🎯 Ostacolo</option>
                    <option value="Caos">🌀 Caos</option>
                  </select>
                </label>

                <label style={{ fontSize: '0.78rem', fontWeight: 800 }}>
                  Rarità (PROMO = Olo)
                  <select
                    value={activeCard.rarity}
                    onChange={(e) =>
                      updateActiveCard({ rarity: e.target.value as CardRarity })
                    }
                    style={inputStyle}
                  >
                    <option value="Comune">Comune</option>
                    <option value="Rara">Rara</option>
                    <option value="PROMO">✨ PROMO (Olografica)</option>
                  </select>
                </label>
              </div>

              <label style={{ fontSize: '0.78rem', fontWeight: 800 }}>
                Testo dell&apos;Effetto (mostrato sulla carta)
                <textarea
                  rows={2}
                  value={activeCard.effectText}
                  onChange={(e) => updateActiveCard({ effectText: e.target.value })}
                  style={{ ...inputStyle, resize: 'vertical' }}
                />
              </label>

              {/* Modello Eseguibile con Parametri */}
              <div
                style={{
                  background: '#eefbf5',
                  border: '2px solid #2b2350',
                  borderRadius: '14px',
                  padding: '10px',
                }}
              >
                <div style={{ fontSize: '0.78rem', fontWeight: 900, marginBottom: '6px' }}>
                  ⚙️ Modello Effetto Eseguibile (Calibrato sul GDD)
                </div>
                <select
                  value={activeCard.effectModel.templateId}
                  onChange={(e) => {
                    const tplId = e.target.value as EffectTemplateId;
                    const meta =
                      EFFECT_TEMPLATES.find((t) => t.id === tplId) || EFFECT_TEMPLATES[0];
                    updateActiveCard({
                      effectModel: {
                        templateId: tplId,
                        timing: meta.defaultTiming,
                        value: activeCard.effectModel.value ?? 1,
                        secondaryValue: activeCard.effectModel.secondaryValue ?? 1,
                        requiresTargetPlayer: meta.requiresTarget,
                      },
                    });
                  }}
                  style={inputStyle}
                >
                  {EFFECT_TEMPLATES.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>
                      {tpl.label}
                    </option>
                  ))}
                </select>

                {currentTemplateMeta.hasParam && (
                  <label
                    style={{
                      display: 'block',
                      marginTop: '8px',
                      fontSize: '0.76rem',
                      fontWeight: 800,
                    }}
                  >
                    {currentTemplateMeta.paramLabel || 'Valore parametro (N)'}:
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={activeCard.effectModel.value ?? 1}
                      onChange={(e) =>
                        updateActiveCard({
                          effectModel: {
                            ...activeCard.effectModel,
                            value: Number(e.target.value),
                          },
                        })
                      }
                      style={{ ...inputStyle, marginTop: '4px' }}
                    />
                  </label>
                )}
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginTop: '6px',
                  gap: '8px',
                }}
              >
                <button
                  className="btn-caramella btn-cream"
                  style={{ fontSize: '0.76rem', padding: '6px 10px' }}
                  onClick={() => {
                    if (confirm('Ripristinare le 32 carte ufficiali del GDD?')) {
                      setCards([...DEFAULT_CARDS]);
                      setSelectedIdx(0);
                    }
                  }}
                >
                  ↺ Ripristina 32 Carte GDD
                </button>

                <button
                  className="btn-caramella btn-cream"
                  style={{ fontSize: '0.76rem', padding: '6px 10px', color: '#c93b2b' }}
                  onClick={handleDeleteCard}
                >
                  🗑 Elimina Carta
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  marginTop: '3px',
  padding: '7px 10px',
  borderRadius: '10px',
  border: '2px solid #2b2350',
  background: '#ffffff',
  color: '#2b2350',
  fontWeight: 700,
  fontSize: '0.84rem',
};
