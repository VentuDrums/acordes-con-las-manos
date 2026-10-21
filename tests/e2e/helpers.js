// Utilidades de los tests en navegador: fotos de manos reales, vídeo de cámara simulada y Chromium.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { startServer } from './serve.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const CACHE = path.join(ROOT, 'tests/.cache');
const IMG = path.join(CACHE, 'img');
const NM = path.join(ROOT, 'node_modules');
const BUCKET = 'https://storage.googleapis.com/mediapipe-tasks';

// Fotos de ejemplo de Google MediaPipe con el gesto que esperamos reconocer.
export const SINGLE_PHOTOS = {
  'pointing_up.jpg': { url: `${BUCKET}/gesture_recognizer/pointing_up.jpg`, expected: 'one' },
  'victory.jpg': { url: `${BUCKET}/gesture_recognizer/victory.jpg`, expected: 'two' },
  'thumbs_up.jpg': { url: `${BUCKET}/gesture_recognizer/thumbs_up.jpg`, expected: 'thumb' },
  'thumbs_down.jpg': { url: `${BUCKET}/gesture_recognizer/thumbs_down.jpg`, expected: 'thumb' },
  'fist.jpg': { url: 'https://storage.googleapis.com/mediapipe-assets/fist.jpg', expected: 'fist' },
};
// Conjunto piedra-papel-tijera: piedra = puño, papel = mano abierta, tijera = 2 dedos.
export const RPS = { rock: 'fist', paper: 'five', scissors: 'two' };

async function download(url, file) {
  if (fs.existsSync(file)) return;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudo descargar ${url}: ${res.status}`);
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
}

export async function ensurePhotos(rpsPerClass = 20) {
  fs.mkdirSync(IMG, { recursive: true });
  for (const [name, { url }] of Object.entries(SINGLE_PHOTOS)) await download(url, path.join(IMG, name));
  const rps = [];
  for (const [cls, expected] of Object.entries(RPS)) {
    const listing = await (await fetch(`${BUCKET}?prefix=gesture_recognizer/rps_data_sample/${cls}/`)).text();
    const keys = [...listing.matchAll(/<Key>([^<]+\.jpg)<\/Key>/g)].map((m) => m[1]).slice(0, rpsPerClass);
    for (const key of keys) {
      const name = `rps_${cls}_${path.basename(key)}`;
      await download(`${BUCKET}/${key}`, path.join(IMG, name));
      rps.push({ name, expected });
    }
  }
  return rps;
}

// Vídeo para la cámara simulada. Cada escena es { photo, crop? } (o null para un fondo vacío)
// y dura `seconds` segundos. La foto se pone en la mitad derecha de la imagen, que en espejo
// es la izquierda: la app la toma como mano izquierda.
export function buildCameraVideo(name, scenes, seconds = 2) {
  const out = path.join(CACHE, `${name}.mjpeg`);
  if (fs.existsSync(out)) return out;
  const inputs = [];
  const filters = [];
  scenes.forEach((scene, i) => {
    if (scene) inputs.push('-loop', '1', '-t', String(seconds), '-i', path.join(IMG, scene.photo));
    else inputs.push('-f', 'lavfi', '-t', String(seconds), '-i', 'color=c=0x404040:s=640x360');
    const crop = scene?.crop ? `crop=${scene.crop},` : '';
    filters.push(scene
      ? `[${i}:v]${crop}scale=-2:300,pad=640:360:440-iw/2:(360-ih)/2:0x404040,setsar=1,fps=15[v${i}]`
      : `[${i}:v]fps=15,setsar=1[v${i}]`);
  });
  const concat = scenes.map((_, i) => `[v${i}]`).join('') + `concat=n=${scenes.length}:v=1:a=0,format=yuvj420p[out]`;
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', [...filters, concat].join(';'),
    '-map', '[out]', '-q:v', '4', out]);
  return out;
}

// Abre la app en Chromium. Las librerías de CDN se sirven desde node_modules (mismas versiones).
// Chromium de pruebas no tiene GPU (la emula muy despacio), así que se fuerza la CPU.
export async function openApp({ video, viewport = { width: 1280, height: 800 }, query = '?delegate=CPU' } = {}) {
  const server = await startServer(0, { '/__fixtures/': IMG });
  const args = ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
    '--autoplay-policy=no-user-gesture-required'];
  if (video) args.push(`--use-file-for-fake-video-capture=${video}`);
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium',
    args,
  });
  const page = await browser.newPage({ viewport });
  const errors = [];
  // MediaPipe escribe avisos informativos por console.error ("INFO: ..."); no son errores.
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().startsWith('INFO:')) errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.49/Tone.js',
    (r) => r.fulfill({ path: path.join(NM, 'tone/build/Tone.js'), contentType: 'text/javascript' }));
  await page.route('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/**', (r) => {
    const rel = new URL(r.request().url()).pathname.split('@0.10.14/')[1];
    r.fulfill({
      path: path.join(NM, '@mediapipe/tasks-vision', rel),
      contentType: rel.endsWith('.wasm') ? 'application/wasm' : 'text/javascript',
    });
  });
  const base = `http://localhost:${server.address().port}`;
  await page.goto(`${base}/index.html${query}`);
  return {
    page, errors, base,
    async close() {
      await browser.close();
      server.close();
    },
  };
}
