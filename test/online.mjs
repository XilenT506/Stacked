// The online check: one host and two friends in three tabs of one browser (BroadcastChannel link),
// one job. Each friend steers their own coat; the host kicks the vending machine; everyone must see the
// same mess; a friend gets away at the gate and everyone gets the result. Writes test/shots/online_*.png
//   node build.mjs && node test/online.mjs
import { chromium } from './pw.mjs';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';

const server = createServer(async (req, res) => { res.end(await readFile('dist/stacked2.html')); }).listen(8483);
await mkdir('test/shots', { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 800, height: 450 } });
const errors = [];
const open = async (q) => { const p = await ctx.newPage(); p.on('pageerror', (e) => { errors.push(String(e)); console.log('PAGE ERROR', String(e)); }); await p.goto(`http://localhost:8483/?q=low&net=local&${q}`); await p.waitForFunction(() => globalThis.__stacked2?.model, null, { timeout: 120000 }); return p; };
const host = await open('host=TEST');
await host.waitForFunction(() => __stacked2.mode === 'host', null, { timeout: 60000 });
const a = await open('join=TEST'), b = await open('join=TEST');
const ok = (name, cond, info = '') => { console.log(name, info, cond ? 'OK' : 'FAIL'); if (!cond) failed = true; };
let failed = false;
const until = (p, fn, arg, ms = 90000) => p.waitForFunction(fn, arg, { timeout: ms, polling: 250 }).then(() => true, () => false);
const hostWait = (sec) => host.evaluate((s) => new Promise((res) => { const t0 = __stacked2.game.time; const f = () => (__stacked2.game.time - t0 >= s ? res() : setTimeout(f, 50)); f(); }), sec);

ok('both friends joined', await until(host, () => __stacked2.game.players.length === 3), JSON.stringify(await host.evaluate(() => __stacked2.game.order)));
ok('friends get snapshots', await until(a, () => __stacked2.mirror?.coats.length === 3) && await until(b, () => __stacked2.mirror?.coats.length === 3));
// friend A walks up the screen (W), friend B walks right (D): each moves only their own coat
const ids = { a: await a.evaluate(() => __stacked2.client.id), b: await b.evaluate(() => __stacked2.client.id) };
const where = () => host.evaluate((ids) => Object.fromEntries(Object.entries(ids).map(([k, id]) => { const f = __stacked2.game.player(id).coat.walker.feet; return [k, { x: +f.x.toFixed(2), z: +f.z.toFixed(2) }]; })), ids);
const w0 = await where();
await a.keyboard.down('KeyW'); await b.keyboard.down('KeyD'); await hostWait(1.2); await a.keyboard.up('KeyW'); await b.keyboard.up('KeyD'); await hostWait(0.3);
const w1 = await where();
ok('each friend steers their own coat', w1.a.z < w0.a.z - 1.5 && Math.abs(w1.a.x - w0.a.x) < 0.8 && w1.b.x > w0.b.x + 1.5 && Math.abs(w1.b.z - w0.b.z) < 0.8, JSON.stringify({ w0, w1 }));
// the host kicks the vending machine: cans, ketchup, a slip, the pyramid
await host.evaluate(() => { const c = __stacked2.coat; c.walker.body.setTranslation({ x: -4.4, y: 1.2, z: -8.3 }, true); });
await hostWait(0.5); await host.keyboard.down('KeyE'); await hostWait(0.2); await host.keyboard.up('KeyE');
await host.evaluate(() => { const c = __stacked2.coat; c.walker.body.setTranslation({ x: -3.5, y: 1.2, z: 4.2 }, true); });
ok('the chain ran on the host', await until(host, () => __stacked2.game.mess.patches.length >= 3 && __stacked2.game.signals.log.some((s) => s.data?.event === 'pyramid crash')));
await hostWait(2);
await a.evaluate(() => { __stacked2.camRig.offset.multiplyScalar(1.3); });
const mess = (p) => p.evaluate(() => __stacked2.model.mess.patches.map((q) => [+q.x.toFixed(1), +q.z.toFixed(1), q.color]));
const tins = (p) => p.evaluate(() => (__stacked2.model.things.list).filter((t) => t.name === 'tin' && !t.gone).map((t) => [t.id, +t.position.x.toFixed(1), +t.position.z.toFixed(1)]).sort((x, y) => x[0] - y[0]));
await hostWait(1);
const [mh, ma, mb, th, ta, tb] = [await mess(host), await mess(a), await mess(b), await tins(host), await tins(a), await tins(b)];
const sameMess = JSON.stringify(mh) === JSON.stringify(ma) && JSON.stringify(mh) === JSON.stringify(mb);
const tinOff = Math.max(...th.map((t, i) => Math.max(Math.hypot(t[1] - ta[i][1], t[2] - ta[i][2]), Math.hypot(t[1] - tb[i][1], t[2] - tb[i][2]))));
ok('everyone sees the same mess', sameMess && mh.length >= 3, `${mh.length} puddles`);
ok('and the same toppled tins', tinOff < 0.5, `worst ${tinOff.toFixed(2)} m`);
// friend A looks at the aisle; take pictures from all three screens
await a.evaluate(() => { const S = __stacked2; S.camRig.focus.set(-3.5, 0.8, 0); });
await host.screenshot({ path: 'test/shots/online_host.png' }); await a.screenshot({ path: 'test/shots/online_friend_a.png' }); await b.screenshot({ path: 'test/shots/online_friend_b.png' });
// friend B gets away: the host puts B by the gate, B presses E
await host.evaluate((id) => { const c = __stacked2.game.player(id).coat; c.walker.body.setTranslation({ x: 16, y: 1.2, z: 18.4 }, true); }, ids.b);
await hostWait(0.6); await b.keyboard.down('KeyE'); await hostWait(0.3); await b.keyboard.up('KeyE');
ok('a friend ended the job at the gate', await until(host, () => __stacked2.game.job.over));
ok('everyone sees the result', await until(a, () => __stacked2.mirror.job.result?.why === 'got away') && await until(b, () => __stacked2.mirror.job.result?.why === 'got away'));
await b.screenshot({ path: 'test/shots/online_result.png' });
const net = await host.evaluate(() => ({ snaps: __stacked2.host.sent, bytes: JSON.stringify(__stacked2.game && (globalThis.__lastSnap ?? {})).length }));
console.log('snapshots sent', net.snaps);
console.log(errors.length ? 'ERRORS ' + errors.join(' | ') : 'no errors');
await browser.close(); server.close();
if (failed || errors.length) process.exit(1);
