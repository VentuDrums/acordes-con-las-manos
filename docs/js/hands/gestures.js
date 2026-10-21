// Reconocimiento de gestos a partir de los 21 puntos de una mano de MediaPipe.

export const GESTURES = {
  fist: '✊', one: '☝️', two: '✌️', three: '3️⃣', four: '4️⃣',
  five: '🖐️', shaka: '🤙', rock: '🤘', thumb: '👍',
};

// Gestos a los que se puede asignar un acorde (el puño tiene función fija).
export const ASSIGNABLE = ['one', 'two', 'three', 'four', 'five', 'shaka', 'rock', 'thumb'];

// Valor especial: la mano no está en cámara.
export const ABSENT = 'absent';

// Umbrales ajustados con fotos de manos reales (ver tests/e2e/photos.test.js).
// Un dedo está estirado si su punta está claramente más lejos de la muñeca que su articulación media.
export const FINGER_EXTENDED_RATIO = 1.1;
// Pulgar fuera: su punta se aleja de la base del meñique más que la base del propio pulgar.
export const THUMB_OUT_RATIO = 1.1;

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, (a.z ?? 0) - (b.z ?? 0));

// Medidas de cada dedo [pulgar, índice, corazón, anular, meñique]: cuanto mayor, más estirado.
// Pulgar: distancia de su punta a la base del meñique / la de la base del pulgar.
// Resto: distancia de la punta a la muñeca / la de su articulación media.
// Conviene pasar worldLandmarks (en metros): no dependen de lo lejos que esté la mano.
export function fingerMeasures(lm) {
  const wrist = lm[0];
  const thumb = dist(lm[4], lm[17]) / dist(lm[2], lm[17]);
  const others = [[6, 8], [10, 12], [14, 16], [18, 20]].map(([pip, tip]) => dist(wrist, lm[tip]) / dist(wrist, lm[pip]));
  return [thumb, ...others];
}

// [pulgar, índice, corazón, anular, meñique] → estirado o no.
export function fingerStates(lm) {
  const m = fingerMeasures(lm);
  return m.map((v, i) => v > (i === 0 ? THUMB_OUT_RATIO : FINGER_EXTENDED_RATIO));
}

// El pulgar solo se tiene en cuenta donde hace falta para distinguir gestos (es el dedo menos fiable).
export function classify([t, i, m, r, p]) {
  if (!i && !m && !r && !p) return t ? 'thumb' : 'fist';
  if (!i && !m && !r && p) return t ? 'shaka' : null;
  if (i && !m && !r && p) return 'rock';
  if (i && !m && !r && !p) return 'one';
  if (i && m && !r && !p) return 'two';
  if (i && m && r && !p) return 'three';
  if (i && m && r && p) return t ? 'five' : 'four';
  return null;
}

// Filtra lo que se ve en cada fotograma para que el gesto no parpadee.
// update() recibe un gesto, null (mano visible pero gesto no reconocido) o ABSENT,
// y devuelve el gesto estable: el último que se ha mantenido el tiempo necesario.
export class GestureFilter {
  constructor({ holdMs, absentMs }) {
    this.holdMs = holdMs;
    this.absentMs = absentMs;
    this.candidate = undefined;
    this.since = 0;
    this.stable = ABSENT;
  }

  update(observation, now) {
    if (observation !== this.candidate) {
      this.candidate = observation;
      this.since = now;
    }
    const needed = observation === ABSENT ? this.absentMs : this.holdMs;
    if (observation !== null && now - this.since >= needed) this.stable = observation;
    return this.stable;
  }
}
