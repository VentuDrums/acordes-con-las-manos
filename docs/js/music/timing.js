// Compases y cálculo de cuándo entra un cambio de acorde. Sin dependencias (se prueba con node).
//
// El reloj avanza en «unidades» de rejilla: semicorcheas en los compases de subdivisión binaria
// y corcheas en los de subdivisión ternaria. Las unidades se cuentan desde que arranca el reloj;
// `phase` es la unidad en la que empezó el compás actual (cambia al reiniciar el patrón).

export const METERS = {
  '2/4': { steps: 8, unit: '16n', beat: 4 },
  '3/4': { steps: 12, unit: '16n', beat: 4 },
  '4/4': { steps: 16, unit: '16n', beat: 4 },
  '3/8': { steps: 3, unit: '8n', beat: 3 },
  '6/8': { steps: 6, unit: '8n', beat: 3 },
  '9/8': { steps: 9, unit: '8n', beat: 3 },
  '12/8': { steps: 12, unit: '8n', beat: 3 },
};

// Unidades de rejilla por negra.
export const unitsPerQuarter = (meter) => (METERS[meter].unit === '16n' ? 4 : 2);

// El tempo se da en pulsos por minuto; el reloj de Tone.js cuenta negras por minuto.
// En los compases ternarios el pulso es la negra con puntillo (1,5 negras).
export const quarterBpm = (meter, bpm) => (METERS[meter].unit === '8n' ? bpm * 1.5 : bpm);

export const mod = (n, m) => ((n % m) + m) % m;

// Paso dentro del compás de la unidad absoluta `unit`.
export const stepOf = (unit, phase, meter) => mod(unit - phase, METERS[meter].steps);

// Margen para los cambios que llegan un poco tarde: una semicorchea, en unidades de rejilla.
export const lateUnits = (meter) => unitsPerQuarter(meter) / 4;

// Decide cuándo entra un cambio de acorde pedido en la unidad `now` (con decimales).
// - mode: 'instant' | 'beat' | 'bar'
// - lastScheduled: última unidad que el reloj ya ha preparado (suena dentro de unos milisegundos).
// Devuelve { when: 'now' } (entra ya, corrigiendo lo que suene o esté a punto de sonar) o
// { when: 'unit', unit } (espera a esa unidad).
export function planChange({ mode, meter, now, phase, lastScheduled }) {
  if (mode === 'instant') return { when: 'now' };
  const { steps, beat } = METERS[meter];
  const size = mode === 'bar' ? steps : beat;
  const lastBoundary = phase + Math.floor((now - phase) / size) * size;
  const nextBoundary = lastBoundary + size;
  // Llega un poco tarde: cuenta para el pulso o compás que acaba de empezar.
  if (now - lastBoundary <= lateUnits(meter)) return { when: 'now' };
  // El siguiente pulso o compás ya está preparado (va a sonar ya): se corrige al momento.
  if (nextBoundary <= lastScheduled) return { when: 'now' };
  return { when: 'unit', unit: nextBoundary };
}
