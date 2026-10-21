// Patrones de acompañamiento de fábrica (anexo A del plan). Rejilla de semicorcheas: 16 pasos = un 4/4.
//
// Cada paso tiene una lista de eventos [qué, duración, intensidad]:
//   'C' = acorde completo · 'B' = bajo · 'F' = quinta en el bajo · 'P' = power chord (fundamental + quinta)
//   número = nota del arpegio (0 = la más grave del acorde; si pasa del número de notas, sube de octava).
// El bloque sostenido no tiene pasos: el acorde suena mientras no cambie.

export const PATTERNS = {
  block: { meter: '4/4', steps: 16, sustain: true, events: {} },
  quarters: {
    meter: '4/4', steps: 16,
    events: {
      0: [['B', '4n', 0.8], ['C', '8n', 0.75]], 4: [['C', '8n', 0.55]],
      8: [['B', '4n', 0.7], ['C', '8n', 0.65]], 12: [['C', '8n', 0.55]],
    },
  },
  ballad: {
    meter: '4/4', steps: 16,
    events: {
      0: [['B', '2n', 0.7], ['C', '8n', 0.55]], 2: [['C', '8n', 0.35]], 4: [['C', '8n', 0.45]], 6: [['C', '8n', 0.35]],
      8: [['F', '2n', 0.65], ['C', '8n', 0.5]], 10: [['C', '8n', 0.35]], 12: [['C', '8n', 0.45]], 14: [['C', '8n', 0.35]],
    },
  },
  pop: {
    meter: '4/4', steps: 16,
    events: {
      0: [['B', '2n', 0.8], ['C', '8n', 0.8]], 4: [['C', '8n', 0.6]], 6: [['C', '16n', 0.5]],
      10: [['C', '16n', 0.55]], 12: [['C', '8n', 0.65]], 14: [['C', '16n', 0.5]],
    },
  },
  arpUp: {
    meter: '4/4', steps: 16,
    events: {
      0: [['B', '2n', 0.7], [0, '8n', 0.7]], 2: [[1, '8n', 0.55]], 4: [[2, '8n', 0.55]], 6: [[3, '8n', 0.6]],
      8: [[0, '8n', 0.65]], 10: [[1, '8n', 0.55]], 12: [[2, '8n', 0.55]], 14: [[3, '8n', 0.6]],
    },
  },
  arpUpDown: {
    meter: '4/4', steps: 16,
    events: {
      0: [['B', '2n', 0.7], [0, '8n', 0.7]], 2: [[1, '8n', 0.55]], 4: [[2, '8n', 0.55]], 6: [[3, '8n', 0.6]],
      8: [[4, '8n', 0.65]], 10: [[3, '8n', 0.55]], 12: [[2, '8n', 0.55]], 14: [[1, '8n', 0.5]],
    },
  },
  alberti: {
    meter: '4/4', steps: 16,
    events: {
      0: [[0, '8n', 0.7]], 2: [[2, '8n', 0.5]], 4: [[1, '8n', 0.55]], 6: [[2, '8n', 0.5]],
      8: [[0, '8n', 0.65]], 10: [[2, '8n', 0.5]], 12: [[1, '8n', 0.55]], 14: [[2, '8n', 0.5]],
    },
  },
  offbeat: {
    meter: '4/4', steps: 16,
    events: {
      0: [['B', '4n', 0.75]], 2: [['C', '16n', 0.65]], 6: [['C', '16n', 0.65]],
      8: [['F', '4n', 0.65]], 10: [['C', '16n', 0.65]], 14: [['C', '16n', 0.65]],
    },
  },
  rock8: {
    meter: '4/4', steps: 16,
    events: Object.fromEntries([0, 2, 4, 6, 8, 10, 12, 14].map((s) => [s, [['B', '8n', s % 4 ? 0.55 : 0.75], ['P', '8n', s % 4 ? 0.5 : 0.7]]])),
  },
  charleston: {
    meter: '4/4', steps: 16,
    events: { 0: [['B', '4n', 0.8], ['C', '4n.', 0.75]], 6: [['C', '8n', 0.7]], 8: [['F', '4n', 0.65]] },
  },
  bossa: {
    meter: '4/4', steps: 16,
    events: { 0: [['B', '4n.', 0.75], ['C', '16n', 0.55]], 6: [['C', '16n', 0.55]], 8: [['F', '4n.', 0.65]], 12: [['C', '16n', 0.55]] },
  },
};

// Eventos de un paso con las notas MIDI concretas del acorde: [{ notes, duration, velocity }].
export function notesForStep(patternId, step, voicing) {
  const pattern = PATTERNS[patternId];
  const events = pattern.events[step % pattern.steps] ?? [];
  const len = voicing.notes.length;
  return events.map(([what, duration, velocity]) => {
    let notes;
    if (what === 'C') notes = voicing.notes;
    else if (what === 'B') notes = [voicing.bass];
    else if (what === 'F') notes = [voicing.fifth];
    else if (what === 'P') notes = [voicing.root + 12, voicing.root + 19];
    else notes = [voicing.notes[what % len] + 12 * Math.floor(what / len)];
    return { notes, duration, velocity };
  });
}
