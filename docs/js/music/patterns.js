// Patrones de acompañamiento de fábrica (anexo A del plan).
//
// Rejilla: semicorcheas en 2/4, 3/4 y 4/4; corcheas en 3/8, 6/8, 9/8 y 12/8 (ver timing.js).
// Cada paso tiene una lista de eventos [qué, duración, intensidad]:
//   'C' = acorde completo · 'B' = bajo · 'F' = quinta en el bajo · 'T' = tercera en el bajo
//   'P' = power chord (fundamental + quinta) · 'x9' = fundamental del bajo + 9 semitonos (notas de paso)
//   número = nota del arpegio (0 = la más grave del acorde; si pasa del número de notas, sube de octava).
// El bloque sostenido no tiene pasos: el acorde suena mientras no cambie. Vale para todos los compases.
import { METERS } from './timing.js';

const every = (steps, fn) => Object.fromEntries(steps.map((s) => [s, fn(s)]));
const seq = (list, dur, vel = 0.55) => Object.fromEntries(list.map((what, i) => [i, [[what, dur, i ? vel : vel + 0.15]]]));

export const PATTERNS = {
  block: { meter: null, sustain: true, events: {} },

  // ---------- 2/4 ----------
  quarters24: { meter: '2/4', events: { 0: [['B', '4n', 0.8], ['C', '8n', 0.75]], 4: [['C', '8n', 0.55]] } },
  march24: { meter: '2/4', events: { 0: [['B', '8n', 0.8]], 2: [['C', '16n', 0.6]], 4: [['F', '8n', 0.7]], 6: [['C', '16n', 0.6]] } },
  habanera24: {
    meter: '2/4',
    events: { 0: [['B', '8n.', 0.8]], 3: [['F', '16n', 0.6]], 4: [['C', '8n', 0.65]], 6: [['C', '8n', 0.6]] },
  },
  arp24: {
    meter: '2/4',
    events: { ...seq([0, 1, 2, 3, 0, 1, 2, 3], '16n'), 0: [['B', '4n', 0.7], [0, '16n', 0.7]] },
  },

  // ---------- 3/4 ----------
  quarters34: { meter: '3/4', events: { 0: [['B', '4n', 0.8], ['C', '8n', 0.75]], 4: [['C', '8n', 0.55]], 8: [['C', '8n', 0.55]] } },
  waltz34: { meter: '3/4', events: { 0: [['B', '4n', 0.8]], 4: [['C', '8n', 0.5]], 8: [['C', '8n', 0.5]] } },
  arp34: {
    meter: '3/4',
    events: { 0: [['B', '2n.', 0.7], [0, '8n', 0.7]], 2: [[1, '8n', 0.55]], 4: [[2, '8n', 0.55]], 6: [[3, '8n', 0.6]], 8: [[2, '8n', 0.55]], 10: [[1, '8n', 0.5]] },
  },
  alberti34: {
    meter: '3/4',
    events: { 0: [[0, '8n', 0.7]], 2: [[2, '8n', 0.5]], 4: [[1, '8n', 0.55]], 6: [[2, '8n', 0.5]], 8: [[0, '8n', 0.6]], 10: [[2, '8n', 0.5]] },
  },

  // ---------- 4/4 ----------
  quarters: {
    meter: '4/4',
    events: {
      0: [['B', '4n', 0.8], ['C', '8n', 0.75]], 4: [['C', '8n', 0.55]],
      8: [['B', '4n', 0.7], ['C', '8n', 0.65]], 12: [['C', '8n', 0.55]],
    },
  },
  ballad: {
    meter: '4/4',
    events: {
      0: [['B', '2n', 0.7], ['C', '8n', 0.55]], 2: [['C', '8n', 0.35]], 4: [['C', '8n', 0.45]], 6: [['C', '8n', 0.35]],
      8: [['F', '2n', 0.65], ['C', '8n', 0.5]], 10: [['C', '8n', 0.35]], 12: [['C', '8n', 0.45]], 14: [['C', '8n', 0.35]],
    },
  },
  pop: {
    meter: '4/4',
    events: {
      0: [['B', '2n', 0.8], ['C', '8n', 0.8]], 4: [['C', '8n', 0.6]], 6: [['C', '16n', 0.5]],
      10: [['C', '16n', 0.55]], 12: [['C', '8n', 0.65]], 14: [['C', '16n', 0.5]],
    },
  },
  arpUp: {
    meter: '4/4',
    events: {
      0: [['B', '2n', 0.7], [0, '8n', 0.7]], 2: [[1, '8n', 0.55]], 4: [[2, '8n', 0.55]], 6: [[3, '8n', 0.6]],
      8: [[0, '8n', 0.65]], 10: [[1, '8n', 0.55]], 12: [[2, '8n', 0.55]], 14: [[3, '8n', 0.6]],
    },
  },
  arpUpDown: {
    meter: '4/4',
    events: {
      0: [['B', '2n', 0.7], [0, '8n', 0.7]], 2: [[1, '8n', 0.55]], 4: [[2, '8n', 0.55]], 6: [[3, '8n', 0.6]],
      8: [[4, '8n', 0.65]], 10: [[3, '8n', 0.55]], 12: [[2, '8n', 0.55]], 14: [[1, '8n', 0.5]],
    },
  },
  alberti: {
    meter: '4/4',
    events: {
      0: [[0, '8n', 0.7]], 2: [[2, '8n', 0.5]], 4: [[1, '8n', 0.55]], 6: [[2, '8n', 0.5]],
      8: [[0, '8n', 0.65]], 10: [[2, '8n', 0.5]], 12: [[1, '8n', 0.55]], 14: [[2, '8n', 0.5]],
    },
  },
  offbeat: {
    meter: '4/4',
    events: {
      0: [['B', '4n', 0.75]], 2: [['C', '16n', 0.65]], 6: [['C', '16n', 0.65]],
      8: [['F', '4n', 0.65]], 10: [['C', '16n', 0.65]], 14: [['C', '16n', 0.65]],
    },
  },
  rock8: {
    meter: '4/4',
    events: every([0, 2, 4, 6, 8, 10, 12, 14], (s) => [['B', '8n', s % 4 ? 0.55 : 0.75], ['P', '8n', s % 4 ? 0.5 : 0.7]]),
  },
  charleston: {
    meter: '4/4',
    events: { 0: [['B', '4n', 0.8], ['C', '4n.', 0.75]], 6: [['C', '8n', 0.7]], 8: [['F', '4n', 0.65]] },
  },
  bossa: {
    meter: '4/4',
    events: { 0: [['B', '4n.', 0.75], ['C', '16n', 0.55]], 6: [['C', '16n', 0.55]], 8: [['F', '4n.', 0.65]], 12: [['C', '16n', 0.55]] },
  },

  // ---------- 3/8 ----------
  waltz38: { meter: '3/8', events: { 0: [['B', '8n', 0.8]], 1: [['C', '16n', 0.5]], 2: [['C', '16n', 0.5]] } },
  arp38: { meter: '3/8', events: { 0: [['B', '4n.', 0.7], [0, '8n', 0.7]], 1: [[1, '8n', 0.55]], 2: [[2, '8n', 0.55]] } },

  // ---------- 6/8 ----------
  pulses68: { meter: '6/8', events: { 0: [['B', '4n.', 0.8], ['C', '4n.', 0.7]], 3: [['C', '4n.', 0.55]] } },
  bassChord68: {
    meter: '6/8',
    events: { 0: [['B', '8n', 0.8]], 1: [['C', '16n', 0.5]], 2: [['C', '16n', 0.5]], 3: [['F', '8n', 0.7]], 4: [['C', '16n', 0.5]], 5: [['C', '16n', 0.5]] },
  },
  barcarole68: {
    meter: '6/8',
    events: { 0: [['B', '4n', 0.8], ['C', '4n', 0.65]], 2: [['C', '8n', 0.5]], 3: [['F', '4n', 0.7], ['C', '4n', 0.6]], 5: [['C', '8n', 0.5]] },
  },
  balladArp68: { meter: '6/8', events: seq(['B', 'F', 0, 1, 0, 'F'], '8n') },
  arpUp68: { meter: '6/8', events: { ...seq([0, 1, 2, 3, 2, 1], '8n'), 0: [['B', '2n.', 0.7], [0, '8n', 0.7]] } },

  // ---------- 9/8 ----------
  pulses98: { meter: '9/8', events: { 0: [['B', '4n.', 0.8], ['C', '4n.', 0.7]], 3: [['C', '4n.', 0.55]], 6: [['C', '4n.', 0.55]] } },
  bassChord98: {
    meter: '9/8',
    events: {
      0: [['B', '8n', 0.8]], 1: [['C', '16n', 0.5]], 2: [['C', '16n', 0.5]], 3: [['F', '8n', 0.7]], 4: [['C', '16n', 0.5]],
      5: [['C', '16n', 0.5]], 6: [['B', '8n', 0.7]], 7: [['C', '16n', 0.5]], 8: [['C', '16n', 0.5]],
    },
  },
  arp98: { meter: '9/8', events: seq(['B', 'F', 0, 1, 2, 3, 2, 1, 0], '8n') },

  // ---------- 12/8 ----------
  pulses128: {
    meter: '12/8',
    events: { 0: [['B', '4n.', 0.8], ['C', '4n.', 0.7]], 3: [['C', '4n.', 0.55]], 6: [['F', '4n.', 0.7], ['C', '4n.', 0.6]], 9: [['C', '4n.', 0.55]] },
  },
  fifties128: {
    meter: '12/8',
    events: {
      ...every([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], (s) => [['C', '8n', s % 3 ? 0.35 : 0.6]]),
      0: [['B', '2n.', 0.75], ['C', '8n', 0.6]],
      6: [['F', '2n.', 0.7], ['C', '8n', 0.6]],
    },
  },
  balladArp128: { meter: '12/8', events: seq(['B', 'F', 0, 1, 0, 'F', 'B', 'F', 0, 1, 0, 'F'], '8n') },
  shuffle128: {
    meter: '12/8',
    events: {
      0: [['B', '4n', 0.8]], 2: [['T', '8n', 0.6]],
      3: [['x7', '4n', 0.7], ['C', '8n', 0.55]], 5: [['x9', '8n', 0.6]],
      6: [['x10', '4n', 0.7]], 8: [['x9', '8n', 0.6]],
      9: [['x7', '4n', 0.7], ['C', '8n', 0.55]], 11: [['T', '8n', 0.6]],
    },
  },
};

// Patrones que se pueden usar en un compás (el bloque sostenido vale en todos).
export const patternsFor = (meter) => Object.keys(PATTERNS).filter((id) => PATTERNS[id].meter === null || PATTERNS[id].meter === meter);

// Notas MIDI de un evento con el acorde dado.
export function notesForEvent(what, voicing) {
  if (what === 'C') return voicing.notes;
  if (what === 'B') return [voicing.bass];
  if (what === 'F') return [voicing.fifth];
  if (what === 'T') return [voicing.third];
  if (what === 'P') return [voicing.root + 12, voicing.root + 19];
  if (typeof what === 'string' && what[0] === 'x') return [voicing.root + Number(what.slice(1))];
  const len = voicing.notes.length;
  return [voicing.notes[what % len] + 12 * Math.floor(what / len)];
}

// Eventos de un paso con sus notas: [{ what, notes, duration, velocity }].
export function notesForStep(patternId, step, voicing) {
  const pattern = PATTERNS[patternId];
  const steps = METERS[pattern.meter ?? '4/4'].steps;
  const events = pattern.events[step % steps] ?? [];
  return events.map(([what, duration, velocity]) => ({ what, notes: notesForEvent(what, voicing), duration, velocity }));
}
