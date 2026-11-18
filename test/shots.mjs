// High-quality screenshots of the new build (shadows and full detail on, nothing switched off),
// so we see what a real graphics card shows. Writes test/shots/*.png.
import { chromium } from './pw.mjs';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';

const page = process.env.PAGE || 'dist/stacked2.html';
const server = createServer(async (req, res) => {
  try { res.end(await readFile(page)); } catch { res.statusCode = 404; res.end(); }
}).listen(8481);
await mkdir('test/shots', { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const tab = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
const errors = [];
tab.on('pageerror', (e) => errors.push(String(e)));
tab.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await tab.goto('http://localhost:8481/?q=high');
const at = async (t, name) => { await tab.waitForFunction((x) => globalThis.__stacked2?.clock.time > x, t, { timeout: 120000 }); await tab.screenshot({ path: `test/shots/${name}.png` }); };
await at(0.5, 'playground_start');
await at(3.2, 'playground_crash');
await at(7, 'playground_after');
const state = await tab.evaluate(() => ({ fps: __stacked2.fps, trolleyX: +__stacked2.pg.trolley.position.x.toFixed(2), signals: __stacked2.signals.sent, shadows: __stacked2.renderer.shadowMap.enabled, quality: __stacked2.quality }));
console.log('playground', JSON.stringify(state), errors.length ? 'ERRORS ' + errors.join(' | ') : 'no errors');
await browser.close(); server.close();
if (errors.length) process.exit(1);
