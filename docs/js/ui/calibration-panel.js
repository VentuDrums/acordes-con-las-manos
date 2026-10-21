// Modo de calibración: graba medidas de cada gesto y las descarga.
import { t } from '../i18n.js';
import { GESTURES } from '../hands/gestures.js';
import { COUNTDOWN_MS, RECORD_MS, makeSample, summarize, buildExport } from '../hands/calibration.js';

const $ = (sel) => document.querySelector(sel);
const CALIB_GESTURES = ['fist', 'one', 'two', 'three', 'four', 'five', 'shaka', 'rock', 'thumb'];

export class CalibrationPanel {
  // onEnter/onExit: avisan a la app para que pare el sonido y muestre u oculte la leyenda.
  constructor({ onEnter, onExit, getMeta }) {
    this.active = false;
    this.hand = 'left';
    this.samples = [];
    this.session = null; // { gesture, hand, start, recordFrom, recordUntil, seen }
    this.onEnter = onEnter;
    this.onExit = onExit;
    this.getMeta = getMeta;

    document.querySelectorAll('[data-calib-hand]').forEach((b) => b.addEventListener('click', () => {
      if (this.session) return;
      this.hand = b.dataset.calibHand;
      this.render();
    }));
    $('#calibList').addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-gesture]');
      if (btn && !this.session) this.startRecording(btn.dataset.gesture);
    });
    $('#downloadBtn').addEventListener('click', () => this.download());
    $('#clearCalibBtn').addEventListener('click', () => {
      this.samples = [];
      this.render();
    });
    $('#exitCalibBtn').addEventListener('click', () => this.exit());
  }

  enter() {
    this.active = true;
    document.body.classList.add('calibrating');
    $('#legendPanel').hidden = true;
    $('#rightLegendPanel').hidden = true;
    $('#calibPanel').hidden = false;
    this.onEnter();
    this.render();
  }

  exit() {
    this.active = false;
    this.session = null;
    document.body.classList.remove('calibrating');
    $('#calibBanner').hidden = true;
    $('#calibPanel').hidden = true;
    $('#legendPanel').hidden = false;
    $('#rightLegendPanel').hidden = false;
    this.onExit();
  }

  startRecording(gesture) {
    // «Repetir» sustituye la grabación anterior de ese gesto y esa mano.
    this.samples = this.samples.filter((x) => !(x.hand === this.hand && x.expected === gesture));
    const now = performance.now();
    this.session = {
      gesture,
      hand: this.hand,
      recordFrom: now + COUNTDOWN_MS,
      recordUntil: now + COUNTDOWN_MS + RECORD_MS,
      seen: 0,
    };
    this.render();
  }

  // Se llama en cada fotograma analizado con las manos detectadas.
  onFrame(hands, now) {
    const s = this.session;
    if (!this.active || !s) return;
    const banner = $('#calibBanner');
    const what = `${GESTURES[s.gesture]} ${t(`gesture_${s.gesture}`)}`;
    banner.hidden = false;
    if (now < s.recordFrom) {
      banner.textContent = t('calibGetReady', {
        gesture: what,
        hand: t(s.hand === 'left' ? 'leftHandLower' : 'rightHandLower'),
        seconds: Math.ceil((s.recordFrom - now) / 1000),
      });
      return;
    }
    if (now <= s.recordUntil) {
      banner.textContent = t('calibRecording', { gesture: what, seconds: ((s.recordUntil - now) / 1000).toFixed(1) });
      const hand = hands[s.hand];
      if (hand) {
        this.samples.push(makeSample(s.hand, s.gesture, hand, now));
        s.seen++;
      }
      return;
    }
    banner.hidden = !(s.seen === 0);
    banner.textContent = s.seen === 0 ? t('calibNoHand') : '';
    this.session = null;
    this.render();
  }

  render() {
    document.querySelectorAll('[data-calib-hand]').forEach((b) => {
      b.setAttribute('aria-pressed', b.dataset.calibHand === this.hand);
    });
    $('#calibList').innerHTML = CALIB_GESTURES.map((g) => {
      const r = summarize(this.samples, this.hand, g);
      let result = '';
      if (r.total) {
        const percent = Math.round((100 * r.ok) / r.total);
        const confusions = Object.entries(r.confusions)
          .map(([k, n]) => `${GESTURES[k] ?? ''} ${t(`gesture_${k}`)} ×${n}`).join(', ');
        result = `<span class="result ${percent >= 90 ? 'good' : 'bad'}">${t('calibResult', { ok: r.ok, total: r.total, percent })}`
          + `${confusions ? ` · ${t('calibConfusions', { list: confusions })}` : ''}</span>`;
      }
      const busy = this.session ? ' disabled' : '';
      return `<li><span class="emoji" aria-hidden="true">${GESTURES[g]}</span>
        <span>${t(`gesture_${g}`)}${result}</span>
        <button data-gesture="${g}"${busy}>${t(r.total ? 'recordAgain' : 'record')}</button></li>`;
    }).join('');
    $('#downloadBtn').textContent = t('download', { count: this.samples.length });
    $('#downloadBtn').disabled = !this.samples.length;
  }

  download() {
    const data = buildExport(this.samples, this.getMeta());
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `calibracion-gestos-${data.createdAt.slice(0, 16).replace(/[:T]/g, '-')}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
}
