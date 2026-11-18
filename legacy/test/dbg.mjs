import { chromium } from './pw.mjs';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
const PORT = 8127; const server = spawn('node', ['server/signal.mjs'], { env: { ...process.env, PORT, PAGE: 'dist/stacked.html' }, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 500));
const three = await readFile('node_modules/three/build/three.min.js');
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 800, height: 450 } });
page.on('console', (m) => { if (m.text().startsWith('[bot]') || m.type() === 'error') console.log('  >', m.text().slice(0, 200)); });
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.route(/cdnjs\.cloudflare\.com.*three/, (r) => r.fulfill({ body: three, contentType: 'text/javascript' }));
await page.route(/fonts\./, (r) => r.abort());
await page.goto(`http://localhost:${PORT}/?bot=1&speed=2&q=low`);
let prev = '';
for (let i = 0; i < 600; i++) {
  await page.waitForTimeout(100);
  const s = await page.evaluate(() => { const s = globalThis.__stacked, W = s.W, b = W.body, r = (v) => +v.toFixed(2); return { t: r(W.time), ph: W.phase, end: W.end, b: [r(b.x), r(b.z), b.down, b.popped], kids: W.kids.map((k) => [r(k.x), r(k.z), k.caught, k.owner]), sus: W.people.map((p) => r(p.sus)), pl: W.players, seats: W.seats, done: s.bot.done }; });
  const key = s.ph === 'scatter' ? String(i) : s.ph + s.kids.length; s.mv = await page.evaluate(() => [globalThis.__stacked.input.part, globalThis.__stacked.input.kid, globalThis.__stacked.input.move, globalThis.__stacked.W.people.map((p) => [+p.x.toFixed(1), +p.z.toFixed(1), p.mode])]);
  if (key !== prev || s.done) { console.log(JSON.stringify(s)); prev = key; }
  if (s.done) break;
}
await browser.close(); server.kill();
