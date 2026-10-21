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
    legendTitleScale: 'Mano izquierda · {scale}',
    legendTitleCustom: 'Mano izquierda · acordes a tu gusto',
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
    gesture_none: 'ningún gesto',

    settings: 'Configuración',
    close: 'Cerrar',
    leftHandSection: 'Mano izquierda: elige el acorde',
    modeScale: 'Por escala',
    modeCustom: 'Acordes a tu gusto',
    modeScaleHelp: 'Cada gesto toca un grado de la escala, del I al VII.',
    modeCustomHelp: 'Elige qué acorde toca cada gesto.',
    tonic: 'Tónica',
    scale: 'Escala',
    sevenths: 'Con séptima (cuatriadas)',
    fillFromScale: 'Rellenar con los acordes de la escala',
    chordRoot: 'Nota del acorde',
    chordQuality: 'Tipo de acorde',
    handsSection: 'Manos',
    swapHands: 'Intercambiar las manos (si salen al revés)',
    calibrationSection: 'Calibrar gestos',
    calibrationHelp: 'Graba unos segundos de cada gesto para ver si se reconoce bien y descargar las medidas de tus manos.',
    calibrate: 'Calibrar gestos',

    calibTitle: 'Calibración de gestos',
    calibHelp: 'Elige la mano, toca «Grabar» en un gesto y hazlo delante de la cámara. Mientras calibras no suena nada.',
    calibHand: 'Mano que calibras',
    record: 'Grabar',
    recordAgain: 'Repetir',
    calibGetReady: 'Prepárate: {gesture} con la {hand} · {seconds}',
    calibRecording: 'Grabando {gesture} · {seconds} s',
    calibNoHand: 'No se ha visto la mano. Ponla en su lado de la pantalla y repite.',
    calibResult: '{ok} de {total} bien ({percent} %)',
    calibConfusions: 'Confundido con: {list}',
    download: 'Descargar datos ({count} muestras)',
    clearData: 'Borrar datos',
    exitCalibration: 'Salir de la calibración',
    leftHandLower: 'mano izquierda',
    rightHandLower: 'mano derecha',

    scale_major: 'Mayor (jónica)',
    scale_minor: 'Menor natural (eólica)',
    scale_harmonicMinor: 'Menor armónica',
    scale_melodicMinor: 'Menor melódica',
    scale_dorian: 'Dórica',
    scale_phrygian: 'Frigia',
    scale_lydian: 'Lidia',
    scale_mixolydian: 'Mixolidia',
    scale_locrian: 'Locria',

    quality_maj: 'Mayor',
    quality_min: 'Menor',
    quality_dim: 'Disminuido',
    quality_aug: 'Aumentado',
    quality_sus2: 'Sus2',
    quality_sus4: 'Sus4',
    quality_6: 'Sexta',
    quality_m6: 'Menor sexta',
    quality_7: 'Séptima (dominante)',
    quality_maj7: 'Séptima mayor',
    quality_m7: 'Menor séptima',
    quality_mMaj7: 'Menor con séptima mayor',
    quality_m7b5: 'Semidisminuido (m7♭5)',
    quality_dim7: 'Disminuido con séptima',
    quality_augMaj7: 'Aumentado con séptima mayor',
    quality_add9: 'Add9',
    quality_madd9: 'Menor add9',
    quality_9: 'Novena',
    quality_maj9: 'Novena mayor',
    quality_m9: 'Menor novena',
    quality_5: 'Quinta (power chord)',
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
