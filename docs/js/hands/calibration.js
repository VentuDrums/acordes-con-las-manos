// Calibración de gestos: graba medidas de la mano mientras se hace un gesto conocido,
// resume cuántas veces se ha reconocido bien y prepara los datos para descargarlos.
import { fingerMeasures, classify, fingerStates, FINGER_EXTENDED_RATIO, THUMB_OUT_RATIO } from './gestures.js';

export const COUNTDOWN_MS = 3000;
export const RECORD_MS = 3000;

const round = (v) => Math.round(v * 10000) / 10000;
const roundPoints = (pts) => pts.map((p) => [round(p.x), round(p.y), round(p.z ?? 0)]);

// Una muestra: lo que se pedía, lo que se ha reconocido y las medidas y puntos de la mano.
export function makeSample(hand, expected, detectedHand, t) {
  return {
    hand,
    expected,
    detected: classify(fingerStates(detectedHand.world)),
    measures: fingerMeasures(detectedHand.world).map(round),
    world: roundPoints(detectedHand.world),
    image: roundPoints(detectedHand.landmarks),
    t: Math.round(t),
  };
}

// { total, ok, confusions: { gesto: veces } } de las muestras de una mano y un gesto.
export function summarize(samples, hand, expected) {
  const mine = samples.filter((s) => s.hand === hand && s.expected === expected);
  const confusions = {};
  for (const s of mine) {
    if (s.detected !== expected) {
      const key = s.detected ?? 'none';
      confusions[key] = (confusions[key] ?? 0) + 1;
    }
  }
  return { total: mine.length, ok: mine.filter((s) => s.detected === expected).length, confusions };
}

export function buildExport(samples, meta) {
  return {
    app: 'acordes-con-las-manos',
    format: 1,
    createdAt: new Date().toISOString(),
    thresholds: { finger: FINGER_EXTENDED_RATIO, thumb: THUMB_OUT_RATIO },
    measuresOrder: ['pulgar', 'índice', 'corazón', 'anular', 'meñique'],
    ...meta,
    samples,
  };
}
