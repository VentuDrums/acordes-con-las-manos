// Motor de sonido con Tone.js (cargado como script global en index.html).
/* global Tone */

const MAX_LOG = 200;

export class AudioEngine {
  constructor() {
    this.ready = false;
    this.current = [];
    // Registro de lo que suena, para poder comprobarlo en los tests.
    this.log = [];
  }

  async start() {
    if (this.ready) return;
    await Tone.start();
    const out = new Tone.Volume(-8).toDestination();
    const reverb = new Tone.Reverb({ decay: 3, wet: 0.25 }).connect(out);
    const filter = new Tone.Filter(1800, 'lowpass').connect(reverb);
    this.synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'fatsawtooth', count: 3, spread: 20 },
      envelope: { attack: 0.15, decay: 0.3, sustain: 0.8, release: 1.2 },
      volume: -12,
    }).connect(filter);
    this.ready = true;
  }

  // Cambia al acorde indicado al instante (notas MIDI).
  playChord(midiNotes, label = '') {
    if (!this.ready) return;
    // Tone.immediate() ejecuta al momento. Con Tone.now() (que añade 0,1 s de margen) una orden
    // de soltar que llega justo después de tocar podía adelantarse y dejar notas colgadas.
    const now = Tone.immediate();
    // Las notas comunes a los dos acordes siguen sonando; solo cambian las demás.
    const off = this.current.filter((m) => !midiNotes.includes(m));
    const on = midiNotes.filter((m) => !this.current.includes(m));
    if (off.length) this.synth.triggerRelease(this.toNotes(off), now);
    if (on.length) this.synth.triggerAttack(this.toNotes(on), now, 0.7);
    this.current = [...midiNotes];
    this.record({ type: 'chord', label, notes: midiNotes });
  }

  silence() {
    if (!this.ready || !this.current.length) return;
    this.synth.triggerRelease(this.toNotes(this.current), Tone.immediate());
    this.current = [];
    this.record({ type: 'silence' });
  }

  toNotes(midiNotes) {
    return midiNotes.map((m) => Tone.Frequency(m, 'midi').toNote());
  }

  record(event) {
    this.log.push({ ...event, at: performance.now() });
    if (this.log.length > MAX_LOG) this.log.shift();
  }
}
