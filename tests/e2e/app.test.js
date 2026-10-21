// La app completa en Chromium: cámara simulada con fotos de manos reales → gestos → acordes.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ensurePhotos, buildCameraVideo, openApp, CACHE } from './helpers.js';

const SHOTS = path.join(CACHE, 'screens');

before(async () => {
  await ensurePhotos(40);
  fs.mkdirSync(SHOTS, { recursive: true });
});

const startApp = async (page) => {
  await page.click('#startBtn');
  await page.waitForFunction(() => document.querySelector('#startPanel').hidden, null, { timeout: 60000 });
};

test('con la cámara: cada gesto de la mano izquierda toca su acorde', async () => {
  const video = buildCameraVideo('secuencia-izquierda', [
    { photo: 'pointing_up.jpg', crop: '220:260:120:0' }, // ☝️ → I (Do)
    { photo: 'rps_scissors_100.jpg' },                   // ✌️ → ii (Rem)
    { photo: 'rps_paper_103.jpg' },                      // 🖐️ → V (Sol)
    { photo: 'fist.jpg' },                             // ✊ → silencio
    { photo: 'rps_paper_103.jpg' },                      // 🖐️ → V (Sol)
    null,                                                // sin mano → silencio
  ]);
  const app = await openApp({ video });
  try {
    await startApp(app.page);
    // El vídeo dura 12 s y se repite; esperamos a ver la secuencia completa.
    await app.page.waitForFunction(() => {
      const seq = window.acordes.engine.log.map((e) => (e.type === 'chord' ? e.label : '·')).join(' ');
      return /Do Rem Sol · Sol ·/.test(seq);
    }, null, { timeout: 40000, polling: 250 });
    const log = await app.page.evaluate(() => window.acordes.engine.log);
    console.log('Secuencia oída:', log.map((e) => (e.type === 'chord' ? e.label : 'silencio')).join(' → '));
    const sol = log.find((e) => e.label === 'Sol');
    assert.deepEqual(sol.notes, [43, 55, 59, 62]); // Sol2 + Sol3 Si3 Re4
    await app.page.screenshot({ path: path.join(SHOTS, 'camara.png') });
    assert.deepEqual(app.errors, []);
  } finally {
    await app.close();
  }
});

test('sin cámara: la tabla toca los acordes, el puño silencia y el audio no está en silencio', async () => {
  const app = await openApp();
  try {
    const { page } = app;
    await page.evaluate(async () => {
      await window.acordes.engine.start();
      // Sin suavizado: el suavizado de Tone.Meter se aplica en cada lectura, no por tiempo.
      window.__meter = new Tone.Meter({ smoothing: 0 });
      Tone.Destination.connect(window.__meter);
    });
    await page.click('#legend button[data-gesture="four"]');
    assert.equal(await page.textContent('#chordName'), 'Fa');
    assert.equal(await page.textContent('#chordDegree'), 'IV');
    await page.waitForTimeout(500);
    const level = await page.evaluate(() => window.__meter.getValue());
    console.log('Nivel de salida con Fa sonando:', level.toFixed(1), 'dB');
    assert.ok(level > -40, `nivel demasiado bajo: ${level}`);

    await page.click('#legend button[data-gesture="rock"]');
    assert.equal(await page.textContent('#chordName'), 'Si°');
    assert.equal(await page.textContent('#chordDegree'), 'vii°');
    assert.equal(await page.getAttribute('#legend button[data-gesture="rock"]', 'aria-pressed'), 'true');

    assert.ok(await page.isDisabled('#legend button[data-gesture="thumb"]'), '👍 no tiene acorde en este modo');

    await page.click('#legend button[data-gesture="fist"]');
    assert.equal(await page.textContent('#chordName'), 'Silencio');
    await page.waitForTimeout(3500); // release del pad (1,2 s) + cola de la reverb
    assert.equal(await page.evaluate(() => window.acordes.engine.synth.activeVoices), 0, 'quedan voces sonando');
    const quiet = await page.evaluate(() => window.__meter.getValue());
    console.log('Nivel de salida tras el puño:', quiet === -Infinity ? '-∞' : quiet.toFixed(1), 'dB');
    assert.ok(quiet < -50, `sigue sonando: ${quiet}`);
    assert.deepEqual(app.errors, []);
  } finally {
    await app.close();
  }
});

test('la página cabe sin desplazamiento horizontal en móvil, tablet y ordenador', async () => {
  const sizes = {
    'tablet-horizontal': { width: 1270, height: 847 }, // Xiaomi Pad 8 Pro aprox.
    'tablet-vertical': { width: 847, height: 1270 },
    movil: { width: 390, height: 844 },
    ordenador: { width: 1440, height: 900 },
  };
  for (const [name, viewport] of Object.entries(sizes)) {
    const app = await openApp({ viewport });
    try {
      await app.page.click('#legend button[data-gesture="one"]');
      const overflow = await app.page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      await app.page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true });
      assert.equal(overflow, false, `${name}: se sale por los lados`);
      assert.deepEqual(app.errors, []);
    } finally {
      await app.close();
    }
  }
});
