// Motor de sonido con Tone.js (cargado como script global en index.html).
//
// Un reloj (Tone.Transport) avanza en unidades de rejilla del compás (semicorcheas o corcheas, ver
// timing.js). En cada unidad:
//   - aplica el cambio de acorde que estuviera esperando a ese pulso o compás,
//   - toca el click del metrónomo en cada pulso (y durante la cuenta previa),
//   - toca las notas del patrón rítmico.
// El bloque sostenido no usa la rejilla: el acorde suena mientras no cambie (con un instrumento que se
// apaga solo, como el piano, se toca una vez y se deja sonar).
//
// Hay dos instrumentos (ver instruments.js): el del acorde y el del bajo. Cada evento del patrón va a
// uno u otro (partOf). El bajo tiene su propio volumen.
//
// Cambio «al momento»: lo que aún suena (o está a punto de sonar) del acorde anterior se corta y el
// acorde nuevo entra en ese momento con el resto de la duración de cada nota.
/* global Tone */
import { PATTERNS, notesForEvent, notesForStep, partOf } from '../music/patterns.js';
import { SOUNDS, BASS_SOUNDS, sampleSets, loadSamples, createInstrument, disposeLater } from './instruments.js';
import { METERS, unitsPerQuarter, quarterBpm, stepOf, planChange, lateUnits } from '../music/timing.js';

const MAX_LOG = 400;
// Margen con el que se preparan las notas (Tone usa 0,1 s): menos margen, menos cambios «tarde».
const LOOK_AHEAD = 0.05;
// Una nota que ya solo iba a sonar menos que esto no se sustituye al cambiar de acorde.
const MIN_REMAINING = 0.06;

const unique = (notes) => [...new Set(notes)];
const allNotes = (voicing) => unique([voicing.bass, ...voicing.notes]);
// Volumen del bajo (0…1) → ganancia: 0,7 deja el bajo como viene de fábrica (≈1); 1 lo duplica.
const bassGain = (v) => 2 * v ** 2;
const PARTS = ['chord', 'bass'];

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
    this.held = { chord: [], bass: [] }; // notas que mantiene el bloque sostenido
    this.active = []; // notas del patrón que suenan o van a sonar: { what, part, notes, start, end, velocity, unit, step }
    this.volume = 0.8;
    this.sound = 'piano'; // instrumento del acorde (SOUNDS)
    this.bassSound = 'same'; // instrumento del bajo (BASS_SOUNDS)
    this.bassVolume = 0.7;
    this.voices = { chord: null, bass: null }; // instrumentos creados (ver createInstrument)
    this.buffers = {}; // muestras ya cargadas: { carpeta: ToneAudioBuffers }
    this.onLoadingChange = null; // () → empiezan a cargar las muestras o termina de cargar un instrumento
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
    this.chordOut = new Tone.Reverb({ decay: 3, wet: 0.25 }).connect(this.out);
    this.bassOut = new Tone.Gain(bassGain(this.bassVolume)).connect(this.out);
    // Se cargan todas las muestras al empezar (las elegidas primero): luego cambiar de instrumento
    // es inmediato. Mientras tanto suena un sustituto sintetizado.
    const sets = Object.entries(sampleSets());
    const chosen = [SOUNDS[this.sound], BASS_SOUNDS[this.bassSound]].map((d) => d.samples?.dir);
    sets.sort(([a], [b]) => chosen.includes(b) - chosen.includes(a));
    for (const [dir, notes] of sets) {
      const buffers = loadSamples(dir, notes, () => {
        this.buffers[dir] = buffers;
        // Los instrumentos que esperaban estas muestras pasan a sonar con ellas.
        for (const part of PARTS) if (this.voices[part]?.waiting === dir) this.buildVoice(part);
        this.onLoadingChange?.();
      });
    }
    this.buildVoice('chord');
    this.buildVoice('bass');
    // El metrónomo va aparte: el fader de volumen no le afecta.
    this.clickOut = new Tone.Gain(this.metronomeVolume).toDestination();
    this.click = new Tone.Synth({
      oscillator: { type: 'square' },
      envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.02 },
      volume: -10,
    }).connect(this.clickOut);
    this.ready = true;
    this.startClock();
    this.onLoadingChange?.();
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

  // Escucha del editor de patrones: el acorde suena ya, sin cuenta previa ni espera al compás.
  playNow(voicing, label) {
    if (!this.ready) return;
    this.pending = null;
    this.countInUntil = null;
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
    if (PATTERNS[this.pattern].sustain) this.hold(voicing);
    this.record({ type: 'chord', label, notes: allNotes(voicing), unit: Math.floor(this.unitAt(Tone.immediate())) });
  }

  setPattern(id) {
    if (id === this.pattern) return;
    this.pattern = id;
    if (!this.ready) return;
    if (PATTERNS[id].sustain && this.voicing) this.hold(this.voicing);
    else {
      this.hold(null);
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
    for (const ev of notesForStep(this.pattern, step, this.voicing)) this.play(ev, now, unit, step, 'catchup');
  }

  silence() {
    if (!this.ready) return;
    const wasPlaying = this.voicing !== null || this.pending !== null;
    this.voicing = null;
    this.pending = null;
    this.countInUntil = null;
    this.hold(null);
    const now = Tone.immediate();
    this.cutActive(now);
    for (const part of PARTS) this.voices[part]?.inst.releaseAll(now);
    if (wasPlaying) this.record({ type: 'silence' });
  }

  setVolume(volume) {
    this.volume = volume;
    // Curva cuadrática: el volumen se percibe más natural que con una recta.
    if (this.ready) this.out.gain.rampTo(volume ** 2, 0.05);
  }

  // Instrumentos: { sound, bassSound, bassVolume }.
  setSounds({ sound, bassSound, bassVolume }) {
    const chordChanged = sound !== this.sound;
    const bassChanged = chordChanged || bassSound !== this.bassSound; // 'same' sigue al acorde
    Object.assign(this, { sound, bassSound, bassVolume });
    if (!this.ready) return;
    this.bassOut.gain.rampTo(bassGain(bassVolume), 0.05);
    if (chordChanged) this.buildVoice('chord');
    if (bassChanged) this.buildVoice('bass');
  }

  // (Re)crea el instrumento de una parte. Lo que sonaba con el anterior se apaga y, en el bloque
  // sostenido, el acorde vuelve a sonar con el nuevo.
  buildVoice(part) {
    const now = Tone.immediate();
    this.cutActive(now, part);
    const old = this.voices[part];
    if (old) {
      old.inst.releaseAll(now);
      disposeLater(old);
    }
    this.held[part] = [];
    const out = part === 'chord' ? this.chordOut : this.bassOut;
    const bass = BASS_SOUNDS[this.bassSound];
    if (part === 'chord') this.voices.chord = createInstrument(SOUNDS, this.sound, out, this.buffers, 'chord');
    else if (bass.none) this.voices.bass = null;
    // «El mismo que el acorde»: otro ejemplar del instrumento del acorde, para que el bajo tenga su volumen.
    else if (bass.same) this.voices.bass = createInstrument(SOUNDS, this.sound, out, this.buffers, 'chord');
    else this.voices.bass = createInstrument(BASS_SOUNDS, this.bassSound, out, this.buffers, 'bass');
    if (this.voicing && PATTERNS[this.pattern].sustain) this.holdPart(part, this.voicing, now);
  }

  get pianoLoaded() {
    return Boolean(this.buffers.piano);
  }

  // ¿Están cargadas las muestras de este instrumento? (los sintetizados siempre lo están)
  isLoaded(id) {
    const def = SOUNDS[id] ?? BASS_SOUNDS[id];
    return !def?.samples || Boolean(this.buffers[def.samples.dir]);
  }

  // Voces que suenan en los instrumentos sintetizados (para los tests).
  activeVoices() {
    return PARTS.reduce((n, part) => n + (this.voices[part]?.inst.activeVoices ?? 0), 0);
  }

  // Bloque sostenido: mantiene sonando exactamente este acorde (o nada, con null).
  // Tone.immediate() ejecuta al momento: con Tone.now() (que añade un margen) una orden de soltar
  // que llega justo después de tocar podía adelantarse y dejar notas colgadas.
  hold(voicing, time = Tone.immediate()) {
    for (const part of PARTS) this.holdPart(part, voicing, time);
  }

  // Con un instrumento que se mantiene (pad, órgano…), las notas comunes con el acorde anterior no se
  // repiten. Con uno que se apaga solo (piano, guitarra…), el acorde nuevo se toca entero.
  holdPart(part, voicing, time) {
    const voice = this.voices[part];
    const notes = !voicing ? [] : part === 'chord' ? voicing.notes : [voicing.bass];
    const held = this.held[part];
    this.held[part] = voice ? [...notes] : [];
    if (!voice || (held.length === notes.length && held.every((m) => notes.includes(m)))) return;
    const off = voice.sustain ? held.filter((m) => !notes.includes(m)) : held;
    const on = voice.sustain ? notes.filter((m) => !held.includes(m)) : notes;
    if (off.length) voice.inst.triggerRelease(this.toNotes(off), time);
    if (on.length) voice.inst.triggerAttack(this.toNotes(on), time, 0.7);
  }

  // Toca un evento del patrón (si su parte suena) y lo apunta en las notas activas.
  play(ev, time, unit, step, kind) {
    const part = partOf(ev.what);
    const voice = this.voices[part];
    if (!voice) return;
    const duration = Tone.Time(ev.duration).toSeconds();
    voice.inst.triggerAttackRelease(this.toNotes(ev.notes), duration, time, ev.velocity);
    this.active.push({ what: ev.what, part, notes: ev.notes, start: time, end: time + duration, velocity: ev.velocity, unit, step });
    this.logNote({ unit, step, notes: ev.notes, kind, part, instrument: voice.playing });
  }

  // Corta (en `time`) las notas del patrón que suenan o van a sonar (de una parte o de todas).
  cutActive(time, part = null) {
    const kept = [];
    for (const ev of this.active) {
      if (part && ev.part !== part) {
        kept.push(ev);
        continue;
      }
      const voice = this.voices[ev.part];
      if (voice && ev.end > time) voice.inst.triggerRelease(this.toNotes(ev.notes), Math.max(time, ev.start + 0.003));
    }
    this.active = kept;
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
      const voice = this.voices[ev.part];
      if (!voice) continue;
      if (off.length) voice.inst.triggerRelease(this.toNotes(off), ev.start > now ? ev.start + 0.003 : now);
      if (on.length && ev.end - from > MIN_REMAINING) {
        voice.inst.triggerAttackRelease(this.toNotes(on), ev.end - from, from, ev.velocity);
        this.logNote({ unit: ev.unit, step: ev.step, notes: on, kind: 'replace', part: ev.part, instrument: voice.playing });
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
      if (PATTERNS[this.pattern].sustain) this.hold(voicing, time);
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
    for (const ev of notesForStep(this.pattern, step, this.voicing)) this.play(ev, time, unit, step, 'note');
  }

  toNotes(midiNotes) {
    return midiNotes.map((m) => Tone.Frequency(m, 'midi').toNote());
  }

  logNote(entry) {
    this.noteLog.push({ ...entry, at: performance.now() });
    if (this.noteLog.length > MAX_LOG) this.noteLog.shift();
  }

  record(event) {
    this.log.push({ ...event, at: performance.now() });
    if (this.log.length > MAX_LOG) this.log.shift();
  }
}
