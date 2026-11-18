// Round 3 critic: play each errand briefly with real keys, then stage funny moments with a fixed outside camera.
// Run: node test/critics/r3/play.mjs [errand...]   (port 8320, dist/critic.html)
import { start } from '../../lib.mjs';
const OUT = 'test/critics/r3/';
const only = process.argv.slice(2);
const k = await start(8320, { page: 'dist/critic.html' });
const log = (...a) => console.log(...a);

const ev = (page, f, a) => page.evaluate(f, a);
const W = (page) => ev(page, () => { const W = globalThis.__stacked.W; return W; });
async function waitGame(page, secs) {           // wait for game seconds
  const t0 = await ev(page, () => globalThis.__stacked.W.time);
  const until = Date.now() + secs * 8000 + 4000;
  while (Date.now() < until) { const t = await ev(page, () => globalThis.__stacked.W.time); if (t - t0 >= secs) return; await page.waitForTimeout(150); }
}
async function hud(page) {
  return ev(page, () => {
    const t = (id) => (document.getElementById(id)?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 220);
    const W = globalThis.__stacked.W;
    return { obj: t('objective'), info: t('info'), banner: t('banner'), toast: t('toast'), side: t('side'), sees: t('sees'), part: globalThis.__stacked.input?.part,
      step: W.errand?.step, q: +(W.errand?.q || 0).toFixed(2), phase: W.phase, time: +W.time.toFixed(1),
      body: [W.body.x, W.body.z, W.body.lx, W.body.lz].map((v) => +(+v).toFixed(2)), down: W.body.down,
      sus: W.people.map((p) => p.id + ':' + p.sus.toFixed(2) + (p.say ? '"' + p.say + '"' : '')).join(' '),
      items: (W.items || []).map((i) => i.id + ':' + i.held).join(' '),
      car: W.car ? { x: +W.car.x.toFixed(2), z: +W.car.z.toFixed(2), v: +W.car.v.toFixed(2), wheel: +(+W.car.wheel).toFixed(2), slipT: +(+W.car.slipT).toFixed(1), ask: +(+W.car.ask).toFixed(1) } : null };
  });
}
async function openErrand(name) {
  const r = await k.open('?errand=' + name);
  const { page } = r;
  await page.waitForSelector('#solo', { state: 'visible', timeout: 15000 }).catch(() => {});
  await page.click('#solo').catch((e) => log('solo click', e.message));
  await page.waitForTimeout(1500);
  return r;
}
async function hold(page, key, ms) { await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key); }
const cam = (page, c) => ev(page, (c) => globalThis.__setCam(c), c);
const shot = async (page, name) => { await page.waitForTimeout(400); await page.screenshot({ path: OUT + name }); log('  shot', name); };

async function firstLook(page, name) {
  log('[' + name + '] start', JSON.stringify(await hud(page)));
  // a first-timer: press W for ~3 s of real time, then look
  await hold(page, 'w', 3000);
  log('[' + name + '] after W', JSON.stringify(await hud(page)));
}

// ---------- SHOP ----------
async function shop() {
  const { page, errors } = await openErrand('shop');
  await firstLook(page, 'shop');
  await shot(page, 'shop1_firstperson.png');
  // stage: at Mabel's stall holding the milk, then topple forward into the stall
  await ev(page, () => { const W = globalThis.__stacked.W; Object.assign(W.body, { x: -8.3, z: 1.95, yaw: 0, v: 0, lx: 0, lz: 0 });
    W.errand.step = 3; W.errand.q = 0; const m = W.items.find((i) => i.kind === 'milk'); if (m) m.held = 0; });
  await cam(page, { p: [-5.2, 2.4, -0.8], l: [-8.3, 1.1, 2.4], fov: 50 });
  await waitGame(page, 0.6);
  log('[shop] staged at stall', JSON.stringify(await hud(page)));
  await ev(page, () => { const b = globalThis.__stacked.W.body; b.lx = 0.05; b.lz = 0.62; });
  await waitGame(page, 0.5);
  log('[shop] fall', JSON.stringify(await hud(page)));
  await shot(page, 'shop2_fall_at_mabel.png');
  await waitGame(page, 1.5);
  log('[shop] after fall', JSON.stringify(await hud(page)));
  await shot(page, 'shop3_after_fall.png');
  log('[shop] errors', errors());
  await page.context().close();
}

// ---------- BANK ----------
async function bank() {
  const { page, errors } = await openErrand('bank');
  await firstLook(page, 'bank');
  // stage: at the counter on the sign step; switch to arms with real keys and try to sign
  await ev(page, () => { const W = globalThis.__stacked.W; Object.assign(W.body, { x: 0.3, z: 7.8, yaw: 0, v: 0, lx: 0, lz: 0 }); W.errand.step = 2; W.errand.q = 0; });
  await cam(page, { p: [2.8, 2.3, 5.4], l: [0.3, 1.2, 8.3], fov: 50 });
  await page.keyboard.press('2');
  await waitGame(page, 1.0);
  log('[bank] sign step', JSON.stringify(await hud(page)));
  await hold(page, 'w', 1200); await hold(page, 'g', 200); await hold(page, 'f', 200); await hold(page, 'd', 1500);
  log('[bank] tried sign', JSON.stringify(await hud(page)));
  await shot(page, 'bank1_signing.png');
  // stage: cash in hand (heavy), wobble and fall in front of Ruth with Hale at the door
  await ev(page, () => { const W = globalThis.__stacked.W; W.errand.step = 4; const c = W.items.find((i) => i.kind === 'cash'); if (c) c.held = 1;
    Object.assign(W.body, { x: 0.2, z: 6.6, yaw: Math.PI, v: 0.8, lx: 0.3, lz: 0 }); });
  await waitGame(page, 0.4);
  await ev(page, () => { const b = globalThis.__stacked.W.body; b.lx = 0.64; });
  await waitGame(page, 0.6);
  log('[bank] fall w cash', JSON.stringify(await hud(page)));
  await shot(page, 'bank2_cash_fall.png');
  await waitGame(page, 1.6);
  log('[bank] after', JSON.stringify(await hud(page)));
  await shot(page, 'bank3_after.png');
  log('[bank] errors', errors());
  await page.context().close();
}

// ---------- CINEMA ----------
async function cinema() {
  const { page, errors } = await openErrand('cinema');
  await firstLook(page, 'cinema');
  // stage: both snacks held, standing at Pip's height check; legs hold Shift (tiptoe) with real keys
  await ev(page, () => { const W = globalThis.__stacked.W; Object.assign(W.body, { x: 9.2, z: -3.05, yaw: Math.PI / 2, v: 0, lx: 0, lz: 0 }); W.errand.step = 3; W.errand.q = 0;
    W.items.forEach((it, i) => { it.held = i; }); });
  await cam(page, { p: [6.6, 1.9, -0.6], l: [9.6, 1.3, -3.4], fov: 50 });
  await page.keyboard.press('1');
  await waitGame(page, 0.5);
  log('[cinema] at check', JSON.stringify(await hud(page)));
  await page.keyboard.down('Shift');
  await waitGame(page, 1.2);
  log('[cinema] tiptoe', JSON.stringify(await hud(page)));
  await shot(page, 'cinema1_tiptoe_check.png');
  await waitGame(page, 1.5);
  await page.keyboard.up('Shift');
  log('[cinema] after tiptoe', JSON.stringify(await hud(page)));
  // tiptoe + snacks wobble: push the lean and see a fall in front of Pip
  await page.keyboard.down('Shift');
  await ev(page, () => { const b = globalThis.__stacked.W.body; b.lx = 0.6; b.lz = 0.1; });
  await waitGame(page, 0.6);
  await page.keyboard.up('Shift');
  log('[cinema] tiptoe fall', JSON.stringify(await hud(page)));
  await shot(page, 'cinema2_tiptoe_fall.png');
  log('[cinema] errors', errors());
  await page.context().close();
}

// ---------- DRIVE ----------
async function drive() {
  const { page, errors } = await openErrand('drive');
  log('[drive] start', JSON.stringify(await hud(page)));
  // a first-timer: try mirrors (head), then pedal (legs)
  await page.keyboard.press('3'); await hold(page, 'a', 1500); await hold(page, 'd', 2500);
  log('[drive] after mirrors try', JSON.stringify(await hud(page)));
  await page.keyboard.press('1'); await hold(page, 'w', 2500);
  log('[drive] after pedal', JSON.stringify(await hud(page)));
  await shot(page, 'drive0_firstperson.png');
  // stage: swerving at speed through the cones
  await ev(page, () => { const W = globalThis.__stacked.W; W.errand.step = 2; Object.assign(W.car, { x: 1.4, z: 0.3, yaw: 1.5708, v: 3.2 }); });
  await page.keyboard.press('2'); await page.keyboard.down('a');
  await cam(page, { p: [4.5, 3.2, -4.5], l: [2.0, 0.8, 0.4], fov: 55 });
  await waitGame(page, 0.8);
  await page.keyboard.up('a'); await page.keyboard.down('d'); await waitGame(page, 0.5);
  log('[drive] swerve', JSON.stringify(await hud(page)));
  await shot(page, 'drive1_swerve_cones.png');
  await page.keyboard.up('d');
  // stage: Mr Price looks away (slip)
  await ev(page, () => { const W = globalThis.__stacked.W; W.car.nextSlip = 0.01; });
  await waitGame(page, 0.8);
  log('[drive] slip', JSON.stringify(await hud(page)));
  // stage: emergency stop
  await ev(page, () => { const W = globalThis.__stacked.W; W.car.slipT = 0; W.errand.step = 4; Object.assign(W.car, { x: 3.0, z: 0.4, yaw: -1.5708, v: 2.5, stopT: -1, stopX: 2.4 }); });
  await cam(page, { p: [0.5, 2.6, -3.5], l: [2.4, 0.9, 0.4], fov: 55 });
  await page.keyboard.press('1'); await page.keyboard.down('w');
  await waitGame(page, 0.5);
  await page.keyboard.up('w');
  log('[drive] STOP?', JSON.stringify(await hud(page)));
  await page.keyboard.down('s'); await waitGame(page, 0.4);
  await shot(page, 'drive2_estop.png');
  await waitGame(page, 0.8); await page.keyboard.up('s');
  log('[drive] after stop', JSON.stringify(await hud(page)));
  // look away during slip, screenshot Price
  await ev(page, () => { const W = globalThis.__stacked.W; W.car.slipT = 4; W.car.v = 1.2; });
  await cam(page, { p: [1.0, 2.0, 2.6], l: [2.0, 1.0, 0.4], fov: 50 });
  await waitGame(page, 0.6);
  log('[drive] price away', JSON.stringify(await hud(page)));
  await shot(page, 'drive3_price_away.png');
  log('[drive] errors', errors());
  await page.context().close();
}

const all = { shop, bank, cinema, drive };
for (const n of (only.length ? only : Object.keys(all))) { try { await all[n](); } catch (e) { log('FAIL', n, e.message); } }
await k.stop();
