// Visual check: fixed cameras around the town, for comparing with the key art.
// node test/look.mjs <outdir> <tag>   (PAGE env picks the page, default dist/next.html)
import { chromium } from './pw.mjs';
import { spawn } from 'child_process';
const [out, tag = 'x'] = process.argv.slice(2);
const PORT = 8140 + Math.floor(Math.random() * 50);
const server = spawn('node', ['server/signal.mjs'], { env: { ...process.env, PORT, PAGE: process.env.PAGE || 'dist/next.html' }, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const br = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await br.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.log('ERR', e.message));
await page.goto(`http://localhost:${PORT}/?pts=${process.env.PTS || 3}`); await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/menu-${tag}.png` });
await page.click('#solo'); await page.waitForTimeout(800);
await page.evaluate(() => { document.querySelectorAll('#hud, .hud, #objective, #parts, #info, #keys, #side, #stick, #banner, #sees, #toast, #cue, #balance').forEach((e) => e.style.visibility = 'hidden'); });
const shots = {
  street: { body: [0.9, 1.3, Math.PI * 0.85], cam: { p: [3.6, 1.25, -2.2], l: [-0.2, 1.35, 2.6], fov: 50 } },
  close: { body: [0.9, 1.3, Math.PI * 0.8], cam: { p: [2.2, 1.35, -1.0], l: [0.9, 1.15, 1.3], fov: 45 } },
  east: { body: [3.5, 0.5, -Math.PI / 2], cam: { p: [-3, 1.7, -2.8], l: [6, 1.4, 2.5], fov: 55 } },
  over: { body: [0, 0.5, 0], cam: { p: [0, 9, -10], l: [0, 0, 3], fov: 55 } },
  bank: { body: [0.3, 7.6, 0], cam: { p: [-1.6, 1.8, 4.6], l: [0.6, 1.0, 8.3], fov: 55 } },
};
for (const [name, s] of Object.entries(shots)) {
  await page.evaluate((s) => { const W = globalThis.__stacked.W, b = W.body; [b.x, b.z, b.yaw] = s.body; b.v = 0; b.lx = b.lz = b.lvx = b.lvz = 0; globalThis.__setCam(s.cam); }, s);
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${out}/${name}-${tag}.png` });
}
await page.evaluate(() => globalThis.__setCam(null));
for (const [k, n] of [['Digit1', 'legs'], ['Digit2', 'arms'], ['Digit3', 'head']]) {
  await page.evaluate(() => { const b = globalThis.__stacked.W.body; b.x = 0.5; b.z = -0.5; b.yaw = 0; });
  await page.keyboard.press(k); await page.waitForTimeout(800); await page.screenshot({ path: `${out}/view-${n}-${tag}.png` });
}
console.log('fps', await page.evaluate(() => globalThis.__stacked.fps));
await br.close(); server.kill();
