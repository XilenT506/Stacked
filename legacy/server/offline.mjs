// STACKED offline launcher: plays with no internet. Starts a small local server (game page + signalling for
// friends on the same home network) and opens the game in the browser. Built into one file per platform.
import http from 'node:http';
import { readFile } from 'node:fs';
import { dirname, join } from 'node:path';
import { networkInterfaces } from 'node:os';
import { exec } from 'node:child_process';

const here = dirname(process.execPath.endsWith('bun') || process.execPath.endsWith('node') || process.execPath.endsWith('node.exe') ? process.argv[1] : process.execPath);
const PAGE = join(here, 'stacked.html');
const listeners = new Map();
const SKELETON = (body) => `<!doctype html><html><head><meta charset="utf8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Stacked</title><style>html,body{margin:0}</style></head><body>${body}</body></html>`;

function handler(req, res) {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/sig/ping') { res.writeHead(200).end('ok'); return; }
  const sig = url.pathname.match(/^\/sig\/([A-Za-z0-9]{1,12})\/([A-Za-z0-9]{1,16})$/);
  if (sig) {
    const key = sig[1].toUpperCase() + '/' + sig[2];
    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
      res.write(':ok\n\n'); listeners.set(key, res);
      const beat = setInterval(() => res.write(':\n\n'), 20000);
      req.on('close', () => { clearInterval(beat); if (listeners.get(key) === res) listeners.delete(key); });
      return;
    }
    if (req.method === 'POST') {
      let body = '';
      req.on('data', (c) => { body += c; if (body.length > 20000) req.destroy(); });
      req.on('end', () => { const to = listeners.get(key); if (!to) { res.writeHead(404).end('nobody there'); return; } to.write(`data: ${body.replace(/\n/g, '')}\n\n`); res.writeHead(204).end(); });
      return;
    }
  }
  if (url.pathname === '/' || url.pathname === '/index.html') {
    readFile(PAGE, 'utf8', (err, page) => {
      if (err) { res.writeHead(500).end('stacked.html is missing: keep it next to this program.'); return; }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(SKELETON(page));
    });
    return;
  }
  res.writeHead(404).end('not found');
}

const lanIPs = () => Object.values(networkInterfaces()).flat().filter((a) => a && a.family === 'IPv4' && !a.internal).map((a) => a.address);
function open(url) {
  const cmd = process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
  exec(cmd, () => {});
}
function listen(port, tries = 0) {
  const server = http.createServer(handler);
  server.on('error', (e) => { if (e.code === 'EADDRINUSE' && tries < 10) listen(port + 1, tries + 1); else { console.error('Could not start:', e.message); } });
  server.listen(port, '0.0.0.0', () => {
    const local = `http://localhost:${port}`;
    console.log('\n  STACKED is running. Keep this window open while you play.\n');
    console.log(`  On this computer:  ${local}`);
    for (const ip of lanIPs()) console.log(`  Friends on the same Wi-Fi:  http://${ip}:${port}   (then type the room code)`);
    console.log('\n  Close this window to stop the game.\n');
    if (!process.env.NO_OPEN) open(local);
  });
}
listen(Number(process.env.PORT) || 8080);
