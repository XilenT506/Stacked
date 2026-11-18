// Plays the game in a real (headless) browser. Usage: node test/run.mjs [bot|controls|online|all]
import { chromium } from './pw.mjs';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';

const which = process.argv[2] || 'all';
const PORT = 8123, URL = `http://localhost:${PORT}/`;
const server = spawn('node', ['server/signal.mjs'], { env: { ...process.env, PORT, PAGE: process.env.PAGE || 'dist/stacked.html' }, stdio: 'inherit' });
await new Promise((r) => setTimeout(r, 600));
const three = await readFile('node_modules/three/build/three.min.js');
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist',
  '--disable-features=WebRtcHideLocalIpsWithMdns', '--autoplay-policy=no-user-gesture-required'] });
let failed = 0;
const check = (ok, what) => { console.log((ok ? '  ok   ' : '  FAIL ') + what); if (!ok) failed++; };

async function open(path = '', opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, ...opts });
  const page = await ctx.newPage(); const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); if (m.text().startsWith('[bot]')) console.log('   ' + m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await page.route(/cdnjs\.cloudflare\.com.*three/, (r) => r.fulfill({ body: three, contentType: 'text/javascript' }));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.goto(URL + path);
  await page.waitForFunction(() => globalThis.__stacked, null, { timeout: 15000 });
  return { page, errors: () => errors.filter((e) => !/fonts\.g|ERR_FAILED/.test(e)), ctx };
}
const S = (page, fn) => page.evaluate(fn);

if (which === 'bot' || which === 'all') {
  console.log('BOT: one bot plays every part, start to end card');
  const { page, errors } = await open('?bot=1&speed=2&q=low', { viewport: { width: 800, height: 450 } });
  const shots = { 'got back up': 'legs', 'busted: scatter': 'scatter', queued: 'head', 'took the cash': 'arms' }; const taken = new Set();
  const t0 = Date.now(); let st;
  for (;;) {
    st = await S(page, () => { const s = globalThis.__stacked; return { done: s.bot.done, error: s.bot.error, log: s.bot.log, phase: s.W.phase, end: s.W.end, clock: s.W.clock, falls: s.W.stats.falls, busts: s.W.stats.busts, fps: s.fps }; });
    for (const m of st.log) if (shots[m] && !taken.has(m)) { taken.add(m); await page.screenshot({ path: `test/shot-${shots[m]}.png` }); }
    if (st.done || Date.now() - t0 > 330000) break;
    await new Promise((r) => setTimeout(r, 400));
  }
  await page.screenshot({ path: 'test/shot-end.png' });
  check(st.done && !st.error, 'bot finished its script' + (st.error ? ': ' + st.error : ''));
  for (const m of ['gaits: stride, shuffle, tiptoe', 'legs stop when released', 'keep walking toggle', 'arm and head actions', 'fell over', 'got back up', 'kid out', 'kid back in', 'busted: scatter', 'restacked', 'bluff landed', 'queued', 'holding the form', 'pen snapped to the line', 'in reach cue', 'took the cash']) check(st.log.includes(m), m);
  check(st.end === 1, 'bank errand finished (end card: errand done)');
  check(st.falls >= 1 && st.busts >= 1, `stack fell (${st.falls}) and was busted (${st.busts})`);
  check(await S(page, () => !document.getElementById('end').hidden), 'end card is showing');
  check(errors().length === 0, 'no console errors' + (errors().length ? ': ' + errors().slice(0, 3).join(' | ') : ''));
  console.log(`   took ${((Date.now() - t0) / 1000).toFixed(0)}s, game clock left ${st.clock.toFixed(0)}s, ${st.fps.toFixed(0)} fps in the headless browser`);
  await page.close();
}

if (which === 'controls' || which === 'all') {
  console.log('CONTROLS: keyboard and mouse, touch, gamepad for every part');
  const { page, errors } = await open();
  const vis = () => S(page, () => ['menu', 'hud', 'end'].filter((id) => getComputedStyle(document.getElementById(id)).display !== 'none').join());
  check((await vis()) === 'menu', 'at boot only the menu shows');
  await page.click('#solo'); await page.waitForTimeout(200);
  check((await vis()) === 'hud', 'Play solo leaves the menu');
  await page.click('#quit'); await page.waitForTimeout(200);
  check((await vis()) === 'menu', 'the Menu button goes back to the menu');
  await page.click('#solo');
  const tick = () => page.waitForTimeout(160);
  const I = () => S(page, () => { const i = globalThis.__stacked.input; return { part: i.part, legs: i.legs, hand: i.hand, sel: i.sel, head: i.head, n: i.n, kid: i.kid }; });
  // legs
  await page.keyboard.down('KeyW'); await tick(); check((await I()).legs.f === 1, 'legs: W walks'); await page.keyboard.up('KeyW');
  await page.keyboard.down('KeyS'); await tick(); check((await I()).legs.f === -1, 'legs: S backs up'); await page.keyboard.up('KeyS');
  await page.keyboard.down('KeyA'); await tick(); check((await I()).legs.t === -1, 'legs: A turns left'); await page.keyboard.up('KeyA');
  await page.keyboard.down('KeyD'); await page.keyboard.down('ShiftLeft'); await tick(); let s = await I(); check(s.legs.t === 1 && s.legs.gait === 1, 'legs: D turns right, Shift tiptoes'); await page.keyboard.up('KeyD'); await page.keyboard.up('ShiftLeft'); await tick();
  check((await I()).legs.f === 0, 'legs: releasing stops');
  await page.keyboard.down('KeyE'); await tick(); check((await I()).legs.gait === 2, 'legs: E strides'); await page.keyboard.up('KeyE');
  await page.keyboard.down('KeyQ'); await tick(); check((await I()).legs.gait === 3, 'legs: Q shuffles'); await page.keyboard.up('KeyQ');
  await page.keyboard.down('KeyW'); await tick(); await page.keyboard.press('Digit2'); await page.keyboard.up('KeyW'); await page.waitForTimeout(500);
  check((await I()).legs.f === 0 && Math.abs(await S(page, () => globalThis.__stacked.W.body.v)) < 0.05, 'legs stop when you switch part: no walking on its own');
  await page.keyboard.press('Digit1'); await tick(); await page.keyboard.press('KeyK'); await page.keyboard.down('KeyS'); await tick(); await page.keyboard.press('Digit2'); await page.keyboard.up('KeyS'); await page.waitForTimeout(400);
  check((await I()).legs.f === -1 && (await S(page, () => globalThis.__stacked.input.keep)), 'solo: K keeps the legs walking while you play another part');
  await page.keyboard.press('Digit1'); await tick(); check(!(await S(page, () => globalThis.__stacked.input.keep)), 'coming back to the legs ends keep walking');
  // arms
  await page.keyboard.press('Digit2'); await tick(); check((await I()).part === 'arms', 'switch to arms with 2');
  await page.keyboard.down('KeyW'); await page.keyboard.down('KeyE'); await page.waitForTimeout(800); await page.keyboard.up('KeyW'); await page.keyboard.up('KeyE'); s = await I();
  check(s.hand[1].z > 0.1 && s.hand[1].y > 0.1, 'arms: W reaches, E raises ' + JSON.stringify(s.hand[1]) + ' ' + s.part);
  await page.keyboard.down('KeyQ'); await page.waitForTimeout(250); await page.keyboard.up('KeyQ'); check((await I()).hand[1].y < s.hand[1].y, 'arms: Q lowers');
  await S(page, () => { HTMLCanvasElement.prototype.requestPointerLock = undefined; });   // headless pointer lock reports nonsense movement
  await page.mouse.move(600, 300); await page.mouse.down(); await page.mouse.move(700, 300, { steps: 4 }); await page.mouse.up(); await tick();
  check((await I()).hand[1].x > 0.05, 'arms: mouse moves the hand');
  await page.keyboard.press('KeyF'); await tick(); check((await I()).sel === 0, 'arms: F switches hand');
  await page.keyboard.press('KeyG'); await tick(); check((await I()).n[0] === 1, 'arms: G grabs');
  await page.keyboard.down('KeyC'); await tick(); check((await I()).hand[0].act === 1, 'arms: C waves'); await page.keyboard.up('KeyC');
  await page.keyboard.down('KeyX'); await tick(); check((await I()).hand[0].act === 2, 'arms: X points'); await page.keyboard.up('KeyX');
  await page.keyboard.press('KeyZ'); await tick(); check((await I()).n[5] === 1 && (await S(page, () => globalThis.__stacked.W.patT)) > 0, 'arms: Z pats the pockets');
  // head
  await page.keyboard.press('Digit3'); await tick(); check((await I()).part === 'head', 'switch to head with 3');
  await page.keyboard.down('KeyN'); await tick(); check((await I()).head.nod === 1 && (await S(page, () => globalThis.__stacked.W.ord.nod)) === 1, 'head: N nods (and the body nods)'); await page.keyboard.up('KeyN');
  await page.keyboard.down('KeyM'); await tick(); check((await I()).head.shake === 1, 'head: M shakes'); await page.keyboard.up('KeyM');
  await page.keyboard.down('KeyE'); await tick(); check((await I()).head.brow === 1 && (await S(page, () => globalThis.__stacked.W.ord.brow)) === 1, 'head: E raises the eyebrows'); await page.keyboard.up('KeyE');
  await page.keyboard.down('Space'); await tick(); check((await I()).head.talk === 1, 'head: Space talks'); await page.keyboard.up('Space');
  await page.keyboard.press('KeyH'); await tick(); check((await S(page, () => globalThis.__stacked.W.hatT)) > 0, 'head: H tips the hat');
  await page.keyboard.down('KeyD'); await page.waitForTimeout(300); await page.keyboard.up('KeyD'); check((await I()).head.y < -0.1, 'head: D looks right');
  await page.keyboard.press('Tab'); await tick(); check((await I()).part === 'legs', 'Tab cycles to the next part');
  // alley actions
  await page.keyboard.press('KeyB'); await page.waitForTimeout(300); check((await S(page, () => globalThis.__stacked.W.kids.length)) === 1, 'B lets a kid out in the alley');
  await page.keyboard.press('Digit4'); await tick(); await page.keyboard.down('KeyW'); await page.waitForTimeout(200); s = await I(); await page.keyboard.up('KeyW'); check(s.part === 'kid' && s.kid.mz === 1, 'kid: 4 selects, WASD runs');
  await page.keyboard.press('KeyV'); await tick(); check((await I()).n[3] === 1, 'V asks to swap places');
  // gamepad (a pretend controller)
  await S(page, () => { const pad = { connected: true, axes: [0, -1, 0, 0], buttons: Array.from({ length: 12 }, () => ({ pressed: false })) }; globalThis.__pad = pad; navigator.getGamepads = () => [pad]; });
  await page.keyboard.press('Digit1'); await tick(); check((await I()).legs.f === 1, 'gamepad: left stick walks');
  await S(page, () => { __pad.axes[1] = 0; __pad.buttons[0].pressed = true; }); await tick(); check((await I()).legs.gait === 1, 'gamepad: A tiptoes');
  await S(page, () => { __pad.buttons[0].pressed = false; __pad.buttons[5].pressed = true; }); await tick(); await S(page, () => { __pad.buttons[5].pressed = false; }); await tick(); check((await I()).part === 'arms', 'gamepad: bumper switches part');
  await S(page, () => { navigator.getGamepads = () => []; }); await tick();
  check(errors().length === 0, 'no console errors' + (errors().length ? ': ' + errors().slice(0, 3).join(' | ') : ''));
  await page.close();
  // touch, on a phone-sized screen
  const t = await open('', { viewport: { width: 740, height: 360 }, hasTouch: true, isMobile: true });
  await t.page.tap('#solo'); await t.page.waitForTimeout(300);
  check(await S(t.page, () => !document.getElementById('touch').hidden), 'touch: joystick and buttons appear');
  const box = await t.page.locator('#stick').boundingBox();
  const cdp = await t.ctx.newCDPSession(t.page), tp = [{ x: box.x + box.width / 2, y: box.y + 10, id: 1 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: tp }); await t.page.waitForTimeout(250);
  check((await S(t.page, () => globalThis.__stacked.input.legs.f)) > 0.5, 'touch: joystick walks the legs');
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await t.page.waitForTimeout(150);
  check((await S(t.page, () => globalThis.__stacked.input.legs.f)) === 0, 'touch: letting go stops');
  const legNames = (await t.page.locator('#btns button').allTextContents()).join();
  check(legNames.includes('Tiptoe') && legNames.includes('Stride') && legNames.includes('Shuffle') && legNames.includes('Keep walking'), 'touch: legs get Tiptoe, Stride, Shuffle, Keep walking');
  await t.page.dispatchEvent('#parts button:nth-child(2)', 'pointerdown', {}); await t.page.waitForTimeout(200);
  const armNames = (await t.page.locator('#btns button').allTextContents()).join();
  check(armNames.includes('Grab') && armNames.includes('Wave') && armNames.includes('Point') && armNames.includes('Pat pockets'), 'touch: arms get Grab, Wave, Point, Pat pockets');
  check(!/Raise|Lower|Up|Down/.test(armNames), 'touch: no reach up / reach down buttons');
  const h0 = await S(t.page, () => ({ ...globalThis.__stacked.input.hand[1] }));
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width * 0.78, y: box.y + box.height * 0.22, id: 2 }] }); await t.page.waitForTimeout(350);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await t.page.waitForTimeout(100);
  const h1 = await S(t.page, () => ({ ...globalThis.__stacked.input.hand[1] }));
  if (process.env.DBG) console.log('   dbg', JSON.stringify([h0, h1, await S(t.page, () => [globalThis.__stacked.input.part, globalThis.__stacked.input.sel, globalThis.__stacked.input.touchMove])]));
  check(h1.x - h0.x > 0.05 && h1.z - h0.z > 0.05, 'touch: the joystick moves the hand sideways and forwards');
  await t.page.dispatchEvent('#parts button:nth-child(3)', 'pointerdown', {}); await t.page.waitForTimeout(200);
  const names = (await t.page.locator('#btns button').allTextContents()).join();
  check(names.includes('Nod') && names.includes('Shake') && names.includes('Eyebrows') && names.includes('Talk') && names.includes('Tip hat'), 'touch: head gets Nod, Shake, Eyebrows, Talk, Tip hat');
  check(!/Look/.test(names), 'touch: no look up / look down buttons');
  const e0 = await S(t.page, () => ({ ...globalThis.__stacked.input.head }));
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width * 0.22, y: box.y + box.height * 0.78, id: 3 }] }); await t.page.waitForTimeout(350);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await t.page.waitForTimeout(100);
  const e1 = await S(t.page, () => ({ ...globalThis.__stacked.input.head }));
  check(e1.y - e0.y > 0.1 && e1.p - e0.p < -0.1, 'touch: the joystick looks left / right and up / down');
  await t.page.dispatchEvent('#btns button[data-act="nod"]', 'pointerdown', {}); await t.page.waitForTimeout(200);
  check((await S(t.page, () => globalThis.__stacked.input.head.nod)) === 1, 'touch: holding Nod nods');
  await t.page.screenshot({ path: 'test/shot-phone.png' });
  check(t.errors().length === 0, 'no console errors on the phone layout' + (t.errors().length ? ': ' + t.errors().slice(0, 2).join(' | ') : ''));
  await t.page.close();
}

if (which === 'online' || which === 'all') {
  console.log('ONLINE: host and one friend over WebRTC through our signalling server');
  const h = await open('?q=low'), c = await open('?q=low');
  await h.page.waitForFunction(() => !document.getElementById('host').disabled && /friends/.test(document.getElementById('status').textContent), null, { timeout: 10000 });
  await h.page.click('#host');
  await h.page.waitForFunction(() => globalThis.__stacked.mode === 'play', null, { timeout: 10000 });
  const code = await S(h.page, () => globalThis.__stacked.link.code);
  check(/^[A-Z]{4}$/.test(code), 'host got a room code: ' + code);
  await c.page.waitForFunction(() => /friends/.test(document.getElementById('status').textContent));
  await c.page.fill('#code', code); await c.page.click('#join');
  await c.page.waitForFunction(() => globalThis.__stacked.mode === 'play' && globalThis.__stacked.W.players.length === 2, null, { timeout: 20000 }).catch(() => {});
  check((await S(c.page, () => globalThis.__stacked.W.players.length)) === 2, 'friend joined and sees two players');
  check((await S(h.page, () => globalThis.__stacked.W.players.length)) === 2, 'host sees two players');
  const seats = await S(h.page, () => globalThis.__stacked.W.seats);
  check(seats.legs === 0 && seats.head === 1 && seats.armL === 1, 'two players: host is the legs, friend is head and arms');
  // the friend nods; the host walks; both must show up on the other screen
  await c.page.keyboard.press('Digit3'); await c.page.keyboard.down('KeyN'); await c.page.waitForTimeout(500);
  check((await S(h.page, () => globalThis.__stacked.W.ord.nod)) === 1, "friend's nod reaches the host");
  await c.page.keyboard.up('KeyN');
  const z0 = await S(c.page, () => globalThis.__stacked.W.body.z);
  await h.page.keyboard.down('KeyW'); await h.page.waitForTimeout(2200); await h.page.keyboard.up('KeyW'); await c.page.waitForTimeout(600);
  const z1 = await S(c.page, () => globalThis.__stacked.W.body.z);
  const hz = await S(h.page, () => [globalThis.__stacked.W.body.z, globalThis.__stacked.fps]);
  check(z1 - z0 > 0.5, `host's walking shows on the friend's screen (moved ${(z1 - z0).toFixed(2)} m; host at ${hz[0].toFixed(2)}, ${hz[1]} fps)`);
  // the friend is the head: they say a line, the host's grown-up hears it and answers on both screens
  await S(h.page, () => { const W = globalThis.__stacked.W; Object.assign(W.body, { x: -8.1, z: 1.4, yaw: -0.15, v: 0 }); });
  await h.page.waitForTimeout(1500);
  await S(c.page, () => { globalThis.__saw = null; setInterval(() => { const x = globalThis.__stacked.W.people.map((p) => p.say).find((v) => typeof v === 'string' && v.length > 3); if (x) globalThis.__saw = x; }, 50); });
  await c.page.keyboard.press('Enter'); await c.page.waitForTimeout(200);
  await c.page.fill('#say', 'Lovely weather, terrible traffic.'); await c.page.keyboard.press('Enter');
  await h.page.waitForTimeout(1500);
  await h.page.waitForFunction(() => (globalThis.__stacked.W.talkLog || []).length > 0, null, { timeout: 8000 }).catch(() => {});
  const heard = await S(h.page, () => (globalThis.__stacked.W.talkLog || [])[0]);
  check(heard && heard[0] === 'Lovely weather, terrible traffic.', "friend's spoken line reaches the host and gets an answer: " + (heard ? heard[2] + ' says ' + heard[1] : 'nothing'));
  await c.page.waitForFunction(() => globalThis.__saw, null, { timeout: 10000 }).catch(() => {});
  const seen = await S(c.page, () => globalThis.__saw);
  check(!!seen, "the answer shows on the friend's screen: " + seen);
  await c.page.screenshot({ path: 'test/shot-friend.png' });
  await c.page.close(); await h.page.waitForTimeout(6500);
  check((await S(h.page, () => globalThis.__stacked.W.players.length)) === 1, 'when the friend leaves, the host carries on alone');
  check(h.errors().length === 0 && c.errors().length === 0, 'no console errors' + ([...h.errors(), ...c.errors()].length ? ': ' + [...h.errors(), ...c.errors()].slice(0, 3).join(' | ') : ''));
  await h.page.close();
}

await browser.close(); server.kill();
console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll checks passed');
process.exit(failed ? 1 : 0);
