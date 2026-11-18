export const CARAMELLA_COLORS = {
  cream: '#fffdf6',
  night: '#2b2350',
  nightLight: '#3d326e',
  mint: '#bff0da',
  mintDeep: '#8ce0bc',
  coral: '#ea5444',
  coralDark: '#c93b2b',
  gold: '#ffd166',
  purple: '#8b5cf6',
  sky: '#5ce1e6',
  green: '#22c55e',
} as const;

export const CLASS_THEME: Record<
  string,
  { bg: string; text: string; emoji: string; tagline: string }
> = {
  Dormienti: {
    bg: '#60a5fa',
    text: '#ffffff',
    emoji: '😴',
    tagline: 'Lenti ma solidi: gettoni nel tempo, protezione e rallentamento',
  },
  Utenti: {
    bg: '#fbbf24',
    text: '#2b2350',
    emoji: '😵‍💫',
    tagline: 'Sfattonati: sviste, scommesse coi dadi ed effetti imprevedibili',
  },
  Festaioli: {
    bg: '#ec4899',
    text: '#ffffff',
    emoji: '🥳',
    tagline: 'L’anima del gruppo: gettoni a tutti, Mercato gratis e doppie giocate',
  },
  Scrocconi: {
    bg: '#a855f7',
    text: '#ffffff',
    emoji: '🦝',
    tagline: 'Vivono alle spalle degli altri: rubano gettoni, spiano e sfrattano',
  },
};

export const EFFECT_TYPE_THEME: Record<
  string,
  { bg: string; text: string; icon: string; label: string }
> = {
  Aiuto: { bg: '#22c55e', text: '#ffffff', icon: '💡', label: 'AIUTO' },
  Ostacolo: { bg: '#f97316', text: '#ffffff', icon: '🎯', label: 'OSTACOLO' },
  Caos: { bg: '#8b5cf6', text: '#ffffff', icon: '🌀', label: 'CAOS' },
};
