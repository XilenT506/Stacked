// Plays an errand solo with real keys only, like a person would: steer with W/A/D, nod with N, hold G to grab,
// Enter to talk. Reports how far it got, how long it took, and saves screenshots.
import { start } from '../lib.mjs';
const errand = process.argv[2] || 'shop';
const k = await start(8418, { page: process.env.PAGE || 'dist/next.html' });
const { page, errors } = await k.open('?errand=' + errand);
const S = (f, a) => page.evaluate(f, a);
await page.click('#solo'); await page.waitForTimeout(1500);
if (process.env.EV) await page.evaluate(() => { globalThis.__evlog = []; let last = 0; const tick = () => { const W = __stacked.W; if (W) for (const e of W.ev) if (e[0] > last) { last = e[0]; __evlog.push([e[1], e[2], +W.time.toFixed(2), W.people.map((p) => p.sus.toFixed(2)).join(','), W.body.down, W.hands.map((h) => [h.x.toFixed(2), h.y.toFixed(2), h.z.toFixed(2)].join(' ')).join(' | ')]); } const L = Math.hypot(W.body.lx, W.body.lz); if (W && L > 0.3 && !W.body.down) __evlog.push([99, +L.toFixed(2), +W.time.toFixed(2), 'v ' + W.body.v.toFixed(2) + ' yaw ' + W.body.yaw.toFixed(2) + ' f ' + __stacked.input.legs.f.toFixed(2) + ' t ' + __stacked.input.legs.t.toFixed(2) + ' g ' + __stacked.input.legs.gait, W.body.down, W.body.x.toFixed(2) + ',' + W.body.z.toFixed(2)]); requestAnimationFrame(tick); }; tick(); });
const st = () => S(() => { const W = __stacked.W; const sus = W.people.map((p) => p.id + ':' + p.sus.toFixed(2)).join(' '); const b = W.body; return { t: W.time, step: W.errand.step, phase: W.phase, x: b.x, z: b.z, yaw: b.yaw, down: b.down, v: b.v, held: W.items.map((i) => i.held), greet: W.people.some((p) => p.greet), ask: W.people.some((p) => p.ask > 0), sus: Math.max(0, ...W.people.map((p) => p.sus)), cue: __stacked.cue && __stacked.cue.state, end: !document.getElementById('end').hidden, obj: document.getElementById('objective').innerText.split('\n')[1], susAll: sus, sign: +(W.errand.sign || 0).toFixed(2) }; });
const held = new Set();
const press = async (key, on) => { if (on && !held.has(key)) { held.add(key); await page.keyboard.down(key); } if (!on && held.has(key)) { held.delete(key); await page.keyboard.up(key); } };
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
// which way does D turn?
await press('d', true); const y0 = (await st()).yaw; await page.waitForTimeout(600); await press('d', false); const y1 = (await st()).yaw;
const dSign = Math.sign(wrap(y1 - y0)) || 1;
const OUT = [[-5.8, -3.6], [-5.8, -1.2]];
const ROUTES = {
  shop: { 0: [...OUT, [-8.3, 1.75]], 4: [[-5.8, -1.2], [-5.8, -3.6], [-7.0, -4.6]] },
  bank: { 0: [...OUT, [0.0, 2.0], [0.0, 4.6]], 1: [[0, 6.3]], 2: [[0.3, 7.55]], 4: [[0.0, 4.6], [0.0, 2.0], [8.5, 0.2]] },
  cinema: { 0: [...OUT, [2.35, -1.6], [2.35, -2.95]], 2: [[5.0, -1.6], [9.2, -1.8], [9.2, -3.0]], 5: [[9.2, -3.7]] },
};
const ACT = { shop: { 2: 'grab', 3: 'talk' }, bank: { 2: 'grab', 3: 'grab' }, cinema: { 1: 'grab', 3: 'tall', 4: 'talk' } };
const LINES = { shop: 'Thank you very much, madam. Lovely day for it.', cinema: 'One ticket for the grown-up film, please. Dreadful traffic today.' };
let wp = null, wpStep = -1, talked = -1, shots = 0, answered = false;
const t0 = Date.now(); let last = null, lastEv = 0;
const EVN0 = { 99: 'LEAN' };
const EVN = Object.assign(EVN0, Object.fromEntries(Object.entries({ FALL: 1, STUMBLE: 2, RIP: 3, GASP: 4, REGISTER: 5, YELP: 6, CLANG: 7, COIN: 8, SLIP: 9, CAUGHT: 10, FREED: 11, RESTACK: 12, BANNER: 13, DROP: 14, HOPOUT: 15, HOPIN: 16, SWAP: 17, HAT: 18, SIGNED: 19, END: 20, UP: 21, CALM: 22, BUMP: 23, GRAB: 24, PAT: 25, POINT: 26, LEVEL: 27, LOOK: 28, WORST: 29, STEP: 30, LAPSE: 31, LAPSEEND: 32, GUST: 33, HIC: 34, NEXT: 35, ASK: 36 }).map(([a, b]) => [b, a])));
while (Date.now() - t0 < 420000) {
  const s = await st(); last = s;
  if (s.end || s.phase === 'end') break;
  const route = (ROUTES[errand] || {})[s.step];
  if (s.step !== wpStep) { wpStep = s.step; wp = route ? route.slice() : null; }
  // nod when greeted
  await press('n', s.greet);
  if (s.down) { for (const kk of ['w', 'a', 'd', 'g']) await press(kk, false); await page.waitForTimeout(150); continue; }
  if (wp && wp.length) {
    const [tx, tz] = wp[0], dx = tx - s.x, dz = tz - s.z, d = Math.hypot(dx, dz);
    if (d < 0.45 && wp.length > 1) { wp.shift(); continue; }
    const err = wrap(Math.atan2(dx, dz) - s.yaw);
    await press('d', err * dSign > 0.12); await press('a', err * dSign < -0.12);
    await press('w', Math.abs(err) < 0.7 && d > 0.3);
    if (d <= 0.3 && wp.length === 1) { await press('w', false); await press('a', false); await press('d', false); wp = null; }
  } else { await press('w', false); await press('a', false); await press('d', false); }
  const act = (ACT[errand] || {})[s.step];
  // grab and sign: hold G. The height check: hold Shift. Talking: Enter and type.
  await press('g', act === 'grab');
  const nearWet = Math.hypot(s.x - 0.45, s.z - 4.65) < 1.6;          // the WET! sign: tiptoe across
  await press('Shift', act === 'tall' || nearWet);
  // a grown-up asked a question: answer it like a person would
  if (s.ask && !answered) { answered = true; await page.keyboard.press('Enter'); await page.waitForTimeout(150); await page.fill('#say', 'I am an accountant, madam. Dreadful traffic on the ring road today.'); await page.keyboard.press('Enter'); }
  if (!s.ask) answered = false;
  if (act === 'talk' && talked !== s.step) { talked = s.step; await page.keyboard.press('Enter'); await page.waitForTimeout(150); await page.fill('#say', LINES[errand] || 'Good afternoon.'); await page.keyboard.press('Enter'); }
  if (s.step !== shots && shots < 6) { shots = s.step; await page.screenshot({ path: `test/play4/solo_${errand}_${s.step}.png` }); console.log(`step ${s.step} at game ${s.t.toFixed(0)}s: ${s.obj}`); }
  if (process.env.TRACE && (Math.round(s.t * 2) % 6 === 0 || (s.step === 4 && s.t < 34))) console.log('  t', s.t.toFixed(1), 'step', s.step, 'sign', s.sign, s.susAll, 'cue', s.cue, 'held', s.held, 'pos', s.x.toFixed(2), s.z.toFixed(2), 'down', s.down, 'v', (s.v||0).toFixed?.(2));
  if (process.env.EV) { const evs = await S(() => __evlog.splice(0)); for (const [kk, a, t, sus, down, hands] of evs) if (![29].includes(kk)) console.log('  ev', EVN[kk] || kk, a, 't', t, 'sus', sus, 'down', down, 'pos', s.x.toFixed(2), s.z.toFixed(2), 'hands', hands); }
  await page.waitForTimeout(80);
}
const s = last;
console.log(s.end ? 'FINISHED' : 'stopped', 'game time', s.t.toFixed(0), 's, step', s.step, 'max ?', s.sus.toFixed(2), JSON.stringify(s));
await page.screenshot({ path: `test/play4/solo_${errand}_end.png` });
console.log(errors()); await k.stop();
