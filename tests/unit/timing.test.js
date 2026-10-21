// Cuándo entra un cambio de acorde: al instante, en el siguiente pulso o en el siguiente compás.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { METERS, quarterBpm, stepOf, planChange, lateUnits } from '../../docs/js/music/timing.js';

test('tempo: en compases ternarios el pulso es la negra con puntillo', () => {
  assert.equal(quarterBpm('4/4', 90), 90);
  assert.equal(quarterBpm('6/8', 60), 90);
  assert.equal(lateUnits('4/4'), 1, 'una semicorchea en rejilla de semicorcheas');
  assert.equal(lateUnits('6/8'), 0.5, 'una semicorchea en rejilla de corcheas');
});

test('paso dentro del compás según el inicio del compás', () => {
  assert.equal(stepOf(17, 0, '4/4'), 1);
  assert.equal(stepOf(17, 16, '4/4'), 1);
  assert.equal(stepOf(17, 18, '4/4'), 15);
  assert.equal(stepOf(7, 1, '6/8'), 0);
  assert.equal(METERS['9/8'].steps, 9);
});

const plan = (mode, now, lastScheduled = Math.floor(now), meter = '4/4', phase = 0) =>
  planChange({ mode, meter, now, phase, lastScheduled });

test('al instante: siempre ya', () => {
  assert.deepEqual(plan('instant', 5.3), { when: 'now' });
});

test('siguiente compás: espera al compás siguiente', () => {
  assert.deepEqual(plan('bar', 5.3), { when: 'unit', unit: 16 });
  assert.deepEqual(plan('bar', 30), { when: 'unit', unit: 32 });
});

test('siguiente pulso: espera al pulso siguiente', () => {
  assert.deepEqual(plan('beat', 5.3), { when: 'unit', unit: 8 });
  assert.deepEqual(plan('beat', 2.5), { when: 'unit', unit: 4 });
});

test('un poco tarde (hasta una semicorchea): cuenta para el pulso o compás que acaba de empezar', () => {
  assert.deepEqual(plan('bar', 16.6), { when: 'now' });
  assert.deepEqual(plan('beat', 4.9), { when: 'now' });
  assert.deepEqual(plan('beat', 5.2), { when: 'unit', unit: 8 }, 'más tarde de una semicorchea, al siguiente');
});

test('el siguiente pulso ya está preparado para sonar: se corrige al momento', () => {
  assert.deepEqual(plan('beat', 7.9, 8), { when: 'now' });
  assert.deepEqual(plan('bar', 15.95, 16), { when: 'now' });
});

test('compases ternarios y compás reiniciado', () => {
  assert.deepEqual(plan('beat', 1.2, 1, '6/8'), { when: 'unit', unit: 3 });
  assert.deepEqual(plan('bar', 4, 4, '6/8'), { when: 'unit', unit: 6 });
  assert.deepEqual(plan('bar', 10, 10, '4/4', 5), { when: 'unit', unit: 21 }, 'el compás empieza en la unidad 5');
});
