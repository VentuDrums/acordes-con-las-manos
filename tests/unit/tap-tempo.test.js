import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTapTempo } from '../../docs/js/music/tap-tempo.js';

const taps = (tempo, times) => times.map((t) => tempo.tap(t));

test('marcar tempo: a partir del segundo toque', () => {
  const tempo = createTapTempo([40, 200]);
  assert.deepEqual(taps(tempo, [0, 500, 1000, 1500]), [null, 120, 120, 120]);
});

test('marcar tempo: promedia los toques irregulares', () => {
  const tempo = createTapTempo([40, 200]);
  const result = taps(tempo, [0, 650, 1340, 2000]); // ~90 ppm con imprecisiones
  assert.equal(result.at(-1), 90);
});

test('marcar tempo: tras una pausa larga empieza de nuevo', () => {
  const tempo = createTapTempo([40, 200]);
  taps(tempo, [0, 500, 1000]);
  assert.equal(tempo.tap(5000), null);
  assert.equal(tempo.tap(6000), 60);
});

test('marcar tempo: solo cuentan los últimos toques (sigue un cambio de tempo)', () => {
  const tempo = createTapTempo([40, 200]);
  taps(tempo, [0, 1000, 2000, 3000]); // 60
  let t = 3000;
  let bpm;
  for (let i = 0; i < 8; i++) bpm = tempo.tap((t += 500));
  assert.equal(bpm, 120);
});

test('marcar tempo: dentro del rango permitido', () => {
  const tempo = createTapTempo([40, 200]);
  assert.equal(taps(tempo, [0, 100]).at(-1), 200);
  tempo.reset();
  assert.equal(taps(tempo, [0, 1900]).at(-1), 40);
});
