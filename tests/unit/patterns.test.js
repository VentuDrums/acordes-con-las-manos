import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PATTERNS, notesForStep } from '../../docs/js/music/patterns.js';
import { voiceChord } from '../../docs/js/music/theory.js';

const C = voiceChord({ root: 0, quality: 'maj' });
const NAMES = { 36: 'Do2', 40: 'Mi2', 43: 'Sol2', 48: 'Do3', 52: 'Mi3', 55: 'Sol3', 60: 'Do4', 64: 'Mi4', 67: 'Sol4' };
const name = (n) => NAMES[n] ?? n;
// Compás completo: { paso: 'notas' } con los nombres del anexo A del plan.
function bar(id, voicing = C) {
  const out = {};
  for (let s = 0; s < PATTERNS[id].steps; s++) {
    const evs = notesForStep(id, s, voicing);
    if (evs.length) out[s] = evs.map((e) => e.notes.map(name).join('-')).join(' + ');
  }
  return out;
}

test('negras: 1 Do2+Ac | 2 Ac | 3 Do2+Ac | 4 Ac', () => {
  assert.deepEqual(bar('quarters'), {
    0: 'Do2 + Do3-Mi3-Sol3', 4: 'Do3-Mi3-Sol3', 8: 'Do2 + Do3-Mi3-Sol3', 12: 'Do3-Mi3-Sol3',
  });
});

test('arpegio ascendente: Do3 Mi3 Sol3 Do4 dos veces, con Do2 en el 1', () => {
  assert.deepEqual(bar('arpUp'), {
    0: 'Do2 + Do3', 2: 'Mi3', 4: 'Sol3', 6: 'Do4', 8: 'Do3', 10: 'Mi3', 12: 'Sol3', 14: 'Do4',
  });
});

test('arpegio que sube y baja: Do3 Mi3 Sol3 Do4 Mi4 Do4 Sol3 Mi3', () => {
  assert.deepEqual(Object.values(bar('arpUpDown')), ['Do2 + Do3', 'Mi3', 'Sol3', 'Do4', 'Mi4', 'Do4', 'Sol3', 'Mi3']);
});

test('bajo Alberti: Do3 Sol3 Mi3 Sol3 dos veces', () => {
  assert.deepEqual(Object.values(bar('alberti')), ['Do3', 'Sol3', 'Mi3', 'Sol3', 'Do3', 'Sol3', 'Mi3', 'Sol3']);
});

test('rasgueo pop: ↓ ↓↑ ↑↓↑ (1, 2, 2y, 3y, 4, 4y)', () => {
  assert.deepEqual(Object.keys(bar('pop')).map(Number), [0, 4, 6, 10, 12, 14]);
});

test('contratiempo: bajo en 1 y 3 (Do2, Sol2) y acorde a contratiempo', () => {
  assert.deepEqual(bar('offbeat'), {
    0: 'Do2', 2: 'Do3-Mi3-Sol3', 6: 'Do3-Mi3-Sol3', 8: 'Sol2', 10: 'Do3-Mi3-Sol3', 14: 'Do3-Mi3-Sol3',
  });
});

test('charlestón y bossa nova', () => {
  assert.deepEqual(bar('charleston'), { 0: 'Do2 + Do3-Mi3-Sol3', 6: 'Do3-Mi3-Sol3', 8: 'Sol2' });
  assert.deepEqual(bar('bossa'), { 0: 'Do2 + Do3-Mi3-Sol3', 6: 'Do3-Mi3-Sol3', 8: 'Sol2', 12: 'Do3-Mi3-Sol3' });
});

test('rock en corcheas: bajo y power chord (Do3-Sol3) en cada corchea', () => {
  const b = bar('rock8');
  assert.equal(Object.keys(b).length, 8);
  assert.equal(b[0], 'Do2 + Do3-Sol3');
});

test('los patrones siguen la inversión: Do/Mi empieza el arpegio en Mi', () => {
  assert.deepEqual(Object.values(bar('arpUp', voiceChord({ root: 0, quality: 'maj' }, 'inv1'))).slice(0, 4),
    ['Mi2 + Mi3', 'Sol3', 'Do4', 'Mi4']);
});

test('todos los patrones: pasos válidos, notas razonables y duraciones de Tone', () => {
  const v = voiceChord({ root: 7, quality: '9' }, 'open');
  for (const [id, p] of Object.entries(PATTERNS)) {
    assert.equal(p.steps, 16, id);
    for (const step of Object.keys(p.events)) assert.ok(Number(step) < p.steps, `${id} paso ${step}`);
    for (let s = 0; s < p.steps; s++) {
      for (const ev of notesForStep(id, s, v)) {
        for (const n of ev.notes) assert.ok(Number.isInteger(n) && n >= 24 && n <= 96, `${id}: nota ${n}`);
        assert.match(ev.duration, /^\d+n\.?$/, id);
        assert.ok(ev.velocity > 0 && ev.velocity <= 1, id);
      }
    }
  }
});
