// Motor de sonido con Tone.js (cargado como script global en index.html).
//
// Un reloj (Tone.Transport) avanza en unidades de rejilla del compás (semicorcheas o corcheas, ver
// timing.js). En cada unidad:
//   - aplica el cambio de acorde que estuviera esperando a ese pulso o compás,
//   - toca el click del metrónomo en cada pulso (y durante la cuenta previa),
//   - toca las notas del patrón rítmico con un piano de muestras grabadas.
// El bloque sostenido no usa la rejilla: el acorde suena con un pad mientras no cambie.
//
// Cambio «al momento»: lo que aún suena (o está a punto de sonar) del acorde anterior se corta y el
// acorde nuevo entra en ese momento con el resto de la duración de cada nota.
/* global Tone */
import { PATTERNS, notesForEvent, notesForStep } from '../music/patterns.js';
import { METERS, unitsPerQuarter, quarterBpm, stepOf, planChange, lateUnits } from '../music/timing.js';

const MAX_LOG = 400;
// Margen con el que se preparan las notas (Tone usa 0,1 s): menos margen, menos cambios «tarde».
const LOOK_AHEAD = 0.05;
// Una nota que ya solo iba a sonar menos que esto no se sustituye al cambiar de acorde.
const MIN_REMAINING = 0.06;

const unique = (notes) => [...new Set(notes)];
const allNotes = (voicing) => unique([voicing.bass, ...voicing.notes]);

// Una muestra de piano cada tres semitonos; Tone.Sampler calcula las notas intermedias.
const PIANO_URLS = Object.fromEntries(
  [2, 3, 4, 5, 6].flatMap((o) => [['C', 'C'], ['D#', 'Ds'], ['F#', 'Fs'], ['A', 'A']]
    .map(([note, file]) => [`${note}${o}`, `${file}${o}.mp3`])).concat([['C7', 'C7.mp3']]),
);

export class AudioEngine {
  constructor() {
    this.ready = false;
    this.voicing = null; // acorde que suena ({ bass, root, third, fifth, notes }) o null
    this.label = '';
    this.pending = null; // cambio que espera a un pulso o compás: { voicing, label, unit }
    this.pattern = 'block';
    this.meter = '4/4';
    this.bpm = 90;
    this.changeMode = 'instant';
    this.restartOnChange = false;
    this.metronome = false;
    this.metronomeVolume = 0.6;
    this.countInEnabled = false;
    this.countInUntil = null; // unidad en la que acaba la cuenta previa
    this.phase = 0; // unidad en la que empieza el compás
    this.lastScheduled = -1; // última unidad preparada por el reloj
    this.held = []; // notas que mantiene el pad
    this.active = []; // notas del patrón que suenan o van a sonar: { what, notes, start, end, velocity, unit, step }
    this.volume = 0.8;
    this.onBeat = null; // (pulso, pulsos por compás, cuenta previa) → para pintar el pulso en pantalla
    this.onApplied = null; // () → el cambio de acorde que esperaba ya suena
    // Registros de lo que suena, para poder comprobarlo en los tests.
    this.log = []; // cambios de acorde y silencios
    this.noteLog = []; // notas de los patrones: { unit, step, notes, kind: 'note' | 'replace' | 'catchup' }
    this.clickLog = []; // clicks: { unit, step, accent, countIn }
  }

  async start() {
    if (this.ready) return;
    await Tone.start();
    Tone.context.lookAhead = LOOK_AHEAD;
    this.out = new Tone.Gain(this.volume ** 2).toDestination();
    const reverb = new Tone.Reverb({ decay: 3, wet: 0.25 }).connect(this.out);
    const padFilter = new Tone.Filter(1800, 'lowpass').connect(reverb);
    this.pad = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'fatsawtooth', count: 3, spread: 20 },
      envelope: { attack: 0.15, decay: 0.3, sustain: 0.8, release: 1.2 },
      volume: -20,
    }).connect(padFilter);
    // Teclado sintetizado: solo se usa mientras carga el piano.
    this.keys = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 3,
      modulationIndex: 2.5,
      envelope: { attack: 0.005, decay: 0.9, sustain: 0.25, release: 0.8 },
      modulationEnvelope: { attack: 0.005, decay: 0.4, sustain: 0.1, release: 0.5 },
      volume: -14,
    }).connect(reverb);
    this.keys.maxPolyphony = 48;
    this.pianoLoaded = false;
    this.piano = new Tone.Sampler({
      urls: PIANO_URLS,
      baseUrl: 'audio/piano/',
      release: 0.6,
      volume: -4,
      onload: () => { this.pianoLoaded = true; },
    }).connect(reverb);
    // El metrónomo va aparte: el fader de volumen no le afecta.
    this.clickOut = new Tone.Gain(this.metronomeVolume).toDestination();
    this.click = new Tone.Synth({
      oscillator: { type: 'square' },
      envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.02 },
      volume: -10,
    }).connect(this.clickOut);
    this.ready = true;
    this.startClock();
  }

  // Ajustes de tiempo: { meter, bpm, changeMode, restartOnChange, metronome, metronomeVolume, countIn }.
  configure(options) {
    const meterChanged = options.meter !== this.meter;
    Object.assign(this, {
      meter: options.meter,
      bpm: options.bpm,
      changeMode: options.changeMode,
      restartOnChange: options.restartOnChange,
      metronome: options.metronome,
      metronomeVolume: options.metronomeVolume,
      countInEnabled: options.countIn,
    });
    if (!this.ready) return;
    this.clickOut.gain.rampTo(options.metronomeVolume, 0.05);
    if (meterChanged) this.startClock();
    else Tone.Transport.bpm.value = quarterBpm(this.meter, this.bpm);
  }

  // Arranca (o rearranca, al cambiar de compás) el reloj con la rejilla del compás.
  startClock() {
    Tone.Transport.stop();
    Tone.Transport.cancel();
    Tone.Transport.bpm.value = quarterBpm(this.meter, this.bpm);
    this.phase = 0;
    this.lastScheduled = -1;
    this.pending = null;
    this.countInUntil = null;
    Tone.Transport.scheduleRepeat((time) => this.tick(time), METERS[this.meter].unit);
    Tone.Transport.start('+0.05');
  }

  // Unidad de rejilla (con decimales) en un momento del reloj de audio.
  unitAt(time) {
    return Tone.Transport.getTicksAtTime(time) / (Tone.Transport.PPQ / unitsPerQuarter(this.meter));
  }

  // Pide un cambio de acorde (o null para silencio). label es el nombre que se muestra.
  setChord(voicing, label = '') {
    if (!this.ready) return;
    if (!voicing) {
      this.silence();
      return;
    }
    const same = (a, b) => a && b && a.bass === b.bass && a.notes.join() === b.notes.join();
    // El mismo acorde que ya suena (por ejemplo, al tocar un ajuste que no le afecta): nada que hacer.
    if (!this.pending && same(voicing, this.voicing)) return;
    // Desde el silencio, con cuenta previa: el compás empieza ya, suena un compás de clicks
    // y el acorde entra en el siguiente.
    if (!this.voicing && this.countInEnabled && this.countInUntil === null) {
      this.phase = this.lastScheduled + 1;
      this.countInUntil = this.phase + METERS[this.meter].steps;
      this.pending = { voicing, label, unit: this.countInUntil };
      return;
    }
    if (this.countInUntil !== null) {
      // Durante la cuenta previa solo se cambia el acorde que va a entrar.
      this.pending = { ...this.pending, voicing, label };
      return;
    }
    const now = this.unitAt(Tone.immediate());
    const plan = planChange({ mode: this.changeMode, meter: this.meter, now, phase: this.phase, lastScheduled: this.lastScheduled });
    if (plan.when === 'unit') {
      this.pending = { voicing, label, unit: plan.unit };
      return;
    }
    this.pending = null;
    this.applyNow(voicing, label);
  }

  // El acorde entra ya: si se reinicia el patrón, desde la siguiente unidad; si no, corrigiendo
  // al momento lo que suena o está a punto de sonar.
  applyNow(voicing, label) {
    const wasPlaying = this.voicing !== null;
    if (this.restartOnChange && wasPlaying && !PATTERNS[this.pattern].sustain) {
      this.cutActive(Tone.immediate());
      this.phase = this.lastScheduled + 1;
    } else {
      this.replaceActive(voicing);
    }
    this.voicing = voicing;
    this.label = label;
    if (PATTERNS[this.pattern].sustain) this.hold(allNotes(voicing));
    this.record({ type: 'chord', label, notes: allNotes(voicing), unit: Math.floor(this.unitAt(Tone.immediate())) });
  }

  setPattern(id) {
    if (id === this.pattern) return;
    this.pattern = id;
    if (!this.ready) return;
    if (PATTERNS[id].sustain && this.voicing) this.hold(allNotes(this.voicing));
    else {
      this.hold([]);
      this.catchUp();
    }
  }

  // Patrón elegido un poco tarde (hasta una semicorchea después de un paso): las notas de ese paso
  // suenan al momento en vez de esperar al siguiente.
  catchUp() {
    if (!this.voicing || this.countInUntil !== null) return;
    const now = Tone.immediate();
    const unit = Math.floor(this.unitAt(now));
    if (unit > this.lastScheduled || this.unitAt(now) - unit > lateUnits(this.meter)) return;
    const step = stepOf(unit, this.phase, this.meter);
    for (const ev of notesForStep(this.pattern, step, this.voicing)) {
      const duration = Tone.Time(ev.duration).toSeconds();
      this.instrument().triggerAttackRelease(this.toNotes(ev.notes), duration, now, ev.velocity);
      this.active.push({ what: ev.what, notes: ev.notes, start: now, end: now + duration, velocity: ev.velocity, unit, step });
      this.logNote({ unit, step, notes: ev.notes, kind: 'catchup' });
    }
  }

  silence() {
    if (!this.ready) return;
    const wasPlaying = this.voicing !== null || this.pending !== null;
    this.voicing = null;
    this.pending = null;
    this.countInUntil = null;
    this.hold([]);
    const now = Tone.immediate();
    this.cutActive(now);
    this.keys.releaseAll(now);
    this.piano.releaseAll(now);
    if (wasPlaying) this.record({ type: 'silence' });
  }

  setVolume(volume) {
    this.volume = volume;
    // Curva cuadrática: el volumen se percibe más natural que con una recta.
    if (this.ready) this.out.gain.rampTo(volume ** 2, 0.05);
  }

  instrument() {
    return this.pianoLoaded ? this.piano : this.keys;
  }

  // Mantiene en el pad exactamente estas notas. Las comunes con las que sonaban no se repiten.
  // Tone.immediate() ejecuta al momento: con Tone.now() (que añade un margen) una orden de soltar
  // que llega justo después de tocar podía adelantarse y dejar notas colgadas.
  hold(notes, time = Tone.immediate()) {
    const off = this.held.filter((m) => !notes.includes(m));
    const on = notes.filter((m) => !this.held.includes(m));
    if (off.length) this.pad.triggerRelease(this.toNotes(off), time);
    if (on.length) this.pad.triggerAttack(this.toNotes(on), time, 0.7);
    this.held = [...notes];
  }

  // Corta (en `time`) las notas del patrón que suenan o van a sonar.
  cutActive(time) {
    for (const ev of this.active) {
      if (ev.end > time) this.instrument().triggerRelease(this.toNotes(ev.notes), Math.max(time, ev.start + 0.003));
    }
    this.active = [];
  }

  // Cambio al momento: cada nota del patrón que suena o va a sonar con el acorde anterior pasa al
  // acorde nuevo (misma función: bajo, acorde, nota del arpegio…) durante lo que le quedaba.
  replaceActive(voicing) {
    const now = Tone.immediate();
    const kept = [];
    for (const ev of this.active) {
      if (ev.end <= now) continue;
      const notes = notesForEvent(ev.what, voicing);
      const from = Math.max(now, ev.start);
      const off = ev.notes.filter((n) => !notes.includes(n));
      const on = notes.filter((n) => !ev.notes.includes(n));
      if (off.length) this.instrument().triggerRelease(this.toNotes(off), ev.start > now ? ev.start + 0.003 : now);
      if (on.length && ev.end - from > MIN_REMAINING) {
        this.instrument().triggerAttackRelease(this.toNotes(on), ev.end - from, from, ev.velocity);
        this.logNote({ unit: ev.unit, step: ev.step, notes: on, kind: 'replace' });
      }
      kept.push({ ...ev, notes });
    }
    this.active = kept;
  }

  // Reloj: una llamada por unidad de rejilla, unos milisegundos antes de que suene (`time`).
  tick(time) {
    const unit = Math.round(this.unitAt(time));
    this.lastScheduled = unit;
    this.active = this.active.filter((ev) => ev.end > time - 0.1);

    // Cambio de acorde que esperaba a esta unidad (o al final de la cuenta previa).
    if (this.pending && unit >= this.pending.unit) {
      const { voicing, label } = this.pending;
      this.pending = null;
      if (this.countInUntil !== null && unit >= this.countInUntil) this.countInUntil = null;
      else if (this.restartOnChange) this.phase = unit;
      this.cutActive(time);
      this.voicing = voicing;
      this.label = label;
      if (PATTERNS[this.pattern].sustain) this.hold(allNotes(voicing), time);
      this.record({ type: 'chord', label, notes: allNotes(voicing), unit });
      Tone.Draw.schedule(() => this.onApplied?.(), time);
    }

    const { steps, beat } = METERS[this.meter];
    const step = stepOf(unit, this.phase, this.meter);
    const countingIn = this.countInUntil !== null && unit < this.countInUntil;
    if (step % beat === 0) {
      if (this.metronome || countingIn) {
        this.click.triggerAttackRelease(step === 0 ? 'C6' : 'G5', 0.03, time, step === 0 ? 1 : 0.6);
        this.clickLog.push({ unit, step, accent: step === 0, countIn: countingIn });
        if (this.clickLog.length > MAX_LOG) this.clickLog.shift();
      }
      Tone.Draw.schedule(() => this.onBeat?.(step / beat, steps / beat, countingIn), time);
    }

    if (!this.voicing || PATTERNS[this.pattern].sustain) return;
    for (const ev of notesForStep(this.pattern, step, this.voicing)) {
      const duration = Tone.Time(ev.duration).toSeconds();
      this.instrument().triggerAttackRelease(this.toNotes(ev.notes), duration, time, ev.velocity);
      this.active.push({ what: ev.what, notes: ev.notes, start: time, end: time + duration, velocity: ev.velocity, unit, step });
      this.logNote({ unit, step, notes: ev.notes, kind: 'note' });
    }
  }

  toNotes(midiNotes) {
    return midiNotes.map((m) => Tone.Frequency(m, 'midi').toNote());
  }

  logNote(entry) {
    this.noteLog.push({ ...entry, instrument: this.pianoLoaded ? 'piano' : 'keys', at: performance.now() });
    if (this.noteLog.length > MAX_LOG) this.noteLog.shift();
  }

  record(event) {
    this.log.push({ ...event, at: performance.now() });
    if (this.log.length > MAX_LOG) this.log.shift();
  }
}
