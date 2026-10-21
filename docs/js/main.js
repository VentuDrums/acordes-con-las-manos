// Fase 1: la mano izquierda toca los grados de Do mayor con un pad, al instante.
import { GESTURE_HOLD_MS, HAND_ABSENT_MS } from './config.js';
import { t, translatePage } from './i18n.js';
import { diatonicChord, romanNumeral, chordName, voiceChord } from './music/theory.js';
import { GESTURES, ABSENT, fingerStates, classify, GestureFilter } from './hands/gestures.js';
import { HandTracker } from './hands/tracker.js';
import { AudioEngine } from './audio/engine.js';
import { drawStage } from './ui/stage.js';

// Grado de la escala (0 = I) que toca cada gesto.
const SCALE_DEGREES = { one: 0, two: 1, three: 2, four: 3, five: 4, shaka: 5, rock: 6 };
const LEGEND_ORDER = ['fist', 'one', 'two', 'three', 'four', 'five', 'shaka', 'rock', 'thumb'];
const TONIC = 0;
const SCALE = 'major';
const NOTATION = 'latin';

const $ = (sel) => document.querySelector(sel);
const engine = new AudioEngine();
const tracker = new HandTracker();
const filters = {
  left: new GestureFilter({ holdMs: GESTURE_HOLD_MS, absentMs: HAND_ABSENT_MS }),
  right: new GestureFilter({ holdMs: GESTURE_HOLD_MS, absentMs: HAND_ABSENT_MS }),
};
// Último gesto estable de cada mano según la cámara (la cámara solo actúa cuando cambia).
const lastStable = { left: ABSENT, right: ABSENT };
const state = {
  leftGesture: ABSENT,  // último gesto estable de la mano izquierda
  chord: null,          // { chord, degree } que suena, o null en silencio
};

function chordForGesture(g) {
  const degree = SCALE_DEGREES[g];
  if (degree === undefined) return null;
  return { chord: diatonicChord(TONIC, SCALE, degree), degree };
}

function applyLeft(g) {
  state.leftGesture = g;
  if (g === 'fist' || g === ABSENT) {
    state.chord = null;
    engine.silence();
  } else {
    const next = chordForGesture(g);
    if (!next) return; // gesto sin asignar: sigue sonando lo que había
    state.chord = next;
    const v = voiceChord(next.chord);
    engine.playChord([v.bass, ...v.notes], chordName(next.chord, NOTATION));
  }
  renderChord();
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
    drawStage($('#view'), tracker.video, hands, seen);
  }
  requestAnimationFrame(loop);
}

async function start() {
  $('#startBtn').hidden = true;
  $('#intro').hidden = true;
  $('#palmTip').hidden = true;
  await engine.start();
  renderChord();
  try {
    setStatus(t('loadingModel'));
    // Por defecto se usa el procesador: en algunas tablets Android la GPU detecta peor las manos.
    // ?delegate=GPU prueba la tarjeta gráfica.
    const delegate = new URLSearchParams(location.search).get('delegate') === 'GPU' ? 'GPU' : 'CPU';
    await tracker.loadModel(delegate);
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
  if (!state.chord) {
    $('#chordName').textContent = engine.ready ? t('silence') : '—';
    $('#chordDegree').textContent = '';
  } else {
    $('#chordName').textContent = chordName(state.chord.chord, NOTATION);
    $('#chordDegree').textContent = romanNumeral(state.chord.chord, state.chord.degree);
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
  $('#legend').innerHTML = LEGEND_ORDER.map((g) => {
    const res = chordForGesture(g);
    const what = g === 'fist'
      ? t('silence')
      : res ? `<b>${romanNumeral(res.chord, res.degree)}</b> · ${chordName(res.chord, NOTATION)}` : t('unassigned');
    return `<li><button data-gesture="${g}" aria-pressed="false"${!res && g !== 'fist' ? ' disabled' : ''}>
      <span class="emoji">${GESTURES[g]}</span><span class="label">${t(`gesture_${g}`)}</span><span class="what">${what}</span>
    </button></li>`;
  }).join('');
}

$('#startBtn').addEventListener('click', start);
$('#legend').addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-gesture]');
  if (!btn) return;
  await engine.start();
  applyLeft(btn.dataset.gesture);
});

translatePage();
renderLegend();
renderChord();

// Acceso para depurar y para los tests automáticos.
window.acordes = { engine, state, filters };
