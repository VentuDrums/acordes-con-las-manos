import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toFullFrame, resolveOverlap, palmSize } from '../../docs/js/hands/tracker.js';

test('los puntos de cada zona pasan a la imagen completa', () => {
  const pts = [{ x: 0, y: 0.2, z: 0.1 }, { x: 0.5, y: 0.5, z: 0 }, { x: 1, y: 0.9, z: 0 }];
  assert.deepEqual(toFullFrame(pts, 0, 0.5).map((p) => p.x), [0, 0.25, 0.5]);
  assert.deepEqual(toFullFrame(pts, 0.35, 0.65).map((p) => +p.x.toFixed(3)), [0.35, 0.675, 1]);
  assert.deepEqual(toFullFrame(pts, 0.35, 0.65).map((p) => [p.y, p.z]), [[0.2, 0.1], [0.5, 0], [0.9, 0]]);
});

const hand = (x, y = 0.5) => ({ landmarks: [{ x, y, z: 0 }], world: [] });

test('la misma mano vista por los dos detectores se queda en el lado de su muñeca', () => {
  const izq = resolveOverlap({ left: hand(0.55), right: hand(0.56) });
  assert.ok(izq.left && !izq.right);
  const der = resolveOverlap({ left: hand(0.45), right: hand(0.44) });
  assert.ok(!der.left && der.right);
});

test('dos manos distintas se mantienen', () => {
  const r = resolveOverlap({ left: hand(0.62), right: hand(0.38) });
  assert.ok(r.left && r.right);
  assert.deepEqual(resolveOverlap({ left: hand(0.8), right: null }), { left: hand(0.8), right: null });
});

test('tamaño de la palma en fracción del alto, teniendo en cuenta la forma de la imagen', () => {
  const pts = new Array(21).fill({ x: 0, y: 0 });
  const vertical = [{ x: 0.5, y: 0.6 }, ...pts.slice(1, 9), { x: 0.5, y: 0.5 }, ...pts.slice(10)];
  assert.ok(Math.abs(palmSize(vertical, 1280, 720) - 0.1) < 1e-9);
  const horizontal = [{ x: 0.5, y: 0.5 }, ...pts.slice(1, 9), { x: 0.55, y: 0.5 }, ...pts.slice(10)];
  assert.ok(Math.abs(palmSize(horizontal, 1280, 720) - (0.05 * 1280) / 720) < 1e-9);
});
