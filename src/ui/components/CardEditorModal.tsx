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
  { id: 'NONE', label: 'Nessun automatismo (Solo testo / Da definire)', defaultTiming: 'PASSIVE_NONE', hasParam: false },
  { id: 'GAIN_TOKENS', label: 'Quando entra: Prendi N gettoni', defaultTiming: 'ON_ENTER', hasParam: true, paramLabel: 'Gettoni guadagnati (N)' },
  { id: 'STEAL_TOKENS', label: 'Quando entra: Ruba N gettoni a un avversario', defaultTiming: 'ON_ENTER', hasParam: true, paramLabel: 'Gettoni rubati (N)', requiresTarget: true },
  { id: 'CASH_IN_BONUS', label: 'Finché in gioco: Quando scegli Incassa prendi +N gettoni', defaultTiming: 'WHILE_IN_PLAY', hasParam: true, paramLabel: 'Gettoni extra (N)' },
  { id: 'NEXT_CARD_DISCOUNT', label: 'Quando entra: La prossima carta costa N gettoni in meno', defaultTiming: 'ON_ENTER', hasParam: true, paramLabel: 'Sconto gettoni (N)' },
  { id: 'RETURN_PLAYED_CARD', label: 'Quando entra: Rimanda in mano carta giocata con costo <= N', defaultTiming: 'ON_ENTER', hasParam: true, paramLabel: 'Costo massimo bersaglio (N)', requiresTarget: true },
  { id: 'GRANT_JOKER_DIE', label: 'Quando entra: Il prossimo tiro ha un Dado Jolly', defaultTiming: 'ON_ENTER', hasParam: false },
  { id: 'REDUCE_TARGET_ROLLS', label: 'Quando entra: Un giocatore tira solo N volte nel prossimo turno', defaultTiming: 'ON_ENTER', hasParam: true, paramLabel: 'Tiri massimi (N)', requiresTarget: true },
  { id: 'REDUCE_ALL_DICE', label: 'Quando entra: Fino al tuo prossimo turno tutti tirano 4 dadi', defaultTiming: 'ON_ENTER', hasParam: false },
  { id: 'SHIFT_TARGET_COMBO_TIER', label: 'Finché in gioco: Avversario richiede combinazione costo superiore', defaultTiming: 'WHILE_IN_PLAY', hasParam: true, paramLabel: 'Aumento livello (+N)', requiresTarget: true },
  { id: 'PASS_UNPLAYED_LEFT', label: 'Quando entra: Tutti passano 1 carta non giocata a sinistra', defaultTiming: 'ON_ENTER', hasParam: false },
  { id: 'ALL_REDRAW_OBJECTIVE', label: 'Quando entra: Tutti pescano 1 nuovo Obiettivo opzionale', defaultTiming: 'ON_ENTER', hasParam: false },
  { id: 'GAMBLE_DICE_SWAP', label: 'Quando entra: Dado 1-2 perdi N gettoni, 6 scambi carta non giocata', defaultTiming: 'ON_ENTER', hasParam: true, paramLabel: 'Gettoni persi su 1-2 (N)', requiresTarget: true },
];

export const CardEditorModal: React.FC<CardEditorModalProps> = ({
  catalog,
  onSaveCatalog,
  onClose,
}) => {
  const [cards, setCards] = useState<CardData[]>(() => [...catalog]);
  const [selectedIdx, setSelectedIdx] = useState<number>(0);

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
    const newCard: CardData = {
      id: `custom-${Date.now()}`,
      setNumber: nextNumber,
      personName: 'Nuovo Amico',
      name: `Nuova Carta #${nextNumber}`,
      version: 'Versione Base',
      cardClass: 'Utenti',
      rarity: 'Comune',
      cost: 3,
      effectType: 'Aiuto',
      effectText: 'Quando entra in gioco: prendi 2 gettoni.',
      effectModel: {
        templateId: 'GAIN_TOKENS',
        timing: 'ON_ENTER',
        value: 2,
      },
      avatarSeed: 'coffee',
    };
    const updated = [...cards, newCard];
    setCards(updated);
    setSelectedIdx(updated.length - 1);
  };

  const handleDeleteCard = () => {
    if (cards.length <= 6) {
      alert('Servono almeno 6 carte nel catalogo!');
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
    a.download = 'lamencards_set.json';
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
          maxWidth: '940px',
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
              🎨 Editor Carte LAMENCARDS ({cards.length} carte)
            </h2>
            <div style={{ fontSize: '0.78rem', opacity: 0.85 }}>
              Modifica foto, nome, versione, classe, rarità, costo ed effetto e rigioca subito!
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
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '16px',
          }}
        >
          {/* Colonna Sinistra: Lista Carte + Anteprima Live Caramella */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
            <div
              style={{
                width: '100%',
                display: 'flex',
                gap: '6px',
                overflowX: 'auto',
                paddingBottom: '6px',
              }}
            >
              {cards.map((c, idx) => (
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
                    fontSize: '0.76rem',
                    cursor: 'pointer',
                  }}
                >
                  #{c.setNumber} {c.name}
                </button>
              ))}
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
                  fontSize: '0.78rem',
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
                  Classe (es. Dormienti, Utenti, PROMO)
                  <input
                    type="text"
                    value={activeCard.cardClass}
                    onChange={(e) => updateActiveCard({ cardClass: e.target.value })}
                    style={inputStyle}
                  />
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 800 }}>
                  Costo (2–6 gettoni)
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
                  Rarità
                  <select
                    value={activeCard.rarity}
                    onChange={(e) =>
                      updateActiveCard({ rarity: e.target.value as CardRarity })
                    }
                    style={inputStyle}
                  >
                    <option value="Comune">Comune</option>
                    <option value="Rara">Rara</option>
                    <option value="Olografica">Olografica</option>
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
                  ⚙️ Modello Effetto Eseguibile (Opzionale / Per Test Automatici)
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
                        value: activeCard.effectModel.value ?? 2,
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
                    if (confirm('Ripristinare le 12 carte originali del GDD?')) {
                      setCards([...DEFAULT_CARDS]);
                      setSelectedIdx(0);
                    }
                  }}
                >
                  ↺ Ripristina 12 Carte GDD
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
