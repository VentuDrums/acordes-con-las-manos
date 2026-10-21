// Qué acorde toca cada gesto de la mano izquierda según los ajustes.
import { SCALES, diatonicChord, romanNumeral, chordName, spellingForScale } from './theory.js';

// Grado de la escala (0 = I) de cada gesto en el modo escala. 👍 no tiene grado.
export const SCALE_DEGREES = { one: 0, two: 1, three: 2, four: 3, five: 4, shaka: 5, rock: 6 };

// Devuelve { chord, degree } (degree es null en el modo personalizado) o null si el gesto no toca nada.
export function chordForGesture(settings, gesture) {
  if (settings.leftMode === 'custom') {
    const chord = settings.custom[gesture];
    return chord ? { chord, degree: null } : null;
  }
  const degree = SCALE_DEGREES[gesture];
  if (degree === undefined) return null;
  return { chord: diatonicChord(settings.tonic, settings.scale, degree, settings.sevenths), degree };
}

// Sostenidos o bemoles de la tonalidad elegida.
export function spellingFor(settings) {
  return spellingForScale(settings.tonic, settings.scale);
}

// Sostenidos o bemoles para el nombre de un acorde: si su nota está en la escala elegida, como en
// esa tonalidad (Sol♯ en La menor armónica); si no, los habituales (Do♯, Mi♭, Fa♯, La♭, Si♭).
export function spellingForChord(settings, chord) {
  const inScale = SCALES[settings.scale].some((step) => (settings.tonic + step) % 12 === chord.root);
  return inScale ? spellingFor(settings) : 'mixed';
}

// Texto para mostrar: nombre del acorde y, en el modo escala, su grado.
export function describe(settings, entry, notation = 'latin') {
  return {
    name: chordName(entry.chord, notation, spellingForChord(settings, entry.chord)),
    degree: entry.degree === null ? '' : romanNumeral(entry.chord, entry.degree),
  };
}

// Acordes de la escala para rellenar el modo personalizado (👍 se queda como estaba).
export function customFromScale(settings) {
  const custom = { ...settings.custom };
  for (const [gesture, degree] of Object.entries(SCALE_DEGREES)) {
    custom[gesture] = diatonicChord(settings.tonic, settings.scale, degree, settings.sevenths);
  }
  return custom;
}
