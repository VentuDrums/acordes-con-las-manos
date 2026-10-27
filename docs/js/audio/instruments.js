// Instrumentos: catálogo y construcción con Tone.js (cargado como script global en index.html).
//
// Para añadir un instrumento basta con una entrada en SOUNDS (o BASS_SOUNDS) y su nombre en i18n.js
// (`sound_<id>`). Un instrumento es:
// - de muestras grabadas: { samples: { dir, notes }, release, volume } — los archivos están en
//   docs/audio/<dir>/<nota>.mp3 (con «s» en vez de «♯»: Fs3.mp3). Tone.Sampler calcula las notas
//   intermedias a partir de las más cercanas.
// - sintetizado: { synth: nombre de una función de SYNTHS }.
// sustain: el sonido se mantiene mientras se pulsa (pad, órgano…). Si no, se apaga solo (piano,
// guitarra…): en el bloque sostenido el acorde se toca una vez y se deja sonar.

// Notas cada tres semitonos (Do, Re♯, Fa♯, La) de las octavas indicadas, más el Do de la siguiente.
const everyThird = (from, to) => [...Array.from({ length: to - from + 1 }, (_, i) => ['C', 'D#', 'F#', 'A']
  .map((n) => `${n}${from + i}`)).flat(), `C${to + 1}`];

export const SOUNDS = {
  piano: { samples: { dir: 'piano', notes: everyThird(2, 6) }, release: 0.6, volume: -4 },
  epiano: { synth: 'epiano' },
  organ: { synth: 'organ', sustain: true },
  pad: { synth: 'pad', sustain: true },
  guitarAcoustic: {
    samples: { dir: 'guitar-acoustic', notes: ['E2', 'G2', 'A#2', 'C#3', 'E3', 'G3', 'A#3', 'C#4', 'E4', 'G4', 'A#4', 'C#5'] },
    release: 0.8, volume: -5,
  },
  guitarElectric: {
    samples: { dir: 'guitar-electric', notes: ['E2', 'F#2', 'A2', 'C3', 'D#3', 'F#3', 'A3', 'C4', 'D#4', 'F#4', 'A4', 'C5', 'D#5', 'F#5', 'A5', 'C6'] },
    release: 0.5, volume: -1,
  },
  harp: {
    samples: { dir: 'harp', notes: ['B1', 'D2', 'F2', 'A2', 'C3', 'E3', 'G3', 'B3', 'D4', 'F4', 'A4', 'C5', 'E5', 'G5', 'B5', 'D6'] },
    release: 1, volume: -3,
  },
  marimba: { samples: { dir: 'marimba', notes: everyThird(2, 6) }, release: 0.4, volume: 3 },
};

// Sonidos del bajo. 'same': el mismo instrumento que el acorde; 'none': el bajo no suena.
export const BASS_SOUNDS = {
  same: { same: true },
  bassElectric: {
    samples: { dir: 'bass-electric', notes: ['A#1', 'C#2', 'E2', 'G2', 'A#2', 'C#3', 'E3', 'G3', 'A#3', 'C#4'] },
    release: 0.3, volume: -3,
  },
  contrabass: {
    samples: { dir: 'contrabass', notes: ['A#1', 'C2', 'D2', 'E2', 'F#2', 'G#2', 'A2', 'C#3', 'E3', 'G#3', 'B3'] },
    release: 0.3, volume: -5,
  },
  synthBass: { synth: 'synthBass', sustain: true },
  none: { none: true },
};

// Mientras cargan las muestras suena un sustituto sintetizado.
const FALLBACK = { chord: 'keys', bass: 'synthBass' };

// Sintetizadores. Cada uno devuelve { inst, nodes } (nodes: efectos propios, para liberarlos luego).
const SYNTHS = {
  // Teclado FM: solo se usa mientras cargan las muestras.
  keys(out) {
    const inst = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 3,
      modulationIndex: 2.5,
      envelope: { attack: 0.005, decay: 0.9, sustain: 0.25, release: 0.8 },
      modulationEnvelope: { attack: 0.005, decay: 0.4, sustain: 0.1, release: 0.5 },
      volume: -14,
    }).connect(out);
    return { inst, nodes: [] };
  },
  // Piano eléctrico (tipo Rhodes): FM suave con un poco de trémolo.
  epiano(out) {
    const tremolo = new Tone.Tremolo(4.5, 0.3).start().connect(out);
    const inst = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 1,
      modulationIndex: 2.2,
      oscillator: { type: 'sine' },
      modulation: { type: 'sine' },
      envelope: { attack: 0.002, decay: 2.5, sustain: 0.1, release: 0.9 },
      modulationEnvelope: { attack: 0.002, decay: 0.6, sustain: 0.05, release: 0.6 },
      volume: 0,
    }).connect(tremolo);
    return { inst, nodes: [tremolo] };
  },
  // Órgano: varios armónicos (como los tiradores de un órgano Hammond) y un leve vaivén.
  organ(out) {
    const tremolo = new Tone.Tremolo(6, 0.18).start().connect(out);
    const inst = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'custom', partials: [1, 0.7, 0.45, 0.3, 0.2, 0, 0, 0.15] },
      envelope: { attack: 0.01, decay: 0.1, sustain: 0.9, release: 0.12 },
      volume: -10,
    }).connect(tremolo);
    return { inst, nodes: [tremolo] };
  },
  pad(out) {
    const filter = new Tone.Filter(1800, 'lowpass').connect(out);
    const inst = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'fatsawtooth', count: 3, spread: 20 },
      envelope: { attack: 0.15, decay: 0.3, sustain: 0.8, release: 1.2 },
      volume: -13,
    }).connect(filter);
    return { inst, nodes: [filter] };
  },
  synthBass(out) {
    const inst = new Tone.PolySynth(Tone.MonoSynth, {
      oscillator: { type: 'sawtooth' },
      filter: { type: 'lowpass', Q: 1 },
      filterEnvelope: { attack: 0.005, decay: 0.25, sustain: 0.35, release: 0.2, baseFrequency: 110, octaves: 2.5 },
      envelope: { attack: 0.005, decay: 0.3, sustain: 0.7, release: 0.15 },
      volume: -9,
    }).connect(out);
    return { inst, nodes: [] };
  },
};

const fileOf = (note) => `${note.replace('#', 's')}.mp3`;

// Todos los conjuntos de muestras (sin repetir): { dir: notes }.
export function sampleSets() {
  const sets = {};
  for (const def of [...Object.values(SOUNDS), ...Object.values(BASS_SOUNDS)]) {
    if (def.samples) sets[def.samples.dir] = def.samples.notes;
  }
  return sets;
}

// Empieza a cargar un conjunto de muestras. onload() se llama al terminar.
export function loadSamples(dir, notes, onload) {
  return new Tone.ToneAudioBuffers({
    urls: Object.fromEntries(notes.map((n) => [n, fileOf(n)])),
    baseUrl: `audio/${dir}/`,
    onload,
  });
}

// Crea el instrumento `id` de `catalog` conectado a `out`. buffers: { dir: ToneAudioBuffers } ya
// cargados. part: 'chord' | 'bass' (para elegir el sustituto mientras cargan las muestras).
// Devuelve { id, playing, waiting, sustain, inst, nodes }: `playing` es lo que suena de verdad (el
// instrumento o su sustituto); `waiting`, la carpeta de muestras que espera el sustituto.
export function createInstrument(catalog, id, out, buffers, part) {
  const def = catalog[id];
  if (def.samples && !buffers[def.samples.dir]) {
    const { inst, nodes } = SYNTHS[FALLBACK[part]](out);
    inst.maxPolyphony = 48;
    return { id, playing: FALLBACK[part], waiting: def.samples.dir, sustain: false, inst, nodes };
  }
  if (def.samples) {
    const urls = Object.fromEntries(def.samples.notes.map((n) => [n, buffers[def.samples.dir].get(n)]));
    const inst = new Tone.Sampler({ urls, release: def.release, volume: def.volume }).connect(out);
    return { id, playing: id, sustain: Boolean(def.sustain), inst, nodes: [] };
  }
  const { inst, nodes } = SYNTHS[def.synth](out);
  inst.maxPolyphony = 48;
  return { id, playing: id, sustain: Boolean(def.sustain), inst, nodes };
}

// Libera un instrumento cuando ya ha terminado de sonar (tras su release).
export function disposeLater(instrument, seconds = 3) {
  setTimeout(() => {
    instrument.inst.dispose();
    instrument.nodes.forEach((n) => n.dispose());
  }, seconds * 1000);
}
