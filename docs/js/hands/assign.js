// Decide qué mano detectada es la izquierda y cuál la derecha de quien toca.
// La imagen de la cámara no está en espejo: la mano izquierda aparece a la derecha (x mayor).
// En pantalla se muestra en espejo, así que la izquierda se ve a la izquierda.

export function assignHands(result, swap = false) {
  const hands = result.landmarks.map((landmarks, i) => ({
    landmarks,
    world: result.worldLandmarks?.[i] ?? landmarks,
  }));
  const out = { left: null, right: null };
  if (hands.length >= 2) {
    const [a, b] = [...hands].sort((h1, h2) => h2.landmarks[0].x - h1.landmarks[0].x);
    out.left = a;
    out.right = b;
  } else if (hands.length === 1) {
    out[hands[0].landmarks[0].x > 0.5 ? 'left' : 'right'] = hands[0];
  }
  return swap ? { left: out.right, right: out.left } : out;
}
