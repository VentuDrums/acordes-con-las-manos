// Patrones de fábrica comparados nota a nota con el anexo A del plan (ejemplo con Do).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PATTERNS, notesForStep, patternsFor } from '../../docs/js/music/patterns.js';
import { METERS } from '../../docs/js/music/timing.js';
import { voiceChord } from '../../docs/js/music/theory.js';

const C = voiceChord({ root: 0, quality: 'maj' });
const NAMES = { 36: 'Do2', 40: 'Mi2', 43: 'Sol2', 45: 'La2', 46: 'Si♭2', 48: 'Do3', 52: 'Mi3', 55: 'Sol3', 60: 'Do4', 64: 'Mi4' };
const name = (n) => NAMES[n] ?? n;
// Compás completo: { paso: 'notas' }.
function bar(id, voicing = C) {
  const out = {};
  for (let s = 0; s < METERS[PATTERNS[id].meter].steps; s++) {
    const evs = notesForStep(id, s, voicing);
    if (evs.length) out[s] = evs.map((e) => e.notes.map(name).join('-')).join(' + ');
  }
  return out;
}
const AC = 'Do3-Mi3-Sol3';

test('cada compás tiene los patrones del anexo', () => {
  assert.equal(patternsFor('2/4').length, 5);
  assert.equal(patternsFor('3/4').length, 5);
  assert.equal(patternsFor('4/4').length, 11);
  assert.equal(patternsFor('3/8').length, 3);
  assert.equal(patternsFor('6/8').length, 6);
  assert.equal(patternsFor('9/8').length, 4);
  assert.equal(patternsFor('12/8').length, 5);
  for (const meter of Object.keys(METERS)) assert.ok(patternsFor(meter).includes('block'), meter);
});

test('4/4: negras, arpegios, Alberti, pop, contratiempo, charlestón, bossa y rock', () => {
  assert.deepEqual(bar('quarters'), { 0: `Do2 + ${AC}`, 4: AC, 8: `Do2 + ${AC}`, 12: AC });
  assert.deepEqual(bar('arpUp'), { 0: 'Do2 + Do3', 2: 'Mi3', 4: 'Sol3', 6: 'Do4', 8: 'Do3', 10: 'Mi3', 12: 'Sol3', 14: 'Do4' });
  assert.deepEqual(Object.values(bar('arpUpDown')), ['Do2 + Do3', 'Mi3', 'Sol3', 'Do4', 'Mi4', 'Do4', 'Sol3', 'Mi3']);
  assert.deepEqual(Object.values(bar('alberti')), ['Do3', 'Sol3', 'Mi3', 'Sol3', 'Do3', 'Sol3', 'Mi3', 'Sol3']);
  assert.deepEqual(Object.keys(bar('pop')).map(Number), [0, 4, 6, 10, 12, 14]);
  assert.deepEqual(bar('offbeat'), { 0: 'Do2', 2: AC, 6: AC, 8: 'Sol2', 10: AC, 14: AC });
  assert.deepEqual(bar('charleston'), { 0: `Do2 + ${AC}`, 6: AC, 8: 'Sol2' });
  assert.deepEqual(bar('bossa'), { 0: `Do2 + ${AC}`, 6: AC, 8: 'Sol2', 12: AC });
  assert.equal(bar('rock8')[0], 'Do2 + Do3-Sol3');
});

test('2/4: negras, marcha, habanera y arpegio en semicorcheas', () => {
  assert.deepEqual(bar('quarters24'), { 0: `Do2 + ${AC}`, 4: AC });
  assert.deepEqual(bar('march24'), { 0: 'Do2', 2: AC, 4: 'Sol2', 6: AC });
  assert.deepEqual(bar('habanera24'), { 0: 'Do2', 3: 'Sol2', 4: AC, 6: AC });
  assert.deepEqual(Object.values(bar('arp24')), ['Do2 + Do3', 'Mi3', 'Sol3', 'Do4', 'Do3', 'Mi3', 'Sol3', 'Do4']);
});

test('3/4: negras, vals, arpegio y Alberti', () => {
  assert.deepEqual(bar('quarters34'), { 0: `Do2 + ${AC}`, 4: AC, 8: AC });
  assert.deepEqual(bar('waltz34'), { 0: 'Do2', 4: AC, 8: AC });
  assert.deepEqual(Object.values(bar('arp34')), ['Do2 + Do3', 'Mi3', 'Sol3', 'Do4', 'Sol3', 'Mi3']);
  assert.deepEqual(Object.values(bar('alberti34')), ['Do3', 'Sol3', 'Mi3', 'Sol3', 'Do3', 'Sol3']);
});

test('3/8 y 6/8 (rejilla de corcheas)', () => {
  assert.deepEqual(bar('waltz38'), { 0: 'Do2', 1: AC, 2: AC });
  assert.deepEqual(bar('arp38'), { 0: 'Do2 + Do3', 1: 'Mi3', 2: 'Sol3' });
  assert.deepEqual(bar('pulses68'), { 0: `Do2 + ${AC}`, 3: AC });
  assert.deepEqual(bar('bassChord68'), { 0: 'Do2', 1: AC, 2: AC, 3: 'Sol2', 4: AC, 5: AC });
  assert.deepEqual(bar('barcarole68'), { 0: `Do2 + ${AC}`, 2: AC, 3: `Sol2 + ${AC}`, 5: AC });
  assert.deepEqual(Object.values(bar('balladArp68')), ['Do2', 'Sol2', 'Do3', 'Mi3', 'Do3', 'Sol2']);
  assert.deepEqual(Object.values(bar('arpUp68')), ['Do2 + Do3', 'Mi3', 'Sol3', 'Do4', 'Sol3', 'Mi3']);
});

test('9/8 y 12/8', () => {
  assert.deepEqual(bar('pulses98'), { 0: `Do2 + ${AC}`, 3: AC, 6: AC });
  assert.deepEqual(Object.values(bar('bassChord98')), ['Do2', AC, AC, 'Sol2', AC, AC, 'Do2', AC, AC]);
  assert.deepEqual(Object.values(bar('arp98')), ['Do2', 'Sol2', 'Do3', 'Mi3', 'Sol3', 'Do4', 'Sol3', 'Mi3', 'Do3']);
  assert.deepEqual(bar('pulses128'), { 0: `Do2 + ${AC}`, 3: AC, 6: `Sol2 + ${AC}`, 9: AC });
  const fifties = bar('fifties128');
  assert.equal(Object.keys(fifties).length, 12);
  assert.equal(fifties[0], `Do2 + ${AC}`);
  assert.equal(fifties[6], `Sol2 + ${AC}`);
  assert.deepEqual(Object.values(bar('balladArp128')), ['Do2', 'Sol2', 'Do3', 'Mi3', 'Do3', 'Sol2', 'Do2', 'Sol2', 'Do3', 'Mi3', 'Do3', 'Sol2']);
  // Shuffle: Do2·Mi2 | Sol2·La2 | Si♭2·La2 | Sol2·Mi2, con acorde corto en los pulsos 2 y 4.
  assert.deepEqual(bar('shuffle128'), {
    0: 'Do2', 2: 'Mi2', 3: `Sol2 + ${AC}`, 5: 'La2', 6: 'Si♭2', 8: 'La2', 9: `Sol2 + ${AC}`, 11: 'Mi2',
  });
});

test('los patrones siguen la inversión y el tipo de acorde', () => {
  assert.deepEqual(Object.values(bar('arpUp', voiceChord({ root: 0, quality: 'maj' }, 'inv1'))).slice(0, 4),
    ['Mi2 + Mi3', 'Sol3', 'Do4', 'Mi4']);
  assert.equal(bar('shuffle128', voiceChord({ root: 0, quality: 'min' }))[2], '39', 'en Dom el boogie usa Mi♭2');
});

test('todos los patrones: pasos válidos, notas razonables y duraciones de Tone', () => {
  const v = voiceChord({ root: 7, quality: '9' }, 'open');
  for (const [id, p] of Object.entries(PATTERNS)) {
    if (p.sustain) continue;
    const steps = METERS[p.meter].steps;
    for (const step of Object.keys(p.events)) assert.ok(Number(step) < steps, `${id} paso ${step}`);
    for (let s = 0; s < steps; s++) {
      for (const ev of notesForStep(id, s, v)) {
        for (const n of ev.notes) assert.ok(Number.isInteger(n) && n >= 24 && n <= 96, `${id}: nota ${n}`);
        assert.match(ev.duration, /^\d+n\.?$/, id);
        assert.ok(ev.velocity > 0 && ev.velocity <= 1, `${id}: intensidad ${ev.velocity}`);
      }
    }
  }
});
