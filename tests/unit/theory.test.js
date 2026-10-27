import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SCALES, diatonicChord, romanNumeral, chordName, voiceChord, spellingForScale, scaleDegrees, noteName } from '../../docs/js/music/theory.js';

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
  assert.deepEqual(voiceChord({ root: 0, quality: 'maj' }), {
    bass: 36, root: 36, third: 40, fifth: 43, degrees: [0, 2, 4, 5, 7, 9, 11], notes: [48, 52, 55],
  });
  assert.equal(voiceChord({ root: 0, quality: 'min' }).third, 39, 'la tercera de Dom es Mi♭');
  assert.deepEqual(voiceChord({ root: 9, quality: 'min' }).notes, [57, 60, 64]);
  assert.deepEqual(voiceChord({ root: 7, quality: '7' }).notes, [55, 59, 62, 65]);
  assert.deepEqual(voiceChord({ root: 0, quality: '9' }).notes, [48, 52, 55, 58, 62]);
  assert.equal(voiceChord({ root: 11, quality: 'dim' }).fifth, 41, 'la quinta disminuida de Si es Fa');
});

test('inversiones de Do mayor (anexo del plan)', () => {
  const C = { root: 0, quality: 'maj' };
  const v = (inv, follows = true) => voiceChord(C, inv, follows);
  assert.deepEqual(v('root').notes, [48, 52, 55]);                      // Do3 Mi3 Sol3
  assert.deepEqual([v('inv1').bass, ...v('inv1').notes], [40, 52, 55, 60]); // Mi2 · Mi3 Sol3 Do4
  assert.deepEqual([v('inv2').bass, ...v('inv2').notes], [43, 55, 60, 64]); // Sol2 · Sol3 Do4 Mi4
  assert.equal(v('inv1', false).bass, 36, 'sin seguir la inversión, el bajo es Do2');
  assert.deepEqual(v('inv3').notes, [48, 52, 55], 'una tríada no tiene 3ª inversión: vuelve a la fundamental');
  assert.deepEqual(v('open').notes, [48, 55, 64]);                       // Do3 Sol3 Mi4
  assert.deepEqual(v('octDown').notes, [36, 40, 43]);
  assert.deepEqual(v('octUp').notes, [60, 64, 67]);
  const Cmaj7 = voiceChord({ root: 0, quality: 'maj7' }, 'inv3');
  assert.deepEqual([Cmaj7.bass, ...Cmaj7.notes], [47, 59, 60, 64, 67]); // Si2 · Si3 Do4 Mi4 Sol4
  const G = voiceChord({ root: 7, quality: 'maj' }, 'inv2');
  assert.deepEqual([G.bass, ...G.notes], [38, 50, 55, 59], 'Sol/Re: se baja de octava para no irse al agudo');
});

test('grados de la escala desde la fundamental del acorde, en la tonalidad', () => {
  const names = (chord, key) => scaleDegrees(chord, key).map((d) => noteName(chord.root + d)).join(' ');
  const doM = { tonic: 0, scale: 'major' };
  assert.equal(names({ root: 2, quality: 'min' }, doM), 'Re Mi Fa Sol La Si Do', 'Rem en Do mayor: notas de Do mayor');
  assert.equal(names({ root: 7, quality: '7' }, doM), 'Sol La Si Do Re Mi Fa');
  assert.equal(names({ root: 0, quality: 'min' }, doM), 'Do Re Mi♭ Fa Sol La Si', 'la 3ª sigue al acorde');
  assert.equal(names({ root: 10, quality: 'maj' }, doM), 'Si♭ Do Re Mi♭ Fa Sol La', 'acorde fuera de la tonalidad: su escala mayor');
  assert.equal(names({ root: 9, quality: 'min' }, null), 'La Si Do Re Mi Fa Sol', 'sin tonalidad: menor natural');
  assert.equal(names({ root: 11, quality: 'dim7' }, { tonic: 9, scale: 'harmonicMinor' }), 'Si Do Re Mi Fa La♭ La',
    'Si°7 en La menor armónica: la 6ª es Sol♯ (La♭) y la 7ª, La; no se repite la 7ª disminuida');
});
