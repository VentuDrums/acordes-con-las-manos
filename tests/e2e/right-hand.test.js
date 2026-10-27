// Fase 3 en Chromium: inversiones, ritmos a tempo y fader de volumen con el puño derecho.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ensurePhotos, buildMovingVideo, openApp, CACHE } from './helpers.js';

const SHOTS = path.join(CACHE, 'screens');

before(async () => {
  await ensurePhotos(40);
  fs.mkdirSync(SHOTS, { recursive: true });
});

const text = (page, sel) => page.textContent(sel);
const lastChord = (page) => page.evaluate(() => window.acordes.engine.log.filter((e) => e.type === 'chord').at(-1));

test('modo inversión: la mano derecha cambia la inversión del acorde que suena', async () => {
  const app = await openApp();
  try {
    const { page } = app;
    await page.click('#legend button[data-gesture="one"]'); // Do
    assert.deepEqual((await lastChord(page)).notes, [36, 48, 52, 55]);
    assert.equal(await text(page, '#soundInfo'), '4/4 · 90 ppm · Estado fundamental · Bloque sostenido · Piano');

    await page.click('#rightLegend button[data-gesture="two"]'); // 1ª inversión
    assert.deepEqual((await lastChord(page)).notes, [40, 52, 55, 60], 'Do/Mi');
    assert.equal(await text(page, '#soundInfo'), '4/4 · 90 ppm · 1ª inversión · Bloque sostenido · Piano');
    assert.equal(await page.getAttribute('#rightLegend button[data-gesture="two"]', 'aria-pressed'), 'true');

    // La inversión se mantiene al cambiar de acorde con la izquierda.
    await page.click('#legend button[data-gesture="five"]'); // Sol → Sol/Si
    assert.deepEqual((await lastChord(page)).notes, [47, 59, 62, 67]);

    await page.click('#rightLegend button[data-gesture="five"]'); // posición abierta
    assert.deepEqual((await lastChord(page)).notes, [43, 55, 62, 71], 'Sol abierto: Sol3 Re4 Si4');
    assert.deepEqual(app.errors, []);
  } finally {
    await app.close();
  }
});

test('modo ritmo: el patrón suena a tempo y el cambio de acorde no lo descuadra', async () => {
  const app = await openApp();
  try {
    const { page } = app;
    await page.click('#settingsBtn');
    await page.click('[data-right-mode="rhythm"]');
    await page.fill('#bpmRange', '120');
    await page.click('#settingsDialog .dialog-head button');
    assert.equal(await page.getAttribute('[data-quick-mode="rhythm"]', 'aria-pressed'), 'true');

    await page.click('#legend button[data-gesture="one"]'); // Do
    await page.click('#rightLegend button[data-gesture="four"]'); // arpegio ascendente
    // El patrón entra cuadrado con el compás global (a veces a mitad): se esperan 2 compases largos.
    await page.waitForTimeout(4600);
    const log = await page.evaluate(() => window.acordes.engine.noteLog.slice());
    const notes = log.map((e) => e.notes.join('-'));
    // Debe aparecer el compás completo: Do2+Do3, Mi3, Sol3, Do4, Do3, Mi3, Sol3, Do4.
    const seq = notes.join(' ');
    assert.match(seq, /36 48 52 55 60 48 52 55 60/, seq);
    // A 120 ppm las corcheas van cada 250 ms.
    const firstBar = log.findIndex((e) => e.step === 0);
    const gaps = log.slice(firstBar + 2, firstBar + 9).map((e, i, arr) => (i ? e.at - arr[i - 1].at : null)).filter(Boolean);
    const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    console.log('Separación media entre corcheas a 120 ppm:', avg.toFixed(0), 'ms');
    assert.ok(avg > 200 && avg < 300, `separación ${avg}`);

    // Cambio de acorde: las siguientes notas son de Rem y los pasos siguen cuadrados con el compás.
    await page.click('#legend button[data-gesture="two"]');
    const before = (await page.evaluate(() => window.acordes.engine.noteLog.length));
    await page.waitForTimeout(2200);
    const after = await page.evaluate((n) => window.acordes.engine.noteLog.slice(n), before);
    const downbeat = after.filter((e) => e.step === 0).slice(-2).flatMap((e) => e.notes);
    assert.deepEqual(downbeat, [38, 50], 'el compás empieza con Re2 + Re3');
    assert.ok(after.every((e) => e.step % 6 === 0), 'las notas caen en las corcheas del compás (6 unidades)');

    // Con la meter de salida: suena algo.
    const level = await page.evaluate(async () => {
      const m = new Tone.Meter({ smoothing: 0 });
      Tone.Destination.connect(m);
      let max = -Infinity;
      for (let i = 0; i < 20; i++) { await new Promise((r) => setTimeout(r, 50)); max = Math.max(max, m.getValue()); }
      return max;
    });
    console.log('Nivel máximo con el arpegio sonando:', level.toFixed(1), 'dB');
    assert.ok(level > -45, `nivel ${level}`);

    // Puño izquierdo: silencio y el patrón deja de tocar.
    await page.click('#legend button[data-gesture="fist"]');
    await page.waitForTimeout(300);
    const n1 = await page.evaluate(() => window.acordes.engine.noteLog.length);
    await page.waitForTimeout(1000);
    const n2 = await page.evaluate(() => window.acordes.engine.noteLog.length);
    assert.equal(n2, n1, 'en silencio no se disparan notas');

    await page.reload();
    assert.equal(await text(page, '#soundInfo'), '4/4 · 120 ppm · Estado fundamental · Arpegio ascendente · Piano', 'se guarda el patrón');
    assert.deepEqual(app.errors, []);
  } finally {
    await app.close();
  }
});

test('cambio rápido de modo desde la pantalla principal, con las tablas ya configuradas', async () => {
  const app = await openApp();
  try {
    const { page } = app;
    await page.click('#legend button[data-gesture="one"]'); // Do
    await page.click('#rightLegend button[data-gesture="two"]'); // 1ª inversión
    assert.equal(await text(page, '#rightLegend button[data-gesture="two"] .what'), '1ª inversión');

    await page.click('[data-quick-mode="rhythm"]');
    assert.equal(await page.getAttribute('[data-quick-mode="rhythm"]', 'aria-pressed'), 'true');
    assert.equal(await text(page, '#rightLegend button[data-gesture="two"] .what'), 'Negras');
    await page.click('#rightLegend button[data-gesture="four"]');
    assert.equal(await text(page, '#soundInfo'), '4/4 · 90 ppm · 1ª inversión · Arpegio ascendente · Piano', 'la inversión elegida se mantiene');

    await page.click('[data-quick-mode="inversion"]');
    assert.equal(await text(page, '#rightLegend button[data-gesture="two"] .what'), '1ª inversión');
    assert.equal(await text(page, '#soundInfo'), '4/4 · 90 ppm · 1ª inversión · Arpegio ascendente · Piano', 'el ritmo elegido se mantiene');

    // La configuración refleja el modo elegido desde la pantalla principal.
    await page.click('#settingsBtn');
    assert.equal(await page.getAttribute('[data-right-mode="inversion"]', 'aria-pressed'), 'true');
    await page.click('#settingsDialog .dialog-head button');
    await page.reload();
    assert.equal(await page.getAttribute('[data-quick-mode="inversion"]', 'aria-pressed'), 'true');
    assert.deepEqual(app.errors, []);
  } finally {
    await app.close();
  }
});

test('los ritmos suenan con el piano: las muestras cargan y se oyen', async () => {
  const app = await openApp();
  try {
    const { page } = app;
    await page.click('[data-quick-mode="rhythm"]');
    await page.click('#legend button[data-gesture="one"]');
    await page.click('#rightLegend button[data-gesture="three"]'); // rasgueo pop
    await page.waitForFunction(() => window.acordes.engine.pianoLoaded, null, { timeout: 15000 });
    const level = await page.evaluate(async () => {
      const m = new Tone.Meter({ smoothing: 0 });
      Tone.Destination.connect(m);
      let max = -Infinity;
      for (let i = 0; i < 40; i++) { await new Promise((r) => setTimeout(r, 50)); max = Math.max(max, m.getValue()); }
      return max;
    });
    const last = await page.evaluate(() => window.acordes.engine.noteLog.at(-1));
    console.log('Nivel máximo con el piano:', level.toFixed(1), 'dB · instrumento:', last.instrument);
    assert.equal(last.instrument, 'piano');
    assert.ok(level > -40, `nivel ${level}`);
    assert.deepEqual(app.errors, []);
  } finally {
    await app.close();
  }
});

test('fader: puño derecho y bajar la mano baja el volumen; al soltar se queda', async () => {
  // Puño en la parte de la mano derecha: quieto arriba 4 s (para agarrarlo aunque el modelo tarde
  // en cargar) y luego baja del 30 % al 75 % del alto. El vídeo se repite cada 12 s.
  const video = buildMovingVideo('fader-baja-v2', 'fist.jpg', { side: 'right', fromY: 0.3, toY: 0.75, startAt: 4, total: 12 });
  const app = await openApp({ video });
  try {
    const { page } = app;
    await page.click('#startBtn');
    await page.waitForFunction(() => document.querySelector('#startPanel').hidden, null, { timeout: 60000 });
    await page.waitForFunction(() => window.acordes.fader.grabbing, null, { timeout: 20000 });
    assert.match(await text(page, '#rightSeen'), /Puño/);
    await page.waitForFunction(() => window.acordes.settings.volume < 0.3, null, { timeout: 40000 });
    const vol = await page.evaluate(() => window.acordes.settings.volume);
    console.log('Volumen tras bajar el puño:', vol.toFixed(2));
    assert.ok(await page.evaluate(() => document.querySelector('#volume').classList.contains('grabbing')));
    await page.screenshot({ path: path.join(SHOTS, 'fader.png') });
    assert.deepEqual(app.errors, []);
  } finally {
    await app.close();
  }
});

test('mano derecha en la configuración: tabla editable y cabe en tablet y móvil', async () => {
  for (const [name, viewport] of Object.entries({ 'tablet-horizontal': { width: 1270, height: 847 }, movil: { width: 390, height: 844 } })) {
    const app = await openApp({ viewport });
    try {
      const { page } = app;
      await page.click('#settingsBtn');
      await page.click('[data-right-mode="rhythm"]');
      await page.selectOption('select[data-right-map="one"]', 'bossa');
      await page.locator('#rightMapList').scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(SHOTS, `mano-derecha-config-${name}.png`) });
      const overflow = await page.evaluate(() => {
        const d = document.querySelector('#settingsDialog');
        return d.scrollWidth > d.clientWidth + 1 || document.documentElement.scrollWidth > window.innerWidth;
      });
      assert.equal(overflow, false, `${name}: se sale por los lados`);
      await page.click('#settingsDialog .dialog-head button');
      assert.equal(await text(page, '#rightLegend button[data-gesture="one"] .what'), 'Bossa nova');
      await page.screenshot({ path: path.join(SHOTS, `mano-derecha-${name}.png`), fullPage: true });
      assert.deepEqual(app.errors, []);
    } finally {
      await app.close();
    }
  }
});
