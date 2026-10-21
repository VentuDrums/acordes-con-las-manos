// Reconocimiento de gestos con fotos de manos reales: MediaPipe + nuestras reglas.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { ensurePhotos, openApp, SINGLE_PHOTOS } from './helpers.js';

let app;
let rps;

before(async () => {
  rps = await ensurePhotos(40);
  app = await openApp();
  await app.page.evaluate(async () => {
    const { FilesetResolver, HandLandmarker } = await import(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs');
    const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm');
    window.__landmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
        delegate: 'CPU',
      },
      runningMode: 'IMAGE',
      numHands: 1,
    });
    const { fingerStates, classify } = await import('/js/hands/gestures.js');
    window.__recognize = async (name) => {
      const img = new Image();
      img.src = `/__fixtures/${name}`;
      await img.decode();
      const r = window.__landmarker.detect(img);
      if (!r.worldLandmarks.length) return { detected: false };
      const fingers = fingerStates(r.worldLandmarks[0]);
      return { detected: true, fingers, gesture: classify(fingers) };
    };
  });
});

after(() => app?.close());

const recognize = (name) => app.page.evaluate((n) => window.__recognize(n), name);

for (const [name, { expected }] of Object.entries(SINGLE_PHOTOS)) {
  test(`foto ${name} → ${expected}`, async () => {
    const r = await recognize(name);
    assert.ok(r.detected, 'MediaPipe no encuentra la mano');
    assert.equal(r.gesture, expected, `dedos detectados: ${JSON.stringify(r.fingers)}`);
  });
}

// Este conjunto tiene muchas fotos de canto o del dorso de la mano, más difíciles que tocar
// con la palma hacia la cámara. Por eso se exige el 90 % en total y el 85 % en cada gesto.
test('conjunto piedra-papel-tijera: 90 % de acierto total y 85 % por gesto', async () => {
  const byClass = {};
  const misses = [];
  for (const { name, expected } of rps) {
    const r = await recognize(name);
    const c = (byClass[expected] ??= { ok: 0, total: 0, undetected: 0 });
    if (!r.detected) { c.undetected++; continue; }
    c.total++;
    if (r.gesture === expected) c.ok++;
    else misses.push(`${name}: ${r.gesture} ${JSON.stringify(r.fingers)}`);
  }
  console.log('Resultados por gesto:', JSON.stringify(byClass));
  if (misses.length) console.log('Fallos:\n  ' + misses.join('\n  '));
  for (const [gesture, c] of Object.entries(byClass)) {
    assert.ok(c.total >= 10, `${gesture}: muy pocas fotos con mano detectada (${c.total})`);
    assert.ok(c.ok / c.total >= 0.85, `${gesture}: ${c.ok}/${c.total} bien`);
  }
  const all = Object.values(byClass).reduce((a, c) => ({ ok: a.ok + c.ok, total: a.total + c.total }), { ok: 0, total: 0 });
  assert.ok(all.ok / all.total >= 0.9, `total: ${all.ok}/${all.total} bien`);
  assert.deepEqual(app.errors, []);
});
