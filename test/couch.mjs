// The couch check: two gamepads on one screen. The second pad joins with A, both players walk with their
// own left stick, the shared camera keeps both in view, both pocket sweets with A, both walk into the
// getaway ring, and player 1 ends the job. Writes test/shots/couch_*.png
//   node build.mjs && node test/couch.mjs
import { chromium } from './pw.mjs';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';

const server = createServer(async (req, res) => { res.end(await readFile('dist/stacked2.html')); }).listen(8484);
await mkdir('test/shots', { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = []; page.on('pageerror', (e) => { errors.push(String(e)); console.log('PAGE ERROR', String(e)); });
await page.goto('http://localhost:8484/?q=high');
await page.waitForFunction(() => globalThis.__stacked2?.game, null, { timeout: 120000 });
let failed = false;
const ok = (name, cond, info = '') => { console.log(name, info, cond ? 'OK' : 'FAIL'); if (!cond) failed = true; };
const wait = (sec) => page.evaluate((s) => new Promise((res) => { const t0 = __stacked2.game.time; const f = () => (__stacked2.game.time - t0 >= s ? res() : requestAnimationFrame(f)); f(); }), sec);
// two fake pads (the test browser has none)
await page.evaluate(() => {
  const pad = () => ({ axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })), connected: true, mapping: 'standard' });
  globalThis.__pads = [pad(), pad()]; navigator.getGamepads = () => globalThis.__pads;
});
const btn = async (i, b, sec = 0.2) => { await page.evaluate(([i, b]) => { __pads[i].buttons[b] = { pressed: true, value: 1 }; }, [i, b]); await wait(sec); await page.evaluate(([i, b]) => { __pads[i].buttons[b] = { pressed: false, value: 0 }; }, [i, b]); await wait(0.15); };
const stick = (i, x, y) => page.evaluate(([i, x, y]) => { __pads[i].axes[0] = x; __pads[i].axes[1] = y; }, [i, x, y]);
const feet = () => page.evaluate(() => __stacked2.game.players.map((p) => ({ x: +p.coat.walker.feet.x.toFixed(2), z: +p.coat.walker.feet.z.toFixed(2) })));
const put = (i, x, z) => page.evaluate(([i, x, z]) => { __stacked2.game.players[i].coat.walker.body.setTranslation({ x, y: 1.2, z }, true); }, [i, x, z]);

await btn(1, 0);
ok('pad 2 joins with A', (await page.evaluate(() => __stacked2.game.players.length)) === 2);
const f0 = await feet();
await stick(0, 0, -1); await stick(1, 1, 0); await wait(1.2); await stick(0, 0, 0); await stick(1, 0, 0); await wait(0.3);
const f1 = await feet();
ok('each pad walks its own player', f1[0].z < f0[0].z - 1.5 && f1[1].x > f0[1].x + 1.5, JSON.stringify({ f0, f1 }));
await page.screenshot({ path: 'test/shots/couch_two_players.png' });
// both pocket a sweet with A
await put(0, -0.3, 2.6); await put(1, -0.3, -0.6); await wait(0.6);
await btn(0, 0); await btn(1, 0);
const pockets = await page.evaluate(() => __stacked2.game.loot.items.filter((i) => i.state === 'pocket').map((i) => i.id));
ok('both pocket a sweet', pockets.length === 2, JSON.stringify(pockets));
// both walk into the getaway ring from just outside it, then player 1 gets away
await put(0, 15, 15.6); await put(1, 17, 15.6); await wait(0.5);
await stick(0, 0, 1); await stick(1, 0, 1); await wait(0.7); await stick(0, 0, 0); await stick(1, 0, 0); await wait(0.4);
await page.screenshot({ path: 'test/shots/couch_getaway.png' });
const banked = await page.evaluate(() => __stacked2.game.loot.bankedValue);
ok('both banked their sweets', banked >= 230, `${banked} sweets`);
await btn(0, 0);
const res = await page.evaluate(() => __stacked2.game.job.result);
ok('player 1 ended the job', res?.why === 'got away', JSON.stringify(res && { banked: res.banked, total: res.total }));
await wait(0.5); await page.screenshot({ path: 'test/shots/couch_result.png' });
console.log(errors.length ? 'ERRORS ' + errors.join(' | ') : 'no errors');
await browser.close(); server.close();
if (failed || errors.length) process.exit(1);
