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
await tab.waitForFunction(() => globalThis.__stacked2?.clock.time > 3, null, { timeout: 60000 });
await tab.screenshot({ path: 'test/shots/foundation.png' });
const state = await tab.evaluate(() => ({ boxY: __stacked2.box.translation().y, shadows: __stacked2.renderer.shadowMap.enabled, quality: __stacked2.quality }));
console.log('foundation', JSON.stringify(state), errors.length ? 'ERRORS ' + errors.join(' | ') : 'no errors');
await browser.close(); server.close();
if (errors.length) process.exit(1);
