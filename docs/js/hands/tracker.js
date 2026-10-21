// Cámara + MediaPipe Hand Landmarker.
import { MEDIAPIPE_URL, HAND_MODEL_URL } from '../config.js';

export class HandTracker {
  // delegate: 'GPU' (por defecto, con CPU de reserva) o 'CPU'.
  async loadModel(delegate = 'GPU') {
    const { FilesetResolver, HandLandmarker } = await import(`${MEDIAPIPE_URL}/vision_bundle.mjs`);
    const vision = await FilesetResolver.forVisionTasks(`${MEDIAPIPE_URL}/wasm`);
    const options = (delegate) => ({
      baseOptions: { modelAssetPath: HAND_MODEL_URL, delegate },
      runningMode: 'VIDEO',
      numHands: 2,
    });
    try {
      this.landmarker = await HandLandmarker.createFromOptions(vision, options(delegate));
    } catch {
      this.landmarker = await HandLandmarker.createFromOptions(vision, options('CPU'));
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

  // Devuelve el resultado de MediaPipe si hay un fotograma nuevo; si no, null.
  detect() {
    const video = this.video;
    if (!video || video.readyState < 2 || video.currentTime === this.lastTime) return null;
    this.lastTime = video.currentTime;
    return this.landmarker.detectForVideo(video, performance.now());
  }
}
