// Ajustes de la app: valores por defecto, validación y guardado en el navegador.
import { SCALES, QUALITIES } from './music/theory.js';
import { ASSIGNABLE } from './hands/gestures.js';

const STORAGE_KEY = 'acordes-con-las-manos:ajustes';

export const DEFAULTS = Object.freeze({
  leftMode: 'scale', // 'scale' | 'custom'
  tonic: 0,
  scale: 'major',
  sevenths: false,
  // Acordes del modo personalizado: Do, Lam, Fa, Sol, Rem, Mim, Sol7, Si♭.
  custom: {
    one: { root: 0, quality: 'maj' },
    two: { root: 9, quality: 'min' },
    three: { root: 5, quality: 'maj' },
    four: { root: 7, quality: 'maj' },
    five: { root: 2, quality: 'min' },
    shaka: { root: 4, quality: 'min' },
    rock: { root: 7, quality: '7' },
    thumb: { root: 10, quality: 'maj' },
  },
  swapHands: false,
});

const isPitch = (n) => Number.isInteger(n) && n >= 0 && n < 12;
const isChord = (c) => c && isPitch(c.root) && Object.hasOwn(QUALITIES, c.quality);

// Mezcla lo guardado con los valores por defecto, descartando lo que no sea válido
// (por ejemplo, datos de una versión anterior de la app).
export function sanitize(saved) {
  const s = saved && typeof saved === 'object' ? saved : {};
  const custom = {};
  for (const g of ASSIGNABLE) {
    const c = s.custom?.[g];
    custom[g] = isChord(c) ? { root: c.root, quality: c.quality } : { ...DEFAULTS.custom[g] };
  }
  return {
    leftMode: ['scale', 'custom'].includes(s.leftMode) ? s.leftMode : DEFAULTS.leftMode,
    tonic: isPitch(s.tonic) ? s.tonic : DEFAULTS.tonic,
    scale: Object.hasOwn(SCALES, s.scale) ? s.scale : DEFAULTS.scale,
    sevenths: typeof s.sevenths === 'boolean' ? s.sevenths : DEFAULTS.sevenths,
    custom,
    swapHands: typeof s.swapHands === 'boolean' ? s.swapHands : DEFAULTS.swapHands,
  };
}

export function loadSettings() {
  try {
    return sanitize(JSON.parse(localStorage.getItem(STORAGE_KEY)));
  } catch {
    return sanitize(null);
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch { /* sin almacenamiento disponible: los ajustes duran lo que dure la página */ }
}
