import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  compile, toEditable, emptyPattern, sanitizePatterns, applyPatterns, patternLabel, LEVEL_VELOCITY, PPQ,
} from '../../docs/js/music/custom-patterns.js';
import { PATTERNS, notesForStep, patternsFor } from '../../docs/js/music/patterns.js';
import { METERS } from '../../docs/js/music/timing.js';
import { voiceChord } from '../../docs/js/music/theory.js';

const C = voiceChord({ root: 0, quality: 'maj' });
const pattern = (extra) => ({ ...emptyPattern('4/4', 'Prueba'), ...extra });

test('picado: cada nota dura media casilla; ligado: hasta la siguiente de su fila', () => {
  const cells = { B: { 0: 2, 8: 2 }, C: { 4: 2, 12: 2 } };
  const sixteenth = PPQ / 4;
  const staccato = compile(pattern({ cells }));
  assert.deepEqual(staccato.events[0], [['B', `${sixteenth / 2}i`, 0.7]]);
  const legato = compile(pattern({ cells, legato: true }));
  assert.deepEqual(legato.events[0], [['B', `${8 * sixteenth}i`, 0.7]]);
  assert.deepEqual(legato.events[36], [['C', `${8 * sixteenth}i`, 0.7]], 'la última nota llega hasta la primera del compás siguiente');
});

test('una sola nota ligada en la fila dura el compás entero', () => {
  const p = compile(pattern({ cells: { B: { 0: 2 } }, legato: true }));
  assert.equal(p.events[0][0][1], `${16 * (PPQ / 4)}i`);
});

test('intensidades: sin ellas todo igual; con ellas, tres niveles', () => {
  const cells = { C: { 0: 1, 4: 2, 8: 3 } };
  assert.deepEqual(Object.values(compile(pattern({ cells })).events).map((e) => e[0][2]), [0.7, 0.7, 0.7]);
  assert.deepEqual(Object.values(compile(pattern({ cells, dynamics: true })).events).map((e) => e[0][2]),
    [LEVEL_VELOCITY[1], LEVEL_VELOCITY[2], LEVEL_VELOCITY[3]]);
});

test('filas: arpegio, bajo y notas extra en registro grave o medio', () => {
  const p = compile(pattern({
    cells: { 2: { 0: 2 }, T: { 2: 2 }, e9: { 4: 2 }, e10: { 6: 2 } },
    registers: { e9: 'low', e10: 'mid' },
  }));
  applyPatterns([]); // limpia
  PATTERNS.utest = p;
  const note = (s) => notesForStep('utest', s * 3, C)[0].notes; // casilla de semicorchea → unidades
  assert.deepEqual(note(0), [55], 'Nota 3 = Sol3');
  assert.deepEqual(note(2), [40], 'Bajo: 3ª = Mi2');
  assert.deepEqual(note(4), [45], '6ª grave = La2');
  assert.deepEqual(note(6), [58], '7ª menor media = Si♭3');
  delete PATTERNS.utest;
});

test('compás ternario: rejilla de corcheas', () => {
  const p = compile({ ...emptyPattern('6/8', 'x'), legato: true, cells: { B: { 0: 2, 3: 2 } } });
  assert.equal(p.meter, '6/8');
  assert.deepEqual(p.events[0], [['B', `${3 * (PPQ / 2)}i`, 0.7]], 'tres corcheas');
});

test('duplicar un patrón de fábrica conserva todas sus notas', () => {
  for (const id of Object.keys(PATTERNS)) {
    if (PATTERNS[id].sustain || PATTERNS[id].custom) continue;
    applyPatterns([]);
    const copy = toEditable(id, 'copia');
    PATTERNS.ucopy = compile(copy);
    for (let s = 0; s < METERS[PATTERNS[id].meter].steps; s++) {  // todas las unidades del compás
      const a = notesForStep(id, s, C).flatMap((e) => e.notes).sort();
      const b = notesForStep('ucopy', s, C).flatMap((e) => e.notes).sort();
      assert.deepEqual(b, a, `${id}, paso ${s}`);
    }
    delete PATTERNS.ucopy;
  }
});

test('los patrones propios aparecen en la lista de su compás y con su nombre', () => {
  const p = { ...emptyPattern('3/4', 'Mi vals'), cells: { B: { 0: 2 } } };
  applyPatterns([p]);
  assert.ok(patternsFor('3/4').includes(p.id));
  assert.ok(!patternsFor('4/4').includes(p.id));
  assert.equal(patternLabel(p.id, (k) => k), 'Mi vals');
  assert.equal(patternLabel('waltz34', (k) => `T:${k}`), 'T:pattern_waltz34');
  applyPatterns([]);
  assert.ok(!patternsFor('3/4').includes(p.id), 'al borrarlo desaparece');
});

test('validación de lo guardado: descarta pasos fuera del compás, niveles y filas raros', () => {
  const [p] = sanitizePatterns([
    { id: 'uabc', name: '  Groove  ', meter: '3/4', dynamics: true, legato: 'sí',
      cells: { B: { 0: 3, 11: 2, 12: 2, '-1': 1 }, C: { 4: 7 }, Z: { 0: 2 } }, registers: { e2: 'mid', e5: 'raro' } },
    { id: 'malo', meter: '4/4' },
    { id: 'uxyz', meter: '5/4' },
  ]);
  assert.deepEqual(p.cells, { B: { 0: 3, 11: 2 } });
  assert.equal(p.name, 'Groove');
  assert.equal(p.legato, false);
  assert.equal(p.registers.e2, 'mid');
  assert.equal(p.registers.e5, 'low');
  assert.equal(sanitizePatterns('nada').length, 0);
});
