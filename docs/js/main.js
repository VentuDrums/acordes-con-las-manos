// Fase 2: la mano izquierda elige el acorde (por escala o a tu gusto), con configuración y calibración.
import { GESTURE_HOLD_MS, HAND_ABSENT_MS } from './config.js';
import { t, translatePage } from './i18n.js';
import { voiceChord, noteName } from './music/theory.js';
import { chordForGesture, describe, spellingFor } from './music/left-hand.js';
import { GESTURES, ABSENT, fingerStates, classify, GestureFilter } from './hands/gestures.js';
import { HandTracker } from './hands/tracker.js';
import { AudioEngine } from './audio/engine.js';
import { drawStage } from './ui/stage.js';
import { loadSettings, saveSettings } from './settings.js';
import { initSettingsPanel } from './ui/settings-panel.js';
import { CalibrationPanel } from './ui/calibration-panel.js';

const LEGEND_ORDER = ['fist', 'one', 'two', 'three', 'four', 'five', 'shaka', 'rock', 'thumb'];
const NOTATION = 'latin';

const $ = (sel) => document.querySelector(sel);
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
  leftGesture: ABSENT, // último gesto aplicado de la mano izquierda
  playing: null,       // { chord, degree } que suena, o null en silencio
};

function applyLeft(g) {
  if (calibration.active) return;
  if (g === 'fist' || g === ABSENT) {
    state.leftGesture = g;
    state.playing = null;
    engine.silence();
  } else {
    const next = chordForGesture(settings, g);
    if (!next) return; // gesto sin acorde: sigue sonando lo que había
    state.leftGesture = g;
    state.playing = next;
    const v = voiceChord(next.chord);
    engine.playChord([v.bass, ...v.notes], describe(settings, next, NOTATION).name);
  }
  renderChord();
}

// Al cambiar los ajustes, el gesto que se está haciendo pasa a tocar su acorde nuevo.
function onSettingsChange() {
  saveSettings(settings);
  tracker.swap = settings.swapHands;
  renderLegend();
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
        if (side === 'left') applyLeft(stable);
      }
      renderHand(side, hand, fingers, seen[side]);
    }
    calibration.onFrame(hands, now);
    drawStage($('#view'), tracker.video, hands, seen);
  }
  requestAnimationFrame(loop);
}

async function start() {
  if (state.started) return;
  state.started = true;
  $('#startBtn').hidden = true;
  $('#intro').hidden = true;
  $('#palmTip').hidden = true;
  await engine.start();
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
  document.querySelectorAll('#legend button').forEach((b) => {
    b.setAttribute('aria-pressed', b.dataset.gesture === state.leftGesture);
  });
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

$('#startBtn').addEventListener('click', start);
$('#legend').addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-gesture]');
  if (!btn) return;
  await engine.start();
  applyLeft(btn.dataset.gesture);
});

translatePage();
renderLegend();

// Acceso para depurar y para los tests automáticos.
window.acordes = { engine, state, filters, settings, calibration };
