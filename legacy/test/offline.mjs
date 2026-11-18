// Plays the offline build with the network switched off: solo starts, and a host and a friend join by room code.
import { chromium } from './pw.mjs';
const url = process.argv[2] || 'http://localhost:8080';
// with the network unplugged there is no Wi-Fi card, so the two browser windows talk over this computer's own loopback (a real home network uses the Wi-Fi address)
const br = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--disable-features=WebRtcHideLocalIpsWithMdns', '--allow-loopback-in-peer-connection',
  // BLOCK=<address>: the browser has no internet at all, only the home network address of the launcher
  ...(process.env.BLOCK ? ['--proxy-server=http://127.0.0.1:9', `--proxy-bypass-list=${process.env.BLOCK}`] : [])] });
const errors = [];
const open = async (q = '') => { const p = await br.newPage({ viewport: { width: 1280, height: 720 } }); p.on('pageerror', (e) => errors.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); }); await p.goto(url + q, { waitUntil: 'domcontentloaded', timeout: 60000 }); await p.waitForTimeout(2000); return p; };
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) process.exitCode = 1; };
if (process.env.BLOCK) { const p = await br.newPage(); const r = await p.goto('https://cdnjs.cloudflare.com/', { timeout: 8000 }).then(() => 'loaded').catch(() => 'blocked'); ok(r === 'blocked', 'the browser cannot reach the internet (' + r + ')'); await p.close(); }
const a = await open();
ok(await a.evaluate(() => typeof THREE === 'object'), 'three.js loaded from inside the page');
await a.click('#solo'); await a.waitForTimeout(2500);
ok(await a.evaluate(() => globalThis.__stacked.mode === 'play' && globalThis.__stacked.W.errand.id === 'shop'), 'solo story starts (corner shop)');
const x0 = await a.evaluate(() => globalThis.__stacked.W.body.z); await a.keyboard.down('KeyW'); await a.waitForFunction((z) => Math.abs(globalThis.__stacked.W.body.z - z) > 0.3, x0, { timeout: 15000 }).catch(() => {}); await a.keyboard.up('KeyW');
ok(await a.evaluate(() => Math.hypot(globalThis.__stacked.W.body.x + 7.6, globalThis.__stacked.W.body.z + 5) > 0.3), 'solo: the coat walks');
await a.close();
const h = await open('/?q=low'), c = await open('/?q=low');
await h.waitForFunction(() => !document.getElementById('host').disabled, null, { timeout: 10000 }).catch(() => {});
await h.click('#host'); await h.waitForFunction(() => globalThis.__stacked.mode === 'play', null, { timeout: 10000 });
const code = await h.evaluate(() => globalThis.__stacked.link.code);
ok(/^[A-Z]{4}$/.test(code), 'host got a room code: ' + code);
await c.waitForFunction(() => !document.getElementById('join').disabled, null, { timeout: 15000 }).catch(() => {});
await c.fill('#code', code); await c.click('#join');
await c.waitForFunction(() => globalThis.__stacked.mode === 'play' && globalThis.__stacked.W.players.length === 2, null, { timeout: 45000 }).catch(() => {});
const st = await c.evaluate(() => [document.getElementById('status').textContent, globalThis.__stacked.mode, globalThis.__stacked.W.players.length]); const hs = await h.evaluate(() => [document.getElementById('status').textContent, globalThis.__stacked.W.players.length]);
ok(st[2] === 2, 'friend joined over the home network, with no internet ' + JSON.stringify(st) + ' host ' + JSON.stringify(hs));
ok(!errors.length, 'no errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
await br.close();
