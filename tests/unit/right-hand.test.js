import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VolumeFader, palmY, FADER_TRAVEL } from '../../docs/js/hands/fader.js';
import { rightAction } from '../../docs/js/music/right-hand.js';
import { sanitize } from '../../docs/js/settings.js';
import { patternsFor } from '../../docs/js/music/patterns.js';

test('fader: cerrar el puño agarra sin cambiar el volumen', () => {
  const f = new VolumeFader(0.5);
  assert.equal(f.update('fist', 0.6), false);
  assert.equal(f.grabbing, true);
  assert.equal(f.volume, 0.5);
});

test('fader: subir la mano sube el volumen y bajarla lo baja, sin pasar de 0 a 1', () => {
  const f = new VolumeFader(0.5);
  f.update('fist', 0.6);
  f.update('fist', 0.6 - FADER_TRAVEL / 4);
  assert.ok(Math.abs(f.volume - 0.75) < 1e-9);
  f.update('fist', 0.0);
  assert.equal(f.volume, 1);
  f.update('fist', 1.0);
  assert.equal(f.volume, 0);
});

test('fader: al abrir la mano el volumen se queda y al volver a agarrar no salta', () => {
  const f = new VolumeFader(0.5);
  f.update('fist', 0.6);
  f.update('fist', 0.5); // +0,2
  f.update('five', 0.9);
  assert.equal(f.grabbing, false);
  assert.ok(Math.abs(f.volume - 0.7) < 1e-9);
  f.update('fist', 0.9); // agarra más abajo: no salta
  assert.ok(Math.abs(f.volume - 0.7) < 1e-9);
  f.update('fist', null); // la mano sale de la cámara
  assert.equal(f.grabbing, false);
  assert.ok(Math.abs(f.volume - 0.7) < 1e-9);
});

test('altura de la palma: punto medio entre muñeca y base del corazón', () => {
  const lm = new Array(21).fill({ x: 0, y: 0 });
  lm[0] = { x: 0, y: 0.8 };
  lm[9] = { x: 0, y: 0.6 };
  assert.ok(Math.abs(palmY(lm) - 0.7) < 1e-9);
});

test('mano derecha: en modo inversión cada gesto elige inversión; en modo ritmo, patrón', () => {
  const s = sanitize({});
  assert.deepEqual(rightAction(s, 'two'), { setting: 'inversion', value: 'inv1' });
  assert.equal(rightAction(s, 'fist'), null);
  s.rightMode = 'rhythm';
  assert.deepEqual(rightAction(s, 'four'), { setting: 'pattern', value: 'arpUp' });
  s.meter = '6/8';
  assert.deepEqual(rightAction(s, 'two'), { setting: 'pattern', value: 'pulses68' }, 'usa la tabla del compás elegido');
});

test('ajustes de la mano derecha: valores no válidos vuelven a los de por defecto', () => {
  const s = sanitize({ rightMode: 'x', inversion: 'inv2', bpm: 500, volume: 0.3,
    patternByMeter: { '4/4': 'nope', '3/4': 'waltz34', '6/8': 'pop' }, patMaps: { '4/4': { one: 'pop', two: 'x' } } });
  assert.equal(s.rightMode, 'inversion');
  assert.equal(s.inversion, 'inv2');
  assert.equal(s.patternByMeter['4/4'], 'block');
  assert.equal(s.patternByMeter['3/4'], 'waltz34');
  assert.equal(s.patternByMeter['6/8'], 'block', 'un patrón de 4/4 no vale en 6/8');
  assert.equal(s.bpm, 90);
  assert.equal(s.volume, 0.3);
  assert.equal(s.patMaps['4/4'].one, 'pop');
  assert.equal(s.patMaps['4/4'].two, 'quarters');
});

test('ajustes de la fase 3 (una sola tabla de patrones) pasan al 4/4 sin perderse', () => {
  const s = sanitize({ pattern: 'bossa', patMap: { one: 'rock8' } });
  assert.equal(s.patternByMeter['4/4'], 'bossa');
  assert.equal(s.patMaps['4/4'].one, 'rock8');
  assert.equal(s.meter, '4/4');
  assert.equal(s.changeMode, 'instant');
  assert.equal(s.metronome, false);
  assert.equal(s.countIn, false);
});

test('cada compás tiene una tabla gesto → patrón con patrones de ese compás', () => {
  const s = sanitize({});
  for (const [meter, map] of Object.entries(s.patMaps)) {
    for (const id of Object.values(map)) assert.ok(patternsFor(meter).includes(id), `${meter}: ${id}`);
  }
  assert.deepEqual(Object.values(s.patMaps['3/8']).slice(0, 3), ['block', 'waltz38', 'arp38']);
});
