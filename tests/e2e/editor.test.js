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
// Casilla por fila y posición en unidades del reloj (en 4/4: negra = 12, semicorchea = 3).
const cell = (row, unit) => `#edGrid button[data-row="${row}"][data-unit="${unit}"]`;

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
    assert.match(await page.getAttribute(cell('B', 0), 'class'), /\bon\b/);
    for (const u of [12, 24, 36]) await page.click(cell('C', u));
    await page.click('[data-ed-legato="true"]');
    assert.match(await page.getAttribute(cell('C', 12), 'class'), /\bon\b/);
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
    assert.deepEqual(byStep, { 0: [36], 12: [48, 52, 55], 24: [48, 52, 55], 36: [48, 52, 55] }, 'en unidades: una negra = 12');

    await page.reload();
    assert.equal(await page.textContent('#rightLegend button[data-gesture="one"] .what'), 'Mi groove', 'se guarda');
    assert.deepEqual(app.errors, []);
  } finally {
    await app.close();
  }
});

test('duplicar uno de fábrica, pintar y borrar con el pincel y escuchar con Dom', async () => {
  const app = await openApp();
  try {
    const { page } = app;
    await openEditor(page);
    await page.selectOption('#edPattern', 'pop');
    await page.click('#edDuplicate');
    assert.match(await page.inputValue('#edName'), /Rasgueo pop \(copia\)/);
    assert.match(await page.getAttribute(cell('B', 0), 'class'), /\bon\b/, 'el bajo del 1, como en el original');
    assert.equal(await page.locator('[data-ed-dynamics]').count(), 0, 'ya no hay intensidades');

    // Pincel con el ratón: se pulsa una casilla vacía y se arrastra en diagonal por otras filas.
    const center = async (sel) => {
      const b = await page.locator(sel).boundingBox();
      return [b.x + b.width / 2, b.y + b.height / 2];
    };
    const drag = async (cells) => {
      await page.locator(cells[0]).scrollIntoViewIfNeeded();
      const points = await Promise.all(cells.map(center));
      await page.mouse.move(...points[0]);
      await page.mouse.down();
      for (const p of points.slice(1)) await page.mouse.move(...p, { steps: 4 });
      await page.mouse.up();
    };
    const isOn = async (row, unit) => /\bon\b/.test(await page.getAttribute(cell(row, unit), 'class'));
    assert.equal(await isOn('l6', 3), false);
    await drag([cell('l6', 3), cell('l6', 6), cell('l6', 9), cell('l7', 9)]);
    for (const [r, u] of [['l6', 3], ['l6', 6], ['l6', 9], ['l7', 9]]) assert.ok(await isOn(r, u), `pintada ${r}@${u}`);
    // Empezando en una casilla llena, el pincel borra (aunque pase por casillas vacías, no las pinta).
    await drag([cell('l6', 6), cell('l6', 9), cell('l6', 15)]);
    assert.equal(await isOn('l6', 6), false);
    assert.equal(await isOn('l6', 9), false);
    assert.equal(await isOn('l6', 15), false);
    assert.ok(await isOn('l6', 3), 'la casilla anterior sigue pintada');
    // Se guarda al momento.
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('acordes-con-las-manos:patrones-v2')).at(-1).cells);
    assert.deepEqual(saved.l6, { 3: 1 });
    assert.deepEqual(saved.l7, { 9: 1 });

    // Con el dedo: el navegador manda los movimientos a la primera casilla; aun así pinta las de debajo.
    await page.locator(cell('m2', 0)).scrollIntoViewIfNeeded();
    await page.evaluate(([a, b]) => {
      const fire = (type, el, target = el) => {
        const r = el.getBoundingClientRect();
        target.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerType: 'touch', isPrimary: true, button: type === 'pointermove' ? -1 : 0,
          clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }));
      };
      const first = document.querySelector(a);
      fire('pointerdown', first);
      fire('pointermove', document.querySelector(b), first);
      fire('pointerup', document.querySelector(b), first);
    }, [cell('m2', 0), cell('m2', 3)]);
    assert.ok(await isOn('m2', 0));
    assert.ok(await isOn('m2', 3));

    // Escuchar con Dom: suena la tercera menor (Mi♭3).
    await page.click(cell('m3', 3)); // 3ª de la escala (sigue al acorde) en la 2ª semicorchea
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

test('al editar mientras suena, sigue sonando el patrón que se edita (con el cambio)', async () => {
  const app = await openApp();
  try {
    const { page } = app;
    await openEditor(page);
    await page.click('#edNew');
    await page.click(cell('B', 0));
    const id = await page.inputValue('#edPattern');
    await page.click('#edPlay');
    await page.waitForTimeout(500);
    await page.click(cell('C', 24)); // cambio mientras suena
    assert.equal(await page.evaluate(() => window.acordes.engine.pattern), id, 'el patrón que suena no cambia');
    await page.waitForTimeout(3500);
    const heard = await page.evaluate(() => window.acordes.engine.noteLog.filter((n) => n.notes.length === 3).length);
    assert.ok(heard > 0, 'el acorde añadido se oye');
    assert.deepEqual(app.errors, []);
  } finally {
    await app.close();
  }
});

test('subdivisión por pulso: un tresillo en el 2º pulso suena en su sitio', async () => {
  const app = await openApp();
  try {
    const { page } = app;
    await openEditor(page);
    await page.click('#edNew');
    await page.selectOption('#edGrid select[data-subdiv="1"]', '3'); // pulso 2 en tresillo
    assert.equal(await page.locator('#edGrid tr.group-chord:not(.group-title)').first().locator('td').nth(1).locator('button').count(), 3);
    for (const u of [12, 16, 20]) await page.click(cell('B', u)); // las tres corcheas del tresillo
    await page.click(cell('C', 0));
    await page.click('#edPlay');
    await page.waitForTimeout(3500);
    const steps = await page.evaluate(() => [...new Set(window.acordes.engine.noteLog.map((n) => n.step))].sort((a, b) => a - b));
    assert.deepEqual(steps, [0, 12, 16, 20], 'tresillo: unidades 12, 16 y 20');
    await page.click('#edPlay');
    // Cambiar la subdivisión con notas: van a la casilla más cercana.
    await page.selectOption('#edGrid select[data-subdiv="1"]', '2');
    assert.match(await page.getAttribute(cell('B', 12), 'class'), /\bon\b/);
    assert.match(await page.getAttribute(cell('B', 18), 'class'), /\bon\b/);
    await page.screenshot({ path: path.join(SHOTS, 'editor-subdivisiones.png') });
    assert.deepEqual(app.errors, []);
  } finally {
    await app.close();
  }
});

test('notas de la escala: se cuentan desde el acorde en la tonalidad elegida', async () => {
  const app = await openApp();
  try {
    const { page } = app;
    await openEditor(page);
    await page.click('#edNew');
    await page.click(cell('m2', 0)); // 2ª de la escala, registro de las notas
    await page.click(cell('l7', 24)); // 7ª de la escala en el bajo
    await page.click('#edPlay'); // con Do, en Do mayor
    await page.waitForTimeout(3500);
    const heard = await page.evaluate(() => [...new Set(window.acordes.engine.noteLog.flatMap((n) => n.notes))].sort());
    assert.deepEqual(heard, [47, 50], 'Re3 y Si2');
    await page.selectOption('#edChord', '7');
    await page.waitForTimeout(3000);
    const with7 = await page.evaluate(() => window.acordes.engine.noteLog.slice(-2).flatMap((n) => n.notes));
    assert.ok(with7.includes(46), `con Do7 la 7ª es Si♭2: ${with7}`);
    assert.deepEqual(app.errors, []);
  } finally {
    await app.close();
  }
});

test('los patrones de la versión anterior aparecen convertidos y el original no se toca', async () => {
  const app = await openApp();
  try {
    const { page } = app;
    const v1 = JSON.stringify([{ id: 'uviejo1', name: 'Viejo', meter: '4/4', dynamics: false, legato: false,
      cells: { B: { 0: 2 }, C: { 4: 2 }, e9: { 8: 2 } }, registers: { e9: 'mid' } }]);
    await page.evaluate((data) => localStorage.setItem('acordes-con-las-manos:patrones', data), v1);
    await page.reload();
    await openEditor(page);
    await page.selectOption('#edPattern', { label: '★ Viejo' });
    assert.match(await page.getAttribute(cell('B', 0), 'class'), /\bon\b/);
    assert.match(await page.getAttribute(cell('C', 12), 'class'), /\bon\b/);
    assert.match(await page.getAttribute(cell('m6', 24), 'class'), /\bon\b/, '6ª en registro medio → escala 6ª');
    await page.click(cell('C', 36)); // un cambio: se guarda en el formato nuevo
    const stored = await page.evaluate(() => ({
      v1: localStorage.getItem('acordes-con-las-manos:patrones'),
      v2: JSON.parse(localStorage.getItem('acordes-con-las-manos:patrones-v2')),
    }));
    assert.equal(stored.v1, v1, 'el formato anterior queda intacto para poder volver atrás');
    assert.equal(stored.v2[0].name, 'Viejo');
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
