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
tab.on('pageerror', (e) => { errors.push(String(e)); console.log('PAGE ERROR', String(e)); });
tab.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await tab.goto('http://localhost:8481/?q=high&place=playground');
const at = async (t, name) => { await tab.waitForFunction((x) => globalThis.__stacked2?.clock.time > x, t, { timeout: 120000 }); await tab.screenshot({ path: `test/shots/${name}.png` }); };
await at(0.5, 'playground_start');
await at(3.2, 'playground_crash');
await at(7, 'playground_after');
const state = await tab.evaluate(() => ({ fps: __stacked2.fps, trolleyX: +__stacked2.pg.trolley.position.x.toFixed(2), signals: __stacked2.signals.sent, shadows: __stacked2.renderer.shadowMap.enabled, quality: __stacked2.quality }));
console.log('playground', JSON.stringify(state));

// controls: keyboard walk and mouse aim
const pos = () => tab.evaluate(() => { const p = __stacked2.walker.position; return { x: +p.x.toFixed(2), z: +p.z.toFixed(2) }; });
const waitGame = (sec) => tab.evaluate((s) => new Promise((res) => { const t0 = __stacked2.clock.time; const f = () => (__stacked2.clock.time - t0 >= s ? res() : requestAnimationFrame(f)); f(); }), sec);
const p0 = await pos();
await tab.mouse.move(1100, 360);
await tab.keyboard.down('KeyW'); await waitGame(0.8); await tab.keyboard.up('KeyW'); await waitGame(0.3);
const p1 = await pos(), aimK = await tab.evaluate(() => __stacked2.aim && { x: +__stacked2.aim.x.toFixed(2), z: +__stacked2.aim.z.toFixed(2) });
await tab.screenshot({ path: 'test/shots/controls_keyboard.png' });
console.log('keyboard', JSON.stringify({ from: p0, to: p1, aim: aimK }), p1.z < p0.z - 1.5 && aimK?.x > 0.5 ? 'OK' : 'FAIL');

// controls: a gamepad (a fake one, as the test browser has none): left stick left, right stick aims down-screen
await tab.evaluate(() => {
  const btn = () => Array.from({ length: 17 }, () => ({ pressed: false, value: 0 }));
  globalThis.__pad = { axes: [-1, 0, 0, 1], buttons: btn(), connected: true, mapping: 'standard' };
  navigator.getGamepads = () => [globalThis.__pad];
});
const p2 = await pos(); await waitGame(0.8);
await tab.evaluate(() => { __pad.axes[0] = 0; }); await waitGame(0.3);
const p3 = await pos(), padState = await tab.evaluate(() => ({ device: __stacked2.input.device, aim: __stacked2.aim && { x: +__stacked2.aim.x.toFixed(2), z: +__stacked2.aim.z.toFixed(2) } }));
await tab.screenshot({ path: 'test/shots/controls_gamepad.png' });
console.log('gamepad', JSON.stringify({ from: p2, to: p3, ...padState }), p3.x < p2.x - 1.5 && padState.device === 'pad' && padState.aim?.z > 0.9 ? 'OK' : 'FAIL');

// wall fade: stand behind the shelf unit (between it and the back wall), seen from the camera side
await tab.evaluate(() => { __pad.axes = [0, 0, 0, 0]; __stacked2.walker.body.setTranslation({ x: -2.6, y: 0.9, z: 1.7 }, true); });
await waitGame(0.6);
const shelf = await tab.evaluate(() => __stacked2.fade.items.map((i) => ({ blocking: i.blocking, k: +i.k.toFixed(2) })));
await tab.screenshot({ path: 'test/shots/wall_fade.png' });
console.log('wall fade', JSON.stringify(shelf), shelf.some((s) => s.blocking && s.k < 0.4) ? 'OK' : 'FAIL');

// the coat: all three heights, loose kids, and the coat lying on the floor like laundry (closer camera)
await tab.evaluate(() => { const S = __stacked2; S.walker.body.setTranslation({ x: 1, y: 1.2, z: 3.5 }, true); S.camRig.offset.multiplyScalar(0.5); });
await tab.mouse.move(640, 600); await waitGame(1.2);
const coatState = () => tab.evaluate(() => { const c = __stacked2.coat; return { count: c.count, speed: c.walker.speed, loose: c.loose.length, pile: !!c.pile, wobble: +c.wobble.toFixed(2), model: !!__stacked2.coatView.U }; });
let cs = await coatState(); await tab.screenshot({ path: 'test/shots/coat_3_kids.png' });
console.log('coat 3', JSON.stringify(cs), cs.count === 3 && cs.speed === 4.2 && cs.model ? 'OK' : 'FAIL');
await tab.keyboard.press('KeyK'); await waitGame(1.2);
cs = await coatState(); await tab.screenshot({ path: 'test/shots/coat_2_kids.png' });
console.log('coat 2', JSON.stringify(cs), cs.count === 2 && cs.speed === 4.8 && cs.loose === 1 ? 'OK' : 'FAIL');
await tab.keyboard.press('KeyK'); await waitGame(1.2);
cs = await coatState(); await tab.screenshot({ path: 'test/shots/coat_1_kid.png' });
console.log('coat 1', JSON.stringify(cs), cs.count === 1 && cs.speed === 6 && cs.loose === 2 ? 'OK' : 'FAIL');
// gather everyone back: put the loose kids at your feet
await waitGame(9.5);
await tab.evaluate(() => { const c = __stacked2.coat, p = c.walker.feet; c.loose.forEach((k, i) => { k.x = p.x + 0.2 * i; k.z = p.z; }); });
await waitGame(0.3); cs = await coatState();
console.log('restack', JSON.stringify(cs), cs.count === 3 && cs.loose === 0 ? 'OK' : 'FAIL');
// R: the coat drops like laundry, you walk away as one kid
await tab.keyboard.down('KeyR'); await waitGame(0.3); await tab.keyboard.up('KeyR');
await tab.keyboard.down('KeyD'); await waitGame(0.35); await tab.keyboard.up('KeyD'); await waitGame(0.8);
cs = await coatState(); await tab.screenshot({ path: 'test/shots/coat_pile.png' });
console.log('pile', JSON.stringify(cs), cs.count === 1 && cs.pile ? 'OK' : 'FAIL');

// the supermarket: an overview with the planning overlay, then every area seen from the coat's camera
const shop = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
shop.on('pageerror', (e) => { errors.push(String(e)); console.log('PAGE ERROR', String(e)); });
shop.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await shop.goto('http://localhost:8481/?q=high');
await shop.waitForFunction(() => globalThis.__stacked2?.clock.time > 1, null, { timeout: 120000 });
const wait2 = (sec) => shop.evaluate((s) => new Promise((res) => { const t0 = __stacked2.clock.time; const f = () => (__stacked2.clock.time - t0 >= s ? res() : requestAnimationFrame(f)); f(); }), sec);
await shop.mouse.move(640, 300);
const go = (x, z) => shop.evaluate(([x, z]) => { const w = __stacked2.walker; w.body.setTranslation({ x, y: 1.2, z }, true); w.body.setNextKinematicTranslation({ x, y: 1.2, z }); }, [x, z]);
await shop.evaluate(() => { const S = __stacked2; S.placeView.overlay.visible = true; S.camRig.offset.multiplyScalar(3.4); });
await go(0, -3); await wait2(2.5);
await shop.screenshot({ path: 'test/shots/shop_overview.png' });
await shop.evaluate(() => { const S = __stacked2; S.placeView.overlay.visible = false; S.camRig.offset.multiplyScalar(1 / 3.4); });
if (!process.env.HEATONLY) {
const spots = [['carpark', -14.5, 16], ['entrance', -14.5, 10.5], ['tills', -6, 10], ['aisle1', -15.5, 0], ['aisle2', -11.5, 0], ['aisle3', -7.5, 0], ['aisle4', -3.5, -3.5],
  ['sweets', 0.5, 0], ['freezer', 4.5, 0], ['bakery', 13, -3.5], ['produce', 13, 4], ['staff', -6, -12.5], ['store', 5, -14.5], ['yard', 6, -20.5], ['lane', 20, 0], ['getaway', 16, 17]];
const wrong = [];
for (const [id, x, z] of spots) {
  await go(x, z); await wait2(1.2);
  const a = await shop.evaluate(() => __stacked2.area?.id);
  if (a !== id) wrong.push(`${id} -> ${a}`);
  await shop.screenshot({ path: `test/shots/shop_${id}.png` });
}
console.log('shop areas', spots.length, wrong.length ? 'FAIL ' + wrong.join(', ') : 'OK');

}
const key = async (code, sec = 0.25) => { await shop.keyboard.down(code); await wait2(sec); await shop.keyboard.up(code); };
const shot = (name) => shop.screenshot({ path: `test/shots/${name}.png` });
const logHas = (ev) => shop.evaluate((e) => __stacked2.signals.log.some((s) => s.data?.event === e), ev);
if (!process.env.HEATONLY) {
// the living supermarket: one kick and the chain runs on its own; freezer fog; timed events; riding, posing, the belt
await shop.evaluate(() => __stacked2.camRig.offset.multiplyScalar(1.3));
await go(-4.4, -8.3); await wait2(0.8);
const hint = await shop.evaluate(() => __stacked2.hands.hint());
await key('KeyE'); await go(-3.5, 4.2); await wait2(0.5); await shot('living_kick');
await wait2(2.5); await shot('living_chain');
const chain = { hint, kicked: await logHas('kicked'), splat: await logHas('splat'), slip: await logHas('slip'), crash: await logHas('pyramid crash') };
console.log('chain', JSON.stringify(chain), chain.kicked && chain.splat && chain.slip && chain.crash ? 'OK' : 'FAIL');
await go(4.95, -0.5); await wait2(0.6); await key('KeyE'); await wait2(2); await shot('living_freezer');
const fog = await shop.evaluate(() => __stacked2.things.list.filter((t) => t.name === 'freezer_door' && t.state === 'on').length);
console.log('freezer', fog, fog === 1 ? 'OK' : 'FAIL');
await go(12.5, -2.6); await wait2(0.6); await key('KeyT'); await wait2(1.2); await shot('living_free_samples');
await go(-3.5, 2.6); await wait2(0.6); await key('KeyT'); await wait2(1.2); await shot('living_clean_up');
const fired = await shop.evaluate(() => __stacked2.jobEvents.fired.map((f) => f.id));
console.log('events', JSON.stringify(fired), fired.length === 2 ? 'OK' : 'FAIL');
await go(-9, 14); await wait2(0.6); await key('KeyE'); await shop.keyboard.down('KeyA'); await wait2(1.0); await shot('living_trolley'); await shop.keyboard.up('KeyA');
const rode = await shop.evaluate(() => !!__stacked2.hands.riding); await key('KeyE');
console.log('trolley', rode ? 'OK' : 'FAIL');
await go(16, 2); await wait2(0.6); await shop.keyboard.down('KeyQ'); await wait2(0.6); await shot('living_pose');
const posed = await shop.evaluate(() => __stacked2.coat.hidden?.mode); await shop.keyboard.up('KeyQ');
console.log('pose', posed, posed === 'pose' ? 'OK' : 'FAIL');
await go(-7.1, 6.5); await wait2(0.6); await key('KeyE'); await wait2(0.9); await shot('living_belt');
const belt = await shop.evaluate(() => !!__stacked2.hands.belt);
console.log('belt', belt ? 'OK' : 'FAIL');

// grown-ups: the crowd at the free samples, a guard chasing a lone kid, a shopper flat on the floor
const ppl = () => shop.evaluate(() => __stacked2.people.list.map((g) => ({ t: g.typeName, s: g.state, x: +g.feet.x.toFixed(1), z: +g.feet.z.toFixed(1) })));
await shop.evaluate(() => __stacked2.signals.emit({ type: 'food', position: { x: 13, y: 0, z: -3 }, range: 45, data: { event: 'test' } }));
await go(13, 1.5); await wait2(14); await shot('people_free_samples');
const crowd = (await ppl()).filter((g) => Math.hypot(g.x - 13, g.z + 3) < 5).length;
console.log('crowd at the bakery', crowd, crowd >= 3 ? 'OK' : 'FAIL');
// a lone kid right in front of the guard
await shop.evaluate(() => { const g = __stacked2.people.byType('guard')[0], f = g.feet, y = g.walker.yaw, c = __stacked2.coat;
  const x = f.x + Math.sin(y) * 4, z = f.z + Math.cos(y) * 4; c.walker.body.setTranslation({ x, y: 1.2, z }, true); });
await key('KeyK', 0.1); await wait2(0.3); await key('KeyK', 0.1); await wait2(0.8);
await shot('people_chase');
const chased = await shop.evaluate(() => __stacked2.people.byType('guard')[0].state);
const grabbed = await shop.evaluate(() => new Promise((res) => { const g = __stacked2.people.byType('guard')[0], t0 = __stacked2.clock.time;
  const f = () => (g.carrying || g.holding ? res(true) : __stacked2.clock.time - t0 > 12 ? res(false) : requestAnimationFrame(f)); f(); }));
await shot('people_grab');
console.log('guard', chased, grabbed ? 'grabbed' : 'no grab', grabbed ? 'OK' : 'FAIL');
// a puddle under a walking shopper
const slipped = await shop.evaluate(() => new Promise((res) => {
  const S = __stacked2, g = S.people.byType('shopper').find((p) => p.walker.flatSpeed > 0.5) || S.people.byType('shopper')[0];
  S.coat.walker.body.setTranslation({ x: g.feet.x + 2, y: 1.2, z: g.feet.z + 2.5 }, true);
  const v = g.walker.vel, l = Math.hypot(v.x, v.z) || 1;
  const f0 = g.feet;
  S.signals.emit({ type: 'slippery', position: { x: f0.x + 1.8, y: 0, z: f0.z }, range: 1.2, data: { color: '#c4231d' } });
  S.signals.emit({ type: 'noise', position: { x: f0.x + 5, y: 0, z: f0.z }, range: 8 });
  const t0 = S.clock.time; const f = () => (S.people.events.some((e) => e.type === 'slip') || S.people.list.some((p) => p.state === 'slipped') ? res(true) : S.clock.time - t0 > 10 ? res(false) : requestAnimationFrame(f)); f(); }));
await wait2(0.4); await shot('people_slip');
console.log('shopper slip', slipped ? 'OK' : 'FAIL');
console.log('people', JSON.stringify(await ppl()));

}
// caught and rescue: the guard catches a lone kid, a Spare Kid comes in, the caught kid sits in the cage; then open the gate
await shop.evaluate(() => { const S = __stacked2, c = S.coat; S.job.over = false; S.job.result = null;
  c.stack = ['sid', 'mo', 'tank']; c.loose = []; c.pile = null; c.grabbedBy = null; c.caught = null; c.inCage = false; c.mods = {}; c.hidden = null; c.wobble = 0; c.applyHeight();
  for (const g of S.people.list) { g.hostile.clear(); g.sus.clear(); } });
await shop.evaluate(() => { const S = __stacked2, g = S.people.byType('guard')[0], f = g.feet, c = S.coat;
  g.set('idle'); c.walker.body.setTranslation({ x: f.x + Math.sin(g.walker.yaw) * 1.6, y: 1.2, z: f.z + Math.cos(g.walker.yaw) * 1.6 }, true); c.toggleStack(); c.pile = null; });
const spare = await shop.evaluate(() => new Promise((res) => { const S = __stacked2, t0 = S.clock.time; const f = () => (S.rescue.spares < 2 ? res(true) : S.clock.time - t0 > 10 ? res(false) : requestAnimationFrame(f)); f(); }));
await wait2(1); await shot('rescue_spare_kid');
const caged = await shop.evaluate(() => new Promise((res) => { const S = __stacked2, t0 = S.clock.time; const f = () => (S.coat.loose.some((k) => k.caged) ? res(true) : S.clock.time - t0 > 30 ? res(false) : requestAnimationFrame(f)); f(); }));
await shop.evaluate(() => { const S = __stacked2, c = S.coat; S.people.list.filter((g) => g.typeName === 'guard' || g.typeName === 'caretaker').forEach((g, i) => { if (g.carrying) return; g.walker.body.setTranslation({ x: 6 + i * 0.8, y: 0.9, z: -12.5 }, true); g.go('investigate', { x: 8, z: -12.5 }, 1.5, 6); });   // lured out of sight (if he sees you open it, he knows)
  c.stack = [c.stack[0], 'mo', 'sid'].slice(0, 3); c.applyHeight(); });     // walk in as a full coat (a lone kid gets chased)
await go(-4.5, -14.2); await wait2(0.6); await shot('rescue_cage');
await key('KeyE', 0.1); await wait2(1); await shot('rescue_open');
const opened = await shop.evaluate(() => (__stacked2.rescue.opened ?? 0) > 0);
console.log('rescue', JSON.stringify({ spare, caged, opened }), spare && caged && opened ? 'OK' : 'FAIL');

// disguise and Heat: a cashier's "?" meter, Act Natural, a bust, Heat 3 with the Caretaker, Closing Time
await shop.evaluate(() => { const S = __stacked2, c = S.coat; S.sus.points = 0; S.sus.level = 0;
  for (const g of S.people.list) { g.sus.clear(); g.hostile.clear(); if (g.carrying) g.dropKid(true); g.holding = null; g.back(); }
  c.stack = ['sid', 'mo', 'tank']; c.loose = []; c.pile = null; c.grabbedBy = null; c.mods = {}; c.hidden = null; c.wobble = 0; c.applyHeight(); });
await go(-5.8, 6); await wait2(0.4);
const susOf = () => shop.evaluate(() => Math.max(...__stacked2.people.byType('cashier').map((g) => g.sus.get(__stacked2.coat) ?? 0)));
await shop.keyboard.down('ShiftLeft');
await key('KeyS', 0.35); await key('KeyW', 0.35); await key('KeyS', 0.35);
await shop.keyboard.up('ShiftLeft');
const filled = await susOf(); await shot('heat_meter');
await shop.keyboard.down('KeyQ'); await wait2(1.5); await shot('heat_act_natural'); await shop.keyboard.up('KeyQ');
const drained = await susOf();
console.log('meter', filled.toFixed(2), '-> act natural', drained.toFixed(2), filled > 0.15 && drained < filled ? 'OK' : 'FAIL');
await shop.keyboard.down('ShiftLeft');
for (let i = 0; i < 6 && (await shop.evaluate(() => __stacked2.sus.level)) === 0; i++) { await key('KeyS', 0.35); await key('KeyW', 0.35); }
await shop.keyboard.up('ShiftLeft'); await shot('heat_bust');
const lvl1 = await shop.evaluate(() => __stacked2.sus.level);
console.log('bust heat', lvl1, lvl1 >= 1 ? 'OK' : 'FAIL');
await go(-12, 6); await key('KeyH', 0.1); await key('KeyH', 0.1); await key('KeyH', 0.1); await wait2(1.5); await shot('heat_panic');
const panic = await shop.evaluate(() => ({ level: __stacked2.sus.level, caretaker: !!__stacked2.security.caretaker, front: __stacked2.closing.closed.has('front'), guards: __stacked2.people.byType('guard').length }));
console.log('panic', JSON.stringify(panic), panic.level === 3 && panic.caretaker && panic.front ? 'OK' : 'FAIL');
await shop.evaluate(() => { const S = __stacked2; S.closing.C.sectionEvery = 2; S.closing.C.warn = 1; });
await key('KeyC', 0.1); await wait2(9);
await shop.evaluate(() => __stacked2.camRig.offset.multiplyScalar(2.6)); await go(0, -2); await wait2(1.5); await shot('heat_closing_time');
const shut = await shop.evaluate(() => [...__stacked2.closing.closed]);
console.log('closing time', JSON.stringify(shut), shut.length >= 3 ? 'OK' : 'FAIL');

// gadgets: water pistol, slingshot and a banana peel down the back walkway
await shop.evaluate(() => { const S = __stacked2, c = S.coat; S.camRig.offset.multiplyScalar(1 / 2.6);
  c.stack = ['sid', 'mo', 'tank']; c.loose = []; c.pile = null; c.grabbedBy = null; c.mods = {}; c.hidden = null; c.wobble = 0; c.applyHeight(); S.gadgets.arm(c); });
await go(-15, -8); await wait2(0.8);
await shop.evaluate(() => { const g = __stacked2.people.list.find((p) => p.typeName === 'shopper'); g.walker.body.setTranslation({ x: -10, y: 0.9, z: -8 }, true); g.set('idle'); g.type = { ...g.type, stays: true }; });
await shop.mouse.move(1150, 330);
await key('Digit1', 0.1); await shop.mouse.down(); await wait2(0.6); await shot('gadget_water'); await shop.mouse.up(); await wait2(0.5);
await key('Digit2', 0.1); await shop.mouse.down(); await wait2(1.1); await shop.mouse.up(); await wait2(0.3); await shot('gadget_slingshot'); await wait2(0.6);
await key('Digit3', 0.1); await shop.mouse.down(); await wait2(0.1); await shop.mouse.up(); await wait2(0.4); await shot('gadget_banana');
const gad = await shop.evaluate(() => ({ counts: __stacked2.gadgets.counts, bananas: __stacked2.gadgets.items.length, ammo: __stacked2.coat.gadgets.ammo }));
console.log('gadgets', JSON.stringify(gad), gad.counts.grownup > 0 && gad.bananas === 1 ? 'OK' : 'FAIL');

// loot: pocket the chocolate, carry the giant lolly out to the getaway gate, get away
await shop.evaluate(() => { const S = __stacked2, c = S.coat; c.stack = ['sid', 'mo', 'tank']; c.loose = []; c.pile = null; c.grabbedBy = null; c.mods = {}; c.hidden = null; c.wobble = 0; c.applyHeight();
  S.job.over = false; S.job.result = null;      // (Closing Time already ended the job above)
  for (const g of S.people.list) { g.hostile.clear(); g.sus.clear(); if (g.typeName === 'caretaker' || g.typeName === 'guard') g.walker.body.setTranslation({ x: -8, y: 0.9, z: -15 }, true); } });
await go(-0.3, 2.6); await wait2(0.6); await shot('loot_sweets');
await key('KeyE', 0.1); await wait2(0.2); await key('KeyE', 0.1); await wait2(0.4);
await shop.keyboard.down('KeyS'); await wait2(0.5); await shop.keyboard.up('KeyS'); await wait2(0.3); await shot('loot_carry');
const carrying = await shop.evaluate(() => __stacked2.loot.items.filter((i) => i.state !== 'lying').map((i) => i.id + ':' + i.state));
await go(16, 16.4); await shop.keyboard.down('KeyS'); await wait2(0.6); await shop.keyboard.up('KeyS'); await wait2(0.4);
await key('KeyE', 0.1); await wait2(0.6); await shot('loot_results');
const res = await shop.evaluate(() => __stacked2.job.result && { banked: __stacked2.job.result.banked, total: __stacked2.job.result.total, met: __stacked2.job.result.met });
console.log('loot', JSON.stringify(carrying), JSON.stringify(res), res && res.banked > 0 ? 'OK' : 'FAIL');

console.log(errors.length ? 'ERRORS ' + errors.join(' | ') : 'no errors');
await browser.close(); server.close();
if (errors.length) process.exit(1);
