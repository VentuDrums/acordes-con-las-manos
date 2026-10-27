// Fase 6 en Chromium: instrumentos del acorde y del bajo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { openApp, CACHE } from './helpers.js';

const SHOTS = path.join(CACHE, 'screens');
fs.mkdirSync(SHOTS, { recursive: true });

const CHORD_SOUNDS = ['piano', 'epiano', 'organ', 'pad', 'guitarAcoustic', 'guitarElectric', 'harp', 'marimba'];

// Nivel máximo de salida (dB) durante `ms`.
const peak = (page, ms = 2000) => page.evaluate(async (ms) => {
  window.__meter ??= new Tone.Meter({ smoothing: 0 });
  Tone.Destination.connect(window.__meter);
  let max = -Infinity;
  for (let t = 0; t < ms; t += 40) { await new Promise((r) => setTimeout(r, 40)); max = Math.max(max, window.__meter.getValue()); }
  return max;
}, ms);
const lastNotes = (page, n = 30) => page.evaluate((n) => window.acordes.engine.noteLog.slice(-n), n);
const waitLoaded = (page) => page.waitForFunction(() => {
  const e = window.acordes.engine;
  return e.ready && [e.sound, e.bassSound].every((id) => e.isLoaded(id));
}, null, { timeout: 20000 });

test('cada instrumento del acorde suena con su sonido (y a un volumen parecido)', async () => {
  const app = await openApp();
  try {
    const { page } = app;
    await page.click('[data-quick-mode="rhythm"]');
    await page.click('#legend button[data-gesture="one"]'); // Do
    await page.click('#rightLegend button[data-gesture="three"]'); // rasgueo pop
    const levels = {};
    for (const id of CHORD_SOUNDS) {
      await page.selectOption('#soundPanel select[data-sound-select="chord"]', id);
      await waitLoaded(page);
      const since = await page.evaluate(() => performance.now());
      levels[id] = await peak(page, 4000);
      const notes = (await lastNotes(page, 20)).filter((n) => n.at > since);
      assert.ok(notes.length && notes.every((n) => n.instrument === id), `${id}: ${notes.map((n) => n.instrument)}`);
    }
    console.log('Nivel máximo por instrumento (dB):', Object.entries(levels).map(([k, v]) => `${k} ${v.toFixed(1)}`).join(' · '));
    for (const [id, level] of Object.entries(levels)) assert.ok(level > -30, `${id} suena demasiado bajo: ${level}`);
    const values = Object.values(levels);
    assert.ok(Math.max(...values) - Math.min(...values) < 12, 'los instrumentos están equilibrados (menos de 12 dB de diferencia)');
    assert.equal(await page.textContent('#soundInfo').then((s) => s.endsWith('Marimba')), true);
    assert.deepEqual(app.errors, []);
  } finally {
    await app.close();
  }
});

test('el bajo: el mismo, otro instrumento o sin bajo, y su volumen', async () => {
  const app = await openApp();
  try {
    const { page } = app;
    await page.click('[data-quick-mode="rhythm"]');
    await page.click('#legend button[data-gesture="one"]');
    await page.click('#rightLegend button[data-gesture="three"]'); // rasgueo pop: bajo + acorde
    await waitLoaded(page);
    await page.waitForTimeout(3000); // un compás a 90 ppm
    let notes = await lastNotes(page);
    assert.ok(notes.some((n) => n.part === 'bass' && n.instrument === 'piano'), `con «el mismo», el bajo es el piano: ${JSON.stringify(notes.map((n) => [n.part, n.instrument, n.kind]))}`);

    for (const id of ['bassElectric', 'contrabass', 'synthBass']) {
      await page.selectOption('#soundPanel select[data-sound-select="bass"]', id);
      await waitLoaded(page);
      const since = await page.evaluate(() => performance.now());
      await page.waitForTimeout(3000); // un compás a 90 ppm
      notes = (await lastNotes(page)).filter((n) => n.at > since);
      const bass = notes.filter((n) => n.part === 'bass' && n.kind === 'note');
      const chord = notes.filter((n) => n.part === 'chord' && n.kind === 'note');
      assert.ok(bass.length && bass.every((n) => n.instrument === id), `${id}: ${bass.map((n) => n.instrument)}`);
      assert.ok(chord.length && chord.every((n) => n.instrument === 'piano'), 'el acorde sigue en el piano');
      assert.ok(bass.every((n) => n.notes.every((m) => m >= 36 && m < 60)), 'registro del bajo');
    }

    // Volumen del bajo: cambia la ganancia del bajo (no la del acorde) y se guarda.
    await page.click('#settingsBtn');
    await page.fill('#bassVolumeRange', '0.35');
    await page.waitForTimeout(200);
    const gain = await page.evaluate(() => window.acordes.engine.bassOut.gain.value);
    assert.ok(Math.abs(gain - 2 * 0.35 ** 2) < 0.02, `ganancia del bajo ${gain}`);
    await page.selectOption('#bassSoundSelect', 'none');
    assert.ok(await page.isDisabled('#bassVolumeRange'), 'sin bajo, el volumen del bajo no se usa');
    await page.click('#settingsDialog .dialog-head button');
    await page.waitForTimeout(3000);
    notes = await lastNotes(page);
    assert.ok(!notes.slice(-8).some((n) => n.part === 'bass'), 'sin bajo no suena el bajo');
    assert.equal(await page.inputValue('#soundPanel select[data-sound-select="bass"]'), 'none', 'el panel rápido sigue a la configuración');
    await page.screenshot({ path: path.join(SHOTS, 'sonido.png') });

    await page.reload();
    const saved = await page.evaluate(() => ({ s: window.acordes.settings.bassSound, v: window.acordes.settings.bassVolume }));
    assert.deepEqual(saved, { s: 'none', v: 0.35 });
    assert.deepEqual(app.errors, []);
  } finally {
    await app.close();
  }
});

test('bloque sostenido: el piano toca el acorde una vez; el pad y el órgano lo mantienen', async () => {
  const app = await openApp();
  try {
    const { page } = app;
    await page.click('#legend button[data-gesture="one"]'); // modo inversión: bloque sostenido
    await waitLoaded(page);
    // Con el piano (se apaga solo) el acorde nuevo se toca entero, incluidas las notas comunes.
    const attacks = await page.evaluate(async () => {
      const e = window.acordes.engine;
      const calls = [];
      const spy = (part) => {
        const inst = e.voices[part].inst;
        const orig = inst.triggerAttack.bind(inst);
        inst.triggerAttack = (notes, ...rest) => { calls.push([part, notes]); return orig(notes, ...rest); };
      };
      spy('chord'); spy('bass');
      document.querySelector('#legend button[data-gesture="six"], #legend button[data-gesture="five"]').click(); // V · Sol
      await new Promise((r) => setTimeout(r, 300));
      document.querySelector('#legend button[data-gesture="one"]').click(); // I · Do (Sol en común)
      await new Promise((r) => setTimeout(r, 300));
      return calls;
    });
    assert.deepEqual(attacks.at(-2), ['chord', ['C3', 'E3', 'G3']], 'el piano repite el Sol común');
    assert.deepEqual(attacks.at(-1), ['bass', ['C2']]);

    // Con el pad (se mantiene) solo entran las notas nuevas.
    await page.selectOption('#soundPanel select[data-sound-select="chord"]', 'pad');
    await page.waitForTimeout(300);
    const padAttacks = await page.evaluate(async () => {
      const e = window.acordes.engine;
      const calls = [];
      const inst = e.voices.chord.inst;
      const orig = inst.triggerAttack.bind(inst);
      inst.triggerAttack = (notes, ...rest) => { calls.push(notes); return orig(notes, ...rest); };
      document.querySelector('#legend button[data-gesture="five"]').click(); // Sol
      await new Promise((r) => setTimeout(r, 300));
      return { calls, voices: e.activeVoices() };
    });
    assert.deepEqual(padAttacks.calls.at(-1), ['B3', 'D4'], 'el Sol común (Sol3) sigue sonando');
    assert.ok(padAttacks.voices >= 3, 'el pad mantiene el acorde');
    assert.deepEqual(app.errors, []);
  } finally {
    await app.close();
  }
});

test('mientras cargan las muestras se indica en el selector y suena un sustituto', async () => {
  const app = await openApp();
  try {
    const { page } = app;
    // Retrasa la descarga de las muestras de marimba para poder ver el estado de carga.
    let release;
    const gate = new Promise((r) => { release = r; });
    await page.route('**/audio/marimba/**', async (route) => { await gate; await route.continue(); });
    await page.selectOption('#soundPanel select[data-sound-select="chord"]', 'marimba');
    await page.click('#legend button[data-gesture="one"]');
    await page.click('[data-quick-mode="rhythm"]');
    await page.click('#rightLegend button[data-gesture="three"]');
    await page.waitForTimeout(1500);
    const label = await page.locator('#soundPanel select[data-sound-select="chord"] option[value="marimba"]').textContent();
    assert.equal(label, 'Marimba (cargando…)');
    const notes = await lastNotes(page, 5);
    assert.ok(notes.length && notes.every((n) => n.instrument === 'keys'), 'suena el sustituto');
    release();
    await waitLoaded(page);
    await page.waitForTimeout(1500);
    assert.equal(await page.locator('#soundPanel select[data-sound-select="chord"] option[value="marimba"]').textContent(), 'Marimba');
    assert.ok((await lastNotes(page, 3)).every((n) => n.instrument === 'marimba'));
    assert.deepEqual(app.errors, []);
  } finally {
    await app.close();
  }
});
