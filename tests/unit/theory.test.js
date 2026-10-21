import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diatonicChord, romanNumeral, chordName, voiceChord } from '../../docs/js/music/theory.js';

const degrees = [0, 1, 2, 3, 4, 5, 6];

test('acordes de Do mayor', () => {
  const names = degrees.map((d) => chordName(diatonicChord(0, 'major', d)));
  assert.deepEqual(names, ['Do', 'Rem', 'Mim', 'Fa', 'Sol', 'Lam', 'Si°']);
});

test('nombres en notación inglesa', () => {
  const names = degrees.map((d) => chordName(diatonicChord(0, 'major', d), 'english'));
  assert.deepEqual(names, ['C', 'Dm', 'Em', 'F', 'G', 'Am', 'B°']);
});

test('grados en números romanos', () => {
  const romans = degrees.map((d) => romanNumeral(diatonicChord(0, 'major', d), d));
  assert.deepEqual(romans, ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°']);
});

test('otra tónica: Sol mayor', () => {
  const names = degrees.map((d) => chordName(diatonicChord(7, 'major', d)));
  assert.deepEqual(names, ['Sol', 'Lam', 'Sim', 'Do', 'Re', 'Mim', 'Fa♯°']);
});

test('notas MIDI del acorde: bajo en octava 2, acorde en octava 3', () => {
  assert.deepEqual(voiceChord({ root: 0, quality: 'maj' }), { bass: 36, notes: [48, 52, 55] });
  assert.deepEqual(voiceChord({ root: 9, quality: 'min' }), { bass: 45, notes: [57, 60, 64] });
  assert.deepEqual(voiceChord({ root: 11, quality: 'dim' }), { bass: 47, notes: [59, 62, 65] });
});
