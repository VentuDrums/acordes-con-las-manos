// Panel de configuración (diálogo desplegable).
import { t } from '../i18n.js';
import { SCALES, QUALITIES, NOTE_NAMES, chordName } from '../music/theory.js';
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
  $('#calibrateBtn').addEventListener('click', () => {
    dialog.close();
    onCalibrate();
  });
}
