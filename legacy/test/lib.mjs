// Shared helper for scripts that play the build in a headless browser.
//   const k = await start(8201);  const { page, errors } = await k.open('?bot=1&speed=2');  ...  await k.stop();
import { chromium } from './pw.mjs';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');

export async function start(port, { page = 'dist/stacked.html' } = {}) {
  const server = spawn('node', ['server/signal.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(port), PAGE: page }, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 600));
  const three = await readFile(join(ROOT, 'node_modules/three/build/three.min.js'));
  const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist',
    '--disable-features=WebRtcHideLocalIpsWithMdns', '--autoplay-policy=no-user-gesture-required'] });
  const url = `http://localhost:${port}/`;
  async function open(path = '', opts = {}) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, ...opts });
    const pg = await ctx.newPage(); const errors = [], logs = [];
    pg.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); logs.push(m.text()); });
    pg.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    await pg.route(/cdnjs\.cloudflare\.com.*three/, (r) => r.fulfill({ body: three, contentType: 'text/javascript' }));
    await pg.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    await pg.goto(url + path);
    await pg.waitForFunction(() => globalThis.__stacked, null, { timeout: 15000 });
    return { page: pg, ctx, logs, errors: () => errors.filter((e) => !/fonts\.g|ERR_FAILED/.test(e)) };
  }
  return { browser, url, open, stop: async () => { await browser.close(); server.kill(); } };
}
