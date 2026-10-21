// Fase 5 en Chromium: editor de patrones.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { openApp, CACHE } from './helpers.js';

const SHOTS = path.join(CACHE, 'screens');
fs.mkdirSync(SHOTS, { recursive: true });

const openEditor = async (page) => {
  await page.click('#settingsBtn');
  await page.click('#openEditorBtn');
};
const cell = (row, step) => `#edGrid button[data-row="${row}"][data-step="${step}"]`;

test('nuevo patrón: se dibuja en la rejilla, se asigna a un gesto, suena y se guarda', async () => {
  const app = await openApp();
  try {
    const { page } = app;
    await openEditor(page);
    assert.ok(await page.isVisible('#edReadonlyHint'), 'un patrón de fábrica no se puede editar');
    assert.ok(await page.isDisabled(cell('C', 0)));

    await page.click('#edNew');
    assert.ok(await page.isHidden('#edReadonlyHint'));
    await page.fill('#edName', 'Mi groove');
    await page.click(cell('B', 0)); // justo después de escribir el nombre: el clic no se debe perder
    assert.match(await page.getAttribute(cell('B', 0), 'class'), /level-2/);
    for (const s of [4, 8, 12]) await page.click(cell('C', s));
    await page.click('[data-ed-legato="true"]');
    assert.match(await page.getAttribute(cell('C', 4), 'class'), /level-2/);
    assert.match(await page.textContent('#edPattern'), /★ Mi groove/);
    await page.screenshot({ path: path.join(SHOTS, 'editor.png') });
    await page.click('#editorDialog .dialog-head button');

    // Asignarlo al gesto ☝️ del modo ritmo.
    await page.click('#settingsBtn');
    await page.click('[data-right-mode="rhythm"]');
    await page.selectOption('select[data-right-map="one"]', { label: 'Mi groove' });
    await page.click('#settingsDialog .dialog-head button');
    assert.equal(await page.textContent('#rightLegend button[data-gesture="one"] .what'), 'Mi groove');

    await page.click('#legend button[data-gesture="one"]'); // Do
    await page.click('#rightLegend button[data-gesture="one"]');
    await page.waitForTimeout(4500); // un compás completo a 90 ppm dura 2,7 s
    const notes = await page.evaluate(() => window.acordes.engine.noteLog.filter((n) => n.kind === 'note'));
    const byStep = Object.fromEntries(notes.map((n) => [n.step, n.notes]));
    assert.deepEqual(byStep, { 0: [36], 4: [48, 52, 55], 8: [48, 52, 55], 12: [48, 52, 55] });

    await page.reload();
    assert.equal(await page.textContent('#rightLegend button[data-gesture="one"] .what'), 'Mi groove', 'se guarda');
    assert.deepEqual(app.errors, []);
  } finally {
    await app.close();
  }
});

test('duplicar uno de fábrica, intensidades con clics sucesivos y registro de las notas extra', async () => {
  const app = await openApp();
  try {
    const { page } = app;
    await openEditor(page);
    await page.selectOption('#edPattern', 'pop');
    await page.click('#edDuplicate');
    assert.match(await page.inputValue('#edName'), /Rasgueo pop \(copia\)/);
    assert.match(await page.getAttribute(cell('B', 0), 'class'), /level-3/, 'el bajo del 1 fuerte, como en el original');

    // Con intensidades: apagada → media → fuerte → suave → apagada.
    const levels = [];
    for (let i = 0; i < 4; i++) {
      await page.click(cell('e9', 2));
      levels.push((await page.getAttribute(cell('e9', 2), 'class')).match(/level-(\d)/)[1]);
    }
    assert.deepEqual(levels, ['2', '3', '1', '0']);

    await page.click('#edGrid [data-register="e9"]');
    assert.equal((await page.textContent('#edGrid [data-register="e9"]')).trim(), 'Medio');

    // Escuchar con Dom: suena la tercera menor (Mi♭3).
    await page.click(cell('2', 1)); // Nota 3 en el paso 2: activa algo más
    await page.selectOption('#edChord', 'min');
    await page.click('#edPlay');
    assert.equal((await page.textContent('#edPlay')).trim(), '⏹ Parar');
    await page.waitForTimeout(2500);
    const heard = await page.evaluate(() => window.acordes.engine.noteLog.flatMap((n) => n.notes));
    assert.ok(heard.includes(51), `debía sonar Mi♭3: ${heard}`);
    await page.click('#edPlay');
    assert.equal(await page.evaluate(() => window.acordes.engine.voicing), null, 'al parar vuelve el silencio de las manos');
    assert.deepEqual(app.errors, []);
  } finally {
    await app.close();
  }
});

test('borrar un patrón asignado: el gesto vuelve al bloque sostenido', async () => {
  const app = await openApp();
  try {
    const { page } = app;
    await openEditor(page);
    await page.click('#edNew');
    await page.fill('#edName', 'Para borrar');
    await page.click(cell('B', 0));
    await page.click('#editorDialog .dialog-head button');
    await page.click('#settingsBtn');
    await page.click('[data-right-mode="rhythm"]');
    await page.selectOption('select[data-right-map="two"]', { label: 'Para borrar' });
    await page.click('#openEditorBtn');
    await page.selectOption('#edPattern', { label: '★ Para borrar' });
    await page.click('#edDelete');
    assert.doesNotMatch(await page.textContent('#edPattern'), /Para borrar/);
    await page.click('#editorDialog .dialog-head button');
    assert.equal(await page.textContent('#rightLegend button[data-gesture="two"] .what'), 'Bloque sostenido');
    assert.deepEqual(app.errors, []);
  } finally {
    await app.close();
  }
});

test('nombres con caracteres especiales no rompen la página', async () => {
  const app = await openApp();
  try {
    const { page } = app;
    await openEditor(page);
    await page.click('#edNew');
    await page.fill('#edName', '<b>Groove</b> & "más"');
    await page.click('#editorDialog .dialog-head button');
    await page.click('#settingsBtn');
    await page.click('[data-right-mode="rhythm"]');
    await page.selectOption('select[data-right-map="three"]', { label: '<b>Groove</b> & "más"' });
    await page.click('#settingsDialog .dialog-head button');
    assert.equal(await page.textContent('#rightLegend button[data-gesture="three"] .what'), '<b>Groove</b> & "más"');
    assert.equal(await page.locator('#rightLegend b').count(), 0, 'el nombre se muestra como texto');
    assert.deepEqual(app.errors, []);
  } finally {
    await app.close();
  }
});

test('el editor cabe en tablet y móvil (la rejilla se desplaza dentro de su caja)', async () => {
  for (const [name, viewport] of Object.entries({ 'tablet-horizontal': { width: 1270, height: 847 }, movil: { width: 390, height: 844 } })) {
    const app = await openApp({ viewport });
    try {
      const { page } = app;
      await openEditor(page);
      await page.click('#edNew');
      await page.screenshot({ path: path.join(SHOTS, `editor-${name}.png`) });
      const overflow = await page.evaluate(() => {
        const d = document.querySelector('#editorDialog');
        return d.scrollWidth > d.clientWidth + 1 || document.documentElement.scrollWidth > window.innerWidth;
      });
      assert.equal(overflow, false, `${name}: el editor se sale por los lados`);
      assert.deepEqual(app.errors, []);
    } finally {
      await app.close();
    }
  }
});
