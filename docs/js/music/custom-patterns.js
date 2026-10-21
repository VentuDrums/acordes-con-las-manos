// Patrones propios (editor de patrones): rejilla editable → eventos del motor de sonido.
//
// Un patrón propio es { id, name, meter, dynamics, legato, cells, registers }:
// - cells: { fila: { paso: nivel } } con nivel 1 (suave), 2 (media) o 3 (fuerte).
// - registers: registro de cada fila de notas extra, 'low' (grave, como el bajo) o 'mid' (como el acorde).
// - dynamics: si es false, todas las notas suenan con la misma intensidad.
// - legato: cada nota dura hasta la siguiente de su fila; si no, picado (media casilla).
import { PATTERNS, registerPatterns } from './patterns.js';
import { METERS, unitsPerQuarter } from './timing.js';

const STORAGE_KEY = 'acordes-con-las-manos:patrones';
const MAX_PATTERNS = 60;
const MAX_NAME = 40;
// Pulsos por negra del reloj de Tone.js (Tone.Transport.PPQ por defecto).
export const PPQ = 192;
export const LEVEL_VELOCITY = { 1: 0.4, 2: 0.65, 3: 0.9 };
const FLAT_VELOCITY = 0.7;

// Filas de la rejilla, en orden. `what` es el evento del motor (ver patterns.js).
export const ROWS = [
  { id: 'C', group: 'chord' },
  { id: 'P', group: 'chord' },
  ...[0, 1, 2, 3, 4].map((n) => ({ id: String(n), group: 'arp' })),
  { id: 'B', group: 'bass' },
  { id: 'T', group: 'bass' },
  { id: 'F', group: 'bass' },
  ...[2, 5, 9, 10, 11].map((n) => ({ id: `e${n}`, group: 'extra', semitones: n })),
];
const ROW_IDS = ROWS.map((r) => r.id);

// Evento del motor para una fila (las notas extra dependen de su registro).
export function rowEvent(rowId, register = 'low') {
  const row = ROWS.find((r) => r.id === rowId);
  if (row.group === 'arp') return Number(rowId);
  if (row.group === 'extra') return `x${row.semitones + (register === 'mid' ? 12 : 0)}`;
  return rowId;
}

// Convierte un patrón propio en el formato del motor: { meter, name, custom, events }.
export function compile(pattern) {
  const { steps } = METERS[pattern.meter];
  const ticksPerUnit = PPQ / unitsPerQuarter(pattern.meter);
  const events = {};
  for (const rowId of ROW_IDS) {
    const row = pattern.cells[rowId];
    if (!row) continue;
    const on = Object.keys(row).map(Number).sort((a, b) => a - b);
    on.forEach((step, i) => {
      const next = on[(i + 1) % on.length];
      const gap = (next - step + steps) % steps || steps;
      const units = pattern.legato ? gap : 0.5;
      const velocity = pattern.dynamics ? LEVEL_VELOCITY[row[step]] : FLAT_VELOCITY;
      (events[step] ??= []).push([rowEvent(rowId, pattern.registers[rowId]), `${Math.round(units * ticksPerUnit)}i`, velocity]);
    });
  }
  return { meter: pattern.meter, name: pattern.name, custom: true, events };
}

const levelOf = (velocity) => (velocity < 0.5 ? 1 : velocity < 0.75 ? 2 : 3);

// Copia editable de un patrón (de fábrica o propio). Las notas de paso del boogie pasan a las filas
// equivalentes (5ª del bajo, 6ª y 7ª menor graves).
export function toEditable(id, name) {
  const source = PATTERNS[id];
  const cells = {};
  const registers = {};
  for (const [step, events] of Object.entries(source.events)) {
    for (const [what] of events) {
      let row;
      if (typeof what === 'number') row = String(Math.min(what, 4));
      else if (what === 'x7') row = 'F';
      else if (what[0] === 'x') {
        const n = Number(what.slice(1));
        row = `e${n % 12}`;
        registers[row] = n >= 12 ? 'mid' : 'low';
      } else row = what;
      const velocity = events.find(([w]) => w === what)[2];
      (cells[row] ??= {})[step] = levelOf(velocity);
    }
  }
  return { id: newId(), name, meter: source.meter ?? '4/4', dynamics: true, legato: true, cells, registers };
}

export function emptyPattern(meter, name) {
  return { id: newId(), name, meter, dynamics: false, legato: false, cells: {}, registers: {} };
}

export function newId() {
  return `u${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

// Valida los patrones guardados: descarta lo que no encaje (pasos fuera del compás, filas raras…).
export function sanitizePatterns(saved) {
  if (!Array.isArray(saved)) return [];
  const out = [];
  for (const p of saved.slice(0, MAX_PATTERNS)) {
    if (!p || typeof p !== 'object' || !/^u[a-z0-9]+$/.test(p.id) || !Object.hasOwn(METERS, p.meter)) continue;
    const { steps } = METERS[p.meter];
    const cells = {};
    for (const rowId of ROW_IDS) {
      const row = p.cells?.[rowId];
      if (!row || typeof row !== 'object') continue;
      const clean = Object.fromEntries(Object.entries(row)
        .filter(([step, level]) => Number.isInteger(Number(step)) && step >= 0 && step < steps && [1, 2, 3].includes(level)));
      if (Object.keys(clean).length) cells[rowId] = clean;
    }
    const registers = Object.fromEntries(ROWS.filter((r) => r.group === 'extra')
      .map((r) => [r.id, p.registers?.[r.id] === 'mid' ? 'mid' : 'low']));
    out.push({
      id: p.id,
      name: String(p.name ?? '').slice(0, MAX_NAME).trim() || p.id,
      meter: p.meter,
      dynamics: p.dynamics === true,
      legato: p.legato === true,
      cells,
      registers,
    });
  }
  return out;
}

// Registra los patrones propios en el motor (y quita los que ya no existen).
export function applyPatterns(list) {
  registerPatterns(Object.fromEntries(list.map((p) => [p.id, compile(p)])));
}

export function loadPatterns() {
  let list = [];
  try {
    list = sanitizePatterns(JSON.parse(localStorage.getItem(STORAGE_KEY)));
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
