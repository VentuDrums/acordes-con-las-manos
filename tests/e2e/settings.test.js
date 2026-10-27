// Fase 2 en Chromium: configuración, modo personalizado, intercambio de manos y calibración.
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

const text = (page, sel) => page.textContent(sel);
const openSettings = (page) => page.click('#settingsBtn');
const closeSettings = (page) => page.click('#settingsDialog .dialog-head button');

test('modo escala: tónica, escala y cuatriadas cambian los acordes y se guardan', async () => {
  const app = await openApp();
  try {
    const { page } = app;
    await openSettings(page);
    await page.selectOption('#tonicSelect', '2');
    await page.selectOption('#scaleSelect', 'dorian');
    await closeSettings(page);
    assert.equal(await text(page, '#legendTitle'), 'Mano izquierda · Re dórica');
    await page.click('#legend button[data-gesture="one"]');
    assert.equal(await text(page, '#chordName'), 'Rem');
    assert.equal(await text(page, '#chordDegree'), 'i');
    await page.click('#legend button[data-gesture="four"]');
    assert.equal(await text(page, '#chordName'), 'Sol');
    assert.equal(await text(page, '#chordDegree'), 'IV');

    // Con el acorde sonando, activar las cuatriadas lo cambia al momento.
    await openSettings(page);
    await page.check('#seventhsCheck');
    await closeSettings(page);
    assert.equal(await text(page, '#chordName'), 'Sol7');
    assert.equal(await text(page, '#chordDegree'), 'IV7');
    const last = await page.evaluate(() => window.acordes.engine.log.at(-1));
    assert.deepEqual(last.notes, [43, 55, 59, 62, 65]); // Sol2 + Sol3 Si3 Re4 Fa4

    await page.reload();
    assert.equal(await text(page, '#legendTitle'), 'Mano izquierda · Re dórica');
    await page.click('#legend button[data-gesture="one"]');
    assert.equal(await text(page, '#chordName'), 'Rem7');
    assert.deepEqual(app.errors, []);
  } finally {
    await app.close();
  }
});

test('modo personalizado: cada gesto toca el acorde elegido, también el pulgar', async () => {
  const app = await openApp();
  try {
    const { page } = app;
    await openSettings(page);
    await page.click('[data-left-mode="custom"]');
    await page.selectOption('select[data-root="thumb"]', '1');
    await page.selectOption('select[data-quality="thumb"]', 'maj7');
    assert.equal(await text(page, '#customList li:last-child .name'), 'Re♭maj7');
    await page.screenshot({ path: path.join(SHOTS, 'configuracion.png') });
    await closeSettings(page);

    assert.equal(await text(page, '#legendTitle'), 'Mano izquierda · acordes a tu gusto');
    await page.click('#legend button[data-gesture="thumb"]');
    assert.equal(await text(page, '#chordName'), 'Re♭maj7');
    assert.equal(await text(page, '#chordDegree'), '', 'en modo personalizado no se muestra el grado');
    await page.click('#legend button[data-gesture="rock"]');
    assert.equal(await text(page, '#chordName'), 'Sol7');

    // Rellenar con la escala de La menor armónica.
    await openSettings(page);
    await page.selectOption('#tonicSelect', '9');
    await page.selectOption('#scaleSelect', 'harmonicMinor');
    await page.click('#fillFromScaleBtn');
    await closeSettings(page);
    const legend = await page.locator('#legend .what').allTextContents();
    assert.deepEqual(legend, ['Silencio', 'Lam', 'Si°', 'Do+', 'Rem', 'Mi', 'Fa', 'Sol♯°', 'Re♭maj7']);

    await page.reload();
    assert.equal(await text(page, '#legendTitle'), 'Mano izquierda · acordes a tu gusto');
    assert.equal(await text(page, '#legend button[data-gesture="three"] .what'), 'Do+');
    assert.deepEqual(app.errors, []);
  } finally {
    await app.close();
  }
});

test('intercambiar las manos: la mano de la izquierda pasa a ser la derecha', async () => {
  const video = buildCameraVideo('solo-tijera', [{ photo: 'rps_scissors_100.jpg' }, { photo: 'rps_scissors_100.jpg' }]);
  const app = await openApp({ video });
  try {
    const { page } = app;
    await page.click('#startBtn');
    await page.waitForFunction(() => document.querySelector('#startPanel').hidden, null, { timeout: 60000 });
    await page.waitForFunction(() => document.querySelector('#chordName').textContent === 'Rem', null, { timeout: 20000 });
    assert.match(await text(page, '#leftSeen'), /2 dedos/);

    await openSettings(page);
    await page.check('#swapHandsCheck');
    await closeSettings(page);
    await page.waitForFunction(() => /2 dedos/.test(document.querySelector('#rightSeen').textContent), null, { timeout: 20000 });
    await page.waitForFunction(() => document.querySelector('#chordName').textContent === 'Silencio', null, { timeout: 20000 });
    assert.equal(await text(page, '#leftSeen'), 'No la veo');
    assert.deepEqual(app.errors, []);
  } finally {
    await app.close();
  }
});

test('calibración: graba un gesto, muestra el acierto, no suena y descarga los datos', async () => {
  const video = buildCameraVideo('solo-tijera', []);
  const app = await openApp({ video });
  try {
    const { page } = app;
    await openSettings(page);
    await page.click('#calibrateBtn');
    assert.ok(await page.isVisible('#calibPanel'));
    assert.ok(await page.isHidden('#legendPanel'));
    await page.waitForFunction(() => document.querySelector('#startPanel').hidden, null, { timeout: 60000 });

    await page.click('#calibList button[data-gesture="two"]');
    await page.waitForFunction(() => /Prepárate/.test(document.querySelector('#calibBanner').textContent), null, { timeout: 5000 });
    await page.waitForFunction(() => /bien/.test(document.querySelector('#calibList li:nth-child(3)').textContent),
      null, { timeout: 15000 });
    const result = await text(page, '#calibList li:nth-child(3) .result');
    console.log('Resultado de la calibración de ✌️:', result);
    const [, ok, total] = result.match(/(\d+) de (\d+)/).map(Number);
    assert.ok(total >= 5, `pocas muestras: ${total}`);
    assert.ok(ok / total >= 0.8, result);
    await page.screenshot({ path: path.join(SHOTS, 'calibracion.png') });

    const chords = await page.evaluate(() => window.acordes.engine.log.filter((e) => e.type === 'chord').length);
    assert.equal(chords, 0, 'durante la calibración no debe sonar nada');

    const [download] = await Promise.all([page.waitForEvent('download'), page.click('#downloadBtn')]);
    const data = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
    assert.match(download.suggestedFilename(), /^calibracion-gestos-.*\.json$/);
    assert.equal(data.samples.length, total);
    assert.equal(data.samples[0].expected, 'two');
    assert.equal(data.samples[0].hand, 'left');
    assert.equal(data.samples[0].world.length, 21);
    assert.equal(data.delegate, 'CPU');

    await page.click('#exitCalibBtn');
    assert.ok(await page.isVisible('#legendPanel'));
    await page.waitForFunction(() => document.querySelector('#chordName').textContent === 'Rem', null, { timeout: 10000 });
    assert.deepEqual(app.errors, []);
  } finally {
    await app.close();
  }
});

test('configuración y calibración caben en tablet y móvil', async () => {
  for (const [name, viewport] of Object.entries({
    'tablet-horizontal': { width: 1270, height: 847 },
    movil: { width: 390, height: 844 },
  })) {
    const app = await openApp({ viewport });
    try {
      const { page } = app;
      await openSettings(page);
      await page.click('[data-left-mode="custom"]');
      const overflow = await page.evaluate(() => {
        const d = document.querySelector('#settingsDialog');
        return d.scrollWidth > d.clientWidth + 1 || document.documentElement.scrollWidth > window.innerWidth;
      });
      await page.screenshot({ path: path.join(SHOTS, `configuracion-${name}.png`) });
      assert.equal(overflow, false, `${name}: la configuración se sale por los lados`);
      assert.deepEqual(app.errors, []);
    } finally {
      await app.close();
    }
  }
});

test('tempo: se escribe con el teclado o se marca con toques', async () => {
  const app = await openApp();
  try {
    const { page } = app;
    await openSettings(page);
    const bpm = () => page.evaluate(() => ({ s: window.acordes.settings.bpm, e: window.acordes.engine.bpm }));

    // Escribir: «1» camino de «112» no cambia el tempo; «112» sí, y el deslizador lo sigue.
    await page.fill('#bpmInput', '');
    await page.type('#bpmInput', '1');
    assert.deepEqual(await bpm(), { s: 90, e: 90 });
    await page.type('#bpmInput', '12');
    assert.deepEqual(await bpm(), { s: 112, e: 112 });
    assert.equal(await page.inputValue('#bpmRange'), '112');
    // Fuera de rango: al pulsar Intro se ajusta al máximo; vacío vuelve al tempo actual.
    await page.fill('#bpmInput', '350');
    await page.press('#bpmInput', 'Enter');
    assert.equal(await page.inputValue('#bpmInput'), '200');
    assert.equal((await bpm()).s, 200);
    await page.fill('#bpmInput', '');
    await page.press('#bpmInput', 'Enter');
    assert.equal(await page.inputValue('#bpmInput'), '200');
    // El deslizador actualiza el número.
    await page.fill('#bpmRange', '75');
    assert.equal(await page.inputValue('#bpmInput'), '75');

    // Marcar el tempo: 6 toques cada 500 ms → 120 ppm.
    const box = await page.locator('#tapTempoBtn').boundingBox();
    for (let i = 0; i < 6; i++) {
      if (i) await page.waitForTimeout(500);
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      if (i === 0) assert.equal((await page.textContent('#tapTempoBtn')).trim(), 'Sigue tocando…');
    }
    const tapped = (await bpm()).s;
    assert.ok(tapped >= 114 && tapped <= 122, `tempo marcado: ${tapped}`);
    assert.equal(await page.inputValue('#bpmInput'), String(tapped));
    assert.match(await page.textContent('#tapTempoBtn'), new RegExp(`${tapped} ppm`));
    await page.screenshot({ path: path.join(SHOTS, 'tempo.png') });

    await page.reload();
    assert.equal(await page.evaluate(() => window.acordes.settings.bpm), tapped, 'se guarda');
    assert.deepEqual(app.errors, []);
  } finally {
    await app.close();
  }
});
