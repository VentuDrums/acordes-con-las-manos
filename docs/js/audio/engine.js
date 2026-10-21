// Motor de sonido con Tone.js (cargado como script global en index.html).
//
// Suena el acorde actual con el patrón actual:
// - Bloque sostenido: el acorde suena con un pad mientras no cambie.
// - Patrones rítmicos: un reloj de semicorcheas (Tone.Transport) dispara las notas de cada paso
//   con un sonido de teclado. Un cambio de acorde se oye desde el siguiente paso, a tempo.
/* global Tone */
import { PATTERNS, notesForStep } from '../music/patterns.js';

const MAX_LOG = 200;
const MAX_NOTE_LOG = 400;

const unique = (notes) => [...new Set(notes)];

export class AudioEngine {
  constructor() {
    this.ready = false;
    this.voicing = null; // { bass, root, fifth, notes } del acorde que suena, o null en silencio
    this.pattern = 'block';
    this.held = []; // notas que mantiene el pad
    this.volume = 0.8;
    // Registros de lo que suena, para poder comprobarlo en los tests.
    this.log = [];      // cambios de acorde y silencios
    this.noteLog = [];  // notas de los patrones rítmicos
  }

  async start() {
    if (this.ready) return;
    await Tone.start();
    this.out = new Tone.Gain(this.volume ** 2).toDestination();
    const reverb = new Tone.Reverb({ decay: 3, wet: 0.25 }).connect(this.out);
    const padFilter = new Tone.Filter(1800, 'lowpass').connect(reverb);
    this.pad = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'fatsawtooth', count: 3, spread: 20 },
      envelope: { attack: 0.15, decay: 0.3, sustain: 0.8, release: 1.2 },
      volume: -20,
    }).connect(padFilter);
    this.keys = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 3,
      modulationIndex: 2.5,
      envelope: { attack: 0.005, decay: 0.9, sustain: 0.25, release: 0.8 },
      modulationEnvelope: { attack: 0.005, decay: 0.4, sustain: 0.1, release: 0.5 },
      volume: -14,
    }).connect(reverb);
    this.keys.maxPolyphony = 48;
    Tone.Transport.scheduleRepeat((time) => this.tick(time), '16n');
    Tone.Transport.start('+0.05');
    this.ready = true;
  }

  // Cambia el acorde (o null para silencio). label es el nombre que se muestra (para el registro).
  setChord(voicing, label = '') {
    if (!this.ready) return;
    if (!voicing) {
      this.silence();
      return;
    }
    this.voicing = voicing;
    if (PATTERNS[this.pattern].sustain) this.hold(unique([voicing.bass, ...voicing.notes]));
    this.record({ type: 'chord', label, notes: unique([voicing.bass, ...voicing.notes]) });
  }

  setPattern(id) {
    if (id === this.pattern) return;
    this.pattern = id;
    if (!this.ready) return;
    if (PATTERNS[id].sustain && this.voicing) this.hold(unique([this.voicing.bass, ...this.voicing.notes]));
    else this.hold([]);
  }

  silence() {
    if (!this.ready) return;
    const wasPlaying = this.voicing !== null;
    this.voicing = null;
    this.hold([]);
    this.keys.releaseAll(Tone.immediate());
    if (wasPlaying) this.record({ type: 'silence' });
  }

  setVolume(volume) {
    this.volume = volume;
    // Curva cuadrática: el volumen se percibe más natural que con una recta.
    if (this.ready) this.out.gain.rampTo(volume ** 2, 0.05);
  }

  setTempo(bpm) {
    Tone.Transport.bpm.value = bpm;
  }

  // Mantiene en el pad exactamente estas notas. Las comunes con las que sonaban no se repiten.
  // Tone.immediate() ejecuta al momento: con Tone.now() (que añade 0,1 s de margen) una orden de
  // soltar que llega justo después de tocar podía adelantarse y dejar notas colgadas.
  hold(notes) {
    const now = Tone.immediate();
    const off = this.held.filter((m) => !notes.includes(m));
    const on = notes.filter((m) => !this.held.includes(m));
    if (off.length) this.pad.triggerRelease(this.toNotes(off), now);
    if (on.length) this.pad.triggerAttack(this.toNotes(on), now, 0.7);
    this.held = [...notes];
  }

  // Reloj de semicorcheas: toca el paso actual del patrón rítmico. El paso sale de la posición del
  // reloj global, así el patrón sigue cuadrado con el compás aunque cambie a mitad.
  tick(time) {
    const pattern = PATTERNS[this.pattern];
    if (!this.voicing || pattern.sustain) return;
    const sixteenth = Math.round(Tone.Transport.getTicksAtTime(time) / (Tone.Transport.PPQ / 4));
    const step = sixteenth % pattern.steps;
    for (const ev of notesForStep(this.pattern, step, this.voicing)) {
      this.keys.triggerAttackRelease(this.toNotes(ev.notes), ev.duration, time, ev.velocity);
      this.noteLog.push({ step, notes: ev.notes, at: performance.now() });
      if (this.noteLog.length > MAX_NOTE_LOG) this.noteLog.shift();
    }
  }

  toNotes(midiNotes) {
    return midiNotes.map((m) => Tone.Frequency(m, 'midi').toNote());
  }

  record(event) {
    this.log.push({ ...event, at: performance.now() });
    if (this.log.length > MAX_LOG) this.log.shift();
  }
}
