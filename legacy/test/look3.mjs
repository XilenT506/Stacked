// Screenshots of the round-3 places: node test/look3.mjs <outdir>
import { chromium } from './pw.mjs';
import { spawn } from 'child_process';
const [out] = process.argv.slice(2);
const PORT = 8170; const server = spawn('node', ['server/signal.mjs'], { env: { ...process.env, PORT, PAGE: process.env.PAGE || 'dist/next.html' }, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const br = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await br.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.log('ERR', e.message));
const go = async (q, setup, cam, name, wait = 1200) => {
  await page.goto(`http://localhost:${PORT}/?${q}`); await page.waitForTimeout(1200); await page.click('#solo'); await page.waitForTimeout(600);
  await page.evaluate(([setup, cam]) => { const W = globalThis.__stacked.W; new Function('W', setup)(W); if (cam) globalThis.__setCam(cam); }, [setup, cam]);
  await page.waitForTimeout(wait); await page.screenshot({ path: `${out}/${name}.png` });
};
await go('errand=shop', 'const b=W.body; b.x=-8.25; b.z=2.05; b.yaw=0;', { p: [-5.6, 1.7, -0.6], l: [-8.3, 1.2, 2.4], fov: 50 }, 'r3-shop');
await go('errand=cinema', 'const b=W.body; b.x=9.2; b.z=-2.95; b.yaw=Math.PI; W.items[0].held=0; W.items[1].held=1; W.ord.gait=1;', { p: [6.2, 1.8, 0.6], l: [9.4, 1.4, -3.6], fov: 55 }, 'r3-cinema');
await go('errand=cinema', '', { p: [0.5, 1.8, 0.2], l: [2.4, 1.0, -3.7], fov: 50 }, 'r3-cart');
await go('errand=drive', 'const c=W.car; c.x=1.5; c.z=0.3; c.yaw=Math.PI/2;', { p: [4.6, 2.2, -3.0], l: [1.4, 0.9, 0.4], fov: 50 }, 'r3-car', 1500);
await go('errand=drive', '', null, 'r3-car-head', 1500);
await page.keyboard.press('Digit1'); await page.waitForTimeout(800); await page.screenshot({ path: `${out}/r3-car-legs.png` });
await page.keyboard.press('Digit2'); await page.waitForTimeout(800); await page.screenshot({ path: `${out}/r3-car-arms.png` });
await br.close(); server.kill();
