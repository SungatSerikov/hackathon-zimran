// Статический сервер для превью сцены. Без зависимостей, только 127.0.0.1.
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { dirname, join, resolve, sep, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(join(dirname(fileURLToPath(import.meta.url)), '..', '..'));
const PORT = Number(process.env.PORT) || 5174;
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png',
  '.webp': 'image/webp', '.wav': 'audio/wav', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};

function send(res, code, body) {
  res.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(body);
}

export const server = createServer(async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method Not Allowed');
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    return send(res, 400, 'Bad Request');
  }
  if (pathname.includes('\0')) return send(res, 400, 'Bad Request');
  if (pathname === '/') pathname = '/tools/scene-preview/index.html';
  const file = resolve(join(ROOT, '.' + pathname));
  if (file !== ROOT && !file.startsWith(ROOT + sep)) return send(res, 403, 'Forbidden');
  try {
    const st = await stat(file);
    if (!st.isFile()) return send(res, 404, 'Not Found');
    res.writeHead(200, {
      'Content-Type': MIME[extname(file).toLowerCase()] || 'application/octet-stream',
      'Content-Length': st.size,
      'Cache-Control': 'no-store',
    });
    if (req.method === 'HEAD') return res.end();
    const stream = createReadStream(file);
    stream.on('error', () => res.destroy());
    stream.pipe(res);
  } catch {
    send(res, 404, 'Not Found');
  }
});

server.on('error', (e) => {
  console.error(e.code === 'EADDRINUSE' ? `Порт ${PORT} занят. Задайте другой через переменную PORT.` : 'Ошибка сервера: ' + e.message);
  process.exit(1);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Scene preview: http://127.0.0.1:${PORT}/`);
});
