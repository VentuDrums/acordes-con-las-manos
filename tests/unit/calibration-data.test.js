// Calibración real del usuario (las dos manos, 9 gestos): el reconocimiento no debe empeorar.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fingerStates, classify } from '../../docs/js/hands/gestures.js';

const data = JSON.parse(fs.readFileSync(new URL('../fixtures/calibracion-pc-2026-10-21.json', import.meta.url)));
const toPoints = (world) => world.map(([x, y, z]) => ({ x, y, z }));

test('calibración del PC: al menos el 99,5 % bien y cada gesto de cada mano al 97 %', () => {
  const groups = {};
  for (const s of data.samples) {
    const key = `${s.hand}/${s.expected}`;
    const g = (groups[key] ??= { ok: 0, total: 0 });
    g.total++;
    if (classify(fingerStates(toPoints(s.world))) === s.expected) g.ok++;
  }
  const ok = Object.values(groups).reduce((a, g) => a + g.ok, 0);
  assert.equal(Object.keys(groups).length, 18, 'deben estar los 9 gestos de las dos manos');
  assert.ok(ok / data.samples.length >= 0.995, `${ok}/${data.samples.length}`);
  for (const [key, g] of Object.entries(groups)) assert.ok(g.ok / g.total >= 0.97, `${key}: ${g.ok}/${g.total}`);
});
