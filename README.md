# Acordes con las manos

Sinte de acompañamiento que se toca con gestos de las manos delante de la cámara. La mano izquierda elige el acorde y la derecha, cómo suena. Proyecto del máster de IA aplicada a la educación.

- **Reconocimiento de manos:** [MediaPipe Hand Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker), que se ejecuta en el propio navegador. La imagen de la cámara no sale del dispositivo.
- **Sonido:** [Tone.js](https://tonejs.github.io/).
- **Plan del proyecto y estado de cada fase:** [`PLAN.md`](PLAN.md).

## Usarla

Abre la app publicada en GitHub Pages con Chrome o Edge, pulsa «Empezar» y permite el uso de la cámara. Pon la palma de frente a la cámara, con buena luz.

Si la tarjeta gráfica del dispositivo da problemas, añade `?delegate=CPU` al final de la dirección.

## Desarrollo

- La app está en `docs/` (HTML, CSS y módulos JavaScript, sin paso de compilación).
- `npm run serve`: sirve la app en `http://localhost:8000`.
- `npm test`: tests de la lógica (teoría musical, gestos).
- `npm install` y `npm run test:e2e`: tests en Chromium con una cámara simulada que usa fotos de manos reales de los ejemplos de MediaPipe. Necesitan `ffmpeg` y Chromium (ruta configurable con la variable `CHROMIUM_PATH`).

## Publicar

En GitHub, *Settings → Pages → Deploy from a branch*, rama `main`, carpeta `/docs`.
