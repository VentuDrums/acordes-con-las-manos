// Teoría musical: nombres de notas, escalas, acordes y su colocación en el teclado (MIDI).

export const NOTE_NAMES = {
  latin: ['Do', 'Do♯', 'Re', 'Re♯', 'Mi', 'Fa', 'Fa♯', 'Sol', 'Sol♯', 'La', 'La♯', 'Si'],
  english: ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'],
};

export const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
};

export const QUALITIES = {
  maj: { suffix: '', intervals: [0, 4, 7] },
  min: { suffix: 'm', intervals: [0, 3, 7] },
  dim: { suffix: '°', intervals: [0, 3, 6] },
  aug: { suffix: '+', intervals: [0, 4, 8] },
};

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

const mod12 = (n) => ((n % 12) + 12) % 12;

function qualityFromIntervals(intervals) {
  const key = intervals.join(',');
  return Object.keys(QUALITIES).find((q) => QUALITIES[q].intervals.join(',') === key) ?? null;
}

// Tríada sobre el grado `degree` (0 = I) apilando terceras de la escala.
export function diatonicChord(tonic, scale, degree) {
  const steps = SCALES[scale];
  const intervals = [0, 2, 4].map((offset) => {
    const idx = degree + offset;
    return steps[idx % 7] + 12 * Math.floor(idx / 7) - steps[degree];
  });
  return { root: mod12(tonic + steps[degree]), quality: qualityFromIntervals(intervals) };
}

export function romanNumeral(chord, degree) {
  const minorThird = QUALITIES[chord.quality].intervals[1] === 3;
  const numeral = minorThird ? ROMAN[degree].toLowerCase() : ROMAN[degree];
  if (chord.quality === 'dim') return `${numeral}°`;
  if (chord.quality === 'aug') return `${numeral}+`;
  return numeral;
}

export function noteName(pc, notation = 'latin') {
  return NOTE_NAMES[notation][mod12(pc)];
}

export function chordName(chord, notation = 'latin') {
  return noteName(chord.root, notation) + QUALITIES[chord.quality].suffix;
}

// Notas MIDI del acorde en estado fundamental: bajo en la octava 2 y acorde en la 3.
export function voiceChord(chord) {
  const notes = QUALITIES[chord.quality].intervals.map((i) => 48 + chord.root + i);
  return { bass: 36 + chord.root, notes };
}
