import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fingerStates, classify, GestureFilter, ABSENT } from '../../docs/js/hands/gestures.js';

// Mano sintética con la palma hacia la cámara y los dedos hacia arriba (y negativa = arriba).
// up = [pulgar, índice, corazón, anular, meñique].
function hand(up) {
  const p = (x, y) => ({ x, y, z: 0 });
  const lm = new Array(21);
  lm[0] = p(0, 0);
  lm[1] = p(-0.02, -0.02);
  lm[2] = p(-0.035, -0.035);
  lm[3] = p(-0.045, -0.05);
  lm[4] = up[0] ? p(-0.06, -0.075) : p(0.005, -0.06); // estirado hacia fuera o cruzando la palma
  [-0.02, 0, 0.02, 0.04].forEach((x, f) => {
    const mcp = 5 + f * 4;
    lm[mcp] = p(x, -0.08);
    const ys = up[f + 1] ? [-0.11, -0.13, -0.15] : [-0.1, -0.08, -0.065];
    ys.forEach((y, k) => { lm[mcp + 1 + k] = p(x, y); });
  });
  return lm;
}

const CASES = {
  fist: [0, 0, 0, 0, 0],
  thumb: [1, 0, 0, 0, 0],
  one: [0, 1, 0, 0, 0],
  two: [0, 1, 1, 0, 0],
  three: [0, 1, 1, 1, 0],
  four: [0, 1, 1, 1, 1],
  five: [1, 1, 1, 1, 1],
  shaka: [1, 0, 0, 0, 1],
  rock: [0, 1, 0, 0, 1],
};

for (const [gesture, up] of Object.entries(CASES)) {
  test(`reconoce el gesto ${gesture}`, () => {
    const fingers = fingerStates(hand(up.map(Boolean)));
    assert.deepEqual(fingers, up.map(Boolean));
    assert.equal(classify(fingers), gesture);
  });
}

test('el pulgar no cambia los gestos de 1 a 3 dedos', () => {
  assert.equal(classify([true, true, false, false, false]), 'one');
  assert.equal(classify([true, true, true, false, false]), 'two');
  assert.equal(classify([true, true, true, true, false]), 'three');
});

test('combinaciones raras no son ningún gesto', () => {
  assert.equal(classify([false, false, true, false, false]), null);
  assert.equal(classify([false, false, false, false, true]), null);
});

test('filtro: el gesto se acepta tras mantenerse 150 ms', () => {
  const f = new GestureFilter({ holdMs: 150, absentMs: 300 });
  assert.equal(f.update('one', 0), ABSENT);
  assert.equal(f.update('one', 100), ABSENT);
  assert.equal(f.update('one', 150), 'one');
  assert.equal(f.update('two', 200), 'one');
  assert.equal(f.update('two', 349), 'one');
  assert.equal(f.update('two', 350), 'two');
});

test('filtro: un gesto no reconocido no cambia nada', () => {
  const f = new GestureFilter({ holdMs: 150, absentMs: 300 });
  f.update('one', 0);
  f.update('one', 200);
  assert.equal(f.update(null, 300), 'one');
  assert.equal(f.update(null, 2000), 'one');
});

test('filtro: perder la mano menos de 300 ms no corta', () => {
  const f = new GestureFilter({ holdMs: 150, absentMs: 300 });
  f.update('one', 0);
  f.update('one', 200);
  assert.equal(f.update(ABSENT, 250), 'one');
  assert.equal(f.update(ABSENT, 500), 'one');
  assert.equal(f.update('one', 520), 'one');
  assert.equal(f.update(ABSENT, 600), 'one');
  assert.equal(f.update(ABSENT, 900), ABSENT);
});

test('filtro: un parpadeo de otro gesto no cambia el acorde', () => {
  const f = new GestureFilter({ holdMs: 150, absentMs: 300 });
  f.update('one', 0);
  f.update('one', 200);
  f.update('five', 230); // un fotograma suelto
  assert.equal(f.update('one', 260), 'one');
  assert.equal(f.update('one', 600), 'one');
});
