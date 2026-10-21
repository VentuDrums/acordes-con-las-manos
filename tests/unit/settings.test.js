import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitize, DEFAULTS } from '../../docs/js/settings.js';
import { chordForGesture, describe, customFromScale } from '../../docs/js/music/left-hand.js';

test('sin nada guardado se usan los valores por defecto', () => {
  const s = sanitize(null);
  assert.equal(s.leftMode, 'scale');
  assert.equal(s.tonic, 0);
  assert.equal(s.scale, 'major');
  assert.deepEqual(s.custom, DEFAULTS.custom);
  assert.equal(s.swapHands, false);
});

test('los valores no válidos se sustituyen y los válidos se conservan', () => {
  const s = sanitize({
    leftMode: 'otro', tonic: 14, scale: 'dorian', sevenths: 'sí', swapHands: true,
    custom: { one: { root: 2, quality: 'm7' }, two: { root: 3, quality: 'raro' }, extra: 1 },
  });
  assert.equal(s.leftMode, 'scale');
  assert.equal(s.tonic, 0);
  assert.equal(s.scale, 'dorian');
  assert.equal(s.sevenths, false);
  assert.equal(s.swapHands, true);
  assert.deepEqual(s.custom.one, { root: 2, quality: 'm7' });
  assert.deepEqual(s.custom.two, DEFAULTS.custom.two);
  assert.equal(s.custom.extra, undefined);
});

test('modo escala: cada gesto toca su grado; el pulgar no toca nada', () => {
  const s = sanitize({ tonic: 2, scale: 'dorian' });
  const d = (g) => describe(s, chordForGesture(s, g));
  assert.deepEqual(d('one'), { name: 'Rem', degree: 'i' });
  assert.deepEqual(d('four'), { name: 'Sol', degree: 'IV' });
  assert.deepEqual(d('rock'), { name: 'Do', degree: 'VII' });
  assert.equal(chordForGesture(s, 'thumb'), null);
  assert.equal(chordForGesture(s, 'fist'), null);
});

test('modo personalizado: cada gesto toca su acorde y no se muestra grado', () => {
  const s = sanitize({ leftMode: 'custom', custom: { thumb: { root: 1, quality: 'maj7' } } });
  assert.deepEqual(describe(s, chordForGesture(s, 'thumb')), { name: 'Re♭maj7', degree: '' });
  assert.deepEqual(describe(s, chordForGesture(s, 'rock')), { name: 'Sol7', degree: '' });
});

test('grafía: notas de la escala como en la tonalidad; las demás, las habituales', () => {
  const s = sanitize({ leftMode: 'custom', tonic: 9, scale: 'harmonicMinor', custom: {
    one: { root: 8, quality: 'dim' }, two: { root: 1, quality: 'maj' }, three: { root: 10, quality: 'maj' },
  } });
  assert.equal(describe(s, chordForGesture(s, 'one')).name, 'Sol♯°');
  assert.equal(describe(s, chordForGesture(s, 'two')).name, 'Re♭');
  assert.equal(describe(s, chordForGesture(s, 'three')).name, 'Si♭');
});

test('rellenar el modo personalizado con la escala conserva el pulgar', () => {
  const s = sanitize({ tonic: 7, scale: 'major', sevenths: true });
  const custom = customFromScale(s);
  assert.deepEqual(custom.one, { root: 7, quality: 'maj7' });
  assert.deepEqual(custom.five, { root: 2, quality: '7' });
  assert.deepEqual(custom.thumb, DEFAULTS.custom.thumb);
});
