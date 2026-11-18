/**
 * Generatore di numeri pseudo-casuali deterministico con seed (Mulberry32).
 * Il motore salva `rngSeed`, `rngState` e `nextIdCounter` direttamente dentro `GameState`,
 * così `applyGameAction(state, action)` è una funzione 100% pura e riproducibile:
 * stesso stato + stessa azione => stesso identico stato successivo.
 */

export const DEFAULT_RNG_SEED = 0x4c414d45; // "LAME" in ASCII hex (1279348037)

export interface RngStateHolder {
  rngState: number;
}

export interface IdCounterHolder {
  nextIdCounter: number;
}

/**
 * Converte un numero o una stringa (es. roomCode) in un intero a 32 bit senza segno non nullo.
 */
export function hashSeed(seed?: number | string): number {
  if (typeof seed === 'number' && Number.isFinite(seed)) {
    const u = seed >>> 0;
    return u === 0 ? DEFAULT_RNG_SEED : u;
  }
  if (typeof seed === 'string' && seed.length > 0) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < seed.length; i++) {
      h ^= seed.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h === 0 ? DEFAULT_RNG_SEED : h;
  }
  return DEFAULT_RNG_SEED;
}

/**
 * Esegue un singolo passo dell'algoritmo Mulberry32 senza mutare variabili esterne.
 */
export function mulberry32Step(state: number): { value: number; nextState: number } {
  const nextState = (state + 0x6d2b79f5) >>> 0;
  let t = nextState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, nextState };
}

/**
 * Avanza lo stato `rngState` dell'oggetto passato e restituisce un float in [0, 1).
 */
export function nextRngFloat(holder: RngStateHolder): number {
  const current = (holder.rngState >>> 0) || DEFAULT_RNG_SEED;
  const { value, nextState } = mulberry32Step(current);
  holder.rngState = nextState;
  return value;
}

/**
 * Restituisce un intero casuale deterministico nell'intervallo [min, maxInclusive].
 */
export function nextRngInt(holder: RngStateHolder, min: number, maxInclusive: number): number {
  if (maxInclusive <= min) return min;
  const span = maxInclusive - min + 1;
  return min + Math.floor(nextRngFloat(holder) * span);
}

/**
 * Tira un dado a 6 facce (1..6) avanzando lo stato deterministico.
 */
export function rollDieFromRng(holder: RngStateHolder): number {
  return nextRngInt(holder, 1, 6);
}

/**
 * Mescola un array (Fisher-Yates) usando esclusivamente il PRNG deterministico.
 */
export function shuffleWithRng<T>(items: readonly T[], holder: RngStateHolder): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = nextRngInt(holder, 0, i);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Crea una funzione RNG standalone `() => number` a partire da un seed.
 */
export function createSeededRng(seed: number | string = DEFAULT_RNG_SEED): () => number {
  const holder: RngStateHolder = { rngState: hashSeed(seed) };
  return () => nextRngFloat(holder);
}

/**
 * Genera un ID deterministico basato sul contatore dello stato (senza Math.random né Date.now).
 */
export function nextDeterministicId(holder: IdCounterHolder, prefix = 'id'): string {
  holder.nextIdCounter = (holder.nextIdCounter || 0) + 1;
  return `${prefix}-${holder.nextIdCounter}`;
}
