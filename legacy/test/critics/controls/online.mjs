// Host + friend over WebRTC. usage: node online.mjs [urlopts] [w] [h] [phases]
import { start } from '../../lib.mjs';
import { install, clear, grab, sleep, stat, firstChange, frameTimes, med } from './probe.mjs';
import { localTests } from './localtests.mjs';
const opts = process.argv[2] || '', vw = +process.argv[3] || 1280, vh = +process.argv[4] || 720, phases = process.argv[5] || 'ABCDE';
const k = await start(8301);
const h = await k.open(opts, { viewport: { width: vw, height: vh } }), c = await k.open(opts, { viewport: { width: vw, height: vh } });
const H = h.page, C = c.page;
await H.waitForFunction(() => !document.getElementById('host').disabled && /friends/.test(document.getElementById('status').textContent), null, { timeout: 10000 });
await H.click('#host'); await H.waitForFunction(() => __stacked.mode === 'play');
const code = await H.evaluate(() => __stacked.link.code);
await C.waitForFunction(() => /friends/.test(document.getElementById('status').textContent));
await C.fill('#code', code); await C.click('#join');
await C.waitForFunction(() => __stacked.mode === 'play' && __stacked.W.players.length === 2, null, { timeout: 20000 });
await install(H); await install(C); await sleep(4000);
const LAG = +process.argv[6] || 0;
if (LAG) { for (const p of [H, C]) await p.evaluate((ms) => { const l = __stacked.link, os = l.onState; l.onState = (f, d) => setTimeout(() => os(f, d), ms); }, LAG); console.log(`*** staged: every received message delayed by ${LAG} ms on both pages (simulated ${LAG} ms one-way latency)`); }
const info = async () => ({ hs: await H.evaluate(() => ({ seats: __stacked.W.seats, fps: __stacked.fps, kind: __stacked.link.kind })), cs: await C.evaluate(() => ({ seats: __stacked.W.seats, fps: __stacked.fps, gap: __stacked.stats.snapGap.slice() })) });
let I = await info();
console.log(`ONLINE opts='${opts}' ${vw}x${vh} link=${I.hs.kind} seats=${JSON.stringify(I.hs.seats)} host fps ${I.hs.fps.toFixed(1)} friend fps ${I.cs.fps.toFixed(1)}`);
const both = async () => { const [a, b] = await Promise.all([grab(H), grab(C)]); return { hf: a.frames, hk: a.keys, cf: b.frames, ck: b.keys }; };
const clr = () => Promise.all([clear(H), clear(C)]);
const stage = (x, z, yaw) => H.evaluate(([x, z, yaw]) => { const b = __stacked.W.body; b.x = x; b.z = z; b.yaw = yaw; b.v = 0; b.lx = b.lz = 0; b.lvx = b.lvz = 0; }, [x, z, yaw]);

if (phases.includes('A')) await localTests(C, 'FRIEND (client) owning head+arms', ['arms', 'head']);

if (phases.includes('B')) {
  console.log('\n== REMOTE host -> friend');
  // (a) lean
  await H.keyboard.press('Digit1');
  const a1 = [], a2 = [], a3 = [], hft = [], cft = [], a4 = []; const r3 = (v) => Math.round(v * 1000) / 1000;
  for (let i = 0; i < 14; i++) {
    const key = i % 2 ? 'KeyS' : 'KeyW';
    await sleep(1900 + Math.random() * 100); await clr(); await sleep(120 + Math.random() * 60);
    await H.keyboard.down(key); await sleep(350); await H.keyboard.up(key); await sleep(450);
    const { hf, hk, cf } = await both(); const kd = hk.find((q) => q.k === key && q.dn);
    hft.push(...frameTimes(hf)); cft.push(...frameTimes(cf));
    const lean = (f) => f.lx * 3 + f.lz;
    { const key3 = (f) => r3(f.lx) + ',' + r3(f.lz); let prev = null;
      for (const f of cf) { const kk = key3(f); if (prev != null && kk !== prev && Math.abs(f.lx) + Math.abs(f.lz) > 0.01) { let best = null; for (const g of hf) { if (g.d > f.d + 3) break; if (key3(g) === kk) best = g; } if (best && f.d - best.d < 600) a4.push(f.d - best.d); } prev = kk; } }
    const rh = firstChange(hf, kd.d, lean, 0.02, 'd'); if (!rh) { a1.push(null); continue; }
    const rc = firstChange(cf, kd.d, lean, 0.02, 'd'); if (i === 0) console.log('   rest lean spread host', Math.max(...hf.filter((f) => f.d < kd.d).map(lean)) - Math.min(...hf.filter((f) => f.d < kd.d).map(lean)));
    const rp = firstChange(cf, kd.d, (f) => f.x * 7 + f.z, 2e-3, 'd');
    a1.push(rc ? rc.f.d - rh.f.d : null); a2.push(rc ? rc.f.d - kd.d : null); a3.push(rp ? rp.f.d - kd.d : null);
  }
  console.log('host frame ms:', stat(hft), '| friend frame ms:', stat(cft));
  console.log('(a) lean value shown on host -> same value shown on friend ms:', stat(a4));
  console.log('(a) lean onset (>0.02): host screen -> friend screen ms:      ', stat(a1));
  console.log('(a) lean: host key press -> friend screen ms:   ', stat(a2));
  console.log('(a) body position: host key -> friend screen ms:', stat(a3));
  // (b) fall, staged by setting lean past the limit on the host
  const b1 = [], b2 = [], b3 = [];
  for (let i = 0; i < 8; i++) {
    await H.waitForFunction(() => !__stacked.W.body.down && __stacked.W.phase === 'play', null, { timeout: 15000 }); await sleep(700 + Math.random() * 200);
    await clr(); await Promise.all([H, C].map((p) => p.evaluate(() => { delete __stacked.stats.evSeen[1]; })));
    await sleep(120);
    const d0 = await H.evaluate(() => { __stacked.W.body.lx = 0.62; return Date.now(); });
    await sleep(900);
    const { hf, cf } = await both();
    const fh = hf.find((f) => f.d > d0 && f.down), fc = cf.find((f) => f.d > d0 && f.down);
    const [eh, ec] = await Promise.all([H, C].map((p) => p.evaluate(() => __stacked.stats.evSeen[1])));
    b1.push(fh && fc ? fc.d - fh.d : null); b2.push(eh && ec ? ec - eh : null); b3.push(fc ? fc.d - d0 : null);
  }
  console.log('(b) fall W.body.down: host frame -> friend frame ms:', stat(b1));
  console.log('(b) fall event kind 1 evSeen friend - host ms:      ', stat(b2));
  console.log('(b) fall: staged at -> friend frame ms:              ', stat(b3));
  await H.waitForFunction(() => !__stacked.W.body.down && __stacked.W.phase === 'play', null, { timeout: 15000 });
  // (c) townsperson: stage the stack in the street in front of Officer Hale, stride at him briefly, then stage it back to the alley
  const c1 = [], c2 = [], evd = {};
  const r2 = (v) => Math.round(v * 100) / 100;
  for (let i = 0; i < 10; i++) {
    await Promise.all([H, C].map((p) => p.evaluate(() => { __stacked.stats.evSeen = {}; })));
    await stage(-7.6, -5.0, 0);
    await H.waitForFunction(() => __stacked.W.people.every((p) => p.sus < 0.005), null, { timeout: 40000 }).catch(() => {});
    await sleep(800); await clr(); await sleep(150);
    const d0 = await H.evaluate(() => { const b = __stacked.W.body; b.x = 2.4; b.z = 0.9; b.yaw = 0; b.lx = 0.3; return Date.now(); });
    await sleep(1000);
    const { hf, cf } = await both();
    for (let p = 0; p < 3; p++) {
      const pick = (f) => r2(+f.sus.split(',')[p]);
      const rh = firstChange(hf, d0, pick, 0.001, 'd'), rc = firstChange(cf, d0, pick, 0.001, 'd');
      if (rh && rc) c1.push(rc.f.d - rh.f.d);
      const mh = firstChange(hf, d0, (f) => f.modes.split(',')[p], 0, 'd'), mc = firstChange(cf, d0, (f) => f.modes.split(',')[p], 0, 'd');
      if (mh && mc) c2.push(mc.f.d - mh.f.d);
    }
    const [eh, ec] = await Promise.all([H, C].map((p) => p.evaluate(() => __stacked.stats.evSeen)));
    for (const kk of Object.keys(eh)) if (ec[kk]) (evd[kk] ||= []).push(ec[kk] - eh[kk]);
    const ph = await H.evaluate(() => __stacked.W.phase); if (ph !== 'play') { console.log('   busted on trial', i, '- stopping (c)'); break; }
  }
  console.log('(c) townsperson sus first change: host frame -> friend frame ms:', stat(c1));
  console.log('(c) townsperson mode change:      host frame -> friend frame ms:', stat(c2));
  for (const [kk, v] of Object.entries(evd)) console.log(`(c) event kind ${kk} evSeen friend - host ms:`, stat(v));
  I = await info(); console.log('snapshot interval seen by friend (stats.snapGap) ms:', stat(I.cs.gap), ' p95', [...I.cs.gap].sort((a, b) => a - b)[Math.floor(I.cs.gap.length * 0.95)]?.toFixed(1));
}

if (phases.includes('C')) {
  console.log('\n== REMOTE friend -> host');
  await stage(-7.6, -5.0, 0); await sleep(500);
  await C.keyboard.press('Digit3'); await sleep(300);
  const n1 = [], n2 = [];
  for (let i = 0; i < 14; i++) {
    await sleep(1100 + Math.random() * 100); await clr(); await sleep(100 + Math.random() * 60);
    await C.keyboard.down('KeyN'); await sleep(150); await C.keyboard.up('KeyN'); await sleep(500);
    const { hf, cf, ck } = await both(); const kd = ck.find((q) => q.k === 'KeyN' && q.dn);
    const fh = hf.find((f) => f.d > kd.d - 5 && f.onod), fc = cf.find((f) => f.d > kd.d && f.onod);
    n1.push(fh ? fh.d - kd.d : null); n2.push(fc ? fc.d - kd.d : null);
  }
  console.log("friend nod key -> host's world W.ord.nod ms:        ", stat(n1));
  console.log("friend nod key -> echoed back in friend's W.ord ms: ", stat(n2));
  await C.keyboard.press('Digit2'); await sleep(300);
  const m1 = [], m2 = [];
  for (let i = 0; i < 14; i++) {
    const key = i % 2 ? 'KeyD' : 'KeyA';
    await sleep(300 + Math.random() * 100); await clr(); await sleep(100 + Math.random() * 60);
    await C.keyboard.down(key); await sleep(200); await C.keyboard.up(key); await sleep(400);
    const { hf, cf, ck } = await both(); const kd = ck.find((q) => q.k === key && q.dn);
    const rh = firstChange(hf, kd.d, (f) => f.ohx, 1e-4, 'd'), rc = firstChange(cf, kd.d, (f) => f.whx * 3 + f.whz, 1e-3, 'd');
    m1.push(rh ? rh.f.d - kd.d : null); m2.push(rc ? rc.f.d - kd.d : null);
  }
  console.log("friend hand key -> host's world W.ord.hand ms:      ", stat(m1));
  console.log("friend hand key -> host-simulated W.hands back on friend ms:", stat(m2));
}

if (phases.includes('D')) {
  console.log('\n== SEAT SWAP: friend becomes the legs');
  await stage(-7.6, -5.0, 0); await sleep(600);
  await H.keyboard.press('KeyV'); await sleep(1200);
  I = await info(); console.log('seats after V on host:', JSON.stringify(I.hs.seats), 'friend sees', JSON.stringify(I.cs.seats));
  if (I.cs.seats.legs === 1) {
    await stage(-2, 0.5, Math.PI / 2); await sleep(1200);
    // walk start / stop
    const s1 = [], s2 = [], s3 = [], e1 = [], e2 = [], e3 = [], back = [];
    for (let i = 0; i < 10; i++) {
      await stage(-2, 0.5, Math.PI / 2); await sleep(900 + Math.random() * 100); await clr(); await sleep(120 + Math.random() * 60);
      await C.keyboard.down('KeyW'); await sleep(900); await C.keyboard.up('KeyW'); await sleep(1300);
      const { hf, cf, ck } = await both(); const kd = ck.find((q) => q.k === 'KeyW' && q.dn), ku = ck.find((q) => q.k === 'KeyW' && !q.dn);
      const rl = firstChange(cf, kd.d, (f) => f.x * 7 + f.z, 1e-4, 'd'), rh = firstChange(hf, kd.d, (f) => f.x * 7 + f.z, 1e-4, 'd'), rn = firstChange(cf, kd.d, (f) => f.nbx * 7 + f.nbz, 1e-4, 'd');
      s1.push(rl ? rl.f.d - kd.d : null); s2.push(rh ? rh.f.d - kd.d : null); s3.push(rn ? rn.f.d - kd.d : null);
      const cl = cf.find((f) => f.d > ku.d && f.v === 0), hl = hf.find((f) => f.d > ku.d && f.v === 0);
      e1.push(cl ? cl.d - ku.d : null); e2.push(hl ? hl.d - ku.d : null);
      // after the friend's local speed hits 0, how far is the body still pulled?
      if (cl) { const after = cf.filter((f) => f.d >= cl.d); const mx = Math.max(...after.map((f) => Math.hypot(f.x - cl.x, f.z - cl.z))); back.push(mx); const st = after.find((f) => Math.hypot(f.x - after[after.length - 1].x, f.z - after[after.length - 1].z) < 0.01); e3.push(st ? st.d - cl.d : null); }
    }
    console.log('friend W key -> own body moves on friend screen ms:', stat(s1));
    console.log('friend W key -> host body moves (host world) ms:   ', stat(s2));
    console.log('friend W key -> host confirmation back on friend ms:', stat(s3));
    console.log('friend releases W -> local speed 0 ms:', stat(e1), '| host speed 0 ms:', stat(e2));
    console.log('after local stop, body keeps sliding (m):', stat(back.map((v) => v * 100)).replace(/(\d+\.\d)/g, '$1cm'), '| settle ms:', stat(e3));
    // 5 s walk with turns: drift between friend's predicted body and the host's body at the same wall-clock time
    for (const [name, turn] of [['straight then turns', true], ['straight only', false]]) {
      const drift = [], driftNb = [], yawd = [], jumps = [];
      for (let rep = 0; rep < 3; rep++) {
        await stage(-4, 0.5, Math.PI / 2); await sleep(1300); await clr(); await sleep(100);
        await C.keyboard.down('KeyW');
        if (turn) for (let j = 0; j < 7; j++) { const kk = j % 2 ? 'KeyD' : 'KeyA'; await sleep(350); await C.keyboard.down(kk); await sleep(360); await C.keyboard.up(kk); } else await sleep(5000);
        await C.keyboard.up('KeyW'); await sleep(1200);
        const { hf, cf } = await both();
        let j = 0;
        for (let q = 1; q < cf.length; q++) {
          const f = cf[q];
          while (j < hf.length - 2 && hf[j + 1].d <= f.d) j++;
          const a = hf[j], b = hf[j + 1]; if (!b || a.d > f.d) continue;
          const u = b.d === a.d ? 0 : Math.min(1, (f.d - a.d) / (b.d - a.d));
          const hx = a.x + (b.x - a.x) * u, hz = a.z + (b.z - a.z) * u;
          drift.push(Math.hypot(f.x - hx, f.z - hz)); driftNb.push(Math.hypot(f.x - f.nbx, f.z - f.nbz));
          yawd.push(Math.abs(Math.atan2(Math.sin(f.yaw - a.yaw), Math.cos(f.yaw - a.yaw))));
          // frame-to-frame step vs what own speed would give: a visible snap
          const p = cf[q - 1], stepd = Math.hypot(f.x - p.x, f.z - p.z), dt = (f.t - p.t) / 1000; jumps.push(stepd - Math.abs(f.v) * dt);
        }
        if (rep === 0) console.log(`   [${name}] host end (${hf[hf.length - 1].x.toFixed(2)}, ${hf[hf.length - 1].z.toFixed(2)}) friend end (${cf[cf.length - 1].x.toFixed(2)}, ${cf[cf.length - 1].z.toFixed(2)}) host fell: ${hf.some((f) => f.down)}`);
      }
      const m = (a) => `med ${med(a).toFixed(3)} worst ${Math.max(...a).toFixed(3)}`;
      console.log(`[${name}] friend body vs host body, same instant (m): ${m(drift)} | vs last snapshot (m): ${m(driftNb)} | yaw diff (rad): ${m(yawd)} | extra per-frame pull beyond own speed (m): ${m(jumps)}`);
    }
    await localTests(C, 'FRIEND (client) owning legs', ['legs'], 10);
  }
}
I = await info(); console.log('\nsnapGap overall ms:', stat(I.cs.gap), '| host fps', I.hs.fps.toFixed(1), 'friend fps', I.cs.fps.toFixed(1));
console.log('errors host', h.errors(), 'friend', c.errors());
await k.stop();
