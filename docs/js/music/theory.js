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

// Posiciones del acorde que elige la mano derecha en el modo inversión.
export const INVERSIONS = ['root', 'inv1', 'inv2', 'inv3', 'open', 'octDown', 'octUp'];

// Notas MIDI del acorde: { bass, root, third, fifth, degrees, notes }.
// - notes: el acorde, colocado desde la octava 3 según la inversión.
// - bass: nota del bajo en la octava 2 (la fundamental o, si bassFollows, la nota más grave del acorde).
// - root: la fundamental en la octava 2, aunque el bajo siga la inversión.
// - third: la tercera por encima de la fundamental del bajo (para líneas de bajo como el boogie).
// - fifth: la quinta del acorde en el bajo (para patrones que alternan fundamental y quinta).
// - degrees: grados de la escala desde la fundamental (ver scaleDegrees), con la tonalidad `key`.
// Grados de la escala contados desde la fundamental del acorde: 7 distancias en semitonos (1ª…7ª).
// - Si la fundamental está en la escala de la tonalidad (key = { tonic, scale }), se usa esa escala:
//   las notas de paso no se salen de la tonalidad (sobre Rem en Do mayor, la 2ª es Mi).
// - Si no está (o no hay tonalidad), la escala mayor o menor natural del propio acorde.
// - La 3ª, la 5ª y la 7ª (menor o mayor) siguen al acorde cuando el acorde las tiene (sobre Dom, la 3ª es Mi♭).
export function scaleDegrees(chord, key = null) {
  const { intervals } = QUALITIES[chord.quality];
  let steps;
  if (key) {
    const pcs = SCALES[key.scale].map((s) => mod12(key.tonic + s));
    const at = pcs.indexOf(mod12(chord.root));
    if (at >= 0) steps = [0, 1, 2, 3, 4, 5, 6].map((k) => mod12(pcs[(at + k) % 7] - chord.root));
  }
  steps ??= SCALES[intervals.includes(3) && !intervals.includes(4) ? 'minor' : 'major'];
  const degrees = [...steps];
  const third = intervals.find((i) => i === 3 || i === 4);
  const fifth = intervals.find((i) => i === 6 || i === 7 || i === 8);
  // La 7ª disminuida (Si°7) suena como la 6ª de la escala: la 7ª solo sigue a séptimas menores o mayores.
  const seventh = intervals.find((i) => i === 10 || i === 11);
  if (third !== undefined) degrees[2] = third;
  if (fifth !== undefined) degrees[4] = fifth;
  if (seventh !== undefined) degrees[6] = seventh;
  return degrees;
}

export function voiceChord(chord, inversion = 'root', bassFollows = true, key = null) {
  const { intervals } = QUALITIES[chord.quality];
  let notes = intervals.map((i) => 48 + chord.root + i);
  const rotations = { inv1: 1, inv2: 2, inv3: 3 }[inversion] ?? 0;
  for (let k = 0; k < rotations % notes.length; k++) notes = [...notes.slice(1), notes[0] + 12];
  // Posición abierta: la segunda nota sube una octava (Do-Mi-Sol pasa a Do-Sol-Mi).
  if (inversion === 'open' && notes.length >= 3) notes = [notes[0], ...notes.slice(2), notes[1] + 12];
  notes.sort((a, b) => a - b);
  while (notes[0] >= 60) notes = notes.map((n) => n - 12);
  if (inversion === 'octDown') notes = notes.map((n) => n - 12);
  if (inversion === 'octUp') notes = notes.map((n) => n + 12);

  const bassPc = bassFollows && rotations % intervals.length ? notes[0] : chord.root;
  const fifth = intervals.find((i) => i === 7 || i === 6 || i === 8) ?? 7;
  const third = intervals.find((i) => i === 3 || i === 4) ?? intervals[1];
  return {
    bass: 36 + mod12(bassPc),
    root: 36 + chord.root,
    third: 36 + chord.root + third,
    fifth: 36 + mod12(chord.root + fifth),
    degrees: scaleDegrees(chord, key),
    notes,
  };
}
