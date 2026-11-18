// STACKED game server: serves the game files and does WebRTC signalling. No dependencies.
//   node server/signal.mjs            then open http://localhost:8080
//
// Signalling is only the handshake. A browser listens on GET /sig/<room>/<id> (server-sent events) and
// anyone can POST a message to /sig/<room>/<id>. The host listens as "host"; a joining friend posts an
// offer to the host and listens under its own id for the answer. After that the browsers talk directly.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8080);
const TYPES = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg' };
const listeners = new Map();                       // "room/id" -> response stream

const SKELETON = (body) => `<!doctype html><html><head><meta charset="utf8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>html,body{margin:0}</style></head><body>${body}</body></html>`;

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const sig = url.pathname.match(/^\/sig\/([A-Za-z0-9]{1,12})\/([A-Za-z0-9]{1,16})$/);
  if (url.pathname === '/sig/ping') { res.writeHead(200).end('ok'); return; }
  if (sig) {
    const key = sig[1].toUpperCase() + '/' + sig[2];
    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
      res.write(':ok\n\n');
      listeners.set(key, res);
      const beat = setInterval(() => res.write(':\n\n'), 20000);
      req.on('close', () => { clearInterval(beat); if (listeners.get(key) === res) listeners.delete(key); });
      return;
    }
    if (req.method === 'POST') {
      let body = '';
      req.on('data', (c) => { body += c; if (body.length > 20000) req.destroy(); });
      req.on('end', () => {
        const to = listeners.get(key);
        if (!to) { res.writeHead(404).end('nobody there'); return; }
        to.write(`data: ${body.replace(/\n/g, '')}\n\n`);
        res.writeHead(204).end();
      });
      return;
    }
  }
  try {
    let path = normalize(url.pathname).replace(/^(\.\.[/\\])+/, '');
    if (path === '/' || path === '\\') {
      const page = await readFile(join(ROOT, process.env.PAGE || 'stacked.html'), 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html' }).end(SKELETON(page));
      return;
    }
    if (!/^[/\\](js|vendor|assets)[/\\]/.test(path)) throw new Error('not served');
    const data = await readFile(join(ROOT, path));
    res.writeHead(200, { 'Content-Type': TYPES[extname(path)] || 'application/octet-stream' }).end(data);
  } catch {
    res.writeHead(404).end('not found');
  }
}).listen(PORT, () => console.log(`STACKED is running on http://localhost:${PORT}`));
