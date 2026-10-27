// Patrones propios: rejilla con subdivisión por pulso, grados de la escala y conversión del formato
// de la fase 5. Posiciones en unidades del reloj: en 4/4 una negra son 12 y una semicorchea, 3.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  compile, toEditable, emptyPattern, sanitizePatterns, applyPatterns, patternLabel, setSubdivision, migrateV1,
  cellPositions, LEVEL_VELOCITY,
} from '../../docs/js/music/custom-patterns.js';
import { PATTERNS, notesForStep, patternsFor } from '../../docs/js/music/patterns.js';
import { METERS, PPQ } from '../../docs/js/music/timing.js';
import { voiceChord } from '../../docs/js/music/theory.js';

const DO_MAYOR = { tonic: 0, scale: 'major' };
const C = voiceChord({ root: 0, quality: 'maj' }, 'root', true, DO_MAYOR);
const pattern = (extra) => ({ ...emptyPattern('4/4', 'Prueba'), ...extra });
const TICKS_PER_UNIT = PPQ / 12; // en 4/4

test('patrón nuevo: semicorcheas en compases binarios y corcheas en ternarios', () => {
  assert.deepEqual(emptyPattern('4/4', 'x').subdivisions, [4, 4, 4, 4]);
  assert.deepEqual(emptyPattern('6/8', 'x').subdivisions, [3, 3]);
  assert.deepEqual(cellPositions(emptyPattern('2/4', 'x')), [0, 3, 6, 9, 12, 15, 18, 21]);
});

test('subdivisión por pulso: posiciones de las casillas', () => {
  const p = pattern({ subdivisions: [4, 3, 2, 6] });
  assert.deepEqual(cellPositions(p), [0, 3, 6, 9, 12, 16, 20, 24, 30, 36, 38, 40, 42, 44, 46]);
});

test('picado: media casilla de su pulso; ligado: hasta la siguiente nota de su fila', () => {
  const cells = { B: { 0: 2, 24: 2 }, C: { 12: 2, 16: 2, 20: 2 } };
  const p = pattern({ subdivisions: [4, 3, 4, 4], cells });
  const staccato = compile(p);
  assert.deepEqual(staccato.events[0], [['B', `${1.5 * TICKS_PER_UNIT}i`, 0.7]], 'media semicorchea');
  assert.deepEqual(staccato.events[16], [['C', `${2 * TICKS_PER_UNIT}i`, 0.7]], 'media corchea de tresillo');
  const legato = compile({ ...p, legato: true });
  assert.deepEqual(legato.events[0], [['B', `${24 * TICKS_PER_UNIT}i`, 0.7]]);
  assert.deepEqual(legato.events[20], [['C', `${40 * TICKS_PER_UNIT}i`, 0.7]], 'hasta el tresillo del compás siguiente');
});

test('intensidades: sin ellas todo igual; con ellas, tres niveles', () => {
  const cells = { C: { 0: 1, 12: 2, 24: 3 } };
  assert.deepEqual(Object.values(compile(pattern({ cells })).events).map((e) => e[0][2]), [0.7, 0.7, 0.7]);
  assert.deepEqual(Object.values(compile(pattern({ cells, dynamics: true })).events).map((e) => e[0][2]),
    [LEVEL_VELOCITY[1], LEVEL_VELOCITY[2], LEVEL_VELOCITY[3]]);
});

test('filas: notas del acorde, bajo y grados de la escala en los dos registros', () => {
  applyPatterns([]);
  PATTERNS.utest = compile(pattern({ cells: { 2: { 0: 2 }, B: { 3: 2 }, m2: { 6: 2 }, l4: { 9: 2 }, l6: { 12: 2 }, m7: { 15: 2 } } }));
  const note = (u, v = C) => notesForStep('utest', u, v)[0].notes;
  assert.deepEqual(note(0), [55], 'Nota 3 = Sol3');
  assert.deepEqual(note(3), [36], 'Bajo = Do2');
  assert.deepEqual(note(6), [50], 'escala 2ª = Re3');
  assert.deepEqual(note(9), [41], 'bajo 4ª = Fa2');
  assert.deepEqual(note(12), [45], 'bajo 6ª = La2');
  assert.deepEqual(note(15), [59], 'escala 7ª = Si3');
  const Dm = voiceChord({ root: 2, quality: 'min' }, 'root', true, DO_MAYOR);
  assert.deepEqual(note(6, Dm), [52], 'sobre Rem en Do mayor, la 2ª es Mi');
  const G7 = voiceChord({ root: 7, quality: '7' }, 'root', true, DO_MAYOR);
  assert.deepEqual(note(15, G7), [53 + 12], 'sobre Sol7, la 7ª es Fa');
  delete PATTERNS.utest;
});

test('cambiar la subdivisión lleva cada nota a la casilla más cercana', () => {
  const p = pattern({ cells: { C: { 0: 2, 3: 1, 6: 3, 9: 2 }, B: { 12: 2 } } });
  setSubdivision(p, 0, 3); // semicorcheas → tresillo: 0, 4, 8
  // 3 → 4; 6 está justo entre 4 y 8 y va a la de después; 9 → 8 (en 8 se queda la más fuerte).
  assert.deepEqual(p.cells.C, { 0: 2, 4: 1, 8: 3 });
  assert.deepEqual(p.subdivisions, [3, 4, 4, 4]);
  assert.deepEqual(p.cells.B, { 12: 2 }, 'los otros pulsos no cambian');
  setSubdivision(p, 0, 1);
  assert.deepEqual(p.cells.C, { 0: 3 });
});

test('compás ternario con subdivisiones distintas', () => {
  const p = { ...emptyPattern('6/8', 'x'), legato: true, subdivisions: [3, 2], cells: { B: { 0: 2, 12: 2, 18: 2 } } };
  const c = compile(p);
  assert.equal(c.meter, '6/8');
  assert.deepEqual(c.events[12], [['B', `${6 * (PPQ / 8)}i`, 0.7]], 'dosillo: media negra con puntillo');
});

test('duplicar un patrón de fábrica conserva todas sus notas (salvo las notas de paso del boogie)', () => {
  for (const id of Object.keys(PATTERNS)) {
    if (PATTERNS[id].sustain || PATTERNS[id].custom) continue;
    applyPatterns([]);
    PATTERNS.ucopy = compile(toEditable(id, 'copia'));
    for (let s = 0; s < METERS[PATTERNS[id].meter].steps; s++) {
      const a = notesForStep(id, s, C).flatMap((e) => e.notes).sort();
      const b = notesForStep('ucopy', s, C).flatMap((e) => e.notes).sort();
      // En el boogie la 7ª menor (Si♭) pasa a ser la 7ª de la escala (Si en Do mayor).
      if (id === 'shuffle128' && a.includes(46)) assert.deepEqual(b, [47], 'Si♭2 → Si2');
      else assert.deepEqual(b, a, `${id}, unidad ${s}`);
    }
    delete PATTERNS.ucopy;
  }
});

test('patrones de la fase 5 se convierten sin perder notas', () => {
  const v1 = { id: 'uold', name: 'Viejo', meter: '4/4', dynamics: true, legato: true,
    cells: { B: { 0: 3 }, C: { 4: 2, 12: 2 }, T: { 8: 1 }, F: { 10: 2 }, e9: { 14: 2 }, e10: { 15: 1 } },
    registers: { e9: 'low', e10: 'mid' } };
  const [p] = sanitizePatterns([migrateV1(v1)]);
  assert.deepEqual(p.subdivisions, [4, 4, 4, 4]);
  assert.deepEqual(p.cells, { C: { 12: 2, 36: 2 }, B: { 0: 3 }, l3: { 24: 1 }, l5: { 30: 2 }, l6: { 42: 2 }, m7: { 45: 1 } });
  const v68 = migrateV1({ id: 'uold2', name: 'x', meter: '6/8', cells: { B: { 0: 2, 4: 2 } } });
  assert.deepEqual(v68.cells.B, { 0: 2, 16: 2 }, 'en 6/8 cada corchea son 4 unidades');
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

test('validación de lo guardado: casillas fuera de su subdivisión, niveles y filas raros', () => {
  const [p] = sanitizePatterns([
    { id: 'uabc', name: '  Groove  ', meter: '3/4', dynamics: true, legato: 'sí', subdivisions: [3, 5, 4],
      cells: { B: { 0: 3, 4: 2, 6: 2, 33: 2, 36: 2 }, C: { 12: 7 }, Z: { 0: 2 }, l3: { 24: 2 } } },
    { id: 'malo', meter: '4/4' },
    { id: 'uxyz', meter: '5/4' },
  ]);
  assert.deepEqual(p.subdivisions, [3, 4, 4], 'una subdivisión no válida vuelve a semicorcheas');
  assert.deepEqual(p.cells, { B: { 0: 3, 4: 2, 33: 2 }, l3: { 24: 2 } }, '6 no está en un tresillo; 36 se sale del compás');
  assert.equal(p.name, 'Groove');
  assert.equal(p.legato, false);
  assert.equal(sanitizePatterns('nada').length, 0);
});
