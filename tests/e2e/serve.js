// Servidor estático mínimo para probar la app en local: `npm run serve` y abre http://localhost:8000
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.wasm': 'application/wasm',
};

// mounts: { '/prefijo/': carpeta }. Lo que no encaja se sirve desde docs/.
export function startServer(port = 0, mounts = {}) {
  const roots = { ...mounts, '/': path.join(ROOT, 'docs') };
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const prefix = Object.keys(roots).find((p) => url.startsWith(p));
    let file = path.join(roots[prefix], url.slice(prefix.length));
    if (url.endsWith('/')) file = path.join(file, 'index.html');
    if (!file.startsWith(roots[prefix]) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404).end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const server = await startServer(Number(process.env.PORT ?? 8000));
  console.log(`Abre http://localhost:${server.address().port}`);
}
