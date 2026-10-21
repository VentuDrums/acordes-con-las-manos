// Textos de la interfaz. El inglés se añade en la fase de idiomas.

const STRINGS = {
  es: {
    title: 'Acordes con las manos',
    start: 'Empezar',
    loadingModel: 'Cargando el modelo de manos…',
    askingCamera: 'Pidiendo permiso para usar la cámara…',
    cameraError: 'No se pudo activar la cámara ({error}). Puedes probar los acordes tocando la tabla.',
    intro: 'Pulsa «Empezar» y permite el uso de la cámara. La imagen no sale de tu dispositivo.',
    palmTip: 'Consejo: pon la palma de frente a la cámara, con buena luz.',
    leftHand: 'Mano izquierda',
    rightHand: 'Mano derecha',
    notSeen: 'No la veo',
    unknownGesture: 'Gesto no reconocido',
    fingersHelp: 'Dedos detectados: pulgar, índice, corazón, anular, meñique',
    silence: 'Silencio',
    legendTitle: 'Gestos de la mano izquierda (Do mayor)',
    legendHint: 'Toca una fila para oír el acorde sin usar la cámara. Con la cámara, pon la palma de frente y con buena luz.',
    unassigned: 'Sin asignar',
    gesture_fist: 'Puño',
    gesture_one: '1 dedo (índice)',
    gesture_two: '2 dedos',
    gesture_three: '3 dedos',
    gesture_four: '4 dedos (pulgar dentro)',
    gesture_five: 'Mano abierta',
    gesture_shaka: 'Pulgar + meñique',
    gesture_rock: 'Índice + meñique',
    gesture_thumb: 'Pulgar arriba',
  },
};

let lang = 'es';

export function t(key, vars = {}) {
  const text = STRINGS[lang][key] ?? key;
  return text.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
}

// Rellena los elementos con data-i18n (texto) y data-i18n-title (tooltip).
export function translatePage(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-title]').forEach((el) => { el.title = t(el.dataset.i18nTitle); });
  document.documentElement.lang = lang;
}
