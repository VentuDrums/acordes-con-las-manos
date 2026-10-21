// Dibuja la cámara en espejo con las manos detectadas.
import { GESTURES } from '../hands/gestures.js';

const CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
];
export const HAND_COLORS = { left: '#3ee6ff', right: '#ff5fd8' };

// hands: { left, right } con los puntos de cada mano; gestures: { left, right } gesto visto (o null).
export function drawStage(canvas, video, hands, gestures) {
  const ctx = canvas.getContext('2d');
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  ctx.save();
  ctx.translate(w, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0, w, h);
  ctx.restore();

  // Guía central: cada mano en su mitad.
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.setLineDash([12, 12]);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(w / 2, 0);
  ctx.lineTo(w / 2, h);
  ctx.stroke();
  ctx.setLineDash([]);

  const scale = Math.max(1, w / 640);
  for (const side of ['left', 'right']) {
    const hand = hands[side];
    if (!hand) continue;
    // Coordenadas en espejo, como se ve en pantalla.
    const pts = hand.landmarks.map((p) => [(1 - p.x) * w, p.y * h]);
    ctx.strokeStyle = HAND_COLORS[side];
    ctx.lineWidth = 3 * scale;
    for (const [a, b] of CONNECTIONS) {
      ctx.beginPath();
      ctx.moveTo(...pts[a]);
      ctx.lineTo(...pts[b]);
      ctx.stroke();
    }
    ctx.fillStyle = '#ffffff';
    for (const [x, y] of pts) {
      ctx.beginPath();
      ctx.arc(x, y, 3.5 * scale, 0, Math.PI * 2);
      ctx.fill();
    }
    const g = gestures[side];
    if (g) {
      ctx.font = `${Math.round(36 * scale)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(GESTURES[g], pts[0][0], Math.min(h - 8, pts[0][1] + 48 * scale));
    }
  }
}
