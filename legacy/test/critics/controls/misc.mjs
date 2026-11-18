// 4. odd cases, solo. usage: node misc.mjs [opts] [w] [h]
import { start } from '../../lib.mjs';
import { install, clear, grab, sleep, stat, firstChange, frameTimes, med } from './probe.mjs';
const opts = process.argv[2] || '', vw = +process.argv[3] || 1280, vh = +process.argv[4] || 720;
const k = await start(8301);
const { page, errors } = await k.open(opts, { viewport: { width: vw, height: vh } });
await page.click('#solo'); await page.waitForFunction(() => __stacked.mode === 'play');
await install(page); await sleep(3000);
// staged: townspeople are kept calm so that a bust cannot interrupt the control checks
await page.evaluate(() => setInterval(() => { for (const p of __stacked.W.people) p.sus = 0; }, 30));
const up = async () => { await page.waitForFunction(() => !__stacked.W.body.down && __stacked.W.phase === 'play', null, { timeout: 20000 }); };
const st = () => page.evaluate(() => { const s = __stacked, I = s.input, W = s.W; return { part: I.part, keep: I.keep, lf: I.legs.f, lt: I.legs.t, gait: I.legs.gait, v: +W.body.v.toFixed(2), of: W.ord.f, ogait: W.ord.gait, nod: W.ord.nod, brow: W.ord.brow, hy: +I.hand[I.sel].y.toFixed(2), hz: +I.hand[I.sel].z.toFixed(2), hp: +I.head.p.toFixed(2), down: W.body.down, x: +W.body.x.toFixed(2), z: +W.body.z.toFixed(2), phase: W.phase }; });
const stage = (x, z, yaw) => page.evaluate(([x, z, yaw]) => { const b = __stacked.W.body; b.x = x; b.z = z; b.yaw = yaw; b.v = 0; b.lx = b.lz = 0; b.lvx = b.lvz = 0; }, [x, z, yaw]);
const K = page.keyboard, log = (n, o) => console.log(n.padEnd(58), typeof o === 'string' ? o : JSON.stringify(o));
console.log(`MISC solo opts='${opts}' ${vw}x${vh} fps ${(await page.evaluate(() => __stacked.fps)).toFixed(1)}`);

// T1 stop on release
for (const [name, extra] of [['walk', null], ['stride', 'KeyE'], ['tiptoe', 'ShiftLeft'], ['shuffle', 'KeyQ']]) {
  const tm = [], ds = [], first = [];
  for (let i = 0; i < 6; i++) {
    await up(); await stage(-4, 0.5, Math.PI / 2); await K.press('Digit1'); await sleep(500); await clear(page);
    if (extra) await K.down(extra); await K.down('KeyW'); await sleep((extra === 'KeyE' ? 700 : 1300) + Math.random() * 50); await K.up('KeyW'); if (extra) await K.up(extra); await sleep(1200);
    const { frames, keys } = await grab(page); const ku = keys.find((q) => q.k === 'KeyW' && !q.dn);
    const before = [...frames].reverse().find((f) => f.t <= ku.t), stop = frames.find((f) => f.t > ku.t && f.v === 0), dec = firstChange(frames, ku.t, (f) => f.v, 1e-4);
    if (stop && !frames.some((f) => f.down)) { tm.push(stop.t - ku.t); ds.push(Math.hypot(stop.x - before.x, stop.z - before.z) * 100); first.push(dec ? dec.ms : null); }
  }
  log(`T1 release W (${name}): first slowdown ms`, stat(first)); log(`   until speed 0 ms`, stat(tm)); log(`   coast distance cm`, stat(ds));
}
// T2 hold W, switch part, switch back
await up(); await stage(-4, 0.5, Math.PI / 2); await K.press('Digit1'); await sleep(400);
await K.down('KeyW'); await sleep(900); log('T2 legs, W held', await st());
await K.press('Digit2'); await sleep(700); log('   -> 2 (arms), W still held', await st());
await K.press('Digit1'); await sleep(700); log('   -> 1 (legs), W still held', await st());
await K.press('Digit3'); await sleep(700); log('   -> 3 (head), W still held (head pitch hp moves)', await st());
await K.up('KeyW'); await K.press('Digit1'); await sleep(600);
// T3 keep walking
await stage(-4, 0.5, Math.PI / 2); await sleep(300);
await K.down('KeyW'); await sleep(500); await K.press('KeyK'); await sleep(200); log('T3 legs, W held, K pressed', await st());
await K.press('Digit2'); await sleep(300); await K.up('KeyW'); await sleep(1000); log('   -> arms, W released, 1.0 s later', await st());
await K.press('KeyK'); await sleep(700); log('   K again while in arms (keep off)', await st());
await K.press('KeyK'); await sleep(500); log('   K a third time while in arms, standing (keep on, nothing to keep)', await st());
await K.press('Digit1'); await sleep(300); await K.down('KeyW'); await sleep(600); await K.press('Digit3'); await sleep(200); await K.up('KeyW'); await sleep(900); log('   legs W, -> head, release W (keep was left on)', await st());
await K.press('Digit1'); await sleep(700); log('   back to legs, no key held', await st());
await K.press('Digit2'); await sleep(700); log('   to arms again (keep still on?)', await st());
if ((await st()).keep) { await K.press('KeyK'); await sleep(200); }
// keep with turn + gait held
await stage(0, 0.5, Math.PI / 2); await K.press('Digit1'); await sleep(300);
await K.down('KeyW'); await K.down('KeyA'); await K.down('ShiftLeft'); await sleep(300); await K.press('KeyK'); await sleep(100); await K.press('Digit2'); await sleep(100);
await K.up('KeyW'); await K.up('KeyA'); await K.up('ShiftLeft'); await sleep(1500); log('T3b keep with W+A+Shift then all released, in arms', await st());
await K.press('KeyK'); await sleep(600); log('   K off', await st());
// keep then fall
await stage(-4, 0.5, Math.PI / 2); await K.press('Digit1'); await sleep(300); await K.down('KeyW'); await sleep(300); await K.press('KeyK'); await K.press('Digit2'); await sleep(100); await K.up('KeyW'); await sleep(400);
await page.evaluate(() => { __stacked.W.body.lx = 0.62; }); await sleep(400); log('T3c keep on, then a (staged) fall', await st());
await up(); await sleep(800); log('   after getting up', await st());
// T4 nod held across a part switch
await K.press('Digit3'); await sleep(300); await K.down('KeyN'); await sleep(400); log('T4 head, N held', await st());
await K.press('Digit1'); await sleep(400); log('   -> legs 0.4 s, N still held', await st()); await sleep(900); log('   -> legs 1.3 s, N still held', await st());
await K.press('Digit3'); await sleep(300); log('   -> back to head, N still held', await st()); await K.up('KeyN'); await sleep(1100);
// T5 E means stride / raise hand / eyebrows
await stage(-4, 0.5, Math.PI / 2); await K.press('Digit1'); await sleep(300); await K.down('KeyE'); await K.down('KeyW'); await sleep(500); log('T5 legs, E+W held (stride)', await st());
await K.press('Tab'); await sleep(500); log('   Tab -> arms, E+W still held (hand y rises, z forward)', await st());
await K.press('Tab'); await sleep(500); log('   Tab -> head, E+W still held (eyebrows up, pitch)', await st());
await K.up('KeyE'); await K.up('KeyW'); await K.press('Digit1'); await sleep(500);
// T7 window blur while W held
await stage(-4, 0.5, Math.PI / 2); await K.down('KeyW'); await sleep(600); await page.evaluate(() => dispatchEvent(new Event('blur'))); await sleep(800); log('T7 W held, window loses focus', await st());
await page.evaluate(() => dispatchEvent(new Event('focus'))); await sleep(600); log('   focus back, W still physically held', await st()); await K.up('KeyW'); await sleep(300);
// T9 short taps of held-type keys; tap-type keys
await K.press('Digit3'); await sleep(300);
for (const dur of [15, 30, 50, 80, 120]) {
  const res = {};
  for (const [key, field] of [['KeyN', 'inod'], ['KeyE', 'ibrow']]) {
    let hit = 0; const n = 20;
    for (let i = 0; i < n; i++) { await sleep(field === 'inod' ? 1000 : 150 + Math.random() * 40); await clear(page); await K.down(key); await sleep(dur); await K.up(key); await sleep(150); const { frames, keys } = await grab(page); if (frames.some((f) => f[field])) hit++; res[key + '_real'] = keys.length >= 2 ? Math.round(keys[1].ts - keys[0].ts) : 0; }
    res[key] = `${hit}/${n}`;
  }
  log(`T9 tap for ~${dur} ms: taps that registered (nod N, brow E)`, res);
}
await K.press('Digit2'); await sleep(300);
{ let hit = 0; for (let i = 0; i < 20; i++) { await sleep(120); const n0 = await page.evaluate(() => __stacked.input.n.join()); await K.down('KeyG'); await sleep(15); await K.up('KeyG'); await sleep(120); if ((await page.evaluate(() => __stacked.input.n.join())) !== n0) hit++; } log('T9 15 ms taps of G (grab) that registered', `${hit}/20`); }
// T11 mouse look, pointer lock stubbed out (staged) so that drag is used
await page.evaluate(() => { document.getElementById('view').requestPointerLock = undefined; });
await K.press('Digit3'); await sleep(300);
{ const ms = [], ms2 = [];
  await page.mouse.move(vw / 2, vh / 2); await page.mouse.down(); await sleep(200);
  for (let i = 0; i < 14; i++) { await sleep(150 + Math.random() * 50); await clear(page); await sleep(60); await page.mouse.move(vw / 2 + (i % 2 ? -20 : 20), vh / 2); await sleep(250);
    const { frames, keys } = await grab(page); const kd = keys.find((q) => q.k === 'mouse'); if (!kd) { ms.push(null); continue; }
    const r = firstChange(frames, kd.t, (f) => f.cry); ms.push(r ? r.ms : null); ms2.push(r ? r.f.t - kd.ts : null); }
  await page.mouse.up(); log('T11 mouse drag look: handler -> camera yaw drawn ms', stat(ms)); log('   browser event time -> drawn ms', stat(ms2)); }
console.log('errors', errors());
await k.stop();
