// The online check: one host and two friends in three tabs of one browser (BroadcastChannel link),
// one job. Each friend steers their own coat; the host kicks the vending machine; everyone must see the
// same mess; a friend gets away at the gate and everyone gets the result. Writes test/shots/online_*.png
// Friend A opens the page like a player (start card, no dev keys) and types the room code, which has the
// letters D, Q and R in it (keys the game also uses), into the CODE box.
//   node build.mjs && node test/online.mjs
import { chromium } from './pw.mjs';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';

const server = createServer(async (req, res) => { res.end(await readFile('dist/stacked2.html')); }).listen(8483);
await mkdir('test/shots', { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 800, height: 450 } });
const errors = [];
const open = async (q) => { const p = await ctx.newPage(); p.on('pageerror', (e) => { errors.push(String(e)); console.log('PAGE ERROR', String(e)); }); await p.goto(`http://localhost:8483/?q=low&net=local${q ? '&' + q : ''}`); await p.waitForFunction(() => globalThis.__stacked2?.model, null, { timeout: 120000 }); return p; };
const ROOM = 'DQRW';
const host = await open(`dev=1&host=${ROOM}`);
await host.waitForFunction(() => __stacked2.mode === 'host', null, { timeout: 60000 });
const ok = (name, cond, info = '') => { console.log(name, info, cond ? 'OK' : 'FAIL'); if (!cond) failed = true; };
let failed = false;
const a = await open('');
ok('friend A sees the start card', await a.evaluate(() => __stacked2.card.open && getComputedStyle(document.getElementById('net')).visibility === 'hidden'));
await a.keyboard.press('KeyR'); await a.waitForTimeout(400);
const soloCoat = () => a.evaluate(() => { const c = __stacked2.coat, f = c.walker.feet; return { x: +f.x.toFixed(3), z: +f.z.toFixed(3), count: c.count, pile: !!c.pile }; });
const s0 = await soloCoat();
ok('the key that closed the card did not unstack the coat', !s0.pile && s0.count === 3 && !(await a.evaluate(() => __stacked2.card.open)), JSON.stringify(s0));
await a.click('#net input'); await a.keyboard.type(ROOM, { delay: 120 }); await a.waitForTimeout(500);
const s1 = await soloCoat(), typed = await a.evaluate(() => document.querySelector('#net input').value.toUpperCase());
ok('typing the room code keeps every letter and does not move the coat', typed === ROOM && Math.hypot(s1.x - s0.x, s1.z - s0.z) < 0.05 && !s1.pile && s1.count === 3, JSON.stringify({ typed, s0, s1 }));
await a.keyboard.press('Enter');
await a.waitForFunction(() => __stacked2.mode === 'client', null, { timeout: 60000 });
const b = await open(`dev=1&join=${ROOM}`);
const until = (p, fn, arg, ms = 90000) => p.waitForFunction(fn, arg, { timeout: ms, polling: 250 }).then(() => true, () => false);
const hostWait = (sec) => host.evaluate((s) => new Promise((res) => { const t0 = __stacked2.game.time; const f = () => (__stacked2.game.time - t0 >= s ? res() : setTimeout(f, 50)); f(); }), sec);

ok('both friends joined', await until(host, () => __stacked2.game.players.length === 3), JSON.stringify(await host.evaluate(() => __stacked2.game.order)));
const ga = await until(a, () => __stacked2.mirror?.coats.length === 3), gb = await until(b, () => __stacked2.mirror?.coats.length === 3);
ok('friends get snapshots', ga && gb, JSON.stringify({ ga, gb, a: await a.evaluate(() => [__stacked2.mode, __stacked2.mirror?.coats.length, document.querySelector('#net .status').textContent]), b: await b.evaluate(() => [__stacked2.mode, __stacked2.mirror?.coats.length, document.querySelector('#net .status').textContent]) }));
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

// the crayon map: friend A opens it (Tab), draws an arrow and puts a sticker down; friend B draws a circle.
// Everyone must see both, on the map and in chalk on the floor; while A has it open, A's coat holds up the paper.
const holdTab = async (p) => { await p.keyboard.down('Tab'); await p.waitForTimeout(150); await p.keyboard.up('Tab'); await p.waitForTimeout(200); };
const scribble = async (p, tool, pts) => {
  const btn = await p.evaluate((t) => { const M = __stacked2.crayonMap, b = M.buttons[t]; return [b.x + b.w / 2, b.y + b.h / 2]; }, tool);
  await p.mouse.click(...btn);
  const px = await p.evaluate((pts) => pts.map(([x, z]) => __stacked2.crayonMap.V.px(x, z)), pts);
  await p.mouse.move(...px[0]); await p.mouse.down(); for (const q of px.slice(1)) await p.mouse.move(...q, { steps: 5 }); await p.mouse.up();
};
await holdTab(a);
ok('friend A opened the map', await until(host, (id) => __stacked2.game.player(id).coat.mapOpen, ids.a, 10000));
await scribble(a, 1, [[-14, 14], [-14, 10], [-10, 6], [-6, 2]]);
await scribble(a, 6, [[-4, -6]]);
await holdTab(b);
await scribble(b, 2, [[16, 18.5], [18, 18.5]]);
const kinds = (p) => p.evaluate(() => __stacked2.model.map.scribbles.map((s) => s.kind + (s.text ? ':' + s.text : '')).sort().join(','));
ok('the host has both friends\' scribbles', await until(host, () => __stacked2.game.map.scribbles.length === 3, null, 15000), await kinds(host));
ok('friend B sees friend A\'s arrow and sticker', await until(b, () => { const s = __stacked2.mirror.map.scribbles; return s.some((x) => x.kind === 'arrow') && s.some((x) => x.text === 'DANGER: GRANNY'); }, null, 15000), await kinds(b));
ok('friend A sees friend B\'s circle', await until(a, () => __stacked2.mirror.map.scribbles.some((x) => x.kind === 'circle'), null, 15000), await kinds(a));
await a.waitForTimeout(600);
await a.screenshot({ path: 'test/shots/online_map_a.png' }); await b.screenshot({ path: 'test/shots/online_map_b.png' });
await host.evaluate(() => { __stacked2.camRig.offset.multiplyScalar(1.6); }); await hostWait(1);
await host.screenshot({ path: 'test/shots/online_map_chalk_host.png' });
await holdTab(a); await holdTab(b);
ok('the map closes again', await until(host, (id) => !__stacked2.game.player(id).coat.mapOpen, ids.a, 10000));

// friend B gets away: the host puts B by the gate, B presses E
await host.evaluate((id) => { const c = __stacked2.game.player(id).coat; c.walker.body.setTranslation({ x: 16, y: 1.2, z: 18.4 }, true); }, ids.b);
await hostWait(0.6); await b.keyboard.down('KeyE'); await hostWait(0.3); await b.keyboard.up('KeyE');
ok('a friend ended the job at the gate', await until(host, () => __stacked2.game.job.over));
ok('everyone sees the result', await until(a, () => __stacked2.mirror.job.result?.why === 'got away') && await until(b, () => __stacked2.mirror.job.result?.why === 'got away'));
await b.screenshot({ path: 'test/shots/online_result.png' });

// Dodgy Del's: after the results everyone is at the stall; friend A buys a Sugar Rush, everyone presses Next,
// and friend A carries it into the next job
await host.evaluate(() => { __stacked2.game.run.sweets = 200; });
ok('everyone is at Del\'s', await until(a, () => __stacked2.mirror.phase === 'shop' && !!__stacked2.mirror.shop, null, 60000) && await until(b, () => __stacked2.mirror.phase === 'shop', null, 30000));
const sugarAt = await a.evaluate(() => { const i = __stacked2.mirror.shop.stock.findIndex((s) => s.id === 'sugar_rush'), b = __stacked2.delShop.boxes.find((q) => q.i === i); return [b.x + b.w / 2, b.y + b.h / 2]; });
await a.mouse.click(...sugarAt);
ok('friend A bought a Sugar Rush', await until(host, (id) => __stacked2.game.run.of(id).drinks.includes('sugar_rush'), ids.a, 20000));
ok('friend B sees the sweet jar go down', await until(b, () => __stacked2.mirror.run.sweets < 200, null, 20000));
await b.screenshot({ path: 'test/shots/online_shop_b.png' });
for (const p of [host, a, b]) { await p.keyboard.down('Enter'); await p.waitForTimeout(150); await p.keyboard.up('Enter'); }
ok('the next job starts when everyone pressed Next', await until(host, () => __stacked2.game.phase === 'job' && __stacked2.game.jobNo > 1, null, 30000));
ok('friend A has the Sugar Rush in the next job', await until(a, (id) => (__stacked2.mirror.coats.find((c) => c.pid === id)?.drinks ?? []).includes('sugar_rush'), ids.a, 20000));
const net = await host.evaluate(() => ({ snaps: __stacked2.host.sent, bytes: JSON.stringify(__stacked2.game && (globalThis.__lastSnap ?? {})).length }));
console.log('snapshots sent', net.snaps);
console.log(errors.length ? 'ERRORS ' + errors.join(' | ') : 'no errors');
await browser.close(); server.close();
if (failed || errors.length) process.exit(1);
