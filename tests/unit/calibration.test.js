import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarize, buildExport, makeSample } from '../../docs/js/hands/calibration.js';

const s = (hand, expected, detected) => ({ hand, expected, detected });

test('resumen: aciertos y confusiones por mano y gesto', () => {
  const samples = [
    s('left', 'two', 'two'), s('left', 'two', 'two'), s('left', 'two', 'three'), s('left', 'two', null),
    s('right', 'two', 'one'), s('left', 'five', 'four'),
  ];
  assert.deepEqual(summarize(samples, 'left', 'two'), { total: 4, ok: 2, confusions: { three: 1, none: 1 } });
  assert.deepEqual(summarize(samples, 'right', 'two'), { total: 1, ok: 0, confusions: { one: 1 } });
  assert.deepEqual(summarize(samples, 'left', 'one'), { total: 0, ok: 0, confusions: {} });
});

test('muestra: guarda lo reconocido, las medidas y los puntos redondeados', () => {
  // Mano abierta sintética: dedos hacia arriba y pulgar hacia fuera.
  const p = (x, y) => ({ x, y, z: 0 });
  const world = [p(0, 0), p(-0.02, -0.02), p(-0.035, -0.035), p(-0.045, -0.05), p(-0.06, -0.075)];
  [-0.02, 0, 0.02, 0.04].forEach((x) => world.push(p(x, -0.08), p(x, -0.11), p(x, -0.13), p(x, -0.15)));
  const sample = makeSample('left', 'five', { world, landmarks: world }, 1234.56);
  assert.equal(sample.detected, 'five');
  assert.equal(sample.measures.length, 5);
  assert.equal(sample.world.length, 21);
  assert.equal(sample.t, 1235);
  const data = buildExport([sample], { delegate: 'CPU' });
  assert.equal(data.samples.length, 1);
  assert.equal(data.delegate, 'CPU');
  assert.ok(data.thresholds.finger > 1);
});
