// Librerías externas (versiones fijadas) y constantes generales.

export const MEDIAPIPE_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
export const HAND_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

// Tiempo que un gesto tiene que mantenerse para aceptarlo (evita parpadeos).
export const GESTURE_HOLD_MS = 150;
// Tiempo sin ver una mano antes de considerarla fuera de cámara.
export const HAND_ABSENT_MS = 300;
// MediaPipe busca primero algo con forma de palma (detección) y luego confirma que es una mano
// (presencia). Con 0,3 en la detección encuentra manos pequeñas o lejanas; con 0,7 en la presencia
// descarta lo que solo se parece a una mano (una oreja, pliegues de la ropa).
export const HAND_DETECTION_CONFIDENCE = 0.3;
export const HAND_PRESENCE_CONFIDENCE = 0.7;
// Tamaño mínimo de la palma (muñeca → base del dedo corazón), en fracción del alto de la imagen.
// Una mano a 1 m de la tablet mide un 10 % aprox.; con un 4 % se descarta lo que esté a más de 2,5 m
// y las falsas detecciones diminutas (la oreja detectada como mano medía un 2,6 %).
export const MIN_PALM_SIZE = 0.04;
