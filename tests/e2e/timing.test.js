// Fase 4 en Chromium: compases, metrónomo, cuenta previa y cuándo entra el acorde nuevo.
// Para los cambios «tarde» la prueba espera a un punto exacto del compás y hace el gesto ahí.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { openApp, CACHE } from './helpers.js';

const SHOTS = path.join(CACHE, 'screens');
fs.mkdirSync(SHOTS, { recursive: true });

const settingsDo = async (page, fn) => {
  await page.click('#settingsBtn');
  await fn();
  await page.click('#settingsDialog .dialog-head button');
};

// Espera a que el reloj esté en [from, to) unidades dentro del compás y entonces toca el gesto.
const gestureAt = (page, gesture, from, to) => page.evaluate(async ([g, a, b]) => {
  const e = window.acordes.engine;
  const steps = { '2/4': 8, '3/4': 12, '4/4': 16, '3/8': 3, '6/8': 6, '9/8': 9, '12/8': 12 }[e.meter];
  for (let i = 0; i < 2000; i++) {
    const u = e.unitAt(Tone.immediate());
    const pos = (((u - e.phase) % steps) + steps) % steps;
    if (pos >= a && pos < b) {
      document.querySelector(`#legend button[data-gesture="${g}"]`).click();
      return { unit: u, pos };
    }
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error('no se llegó al punto del compás');
}, [gesture, from, to]);

const engineLogs = (page) => page.evaluate(() => {
  const e = window.acordes.engine;
  return { log: e.log.slice(), notes: e.noteLog.slice(), clicks: e.clickLog.slice() };
});

test('metrónomo: un click por pulso con acento en la primera parte (4/4 y 6/8)', async () => {
  const app = await openApp();
  try {
    const { page } = app;
    await page.click('#metronomeBtn');
    assert.equal(await page.getAttribute('#metronomeBtn', 'aria-pressed'), 'true');
    await page.waitForTimeout(3000);
    let { clicks } = await engineLogs(page);
    assert.ok(clicks.length >= 4, `pocos clicks: ${clicks.length}`);
    assert.ok(clicks.every((c) => c.step % 4 === 0), 'en 4/4 un click cada negra');
    assert.ok(clicks.every((c) => c.accent === (c.step === 0)), 'acento solo en la primera parte');

    await settingsDo(page, () => page.selectOption('#meterSelect', '6/8'));
    await page.waitForTimeout(3000);
    ({ clicks } = await engineLogs(page));
    const in68 = clicks.filter((c) => c.at === undefined || true).slice(-4);
    assert.ok(in68.every((c) => c.step % 3 === 0), `en 6/8 un click cada negra con puntillo: ${JSON.stringify(in68)}`);
    assert.ok(in68.some((c) => c.step === 3) && in68.some((c) => c.step === 0));
    assert.match(await page.textContent('#soundInfo'), /^6\/8 · 90 ppm/);
    assert.equal(await page.locator('#beats span').count(), 2, 'dos pulsos en pantalla');
    // La mano derecha muestra los patrones de 6/8.
    await page.click('[data-quick-mode="rhythm"]');
    assert.equal(await page.textContent('#rightLegend button[data-gesture="two"] .what'), 'Pulsos');

    await page.reload();
    assert.match(await page.textContent('#soundInfo'), /^6\/8/, 'el compás se guarda');
    assert.equal(await page.getAttribute('#metronomeBtn', 'aria-pressed'), 'true');
    assert.deepEqual(app.errors, []);
  } finally {
    await app.close();
  }
});

test('3/4: el vals suena bajo-acorde-acorde y un compás dura 12 semicorcheas', async () => {
  const app = await openApp();
  try {
    const { page } = app;
    await settingsDo(page, () => page.selectOption('#meterSelect', '3/4'));
    await page.click('[data-quick-mode="rhythm"]');
    await page.click('#legend button[data-gesture="one"]');
    await page.click('#rightLegend button[data-gesture="three"]'); // vals
    assert.equal(await page.textContent('#rightLegend button[data-gesture="three"] .what'), 'Vals');
    await page.waitForTimeout(4500);
    const { notes } = await engineLogs(page);
    const bars = notes.filter((n) => n.step === 0).map((n) => n.unit);
    assert.ok(bars.length >= 2, 'al menos dos compases');
    assert.equal(bars[1] - bars[0], 12);
    assert.deepEqual([...new Set(notes.map((n) => n.step))].sort((a, b) => a - b), [0, 4, 8]);
    assert.deepEqual(notes.find((n) => n.step === 0).notes, [36]);
    assert.deepEqual(notes.find((n) => n.step === 4).notes, [48, 52, 55]);
    assert.deepEqual(app.errors, []);
  } finally {
    await app.close();
  }
});

test('al instante: si el gesto llega tarde, el bajo nuevo entra en ese momento', async () => {
  const app = await openApp();
  try {
    const { page } = app;
    await settingsDo(page, () => page.fill('#bpmRange', '60'));
    await page.click('[data-quick-mode="rhythm"]');
    await page.click('#legend button[data-gesture="one"]'); // Do
    await page.click('#rightLegend button[data-gesture="three"]'); // rasgueo pop: bajo de blanca en el 1
    // Que el patrón ya haya sonado una parte fuerte (antes de elegirlo sonaba el bloque sostenido).
    await page.waitForFunction(() => window.acordes.engine.noteLog.some((n) => n.step === 0), null, { timeout: 8000 });

    // 1) Justo después de la parte fuerte (dentro de la primera semicorchea).
    const late = await gestureAt(page, 'two', 0.2, 0.7); // Rem
    await page.waitForTimeout(300);
    let { notes } = await engineLogs(page);
    let fix = notes.find((n) => n.kind === 'replace' && n.unit === Math.floor(late.unit) && n.notes.includes(38));
    assert.ok(fix, `el bajo Re2 debía sonar al momento: ${JSON.stringify(notes.filter((n) => n.unit >= Math.floor(late.unit)))}`);

    // 2) A mitad del compás: el bajo largo (blanca) de Re se sustituye por el de Fa.
    const mid = await gestureAt(page, 'four', 5.2, 5.8); // Fa
    await page.waitForTimeout(300);
    ({ notes } = await engineLogs(page));
    const barStart = Math.floor(mid.unit) - Math.floor(mid.pos);
    fix = notes.find((n) => n.kind === 'replace' && n.unit === barStart && n.notes.includes(41));
    assert.ok(fix, `el bajo largo debía pasar a Fa2 al momento: ${JSON.stringify(notes.slice(-6))}`);
    assert.deepEqual(app.errors, []);
  } finally {
    await app.close();
  }
});

test('elegir un patrón un poco tarde: las notas de la parte fuerte suenan al momento', async () => {
  const app = await openApp();
  try {
    const { page } = app;
    await settingsDo(page, () => page.fill('#bpmRange', '60'));
    await page.click('[data-quick-mode="rhythm"]');
    await page.click('#legend button[data-gesture="one"]'); // Do, en bloque sostenido
    await page.waitForTimeout(300);
    const at = await page.evaluate(async () => {
      const e = window.acordes.engine;
      for (let i = 0; i < 2000; i++) {
        const u = e.unitAt(Tone.immediate());
        const pos = (((u - e.phase) % 16) + 16) % 16;
        if (pos >= 0.2 && pos < 0.7) {
          document.querySelector('#rightLegend button[data-gesture="three"]').click(); // rasgueo pop
          return u;
        }
        await new Promise((r) => setTimeout(r, 5));
      }
      throw new Error('no se llegó al punto del compás');
    });
    const { notes } = await engineLogs(page);
    const caught = notes.filter((n) => n.kind === 'catchup' && n.unit === Math.floor(at));
    assert.deepEqual(caught.map((n) => n.notes), [[36], [48, 52, 55]], 'bajo y acorde del 1 al momento');
    assert.deepEqual(app.errors, []);
  } finally {
    await app.close();
  }
});

test('siguiente compás: el acorde espera al compás siguiente y se ve en espera', async () => {
  const app = await openApp();
  try {
    const { page } = app;
    await settingsDo(page, async () => {
      await page.click('[data-change-mode="bar"]');
      await page.fill('#bpmRange', '60');
    });
    await page.click('[data-quick-mode="rhythm"]');
    await page.click('#legend button[data-gesture="one"]');
    await page.click('#rightLegend button[data-gesture="four"]'); // arpegio
    await page.waitForFunction(() => window.acordes.engine.voicing !== null, null, { timeout: 8000 });

    const req = await gestureAt(page, 'five', 6, 7); // Sol, a mitad del compás
    assert.match(await page.getAttribute('.chord', 'class'), /pending/, 'el acorde se ve en espera');
    await page.waitForFunction(() => window.acordes.engine.log.at(-1).label === 'Sol', null, { timeout: 6000 });
    const { log, notes } = await engineLogs(page);
    const applied = log.at(-1);
    const barStart = Math.floor(req.unit) - Math.floor(req.pos);
    assert.equal(applied.unit, barStart + 16, 'entra en el compás siguiente');
    assert.ok(!notes.some((n) => n.kind === 'replace'), 'no se corrige nada: espera');
    await page.waitForFunction(() => !document.querySelector('.chord').classList.contains('pending'), null, { timeout: 3000 });
    assert.deepEqual(app.errors, []);
  } finally {
    await app.close();
  }
});

test('reiniciar el patrón: al cambiar de acorde el patrón vuelve a empezar', async () => {
  const app = await openApp();
  try {
    const { page } = app;
    await settingsDo(page, async () => {
      await page.click('[data-restart="true"]');
      await page.fill('#bpmRange', '60');
    });
    await page.click('[data-quick-mode="rhythm"]');
    await page.click('#legend button[data-gesture="one"]');
    await page.click('#rightLegend button[data-gesture="four"]'); // arpegio
    await page.waitForTimeout(500);
    const req = await gestureAt(page, 'two', 6.2, 6.8);
    await page.waitForTimeout(700);
    const { notes } = await engineLogs(page);
    const restart = notes.find((n) => n.unit > req.unit && n.step === 0);
    assert.ok(restart, 'hay un paso 0 tras el cambio');
    assert.ok(restart.unit - req.unit <= 2, `el patrón empieza de nuevo enseguida (${restart.unit} vs ${req.unit})`);
    assert.deepEqual(restart.notes, [38], 'empieza con el bajo de Rem');
    assert.deepEqual(app.errors, []);
  } finally {
    await app.close();
  }
});

test('cuenta previa: un compás de clicks y el acorde entra en el siguiente', async () => {
  const app = await openApp();
  try {
    const { page } = app;
    await settingsDo(page, () => page.check('#countInCheck'));
    await page.evaluate(() => window.acordes.engine.start());
    await page.waitForTimeout(500);
    await page.click('#legend button[data-gesture="one"]');
    await page.waitForSelector('#countIn', { state: 'visible', timeout: 2000 });
    await page.screenshot({ path: path.join(SHOTS, 'cuenta-previa.png') });
    await page.waitForFunction(() => window.acordes.engine.log.some((e) => e.label === 'Do'), null, { timeout: 8000 });
    const { log, clicks } = await engineLogs(page);
    const countClicks = clicks.filter((c) => c.countIn);
    assert.equal(countClicks.length, 4, 'cuatro clicks en 4/4 aunque el metrónomo esté apagado');
    assert.equal(countClicks[0].step, 0);
    assert.equal(log.find((e) => e.label === 'Do').unit, countClicks[0].unit + 16, 'el acorde entra un compás después');
    assert.ok(!clicks.some((c) => !c.countIn), 'fuera de la cuenta no hay clicks (metrónomo apagado)');
    assert.ok(await page.isHidden('#countIn'));
    assert.deepEqual(app.errors, []);
  } finally {
    await app.close();
  }
});

test('la sección de tiempo cabe en tablet y móvil', async () => {
  for (const [name, viewport] of Object.entries({ 'tablet-horizontal': { width: 1270, height: 847 }, movil: { width: 390, height: 844 } })) {
    const app = await openApp({ viewport });
    try {
      const { page } = app;
      await page.click('#settingsBtn');
      await page.locator('#meterSelect').scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(SHOTS, `tiempo-${name}.png`) });
      const overflow = await page.evaluate(() => {
        const d = document.querySelector('#settingsDialog');
        return d.scrollWidth > d.clientWidth + 1 || document.documentElement.scrollWidth > window.innerWidth;
      });
      assert.equal(overflow, false, `${name}: se sale por los lados`);
      await page.click('#settingsDialog .dialog-head button');
      const headerOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      assert.equal(headerOverflow, false, `${name}: la cabecera se sale`);
      assert.deepEqual(app.errors, []);
    } finally {
      await app.close();
    }
  }
});
