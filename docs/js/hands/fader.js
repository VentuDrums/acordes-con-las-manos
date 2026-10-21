// Fader de volumen con el puño derecho: al cerrar el puño se «agarra» el fader; subir o bajar
// la mano cambia el volumen según cuánto se ha movido desde donde se cerró (sin saltos);
// al abrir la mano o sacarla de la cámara, el volumen se queda donde estaba.

// Recorrido vertical (en fracción del alto de la imagen) que va de volumen 0 a volumen máximo.
export const FADER_TRAVEL = 0.5;

const clamp01 = (v) => Math.min(1, Math.max(0, v));

export class VolumeFader {
  constructor(volume = 0.8) {
    this.volume = volume;
    this.grabbing = false;
    this.startY = 0;
    this.startVolume = volume;
  }

  // gesture: gesto estable de la mano derecha; y: altura de la palma (0 arriba, 1 abajo) o null si no se ve.
  // Devuelve true si el volumen ha cambiado.
  update(gesture, y) {
    if (gesture !== 'fist' || y === null) {
      this.grabbing = false;
      return false;
    }
    if (!this.grabbing) {
      this.grabbing = true;
      this.startY = y;
      this.startVolume = this.volume;
      return false;
    }
    const next = clamp01(this.startVolume + (this.startY - y) / FADER_TRAVEL);
    const changed = Math.abs(next - this.volume) > 1e-4;
    this.volume = next;
    return changed;
  }
}

// Altura de la palma: punto medio entre la muñeca y la base del dedo corazón.
export function palmY(landmarks) {
  return (landmarks[0].y + landmarks[9].y) / 2;
}
