// Teoría musical: nombres de notas, escalas, acordes y su colocación en el teclado (MIDI).

export const NOTE_NAMES = {
  latin: {
    sharp: ['Do', 'Do♯', 'Re', 'Re♯', 'Mi', 'Fa', 'Fa♯', 'Sol', 'Sol♯', 'La', 'La♯', 'Si'],
    flat: ['Do', 'Re♭', 'Re', 'Mi♭', 'Mi', 'Fa', 'Sol♭', 'Sol', 'La♭', 'La', 'Si♭', 'Si'],
    mixed: ['Do', 'Re♭', 'Re', 'Mi♭', 'Mi', 'Fa', 'Fa♯', 'Sol', 'La♭', 'La', 'Si♭', 'Si'],
  },
  english: {
    sharp: ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'],
    flat: ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'],
    mixed: ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'],
  },
};

// Intervalos de cada escala desde la tónica, en semitonos.
export const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
  melodicMinor: [0, 2, 3, 5, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  locrian: [0, 1, 3, 5, 6, 8, 10],
};

// Tipos de acorde: sufijo del nombre e intervalos desde la fundamental.
export const QUALITIES = {
  maj: { suffix: '', intervals: [0, 4, 7] },
  min: { suffix: 'm', intervals: [0, 3, 7] },
  dim: { suffix: '°', intervals: [0, 3, 6] },
  aug: { suffix: '+', intervals: [0, 4, 8] },
  sus2: { suffix: 'sus2', intervals: [0, 2, 7] },
  sus4: { suffix: 'sus4', intervals: [0, 5, 7] },
  '6': { suffix: '6', intervals: [0, 4, 7, 9] },
  m6: { suffix: 'm6', intervals: [0, 3, 7, 9] },
  '7': { suffix: '7', intervals: [0, 4, 7, 10] },
  maj7: { suffix: 'maj7', intervals: [0, 4, 7, 11] },
  m7: { suffix: 'm7', intervals: [0, 3, 7, 10] },
  mMaj7: { suffix: 'm(maj7)', intervals: [0, 3, 7, 11] },
  m7b5: { suffix: 'm7♭5', intervals: [0, 3, 6, 10] },
  dim7: { suffix: '°7', intervals: [0, 3, 6, 9] },
  augMaj7: { suffix: 'maj7♯5', intervals: [0, 4, 8, 11] },
  add9: { suffix: 'add9', intervals: [0, 4, 7, 14] },
  madd9: { suffix: 'm(add9)', intervals: [0, 3, 7, 14] },
  '9': { suffix: '9', intervals: [0, 4, 7, 10, 14] },
  maj9: { suffix: 'maj9', intervals: [0, 4, 7, 11, 14] },
  m9: { suffix: 'm9', intervals: [0, 3, 7, 10, 14] },
  '5': { suffix: '5', intervals: [0, 7] },
};

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
// Tónicas que se escriben con bemoles: en escalas con 3ª mayor (Fa, Si♭, Mi♭, La♭, Re♭)
// y en escalas con 3ª menor (Re, Sol, Do, Fa, Si♭, Mi♭).
const FLAT_TONICS = { major: [1, 3, 5, 8, 10], minor: [0, 2, 3, 5, 7, 10] };

const mod12 = (n) => ((n % 12) + 12) % 12;

function qualityFromIntervals(intervals) {
  const key = intervals.join(',');
  return Object.keys(QUALITIES).find((q) => QUALITIES[q].intervals.join(',') === key) ?? null;
}

export function spellingForScale(tonic, scale) {
  const majorThird = SCALES[scale][2] === 4;
  return FLAT_TONICS[majorThird ? 'major' : 'minor'].includes(mod12(tonic)) ? 'flat' : 'sharp';
}

// Acorde sobre el grado `degree` (0 = I) apilando terceras de la escala: tríada o cuatriada.
export function diatonicChord(tonic, scale, degree, sevenths = false) {
  const steps = SCALES[scale];
  const intervals = (sevenths ? [0, 2, 4, 6] : [0, 2, 4]).map((offset) => {
    const idx = degree + offset;
    return steps[idx % 7] + 12 * Math.floor(idx / 7) - steps[degree];
  });
  return { root: mod12(tonic + steps[degree]), quality: qualityFromIntervals(intervals) };
}

export function romanNumeral(chord, degree) {
  const { intervals } = QUALITIES[chord.quality];
  const numeral = intervals[1] === 3 ? ROMAN[degree].toLowerCase() : ROMAN[degree];
  const marks = { dim: '°', aug: '+', m7b5: 'ø7', dim7: '°7', augMaj7: '+maj7', maj7: 'maj7', mMaj7: 'maj7', '7': '7', m7: '7' };
  return numeral + (marks[chord.quality] ?? '');
}

export function noteName(pc, notation = 'latin', spelling = 'mixed') {
  return NOTE_NAMES[notation][spelling][mod12(pc)];
}

export function chordName(chord, notation = 'latin', spelling = 'mixed') {
  return noteName(chord.root, notation, spelling) + QUALITIES[chord.quality].suffix;
}

// Notas MIDI del acorde en estado fundamental: bajo en la octava 2 y acorde desde la octava 3.
export function voiceChord(chord) {
  const notes = QUALITIES[chord.quality].intervals.map((i) => 48 + chord.root + i);
  return { bass: 36 + chord.root, notes };
}
