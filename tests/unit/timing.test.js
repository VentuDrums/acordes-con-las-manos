// Cuándo entra un cambio de acorde: al instante, en el siguiente pulso o en el siguiente compás.
// El reloj cuenta doceavos de pulso: en 4/4 una semicorchea son 3 unidades y un compás, 48.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { METERS, quarterBpm, stepOf, planChange, lateUnits } from '../../docs/js/music/timing.js';

test('tempo: en compases ternarios el pulso es la negra con puntillo', () => {
  assert.equal(quarterBpm('4/4', 90), 90);
  assert.equal(quarterBpm('6/8', 60), 90);
  assert.equal(lateUnits('4/4'), 3, 'una semicorchea = un cuarto de negra');
  assert.equal(lateUnits('6/8'), 2, 'una semicorchea = un sexto de negra con puntillo');
});

test('compases: unidades por compás y por pulso', () => {
  assert.equal(METERS['4/4'].steps, 48);
  assert.equal(METERS['3/4'].steps, 36);
  assert.equal(METERS['6/8'].steps, 24);
  assert.equal(METERS['9/8'].steps, 36);
  assert.equal(METERS['3/8'].steps, 12);
  for (const m of Object.values(METERS)) assert.equal(m.beat, 12);
  assert.equal(METERS['4/4'].unit, '16i', 'una negra (192 pulsos de Tone) entre 12');
  assert.equal(METERS['6/8'].unit, '24i', 'una negra con puntillo (288) entre 12');
});

test('paso dentro del compás según el inicio del compás', () => {
  assert.equal(stepOf(51, 0, '4/4'), 3);
  assert.equal(stepOf(51, 48, '4/4'), 3);
  assert.equal(stepOf(51, 54, '4/4'), 45);
  assert.equal(stepOf(28, 4, '6/8'), 0);
});

const plan = (mode, now, lastScheduled = Math.floor(now), meter = '4/4', phase = 0) =>
  planChange({ mode, meter, now, phase, lastScheduled });

test('al instante: siempre ya', () => {
  assert.deepEqual(plan('instant', 16), { when: 'now' });
});

test('siguiente compás: espera al compás siguiente', () => {
  assert.deepEqual(plan('bar', 16), { when: 'unit', unit: 48 });
  assert.deepEqual(plan('bar', 90), { when: 'unit', unit: 96 });
});

test('siguiente pulso: espera al pulso siguiente', () => {
  assert.deepEqual(plan('beat', 16), { when: 'unit', unit: 24 });
  assert.deepEqual(plan('beat', 7.5), { when: 'unit', unit: 12 });
});

test('un poco tarde (hasta una semicorchea): cuenta para el pulso o compás que acaba de empezar', () => {
  assert.deepEqual(plan('bar', 49.8), { when: 'now' });
  assert.deepEqual(plan('beat', 14.7), { when: 'now' });
  assert.deepEqual(plan('beat', 15.6), { when: 'unit', unit: 24 }, 'más tarde de una semicorchea, al siguiente');
});

test('el siguiente pulso ya está preparado para sonar: se corrige al momento', () => {
  assert.deepEqual(plan('beat', 23.8, 24), { when: 'now' });
  assert.deepEqual(plan('bar', 47.9, 48), { when: 'now' });
});

test('compases ternarios y compás reiniciado', () => {
  assert.deepEqual(plan('beat', 4.8, 4, '6/8'), { when: 'unit', unit: 12 });
  assert.deepEqual(plan('bar', 16, 16, '6/8'), { when: 'unit', unit: 24 });
  assert.deepEqual(plan('bar', 30, 30, '4/4', 15), { when: 'unit', unit: 63 }, 'el compás empieza en la unidad 15');
});
