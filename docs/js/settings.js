// Ajustes de la app: valores por defecto, validación y guardado en el navegador.
import { SCALES, QUALITIES, INVERSIONS } from './music/theory.js';
import { PATTERNS, patternsFor } from './music/patterns.js';
import { METERS } from './music/timing.js';
import { ASSIGNABLE } from './hands/gestures.js';

const STORAGE_KEY = 'acordes-con-las-manos:ajustes';

// Tabla gesto → patrón por defecto de cada compás: los patrones del compás en orden (y se repiten
// si hay menos que gestos). En 4/4 se mantiene la de la fase 3.
const PAT_MAP_44 = {
  one: 'block', two: 'quarters', three: 'pop', four: 'arpUp', five: 'arpUpDown', shaka: 'alberti', rock: 'offbeat', thumb: 'bossa',
};
function defaultPatMap(meter) {
  if (meter === '4/4') return { ...PAT_MAP_44 };
  const list = patternsFor(meter);
  return Object.fromEntries(ASSIGNABLE.map((g, i) => [g, list[i % list.length]]));
}

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

  rightMode: 'inversion', // 'inversion' | 'rhythm'
  // Lo que suena ahora: la mano derecha cambia uno de los dos según el modo; el otro queda fijo.
  // El patrón se guarda por compás.
  inversion: 'root',
  patternByMeter: Object.fromEntries(Object.keys(METERS).map((m) => [m, 'block'])),
  bassFollows: true,
  invMap: {
    one: 'root', two: 'inv1', three: 'inv2', four: 'inv3', five: 'open', shaka: 'octDown', rock: 'octUp', thumb: 'root',
  },
  patMaps: Object.fromEntries(Object.keys(METERS).map((m) => [m, defaultPatMap(m)])),
  bpm: 90,
  volume: 0.8,

  meter: '4/4',
  // Modo libre (como en la fase 3): sin click, sin pulso en pantalla, sin cuenta previa y el acorde
  // cambia al instante. Con metrónomo: se aplican los ajustes de abajo.
  timeMode: 'free', // 'free' | 'metronome'
  changeMode: 'instant', // 'instant' | 'beat' | 'bar'
  restartOnChange: false,
  click: true,
  metronomeVolume: 0.6,
  countIn: false,
});

export const CHANGE_MODES = ['instant', 'beat', 'bar'];

export const BPM_RANGE = [40, 200];

const isPitch = (n) => Number.isInteger(n) && n >= 0 && n < 12;
const isInversion = (v) => INVERSIONS.includes(v);
const isPatternFor = (meter) => (v) => Object.hasOwn(PATTERNS, v) && patternsFor(meter).includes(v);
const isUnit = (v) => typeof v === 'number' && v >= 0 && v <= 1;
const isBool = (v) => typeof v === 'boolean';
const pick = (value, valid, fallback) => (valid(value) ? value : fallback);
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
  const invMap = {};
  for (const g of ASSIGNABLE) invMap[g] = pick(s.invMap?.[g], isInversion, DEFAULTS.invMap[g]);
  // Versiones anteriores guardaban una sola tabla y un solo patrón (de 4/4): se usan para el 4/4.
  const savedMaps = { ...s.patMaps, '4/4': s.patMaps?.['4/4'] ?? s.patMap };
  const savedPatterns = { ...s.patternByMeter, '4/4': s.patternByMeter?.['4/4'] ?? s.pattern };
  const patMaps = {};
  const patternByMeter = {};
  for (const meter of Object.keys(METERS)) {
    const valid = isPatternFor(meter);
    patMaps[meter] = Object.fromEntries(ASSIGNABLE.map((g) => [g, pick(savedMaps[meter]?.[g], valid, DEFAULTS.patMaps[meter][g])]));
    patternByMeter[meter] = pick(savedPatterns[meter], valid, DEFAULTS.patternByMeter[meter]);
  }
  const bpm = Math.round(s.bpm);
  return {
    leftMode: ['scale', 'custom'].includes(s.leftMode) ? s.leftMode : DEFAULTS.leftMode,
    tonic: isPitch(s.tonic) ? s.tonic : DEFAULTS.tonic,
    scale: Object.hasOwn(SCALES, s.scale) ? s.scale : DEFAULTS.scale,
    sevenths: typeof s.sevenths === 'boolean' ? s.sevenths : DEFAULTS.sevenths,
    custom,
    swapHands: typeof s.swapHands === 'boolean' ? s.swapHands : DEFAULTS.swapHands,
    rightMode: ['inversion', 'rhythm'].includes(s.rightMode) ? s.rightMode : DEFAULTS.rightMode,
    inversion: pick(s.inversion, isInversion, DEFAULTS.inversion),
    patternByMeter,
    bassFollows: pick(s.bassFollows, isBool, DEFAULTS.bassFollows),
    invMap,
    patMaps,
    bpm: bpm >= BPM_RANGE[0] && bpm <= BPM_RANGE[1] ? bpm : DEFAULTS.bpm,
    volume: pick(s.volume, isUnit, DEFAULTS.volume),
    meter: pick(s.meter, (v) => Object.hasOwn(METERS, v), DEFAULTS.meter),
    changeMode: pick(s.changeMode, (v) => CHANGE_MODES.includes(v), DEFAULTS.changeMode),
    restartOnChange: pick(s.restartOnChange, isBool, DEFAULTS.restartOnChange),
    timeMode: pick(s.timeMode, (v) => ['free', 'metronome'].includes(v), DEFAULTS.timeMode),
    click: pick(s.click, isBool, DEFAULTS.click),
    metronomeVolume: pick(s.metronomeVolume, isUnit, DEFAULTS.metronomeVolume),
    countIn: pick(s.countIn, isBool, DEFAULTS.countIn),
  };
}

// Ajustes de tiempo que recibe el motor de sonido: en modo libre no hay click ni cuenta previa y el
// acorde cambia al instante, aunque estén configurados para el modo metrónomo.
export function engineTiming(settings) {
  const free = settings.timeMode === 'free';
  return {
    meter: settings.meter,
    bpm: settings.bpm,
    restartOnChange: settings.restartOnChange,
    metronomeVolume: settings.metronomeVolume,
    changeMode: free ? 'instant' : settings.changeMode,
    metronome: !free && settings.click,
    countIn: !free && settings.countIn,
  };
}

// Patrón actual y tabla gesto → patrón del compás elegido.
export const currentPattern = (settings) => settings.patternByMeter[settings.meter];
export const currentPatMap = (settings) => settings.patMaps[settings.meter];

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
