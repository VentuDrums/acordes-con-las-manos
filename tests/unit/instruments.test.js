// Catálogo de instrumentos: archivos de muestras, nombres y parte (acorde o bajo) de cada evento.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { SOUNDS, BASS_SOUNDS, sampleSets } from '../../docs/js/audio/instruments.js';
import { partOf, PATTERNS } from '../../docs/js/music/patterns.js';
import { t } from '../../docs/js/i18n.js';

const AUDIO = new URL('../../docs/audio/', import.meta.url);

test('todas las muestras del catálogo existen y cada carpeta tiene sus créditos', () => {
  const sets = sampleSets();
  assert.deepEqual(Object.keys(sets).sort(),
    ['bass-electric', 'contrabass', 'guitar-acoustic', 'guitar-electric', 'harp', 'marimba', 'piano']);
  for (const [dir, notes] of Object.entries(sets)) {
    for (const n of notes) assert.ok(fs.existsSync(new URL(`${dir}/${n.replace('#', 's')}.mp3`, AUDIO)), `${dir}/${n}`);
    assert.ok(fs.existsSync(new URL(`${dir}/CREDITOS.md`, AUDIO)), `${dir}/CREDITOS.md`);
  }
});

test('las muestras cubren el registro que toca la app', () => {
  const midi = (n) => {
    const [, name, oct] = n.match(/^([A-G]#?)(\d)$/);
    return ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].indexOf(name) + 12 * (Number(oct) + 1);
  };
  // Acorde: del Do2 (bajo con «el mismo que el acorde») hacia arriba; bajo: Do2 a Si3.
  for (const [id, def] of Object.entries(SOUNDS)) {
    if (!def.samples) continue;
    const notes = def.samples.notes.map(midi);
    assert.ok(Math.min(...notes) <= 40, `${id}: le faltan graves`);
    assert.ok(Math.max(...notes) >= 72, `${id}: le faltan agudos`);
  }
  for (const [id, def] of Object.entries(BASS_SOUNDS)) {
    if (!def.samples) continue;
    const notes = def.samples.notes.map(midi);
    assert.ok(Math.min(...notes) <= 36 && Math.max(...notes) >= 57, `${id}: registro del bajo`);
  }
});

test('cada sonido tiene su nombre en la interfaz', () => {
  for (const id of [...Object.keys(SOUNDS), ...Object.keys(BASS_SOUNDS)]) {
    assert.notEqual(t(`sound_${id}`), `sound_${id}`, `falta sound_${id}`);
  }
});

test('parte de cada evento: bajo o acorde', () => {
  for (const what of ['B', 'F', 'T', 'x7', 'x10', 'l1', 'l7']) assert.equal(partOf(what), 'bass', what);
  for (const what of ['C', 'P', 0, 3, 'm1', 'm7']) assert.equal(partOf(what), 'chord', String(what));
  // Todos los eventos de los patrones de fábrica tienen una parte conocida.
  for (const p of Object.values(PATTERNS)) {
    for (const events of Object.values(p.events ?? {})) for (const [what] of events) assert.ok(['bass', 'chord'].includes(partOf(what)));
  }
});
