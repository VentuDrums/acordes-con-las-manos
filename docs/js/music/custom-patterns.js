// Patrones propios (editor de patrones): rejilla editable → eventos del motor de sonido.
//
// Un patrón propio es { id, name, meter, dynamics, legato, subdivisions, cells }:
// - subdivisions: casillas de cada pulso (1, 2, 3, 4 o 6).
// - cells: { fila: { unidad: nivel } }. La unidad es la posición en el compás en doceavos de pulso
//   (ver timing.js); el nivel, 1 (suave), 2 (media) o 3 (fuerte).
// - dynamics: si es false, todas las notas suenan con la misma intensidad.
// - legato: cada nota dura hasta la siguiente de su fila; si no, picado (media casilla).
import { PATTERNS, registerPatterns } from './patterns.js';
import { METERS, PPQ, unitsPerQuarter } from './timing.js';

const STORAGE_KEY = 'acordes-con-las-manos:patrones-v2';
// Formato de la fase 5 (rejilla fija). No se modifica: así la versión anterior de la app sigue
// encontrando los patrones que tenía.
const STORAGE_KEY_V1 = 'acordes-con-las-manos:patrones';
const MAX_PATTERNS = 60;
const MAX_NAME = 40;
export const LEVEL_VELOCITY = { 1: 0.4, 2: 0.65, 3: 0.9 };
const FLAT_VELOCITY = 0.7;
export const SUBDIVISIONS = [1, 2, 3, 4, 6];

// Filas de la rejilla, en orden. El id es también el evento del motor (ver patterns.js), salvo las
// notas del acorde, que son números.
const degreeRows = (prefix, group) => [1, 2, 3, 4, 5, 6, 7].map((n) => ({ id: `${prefix}${n}`, group }));
export const ROWS = [
  { id: 'C', group: 'chord' },
  { id: 'P', group: 'chord' },
  ...[0, 1, 2, 3, 4].map((n) => ({ id: String(n), group: 'arp' })),
  { id: 'B', group: 'bass' },
  ...degreeRows('m', 'scale'),
  ...degreeRows('l', 'scaleLow'),
];
const ROW_IDS = ROWS.map((r) => r.id);
const rowEvent = (rowId) => (/^\d$/.test(rowId) ? Number(rowId) : rowId);

// Subdivisión por defecto: la rejilla de los patrones de fábrica (semicorcheas o corcheas).
export const defaultSubdivision = (meter) => METERS[meter].grid;
const cellUnits = (sub) => METERS['4/4'].beat / sub;

// Posiciones (unidades) de las casillas de cada pulso.
export function cellPositions(pattern) {
  const { beat } = METERS[pattern.meter];
  return pattern.subdivisions.flatMap((sub, b) => Array.from({ length: sub }, (_, i) => b * beat + i * cellUnits(sub)));
}

// Convierte un patrón propio en el formato del motor: { meter, name, custom, events }.
export function compile(pattern) {
  const { steps, beat } = METERS[pattern.meter];
  const ticksPerUnit = PPQ / unitsPerQuarter(pattern.meter);
  const events = {};
  for (const rowId of ROW_IDS) {
    const row = pattern.cells[rowId];
    if (!row) continue;
    const on = Object.keys(row).map(Number).sort((a, b) => a - b);
    on.forEach((unit, i) => {
      const next = on[(i + 1) % on.length];
      const gap = (next - unit + steps) % steps || steps;
      const units = pattern.legato ? gap : cellUnits(pattern.subdivisions[Math.floor(unit / beat)]) / 2;
      const velocity = pattern.dynamics ? LEVEL_VELOCITY[row[unit]] : FLAT_VELOCITY;
      (events[unit] ??= []).push([rowEvent(rowId), `${Math.round(units * ticksPerUnit)}i`, velocity]);
    });
  }
  return { meter: pattern.meter, name: pattern.name, custom: true, events };
}

// Cambia la subdivisión de un pulso: cada nota del pulso pasa a la casilla más cercana de la nueva
// subdivisión (si dos coinciden, se queda la más fuerte).
export function setSubdivision(pattern, beatIndex, sub) {
  const { beat } = METERS[pattern.meter];
  const size = cellUnits(sub);
  const start = beatIndex * beat;
  for (const row of Object.values(pattern.cells)) {
    for (const unit of Object.keys(row).map(Number)) {
      if (unit < start || unit >= start + beat) continue;
      const level = row[unit];
      delete row[unit];
      const moved = Math.min(start + Math.round((unit - start) / size) * size, start + beat - size);
      row[moved] = Math.max(row[moved] ?? 0, level);
    }
  }
  pattern.subdivisions[beatIndex] = sub;
}

const levelOf = (velocity) => (velocity < 0.5 ? 1 : velocity < 0.75 ? 2 : 3);

// Fila del editor para un evento de un patrón de fábrica. Las notas del bajo pasan a los grados de la
// escala en el bajo: 3ª y 5ª siguen al acorde; 6ª y 7ª son las de la escala.
function rowForEvent(what) {
  if (typeof what === 'number') return String(Math.min(what, 4));
  if (what === 'T') return 'l3';
  if (what === 'F' || what === 'x7') return 'l5';
  if (what === 'x9') return 'l6';
  if (what === 'x10' || what === 'x11') return 'l7';
  return what;
}

// Copia editable de un patrón (de fábrica o propio).
export function toEditable(id, name) {
  const source = PATTERNS[id];
  const meter = source.meter ?? '4/4';
  const cells = {};
  for (const [unit, events] of Object.entries(source.events)) {
    for (const [what, , velocity] of events) {
      const row = rowForEvent(what);
      (cells[row] ??= {})[unit] = Math.max(cells[row]?.[unit] ?? 0, levelOf(velocity));
    }
  }
  const subdivisions = Array.from({ length: METERS[meter].beats }, () => defaultSubdivision(meter));
  // Un patrón propio conserva su subdivisión.
  const own = source.custom ? source.subdivisions : null;
  return { id: newId(), name, meter, dynamics: true, legato: true, subdivisions: own ? [...own] : subdivisions, cells };
}

export function emptyPattern(meter, name) {
  const subdivisions = Array.from({ length: METERS[meter].beats }, () => defaultSubdivision(meter));
  return { id: newId(), name, meter, dynamics: false, legato: false, subdivisions, cells: {} };
}

export function newId() {
  return `u${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

// Patrón del formato de la fase 5 (rejilla fija de semicorcheas o corcheas, notas extra con registro)
// al formato actual.
export function migrateV1(p) {
  if (!p || typeof p !== 'object' || !Object.hasOwn(METERS, p.meter)) return null;
  const m = METERS[p.meter];
  const factor = m.beat / m.grid;
  const extra = { e2: 2, e5: 4, e9: 6, e10: 7, e11: 7 };
  const cells = {};
  for (const [row, steps] of Object.entries(p.cells ?? {})) {
    let target = row;
    if (row === 'T') target = 'l3';
    else if (row === 'F') target = 'l5';
    else if (extra[row]) target = `${p.registers?.[row] === 'mid' ? 'm' : 'l'}${extra[row]}`;
    for (const [step, level] of Object.entries(steps ?? {})) {
      (cells[target] ??= {})[Number(step) * factor] = Math.max(cells[target]?.[Number(step) * factor] ?? 0, level);
    }
  }
  return { ...p, subdivisions: Array.from({ length: m.beats }, () => m.grid), cells };
}

// Valida los patrones guardados: descarta lo que no encaje (casillas fuera de su subdivisión,
// filas o niveles raros…).
export function sanitizePatterns(saved) {
  if (!Array.isArray(saved)) return [];
  const out = [];
  for (const p of saved.slice(0, MAX_PATTERNS)) {
    if (!p || typeof p !== 'object' || !/^u[a-z0-9]+$/.test(p.id) || !Object.hasOwn(METERS, p.meter)) continue;
    const { beats } = METERS[p.meter];
    const subdivisions = Array.from({ length: beats }, (_, b) => (SUBDIVISIONS.includes(p.subdivisions?.[b])
      ? p.subdivisions[b] : defaultSubdivision(p.meter)));
    const valid = new Set(cellPositions({ meter: p.meter, subdivisions }));
    const cells = {};
    for (const rowId of ROW_IDS) {
      const row = p.cells?.[rowId];
      if (!row || typeof row !== 'object') continue;
      const clean = Object.fromEntries(Object.entries(row)
        .filter(([unit, level]) => valid.has(Number(unit)) && [1, 2, 3].includes(level))
        .map(([unit, level]) => [Number(unit), level]));
      if (Object.keys(clean).length) cells[rowId] = clean;
    }
    out.push({
      id: p.id,
      name: String(p.name ?? '').slice(0, MAX_NAME).trim() || p.id,
      meter: p.meter,
      dynamics: p.dynamics === true,
      legato: p.legato === true,
      subdivisions,
      cells,
    });
  }
  return out;
}

// Registra los patrones propios en el motor (y quita los que ya no existen).
export function applyPatterns(list) {
  registerPatterns(Object.fromEntries(list.map((p) => [p.id, { ...compile(p), subdivisions: p.subdivisions }])));
}

export function loadPatterns() {
  let list = [];
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== null) list = sanitizePatterns(JSON.parse(saved));
    else list = sanitizePatterns((JSON.parse(localStorage.getItem(STORAGE_KEY_V1)) ?? []).map(migrateV1));
  } catch { /* sin almacenamiento o datos dañados: sin patrones propios */ }
  applyPatterns(list);
  return list;
}

export function savePatterns(list) {
  applyPatterns(list);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch { /* sin almacenamiento disponible: duran lo que dure la página */ }
}

// Nombre para mostrar: el propio o el de fábrica traducido.
export function patternLabel(id, t) {
  return PATTERNS[id]?.custom ? PATTERNS[id].name : t(`pattern_${id}`);
}
