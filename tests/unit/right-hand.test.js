import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VolumeFader, palmY, FADER_TRAVEL } from '../../docs/js/hands/fader.js';
import { rightAction } from '../../docs/js/music/right-hand.js';
import { sanitize } from '../../docs/js/settings.js';

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
});

test('ajustes de la mano derecha: valores no válidos vuelven a los de por defecto', () => {
  const s = sanitize({ rightMode: 'x', inversion: 'inv2', pattern: 'nope', bpm: 500, volume: 0.3, patMap: { one: 'pop', two: 'x' } });
  assert.equal(s.rightMode, 'inversion');
  assert.equal(s.inversion, 'inv2');
  assert.equal(s.pattern, 'block');
  assert.equal(s.bpm, 90);
  assert.equal(s.volume, 0.3);
  assert.equal(s.patMap.one, 'pop');
  assert.equal(s.patMap.two, 'quarters');
});
