// Panel de configuración (diálogo desplegable).
import { t } from '../i18n.js';
import { SCALES, QUALITIES, NOTE_NAMES, INVERSIONS, chordName } from '../music/theory.js';
import { patternsFor } from '../music/patterns.js';
import { patternLabel } from '../music/custom-patterns.js';
import { METERS } from '../music/timing.js';
import { BPM_RANGE, currentPattern, currentPatMap } from '../settings.js';
import { customFromScale, spellingForChord } from '../music/left-hand.js';
import { GESTURES, ASSIGNABLE } from '../hands/gestures.js';

const $ = (sel) => document.querySelector(sel);

function options(entries, selected) {
  return entries
    .map(([value, label]) => `<option value="${value}"${String(value) === String(selected) ? ' selected' : ''}>${label}</option>`)
    .join('');
}

// Nombres de nota con sus dos grafías cuando las hay: «Do♯ / Re♭».
function pitchOptions(selected, notation) {
  const { sharp, flat } = NOTE_NAMES[notation];
  return options(sharp.map((s, pc) => [pc, s === flat[pc] ? s : `${s} / ${flat[pc]}`]), selected);
}

// settings: objeto de ajustes (se modifica aquí); onChange(): se llama tras cada cambio.
export function initSettingsPanel({ settings, notation, onChange, onCalibrate }) {
  const dialog = $('#settingsDialog');

  function render() {
    const custom = settings.leftMode === 'custom';
    document.querySelectorAll('[data-left-mode]').forEach((b) => {
      b.setAttribute('aria-pressed', b.dataset.leftMode === settings.leftMode);
    });
    $('#leftModeHelp').textContent = t(custom ? 'modeCustomHelp' : 'modeScaleHelp');
    $('#tonicSelect').innerHTML = pitchOptions(settings.tonic, notation);
    $('#scaleSelect').innerHTML = options(Object.keys(SCALES).map((id) => [id, t(`scale_${id}`)]), settings.scale);
    $('#seventhsCheck').checked = settings.sevenths;
    $('#customEditor').hidden = !custom;
    $('#swapHandsCheck').checked = settings.swapHands;
    if (custom) renderCustom();
    renderTime();
    renderRight();
  }

  function renderTime() {
    $('#meterSelect').innerHTML = options(Object.keys(METERS).map((m) => [m, m]), settings.meter);
    Object.assign($('#bpmRange'), { min: BPM_RANGE[0], max: BPM_RANGE[1], step: 1, value: settings.bpm });
    $('#bpmValue').textContent = `${settings.bpm} ${t('bpmUnit')}`;
    document.querySelectorAll('[data-change-mode]').forEach((b) => {
      b.setAttribute('aria-pressed', b.dataset.changeMode === settings.changeMode);
    });
    const help = { instant: 'changeInstantHelp', beat: 'changeBeatHelp', bar: 'changeBarHelp' };
    $('#changeModeHelp').textContent = t(help[settings.changeMode]);
    document.querySelectorAll('[data-restart]').forEach((b) => {
      b.setAttribute('aria-pressed', b.dataset.restart === String(settings.restartOnChange));
    });
    const free = settings.timeMode === 'free';
    document.querySelectorAll('[data-time-mode]').forEach((b) => {
      b.setAttribute('aria-pressed', b.dataset.timeMode === settings.timeMode);
    });
    $('#timeModeHelp').textContent = t(free ? 'freeModeHelp' : 'metronomeModeHelp');
    $('#metronomeOptions').hidden = free;
    $('#clickCheck').checked = settings.click;
    $('#metronomeVolumeRange').value = settings.metronomeVolume;
    $('#countInCheck').checked = settings.countIn;
  }

  const inversionOptions = (selected) => options(INVERSIONS.map((id) => [id, t(`inversion_${id}`)]), selected);
  const escapeHtml = (text) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  const patternOptions = (selected) => options(patternsFor(settings.meter).map((id) => [id, escapeHtml(patternLabel(id, t))]), selected);

  function renderRight() {
    const inversion = settings.rightMode === 'inversion';
    document.querySelectorAll('[data-right-mode]').forEach((b) => {
      b.setAttribute('aria-pressed', b.dataset.rightMode === settings.rightMode);
    });
    $('#rightModeHelp').textContent = t(inversion ? 'modeInversionHelp' : 'modeRhythmHelp');
    $('#inversionSelect').innerHTML = inversionOptions(settings.inversion);
    $('#patternSelect').innerHTML = patternOptions(currentPattern(settings));
    $('#bassFollowsCheck').checked = settings.bassFollows;
    $('#rightMapList').innerHTML = ASSIGNABLE.map((g) => `<li>
        <span class="emoji" aria-hidden="true">${GESTURES[g]}</span>
        <span class="label">${t(`gesture_${g}`)}</span>
        <select data-right-map="${g}" aria-label="${t('gestureAction', { gesture: t(`gesture_${g}`) })}">${
          inversion ? inversionOptions(settings.invMap[g]) : patternOptions(currentPatMap(settings)[g])}</select>
      </li>`).join('');
  }

  function renderCustom() {
    const qualities = Object.keys(QUALITIES).map((id) => [id, t(`quality_${id}`)]);
    $('#customList').innerHTML = ASSIGNABLE.map((g) => {
      const c = settings.custom[g];
      return `<li>
        <span class="emoji" aria-hidden="true">${GESTURES[g]}</span>
        <span class="label">${t(`gesture_${g}`)}</span>
        <select data-root="${g}" aria-label="${t(`gesture_${g}`)}: ${t('chordRoot')}">${pitchOptions(c.root, notation)}</select>
        <select data-quality="${g}" aria-label="${t(`gesture_${g}`)}: ${t('chordQuality')}">${options(qualities, c.quality)}</select>
        <span class="name">${chordName(c, notation, spellingForChord(settings, c))}</span>
      </li>`;
    }).join('');
  }

  const changed = () => {
    render();
    onChange();
  };

  $('#settingsBtn').addEventListener('click', () => {
    render();
    dialog.showModal();
  });
  document.querySelectorAll('[data-left-mode]').forEach((b) => b.addEventListener('click', () => {
    settings.leftMode = b.dataset.leftMode;
    changed();
  }));
  $('#tonicSelect').addEventListener('change', (e) => { settings.tonic = Number(e.target.value); changed(); });
  $('#scaleSelect').addEventListener('change', (e) => { settings.scale = e.target.value; changed(); });
  $('#seventhsCheck').addEventListener('change', (e) => { settings.sevenths = e.target.checked; changed(); });
  $('#swapHandsCheck').addEventListener('change', (e) => { settings.swapHands = e.target.checked; changed(); });
  $('#fillFromScaleBtn').addEventListener('click', () => {
    settings.custom = customFromScale(settings);
    changed();
  });
  $('#customList').addEventListener('change', (e) => {
    const { root, quality } = e.target.dataset;
    if (root) settings.custom[root] = { ...settings.custom[root], root: Number(e.target.value) };
    if (quality) settings.custom[quality] = { ...settings.custom[quality], quality: e.target.value };
    changed();
  });
  document.querySelectorAll('[data-right-mode]').forEach((b) => b.addEventListener('click', () => {
    settings.rightMode = b.dataset.rightMode;
    changed();
  }));
  $('#inversionSelect').addEventListener('change', (e) => { settings.inversion = e.target.value; changed(); });
  $('#patternSelect').addEventListener('change', (e) => { settings.patternByMeter[settings.meter] = e.target.value; changed(); });
  $('#meterSelect').addEventListener('change', (e) => { settings.meter = e.target.value; changed(); });
  document.querySelectorAll('[data-change-mode]').forEach((b) => b.addEventListener('click', () => {
    settings.changeMode = b.dataset.changeMode;
    changed();
  }));
  document.querySelectorAll('[data-restart]').forEach((b) => b.addEventListener('click', () => {
    settings.restartOnChange = b.dataset.restart === 'true';
    changed();
  }));
  document.querySelectorAll('[data-time-mode]').forEach((b) => b.addEventListener('click', () => {
    settings.timeMode = b.dataset.timeMode;
    changed();
  }));
  $('#clickCheck').addEventListener('change', (e) => { settings.click = e.target.checked; changed(); });
  $('#metronomeVolumeRange').addEventListener('input', (e) => { settings.metronomeVolume = Number(e.target.value); onChange(); });
  $('#countInCheck').addEventListener('change', (e) => { settings.countIn = e.target.checked; changed(); });
  $('#bassFollowsCheck').addEventListener('change', (e) => { settings.bassFollows = e.target.checked; changed(); });
  $('#bpmRange').addEventListener('input', (e) => {
    settings.bpm = Number(e.target.value);
    $('#bpmValue').textContent = `${settings.bpm} ${t('bpmUnit')}`;
    onChange();
  });
  $('#rightMapList').addEventListener('change', (e) => {
    const g = e.target.dataset.rightMap;
    if (!g) return;
    (settings.rightMode === 'inversion' ? settings.invMap : currentPatMap(settings))[g] = e.target.value;
    changed();
  });
  $('#calibrateBtn').addEventListener('click', () => {
    dialog.close();
    onCalibrate();
  });
}
