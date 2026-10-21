// Cámara + MediaPipe Hand Landmarker.
//
// Cada mano se busca en su zona de la imagen, con su propio detector: la parte derecha de la cámara
// (izquierda en espejo) para la mano izquierda y la parte izquierda para la derecha. Así la mano
// llega mucho más grande al detector de MediaPipe, que reduce la imagen a 192×192 píxeles, y la
// encuentra aunque esté lejos de la cámara. Las dos zonas se solapan en el centro para no cortar
// una mano que cruce la línea central.
import {
  MEDIAPIPE_URL, HAND_MODEL_URL, HAND_DETECTION_CONFIDENCE, HAND_PRESENCE_CONFIDENCE, MIN_PALM_SIZE,
} from '../config.js';

// Ancho de cada zona, en fracción del ancho de la imagen.
export const REGION_WIDTH = 0.65;
// Dónde empieza la zona de cada mano en la imagen de la cámara (sin espejo).
const REGION_START = { left: 1 - REGION_WIDTH, right: 0 };
// Dos detecciones con las muñecas más cerca que esto son la misma mano.
const SAME_HAND_DISTANCE = 0.05;

// Pasa los puntos de una zona a coordenadas de la imagen completa.
export function toFullFrame(landmarks, start, width = REGION_WIDTH) {
  return landmarks.map((p) => ({ ...p, x: start + p.x * width }));
}

// Tamaño de la palma (muñeca → base del dedo corazón) en fracción del alto de una imagen w × h.
export function palmSize(landmarks, w, h) {
  const a = landmarks[0];
  const b = landmarks[9];
  return Math.hypot((a.x - b.x) * w, (a.y - b.y) * h) / h;
}

// Si los dos detectores han encontrado la misma mano (en la zona compartida), se queda solo en el
// lado de la línea central donde está la muñeca. En la imagen sin espejo, x > 0,5 es la izquierda.
export function resolveOverlap(hands) {
  const { left, right } = hands;
  if (!left || !right) return hands;
  const a = left.landmarks[0];
  const b = right.landmarks[0];
  if (Math.hypot(a.x - b.x, a.y - b.y) > SAME_HAND_DISTANCE) return hands;
  return a.x > 0.5 ? { left, right: null } : { left: null, right };
}

export class HandTracker {
  constructor() {
    this.swap = false; // por si las manos salen al revés
    this.detectors = {};
    this.canvases = {};
  }

  // delegate: 'CPU' (por defecto) o 'GPU' (con CPU de reserva si falla).
  async loadModel(delegate = 'CPU') {
    const { FilesetResolver, HandLandmarker } = await import(`${MEDIAPIPE_URL}/vision_bundle.mjs`);
    const vision = await FilesetResolver.forVisionTasks(`${MEDIAPIPE_URL}/wasm`);
    const create = (d) => HandLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: HAND_MODEL_URL, delegate: d },
      runningMode: 'VIDEO',
      numHands: 1,
      minHandDetectionConfidence: HAND_DETECTION_CONFIDENCE,
      minHandPresenceConfidence: HAND_PRESENCE_CONFIDENCE,
    });
    for (const side of ['left', 'right']) {
      try {
        this.detectors[side] = await create(delegate);
      } catch {
        this.detectors[side] = await create('CPU');
      }
      this.canvases[side] = document.createElement('canvas');
    }
  }

  async startCamera(video) {
    video.srcObject = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
    });
    await video.play();
    this.video = video;
    this.lastTime = -1;
  }

  // Si hay un fotograma nuevo devuelve { left, right }: cada mano con sus puntos en la imagen
  // completa (landmarks) y en metros (world), o null si no se ve. Si no hay fotograma nuevo, null.
  detect() {
    const video = this.video;
    if (!video || video.readyState < 2 || video.currentTime === this.lastTime) return null;
    this.lastTime = video.currentTime;
    const w = video.videoWidth;
    const h = video.videoHeight;
    const rw = Math.round(w * REGION_WIDTH);
    const now = performance.now();
    const hands = {};
    for (const side of ['left', 'right']) {
      const canvas = this.canvases[side];
      if (canvas.width !== rw || canvas.height !== h) {
        canvas.width = rw;
        canvas.height = h;
      }
      const sx = Math.round(REGION_START[side] * w);
      canvas.getContext('2d').drawImage(video, sx, 0, rw, h, 0, 0, rw, h);
      const r = this.detectors[side].detectForVideo(canvas, now);
      const landmarks = r.landmarks.length ? toFullFrame(r.landmarks[0], sx / w, rw / w) : null;
      // Una «mano» diminuta es casi siempre otra cosa (una oreja, un pliegue de la ropa).
      hands[side] = landmarks && palmSize(landmarks, w, h) >= MIN_PALM_SIZE
        ? { landmarks, world: r.worldLandmarks[0] }
        : null;
    }
    const resolved = resolveOverlap(hands);
    return this.swap ? { left: resolved.right, right: resolved.left } : resolved;
  }
}
