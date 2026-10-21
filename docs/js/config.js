// Librerías externas (versiones fijadas) y constantes generales.

export const MEDIAPIPE_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
export const HAND_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

// Tiempo que un gesto tiene que mantenerse para aceptarlo (evita parpadeos).
export const GESTURE_HOLD_MS = 150;
// Tiempo sin ver una mano antes de considerarla fuera de cámara.
export const HAND_ABSENT_MS = 300;
