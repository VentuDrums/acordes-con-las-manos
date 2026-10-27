// Compases y cálculo de cuándo entra un cambio de acorde. Sin dependencias (se prueba con node).
//
// El reloj avanza en doceavos de pulso («unidades»). 12 se divide entre 1, 2, 3, 4 y 6, así que caben
// negras, corcheas, tresillos, semicorcheas y seisillos (y sus equivalentes en compases ternarios,
// donde el pulso es la negra con puntillo). Las unidades se cuentan desde que arranca el reloj;
// `phase` es la unidad en la que empezó el compás actual (cambia al reiniciar el patrón).

// Unidades por pulso.
export const UNITS_PER_BEAT = 12;
// Pulsos por negra del reloj de Tone.js (Tone.Transport.PPQ por defecto).
export const PPQ = 192;

// beats: pulsos por compás · compound: pulso de negra con puntillo · grid: casillas por pulso de la
// rejilla con la que están escritos los patrones de fábrica (semicorcheas o corcheas).
const meter = (beats, compound) => ({
  beats,
  compound,
  grid: compound ? 3 : 4,
  steps: beats * UNITS_PER_BEAT, // unidades por compás
  beat: UNITS_PER_BEAT,          // unidades por pulso
  unit: `${PPQ / (compound ? 8 : 12)}i`, // duración de una unidad para Tone.js
});

export const METERS = {
  '2/4': meter(2, false),
  '3/4': meter(3, false),
  '4/4': meter(4, false),
  '3/8': meter(1, true),
  '6/8': meter(2, true),
  '9/8': meter(3, true),
  '12/8': meter(4, true),
};

// Unidades por negra.
export const unitsPerQuarter = (m) => (METERS[m].compound ? 8 : 12);

// El tempo se da en pulsos por minuto; el reloj de Tone.js cuenta negras por minuto.
// En los compases ternarios el pulso es la negra con puntillo (1,5 negras).
export const quarterBpm = (m, bpm) => (METERS[m].compound ? bpm * 1.5 : bpm);

export const mod = (n, m) => ((n % m) + m) % m;

// Paso (unidad dentro del compás) de la unidad absoluta `unit`.
export const stepOf = (unit, phase, m) => mod(unit - phase, METERS[m].steps);

// Margen para los cambios que llegan un poco tarde: una semicorchea, en unidades.
export const lateUnits = (m) => unitsPerQuarter(m) / 4;

// Decide cuándo entra un cambio de acorde pedido en la unidad `now` (con decimales).
// - mode: 'instant' | 'beat' | 'bar'
// - lastScheduled: última unidad que el reloj ya ha preparado (suena dentro de unos milisegundos).
// Devuelve { when: 'now' } (entra ya, corrigiendo lo que suene o esté a punto de sonar) o
// { when: 'unit', unit } (espera a esa unidad).
export function planChange({ mode, meter: m, now, phase, lastScheduled }) {
  if (mode === 'instant') return { when: 'now' };
  const { steps, beat } = METERS[m];
  const size = mode === 'bar' ? steps : beat;
  const lastBoundary = phase + Math.floor((now - phase) / size) * size;
  const nextBoundary = lastBoundary + size;
  // Llega un poco tarde: cuenta para el pulso o compás que acaba de empezar.
  if (now - lastBoundary <= lateUnits(m)) return { when: 'now' };
  // El siguiente pulso o compás ya está preparado (va a sonar ya): se corrige al momento.
  if (nextBoundary <= lastScheduled) return { when: 'now' };
  return { when: 'unit', unit: nextBoundary };
}
