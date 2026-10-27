// La mano izquierda elige el acorde (por escala o a tu gusto) y la derecha cómo suena (inversión o ritmo)
// y el volumen (puño + subir o bajar). Con configuración y calibración de gestos.
import { GESTURE_HOLD_MS, HAND_ABSENT_MS } from './config.js';
import { t, translatePage } from './i18n.js';
import { voiceChord, noteName } from './music/theory.js';
import { chordForGesture, describe, spellingFor } from './music/left-hand.js';
import { rightAction } from './music/right-hand.js';
import { GESTURES, ASSIGNABLE, ABSENT, fingerStates, classify, GestureFilter } from './hands/gestures.js';
import { VolumeFader, palmY } from './hands/fader.js';
import { HandTracker } from './hands/tracker.js';
import { AudioEngine } from './audio/engine.js';
import { drawStage } from './ui/stage.js';
import { loadSettings, saveSettings, currentPattern, currentPatMap, engineTiming } from './settings.js';
import { initSettingsPanel } from './ui/settings-panel.js';
import { CalibrationPanel } from './ui/calibration-panel.js';
import { initPatternEditor } from './ui/pattern-editor.js';
import { loadPatterns, patternLabel } from './music/custom-patterns.js';

const LEGEND_ORDER = ['fist', 'one', 'two', 'three', 'four', 'five', 'shaka', 'rock', 'thumb'];
const NOTATION = 'latin';

const $ = (sel) => document.querySelector(sel);
// Los nombres de los patrones propios los escribe el usuario: se escapan antes de meterlos en HTML.
const escapeHtml = (text) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
// Los patrones propios se registran antes de leer los ajustes, que los pueden usar.
const customPatterns = loadPatterns();
const settings = loadSettings();
const engine = new AudioEngine();
const tracker = new HandTracker();
const filters = {
  left: new GestureFilter({ holdMs: GESTURE_HOLD_MS, absentMs: HAND_ABSENT_MS }),
  right: new GestureFilter({ holdMs: GESTURE_HOLD_MS, absentMs: HAND_ABSENT_MS }),
};
// Último gesto estable de cada mano según la cámara (la cámara solo actúa cuando cambia).
const lastStable = { left: ABSENT, right: ABSENT };
const state = {
  started: false,
  delegate: null,
  leftGesture: ABSENT,  // último gesto aplicado de la mano izquierda
  rightGesture: null,   // último gesto aplicado de la mano derecha
  playing: null,        // { chord, degree } que suena, o null en silencio
  previewPattern: null, // patrón que se escucha en el editor de patrones
};
const fader = new VolumeFader(settings.volume);

// Lleva al motor de sonido el acorde actual con la inversión actual (o el silencio).
function soundChord() {
  if (!state.playing) {
    engine.silence();
    return;
  }
  const voicing = voiceChord(state.playing.chord, settings.inversion, settings.bassFollows);
  engine.setChord(voicing, describe(settings, state.playing, NOTATION).name);
}

// Lleva al motor de sonido el patrón, el tempo y el volumen de los ajustes.
function syncEngine() {
  engine.configure(engineTiming(settings));
  // Mientras se escucha un patrón en el editor, suena ese y no el de la mano derecha.
  engine.setPattern(state.previewPattern ?? currentPattern(settings));
  engine.setVolume(settings.volume);
}

// Mientras se calibra o se edita un patrón, los gestos no cambian lo que suena.
const handsPaused = () => calibration.active || $('#editorDialog').open;

function applyLeft(g) {
  if (handsPaused()) return;
  if (g === 'fist' || g === ABSENT) {
    state.leftGesture = g;
    state.playing = null;
  } else {
    const next = chordForGesture(settings, g);
    if (!next) return; // gesto sin acorde: sigue sonando lo que había
    state.leftGesture = g;
    state.playing = next;
  }
  soundChord();
  renderChord();
}

// El puño derecho (fader) y la mano fuera de cámara no cambian la inversión ni el ritmo.
function applyRight(g) {
  if (handsPaused() || g === 'fist' || g === ABSENT) return;
  const action = rightAction(settings, g);
  if (!action) return;
  state.rightGesture = g;
  if (action.setting === 'pattern') settings.patternByMeter[settings.meter] = action.value;
  else settings.inversion = action.value;
  saveSettings(settings);
  syncEngine();
  if (action.setting === 'inversion') soundChord();
  renderRight();
}

// Al cambiar los ajustes, el gesto que se está haciendo pasa a tocar su acorde nuevo.
function onSettingsChange() {
  saveSettings(settings);
  tracker.swap = settings.swapHands;
  syncEngine();
  renderLegend();
  renderRight();
  if (state.playing && state.leftGesture !== ABSENT) applyLeft(state.leftGesture);
  else renderChord();
}

// ---------- Bucle de la cámara ----------

function loop() {
  const hands = tracker.detect();
  if (hands) {
    const now = performance.now();
    const seen = {};
    for (const side of ['left', 'right']) {
      const hand = hands[side];
      const fingers = hand ? fingerStates(hand.world) : null;
      seen[side] = fingers ? classify(fingers) : null;
      const stable = filters[side].update(hand ? seen[side] : ABSENT, now);
      if (stable !== lastStable[side]) {
        lastStable[side] = stable;
        (side === 'left' ? applyLeft : applyRight)(stable);
      }
      renderHand(side, hand, fingers, seen[side]);
    }
    updateFader(hands.right);
    calibration.onFrame(hands, now);
    drawStage($('#view'), tracker.video, hands, seen);
  }
  requestAnimationFrame(loop);
}

function updateFader(hand) {
  const wasGrabbing = fader.grabbing;
  const gesture = calibration.active ? null : lastStable.right;
  if (fader.update(gesture, hand ? palmY(hand.landmarks) : null)) {
    settings.volume = fader.volume;
    engine.setVolume(settings.volume);
  }
  if (wasGrabbing && !fader.grabbing) saveSettings(settings);
  renderVolume();
}

async function start() {
  if (state.started) return;
  state.started = true;
  $('#startBtn').hidden = true;
  $('#intro').hidden = true;
  $('#palmTip').hidden = true;
  await engine.start();
  syncEngine();
  renderChord();
  try {
    setStatus(t('loadingModel'));
    // Por defecto se usa el procesador: en algunas tablets Android la GPU detecta peor las manos.
    // ?delegate=GPU prueba la tarjeta gráfica.
    state.delegate = new URLSearchParams(location.search).get('delegate') === 'GPU' ? 'GPU' : 'CPU';
    await tracker.loadModel(state.delegate);
    tracker.swap = settings.swapHands;
    setStatus(t('askingCamera'));
    await tracker.startCamera($('#cam'));
    $('#startPanel').hidden = true;
    requestAnimationFrame(loop);
  } catch (err) {
    console.error(err);
    setStatus(t('cameraError', { error: err.message }));
  }
}

// ---------- Interfaz ----------

function setStatus(text) {
  $('#status').textContent = text;
  $('#status').hidden = !text;
}

function renderChord() {
  if (!state.playing) {
    $('#chordName').textContent = engine.ready ? t('silence') : '—';
    $('#chordDegree').textContent = '';
  } else {
    const d = describe(settings, state.playing, NOTATION);
    $('#chordName').textContent = d.name;
    $('#chordDegree').textContent = d.degree;
  }
  // Acorde pedido que espera al siguiente pulso o compás (o a que acabe la cuenta previa).
  $('.chord').classList.toggle('pending', Boolean(state.playing && engine.pending));
  document.querySelectorAll('#legend button').forEach((b) => {
    b.setAttribute('aria-pressed', b.dataset.gesture === state.leftGesture);
  });
}

function renderRight() {
  const inversion = settings.rightMode === 'inversion';
  document.querySelectorAll('[data-quick-mode]').forEach((b) => {
    b.setAttribute('aria-pressed', b.dataset.quickMode === settings.rightMode);
  });
  const patMap = currentPatMap(settings);
  const pattern = currentPattern(settings);
  $('#rightLegend').innerHTML = ['fist', ...ASSIGNABLE].map((g) => {
    let what = t('faderLabel');
    if (g !== 'fist') what = inversion ? t(`inversion_${settings.invMap[g]}`) : escapeHtml(patternLabel(patMap[g], t));
    const current = g !== 'fist' && (inversion ? settings.invMap[g] === settings.inversion : patMap[g] === pattern);
    return `<li><button data-gesture="${g}" aria-pressed="${g === state.rightGesture && current}">
      <span class="emoji">${GESTURES[g]}</span><span class="label">${t(`gesture_${g}`)}</span><span class="what">${what}</span>
    </button></li>`;
  }).join('');
  $('#soundInfo').textContent = `${settings.meter} · ${settings.bpm} ${t('bpmUnit')} · ${t(`inversion_${settings.inversion}`)} · ${patternLabel(pattern, t)}`;
  const withMetronome = settings.timeMode === 'metronome';
  $('#metronomeBtn').setAttribute('aria-pressed', withMetronome);
  $('#metronomeBtn').innerHTML = `<span aria-hidden="true">${withMetronome ? '🥁' : '🎶'}</span> `
    + `<span class="btn-label">${t(withMetronome ? 'metronome' : 'freeMode')}</span>`;
  $('#metronomeBtn').title = t(withMetronome ? 'toFreeMode' : 'toMetronomeMode');
  document.body.classList.toggle('free-mode', !withMetronome);
  renderVolume();
}

// Puntos del pulso: uno por pulso del compás; durante la cuenta previa, también el número.
function renderBeat(beat, beats, countingIn) {
  const box = $('#beats');
  if (box.children.length !== beats) box.innerHTML = '<span></span>'.repeat(beats);
  [...box.children].forEach((dot, i) => dot.classList.toggle('on', i === beat));
  box.classList.toggle('count-in', countingIn);
  $('#countIn').hidden = !countingIn;
  $('#countIn').textContent = countingIn ? String(beat + 1) : '';
}

function renderVolume() {
  const percent = Math.round(settings.volume * 100);
  $('#volumeFill').style.height = `${percent}%`;
  $('#volume').classList.toggle('grabbing', fader.grabbing);
  $('#volume').setAttribute('aria-valuenow', percent);
}

function renderHand(side, hand, fingers, gesture) {
  $(`#${side}Seen`).textContent = !hand
    ? t('notSeen')
    : gesture ? `${GESTURES[gesture]} ${t(`gesture_${gesture}`)}` : t('unknownGesture');
  $(`#${side}Fingers`).textContent = fingers ? fingers.map((on) => (on ? '●' : '○')).join(' ') : '';
}

function renderLegend() {
  $('#legendTitle').textContent = settings.leftMode === 'scale'
    ? t('legendTitleScale', {
      scale: `${noteName(settings.tonic, NOTATION, spellingFor(settings))} ${t(`scale_${settings.scale}`).toLowerCase()}`,
    })
    : t('legendTitleCustom');
  $('#legend').innerHTML = LEGEND_ORDER.map((g) => {
    const entry = g === 'fist' ? null : chordForGesture(settings, g);
    let what = t('unassigned');
    if (g === 'fist') what = t('silence');
    else if (entry) {
      const d = describe(settings, entry, NOTATION);
      what = d.degree ? `<b>${d.degree}</b> · ${d.name}` : d.name;
    }
    const disabled = !entry && g !== 'fist' ? ' disabled' : '';
    return `<li><button data-gesture="${g}" aria-pressed="false"${disabled}>
      <span class="emoji">${GESTURES[g]}</span><span class="label">${t(`gesture_${g}`)}</span><span class="what">${what}</span>
    </button></li>`;
  }).join('');
  renderChord();
}

const calibration = new CalibrationPanel({
  onEnter: () => {
    state.playing = null;
    engine.silence();
    renderChord();
  },
  onExit: () => {
    // Al salir, la mano izquierda vuelve a mandar desde su gesto actual.
    if (lastStable.left !== ABSENT) applyLeft(lastStable.left);
  },
  getMeta: () => ({
    userAgent: navigator.userAgent,
    delegate: state.delegate,
    video: tracker.video ? { width: tracker.video.videoWidth, height: tracker.video.videoHeight } : null,
    swapHands: settings.swapHands,
  }),
});

initSettingsPanel({
  settings,
  notation: NOTATION,
  onChange: onSettingsChange,
  onCalibrate: async () => {
    calibration.enter();
    await start();
  },
});

const editor = initPatternEditor({
  settings,
  patterns: customPatterns,
  onChange: onSettingsChange,
  preview: async (id, chord) => {
    await engine.start();
    state.previewPattern = id;
    syncEngine();
    engine.playNow(voiceChord(chord, settings.inversion, settings.bassFollows), chord.name);
  },
  // Al dejar de escuchar vuelve lo que tocaban las manos.
  stopPreview: () => {
    state.previewPattern = null;
    engine.silence();
    syncEngine();
    soundChord();
  },
});
$('#openEditorBtn').addEventListener('click', () => {
  $('#settingsDialog').close();
  editor.open();
});

$('#startBtn').addEventListener('click', start);
$('#metronomeBtn').addEventListener('click', async () => {
  settings.timeMode = settings.timeMode === 'free' ? 'metronome' : 'free';
  await engine.start();
  onSettingsChange();
});
engine.onBeat = renderBeat;
engine.onApplied = renderChord;
// Cambio rápido de modo de la mano derecha desde la pantalla principal (las tablas se editan en la configuración).
document.querySelectorAll('[data-quick-mode]').forEach((b) => b.addEventListener('click', () => {
  settings.rightMode = b.dataset.quickMode;
  state.rightGesture = null;
  onSettingsChange();
}));
$('#rightLegend').addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-gesture]');
  if (!btn) return;
  await engine.start();
  syncEngine();
  applyRight(btn.dataset.gesture);
});
$('#legend').addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-gesture]');
  if (!btn) return;
  await engine.start();
  syncEngine();
  applyLeft(btn.dataset.gesture);
});

translatePage();
renderLegend();
renderRight();

// Acceso para depurar y para los tests automáticos.
window.acordes = { engine, state, filters, settings, calibration, fader, customPatterns };
