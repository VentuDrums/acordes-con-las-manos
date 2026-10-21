import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SCALES, diatonicChord, romanNumeral, chordName, voiceChord, spellingForScale } from '../../docs/js/music/theory.js';

const degrees = [0, 1, 2, 3, 4, 5, 6];
const names = (tonic, scale, sevenths = false, notation = 'latin') =>
  degrees.map((d) => chordName(diatonicChord(tonic, scale, d, sevenths), notation, spellingForScale(tonic, scale)));
const romans = (tonic, scale, sevenths = false) =>
  degrees.map((d) => romanNumeral(diatonicChord(tonic, scale, d, sevenths), d));

test('Do mayor: tríadas, cuatriadas y grados', () => {
  assert.deepEqual(names(0, 'major'), ['Do', 'Rem', 'Mim', 'Fa', 'Sol', 'Lam', 'Si°']);
  assert.deepEqual(names(0, 'major', false, 'english'), ['C', 'Dm', 'Em', 'F', 'G', 'Am', 'B°']);
  assert.deepEqual(romans(0, 'major'), ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°']);
  assert.deepEqual(names(0, 'major', true), ['Domaj7', 'Rem7', 'Mim7', 'Famaj7', 'Sol7', 'Lam7', 'Sim7♭5']);
  assert.deepEqual(romans(0, 'major', true), ['Imaj7', 'ii7', 'iii7', 'IVmaj7', 'V7', 'vi7', 'viiø7']);
});

test('tonalidades con sostenidos y con bemoles', () => {
  assert.deepEqual(names(7, 'major'), ['Sol', 'Lam', 'Sim', 'Do', 'Re', 'Mim', 'Fa♯°']);
  assert.deepEqual(names(5, 'major'), ['Fa', 'Solm', 'Lam', 'Si♭', 'Do', 'Rem', 'Mi°']);
  assert.deepEqual(names(3, 'major'), ['Mi♭', 'Fam', 'Solm', 'La♭', 'Si♭', 'Dom', 'Re°']);
  assert.deepEqual(names(2, 'minor'), ['Rem', 'Mi°', 'Fa', 'Solm', 'Lam', 'Si♭', 'Do']);
  assert.deepEqual(names(4, 'minor'), ['Mim', 'Fa♯°', 'Sol', 'Lam', 'Sim', 'Do', 'Re']);
});

test('menor armónica y modos', () => {
  assert.deepEqual(names(9, 'harmonicMinor'), ['Lam', 'Si°', 'Do+', 'Rem', 'Mi', 'Fa', 'Sol♯°']);
  assert.deepEqual(romans(9, 'harmonicMinor', true), ['imaj7', 'iiø7', 'III+maj7', 'iv7', 'V7', 'VImaj7', 'vii°7']);
  assert.deepEqual(names(2, 'dorian'), ['Rem', 'Mim', 'Fa', 'Sol', 'Lam', 'Si°', 'Do']);
  assert.deepEqual(names(7, 'mixolydian'), ['Sol', 'Lam', 'Si°', 'Do', 'Rem', 'Mim', 'Fa']);
});

test('todas las escalas dan acordes conocidos en todos los grados', () => {
  for (const scale of Object.keys(SCALES)) {
    for (const sevenths of [false, true]) {
      for (let tonic = 0; tonic < 12; tonic++) {
        for (const d of degrees) {
          const c = diatonicChord(tonic, scale, d, sevenths);
          assert.ok(c.quality, `${scale} tónica ${tonic} grado ${d + 1} séptima=${sevenths}`);
          assert.ok(romanNumeral(c, d));
        }
      }
    }
  }
});

test('notas MIDI: bajo en la octava 2 y acorde desde la octava 3', () => {
  assert.deepEqual(voiceChord({ root: 0, quality: 'maj' }), { bass: 36, notes: [48, 52, 55] });
  assert.deepEqual(voiceChord({ root: 9, quality: 'min' }), { bass: 45, notes: [57, 60, 64] });
  assert.deepEqual(voiceChord({ root: 7, quality: '7' }), { bass: 43, notes: [55, 59, 62, 65] });
  assert.deepEqual(voiceChord({ root: 0, quality: '9' }).notes, [48, 52, 55, 58, 62]);
});
