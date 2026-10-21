// Editor de patrones: rejilla tipo step sequencer para crear patrones propios.
import { t } from '../i18n.js';
import { PATTERNS, patternsFor } from '../music/patterns.js';
import { METERS } from '../music/timing.js';
import { ROWS, toEditable, emptyPattern, savePatterns, patternLabel } from '../music/custom-patterns.js';

const $ = (sel) => document.querySelector(sel);
// Clics sucesivos en una casilla: apagada → media → fuerte → suave → apagada (con intensidades).
const NEXT_LEVEL = { 0: 2, 2: 3, 3: 1, 1: 0 };
const PREVIEW_CHORDS = {
  maj: { root: 0, quality: 'maj', name: 'Do' },
  min: { root: 0, quality: 'min', name: 'Dom' },
  '7': { root: 0, quality: '7', name: 'Do7' },
};

function options(entries, selected) {
  return entries
    .map(([value, label]) => `<option value="${value}"${String(value) === String(selected) ? ' selected' : ''}>${label}</option>`)
    .join('');
}
const escapeHtml = (text) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// settings y patterns se modifican aquí. onChange(): ajustes o patrones cambiados.
// preview(id, chord) empieza a sonar un patrón en bucle; stopPreview() para.
export function initPatternEditor({ settings, patterns, onChange, preview, stopPreview }) {
  const dialog = $('#editorDialog');
  let selected = null; // id del patrón que se ve en la rejilla
  let previewing = false;

  const custom = () => patterns.find((p) => p.id === selected) ?? null;

  function open() {
    if (!PATTERNS[selected] || (PATTERNS[selected].meter && PATTERNS[selected].meter !== settings.meter)) {
      selected = patternsFor(settings.meter).find((id) => !PATTERNS[id].sustain);
    }
    render();
    dialog.showModal();
  }

  function renderPatternList() {
    const ids = patternsFor(settings.meter).filter((id) => !PATTERNS[id].sustain);
    $('#edPattern').innerHTML = options(ids.map((id) => [id, `${PATTERNS[id].custom ? '★ ' : ''}${escapeHtml(patternLabel(id, t))}`]), selected);
  }

  function render() {
    $('#edMeter').innerHTML = options(Object.keys(METERS).map((m) => [m, m]), settings.meter);
    renderPatternList();
    const editable = custom();
    $('#edDelete').disabled = !editable;
    $('#edReadonlyHint').hidden = Boolean(editable);
    $('#edOptions').hidden = !editable;
    if (editable) {
      $('#edName').value = editable.name;
      document.querySelectorAll('[data-ed-dynamics]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.edDynamics === String(editable.dynamics)));
      document.querySelectorAll('[data-ed-legato]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.edLegato === String(editable.legato)));
    }
    renderGrid();
    $('#edPlay').textContent = previewing ? `⏹ ${t('stop')}` : `▶ ${t('listen')}`;
  }

  // Rejilla: una fila por tipo de nota y una columna por semicorchea (o corchea).
  function renderGrid() {
    const editable = custom();
    const source = editable ?? toEditable(selected, '');
    const { steps, beat } = METERS[settings.meter];
    const head = Array.from({ length: steps }, (_, s) => `<th scope="col" class="${s % beat ? '' : 'beat'}">${s % beat ? '·' : s / beat + 1}</th>`).join('');
    const rows = ROWS.map((row) => {
      const register = row.group === 'extra'
        ? ` <button class="register" data-register="${row.id}"${editable ? '' : ' disabled'}>${t(source.registers[row.id] === 'mid' ? 'registerMid' : 'registerLow')}</button>`
        : '';
      const cells = Array.from({ length: steps }, (_, s) => {
        const level = source.cells[row.id]?.[s] ?? 0;
        const label = `${t(`row_${row.id}`)}, ${s + 1}: ${t(`level_${level}`)}`;
        return `<td class="${s % beat ? '' : 'beat'}"><button class="cell level-${level}" data-row="${row.id}" data-step="${s}" aria-label="${label}"${editable ? '' : ' disabled'}></button></td>`;
      }).join('');
      return `<tr class="group-${row.group}"><th scope="row">${t(`row_${row.id}`)}${register}</th>${cells}</tr>`;
    }).join('');
    $('#edGrid').innerHTML = `<thead><tr><th></th>${head}</tr></thead><tbody>${rows}</tbody>`;
  }

  function changed() {
    savePatterns(patterns);
    onChange();
    render();
  }

  function select(id) {
    selected = id;
    if (previewing) startPreview();
    render();
  }

  function startPreview() {
    previewing = true;
    preview(selected, PREVIEW_CHORDS[$('#edChord').value]);
  }

  function endPreview() {
    if (!previewing) return;
    previewing = false;
    stopPreview();
  }

  $('#edChord').innerHTML = options(Object.entries(PREVIEW_CHORDS).map(([id, c]) => [id, c.name]), 'maj');
  $('#edMeter').addEventListener('change', (e) => {
    settings.meter = e.target.value;
    selected = null;
    endPreview();
    onChange();
    open();
  });
  $('#edPattern').addEventListener('change', (e) => select(e.target.value));
  $('#edNew').addEventListener('click', () => {
    const p = emptyPattern(settings.meter, t('newPatternName', { n: patterns.filter((x) => x.meter === settings.meter).length + 1 }));
    patterns.push(p);
    selected = p.id;
    changed();
  });
  $('#edDuplicate').addEventListener('click', () => {
    const p = toEditable(selected, t('copyName', { name: patternLabel(selected, t) }).slice(0, 40));
    if (custom()) Object.assign(p, { dynamics: custom().dynamics, legato: custom().legato });
    patterns.push(p);
    selected = p.id;
    changed();
  });
  $('#edDelete').addEventListener('click', () => {
    const id = selected;
    patterns.splice(patterns.findIndex((p) => p.id === id), 1);
    // Los gestos que tocaban este patrón vuelven al bloque sostenido.
    for (const meter of Object.keys(settings.patMaps)) {
      for (const g of Object.keys(settings.patMaps[meter])) if (settings.patMaps[meter][g] === id) settings.patMaps[meter][g] = 'block';
      if (settings.patternByMeter[meter] === id) settings.patternByMeter[meter] = 'block';
    }
    selected = null;
    endPreview();
    savePatterns(patterns);
    onChange();
    open();
  });
  // Solo se actualiza la lista: si se redibujara la rejilla, el clic en una casilla que hace perder
  // el foco al nombre se perdería.
  $('#edName').addEventListener('input', (e) => {
    custom().name = e.target.value.slice(0, 40);
    savePatterns(patterns);
    onChange();
    renderPatternList();
  });
  document.querySelectorAll('[data-ed-dynamics]').forEach((b) => b.addEventListener('click', () => {
    custom().dynamics = b.dataset.edDynamics === 'true';
    changed();
  }));
  document.querySelectorAll('[data-ed-legato]').forEach((b) => b.addEventListener('click', () => {
    custom().legato = b.dataset.edLegato === 'true';
    changed();
  }));
  $('#edGrid').addEventListener('click', (e) => {
    const p = custom();
    if (!p) return;
    const reg = e.target.closest('[data-register]');
    if (reg) {
      p.registers[reg.dataset.register] = p.registers[reg.dataset.register] === 'mid' ? 'low' : 'mid';
      changed();
      return;
    }
    const cell = e.target.closest('[data-row]');
    if (!cell) return;
    const { row, step } = cell.dataset;
    const level = p.cells[row]?.[step] ?? 0;
    const next = p.dynamics ? NEXT_LEVEL[level] : (level ? 0 : 2);
    if (next) (p.cells[row] ??= {})[step] = next;
    else {
      delete p.cells[row][step];
      if (!Object.keys(p.cells[row]).length) delete p.cells[row];
    }
    changed();
  });
  $('#edPlay').addEventListener('click', () => {
    if (previewing) endPreview();
    else startPreview();
    render();
  });
  $('#edChord').addEventListener('change', () => { if (previewing) startPreview(); });
  dialog.addEventListener('close', () => {
    endPreview();
    onChange();
  });

  return { open };
}
