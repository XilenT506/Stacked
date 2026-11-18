// Boot, the frame loop, and the glue between the systems.
import { Post } from './post.js';
import { T, PAL, CFG, E, ease, wrap, dist, clamp } from './config.js';
import { buildTown, updateTown, inAlley, los, label, setLabel, fitBubble } from './town.js';
import { talkTarget, judge, Voices, claudeReady, lastLine } from './talk.js';
import { StackView, walkStep, handTarget, effHand } from './stack.js';
import { assistHand, autoReach } from './assist.js';
import { talkTarget as lookTarget } from './talk.js';
import { PopFX } from './fx.js';
import { myParts, placeCamera, KidsView, emptyPacket } from './parts.js';
import { PeopleView } from './townspeople.js';
import { personDef, ERRANDS } from './errands.js';
import { nextErrand, newWorld, stepWorld, setPlayers, pack, unpack, hostTalk, endCard } from './game.js';
import { shareCard, savePicture } from './share.js';
import { findOnline, makeCode } from './network.js';
import { Sound } from './audio.js';
import { Callouts } from './callouts.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { Bot } from './bot.js';

const canvas = document.getElementById('view');
const params = new URLSearchParams(location.search);
const lowQ = params.get('q') === 'low';
const phone = lowQ || matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 520;

// ---------- renderer: full quality on a laptop, lighter on phones, and it backs off if frames get slow ----------
const renderer = new T.WebGLRenderer({ canvas, antialias: !phone, powerPreference: 'high-performance' });
let pixelRatio = lowQ ? 0.75 : Math.min(devicePixelRatio || 1, phone ? 1.25 : 2);
renderer.shadowMap.enabled = !phone; renderer.shadowMap.type = T.PCFSoftShadowMap;
const scene = new T.Scene();
{ // late-afternoon sky from the key art: lilac at the top, peach, then a warm glow at the horizon
  const c = document.createElement('canvas'); c.width = 4; c.height = 256; const g2 = c.getContext('2d'), gr = g2.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, '#d9b3c4'); gr.addColorStop(0.35, '#f3c2a8'); gr.addColorStop(0.62, '#fbd9ae'); gr.addColorStop(1, '#ffe9c4');
  g2.fillStyle = gr; g2.fillRect(0, 0, 4, 256);
  const tex = new T.CanvasTexture(c); tex.colorSpace = T.SRGBColorSpace; scene.background = tex;
}
scene.fog = new T.Fog(0xf9cfa6, 22, 60);
// golden-hour light, as in the key art: a low warm sun with soft long shadows, a soft sky fill and warm bounce from the street
renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
scene.add(new T.HemisphereLight(0xfde9dc, 0xd9906a, 1.25));
const sun = new T.DirectionalLight(0xffc98e, 3.4);
const SUN = new T.Vector3(-9, 7.5, -5.5);        // low in the west: long shadows down the street
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -11, right: 11, top: 11, bottom: -11, near: 0.5, far: 40 });
sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.025; sun.shadow.radius = 3; scene.add(sun, sun.target);
const fill = new T.DirectionalLight(0xffdcc0, 0.75); fill.position.set(8, 5, 9); scene.add(fill);     // soft warm fill from the other side, so faces in shadow keep their colour
// the shadow box follows the action, so shadows stay crisp
function placeSun(x, z) { sun.target.position.set(x, 0, z); sun.position.set(x + SUN.x, SUN.y, z + SUN.z); }
const cam = new T.PerspectiveCamera(70, 1, 0.05, 90);
const popFX = new PopFX(scene);
// extra rendering (glow, soft contact shadows, haze, warm grade): on for desktop, off for low quality or ?post=0
const post = new Post(renderer); post.on = !phone && params.get('post') !== '0';

function resize() {
  const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
  renderer.setPixelRatio(pixelRatio); renderer.setSize(w, h, false);
  cam.aspect = w / h; cam.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

const townView = buildTown(scene);
const stackView = new StackView(scene), kidsView = new KidsView(scene), peopleView = new PeopleView(scene);
const sound = new Sound(), input = new Input(canvas);

// ---------- session ----------
let Wd = null, mode = 'menu', link = null, isHost = true, myKey = 'solo', code = '', online = null;
let netIn = new Map(), seen = new Map(), hostSeen = 0, sendT = 0, lastEv = 0, acc = 0, bot = null, menuT = 0, gotSnap = false;
let outCam = params.get('cam') === 'out' ? 0.5 : 0;
globalThis.__setOutCam = (a) => { outCam = a; };
let fixCam = null; globalThis.__setCam = (c) => { fixCam = c; };     // test view: a fixed camera { p: [x,y,z], l: [x,y,z], fov }
const speed = Math.max(1, Math.min(8, Number(params.get('speed')) || 1));
const STEP = 1 / 60;

const num = (v) => (typeof v === 'number' && isFinite(v) ? v : 0);
function cleanPacket(P) {            // whatever a friend's browser sends is checked before the host uses it
  const out = emptyPacket();
  try {
    out.l = [num(P.l[0]), num(P.l[1]), num(P.l[2]) & 3, num(P.l[3]), num(P.l[4]), num(P.l[5]), P.l[6] ? 1 : 0];
    out.h = [0, 1].map((i) => [num(P.h[i][0]), num(P.h[i][1]), num(P.h[i][2]), num(P.h[i][3]) & 3]);
    out.hd = [num(P.hd[0]), num(P.hd[1]), num(P.hd[2]) & 15];
    out.k = [num(P.k[0]), num(P.k[1]), num(P.k[2]) | 0];
    out.n = [0, 1, 2, 3, 4, 5].map((i) => num(P.n[i]) | 0);
    if (Array.isArray(P.u) && typeof P.u[1] === 'string') out.u = [num(P.u[0]) | 0, P.u[1].slice(0, 160)];
  } catch { return null; }
  return out;
}

// disguise points are kept between afternoons (and between visits, where the browser allows it)
let career = 0;
try { career = Math.max(0, Math.min(99, Number(localStorage.getItem('stacked.disguise')) || 0)); } catch { /* no storage here */ }
if (params.has('pts')) career = Number(params.get('pts')) || 0;
const saveCareer = (pts) => { career = pts; try { localStorage.setItem('stacked.disguise', String(pts)); } catch { /* fine */ } };

// which game to start: from the menu, or from the address (?mode=story|survival, ?errand=bank)
let run = { mode: params.get('mode') || (params.get('errand') ? 'single' : 'story'), errand: params.get('errand') || 'bank' };
let snapshot = null, grabSnap = false, errandKey = '';
function begin(asHost, newLink, key, roomCode) {
  link = newLink; isHost = asHost; myKey = key; code = roomCode || ''; snapshot = null; errandKey = ''; callouts.reset();
  Wd = asHost ? newWorld([key], career, run, run.daily ? daySeed(run.daily) : undefined) : newWorld(['host'], 0, { mode: 'single', errand: 'bank' }); netIn = new Map(); lastEv = 0; acc = 0; gotSnap = asHost;
  input.reset(); townView.ink.count = 0; townView.inkLast = null;
  mode = 'play'; ui.show('hud');
  if (asHost) ui.banner(0);
  if (link) {
    link.onState = (from, data) => {
      if (isHost) {
        const P = cleanPacket(data); if (!P) return;
        if (!Wd.players.includes(from)) { if (Wd.players.length >= 4) return; setPlayers(Wd, [...Wd.players, from]); ui.note('A friend joined. Places changed!'); }
        netIn.set(from, P); seen.set(from, performance.now());
        if (P.u && heardSeq.get(from) !== P.u[0]) { heardSeq.set(from, P.u[0]); if (Wd.seats.head === Wd.players.indexOf(from)) hostHears(P.u[1]); }
      } else {
        try {
          if (gotSnap && data.t < Wd.time - 1) { Wd = newWorld(['host'], 0, { mode: 'single', errand: 'bank' }); lastEv = 0; input.reset(); townView.ink.count = 0; ui.show('hud'); }
          unpack(Wd, data); hostSeen = performance.now();
          if (stats.lastSnap) { stats.snapGap.push(hostSeen - stats.lastSnap); if (stats.snapGap.length > 300) stats.snapGap.shift(); } stats.lastSnap = hostSeen;
          if (!gotSnap) { gotSnap = true; Object.assign(Wd.body, Wd.nb); lastEv = Math.max(0, ...Wd.ev.map((e) => e[0])); ui.note('You are in. Find out which part you are!'); }
        } catch (e) { console.warn('bad snapshot', e); }
      }
    };
    link.onLeave = (who) => {
      if (isHost) { if (Wd.players.includes(who)) { setPlayers(Wd, Wd.players.filter((p) => p !== who)); netIn.delete(who); seen.delete(who); ui.note('A friend left. Places changed!'); } }
      else { console.info('[net] host left', who); toMenu(); ui.status('The host left the game.', true); }
    };
    hostSeen = performance.now();
  }
}

function menuWorld() { const w = newWorld(['solo'], career); Object.assign(w.body, { x: 0.9, z: -0.3, yaw: 2.3 }); return w; }
const unlock = () => { try { document.exitPointerLock?.(); } catch { /* optional */ } };
function toMenu() { link?.close(); link = null; mode = 'menu'; bot = null; Wd = menuWorld(); ui.show('menu'); unlock(); }

// "Today's town": a Survival run with the same town, people and surprises for everyone today
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const daySeed = (k) => { let h = 2166136261; for (const c of 'stacked:' + k) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h | 0; };
const dailyBest = (k) => { try { return Number(localStorage.getItem('stacked.daily.' + k)) || 0; } catch { return 0; } };
const pickRun = () => {
  if (params.get('errand') || params.get('mode')) return;
  run = ui.mode === 'daily' ? { mode: 'survival', daily: today() } : { mode: ui.mode, errand: document.getElementById('practice').value || 'bank' };
};
const ui = new UI(input, {
  solo() { sound.start(); pickRun(); begin(true, null, 'solo'); },
  async host() {
    sound.start(); if (!online) return;
    pickRun(); const c = makeCode(), l = online.make();
    ui.status('Opening a room...');
    try { await l.host(c); begin(true, l, l.key, c); ui.note(`Room code: ${c}. Tell your friends!`); } catch (e) { ui.status(e.message, true); }
  },
  async join(c) {
    sound.start(); if (!online) return;
    const l = online.make();
    ui.status('Joining...');
    try { await l.join(c); begin(false, l, l.key, c); ui.status(''); } catch (e) { l.close(); ui.status(e.message, true); }
  },
  again() { if (!isHost) return; const players = Wd.players; begin(true, link, myKey, code); setPlayers(Wd, players); },
  next() { if (!isHost) return; if (nextErrand(Wd)) { input.reset(); ui.show('hud'); } },
  async share() {
    const card = endCard(Wd), blob = await shareCard(card, snapshot);
    if (!blob) return 'failed';
    const name = 'stacked-' + (card.afternoon ? 'afternoon' : (Wd.errand.id || 'run')) + '-' + (card.afternoon ? card.afternoon.rank : card.rank) + '.png';
    return savePicture(blob, name);
  },
  menu() { toMenu(); },
  mute() { sound.setMuted(!sound.muted); return sound.muted; },
});
Wd = menuWorld();
findOnline().then((o) => { online = o; ui.online(o?.kind); });
ui.online('room'); ui.status('Checking for online play...');
if (/^#[A-Za-z]{4}$/.test(location.hash)) document.getElementById('code').value = location.hash.slice(1).toUpperCase();

// ---------- frame ----------
function clientStep(dt, pid) {
  const b = Wd.body, nb = Wd.nb; if (!nb) return;
  Wd.time += dt;
  const mine = Wd.seats.legs === pid && Wd.phase === 'play' && !b.down && !b.popped && !Wd.car;
  if (mine) walkStep(b, input.legs, dt);                      // my own legs answer at once...
  // my own legs: my screen leads and the host follows; only a big gap (a restack, a fall) is corrected
  const far = dist(b.x, b.z, nb.x, nb.z) > (mine ? 1.2 : 2);
  const k = far ? 1 : ease(dt, mine ? 0.4 : 14);
  b.x += (nb.x - b.x) * k; b.z += (nb.z - b.z) * k; b.yaw += wrap(nb.yaw - b.yaw) * k;   // ...and the host has the last word
  if (!mine) b.v = nb.v;
}

let last = performance.now(), slow = 0, fps = 60, lastCue = null, measured = 0, keepFocus = null, introT = 0;
// numbers for testing: how fast my own part answers, and when each kind of event reached this screen
const stats = { localMs: [], evSeen: {}, snapGap: [], lastSnap: 0 };
// ---------- talking out loud: T to speak (dictation), Enter to type. Only the head can talk. ----------
const voices = new Voices(); voices.init(); claudeReady();
const callouts = new Callouts();
const coatBubble = label('', { size: 0.24, bubble: true, color: '#7a2e1c' }); scene.add(coatBubble);
let mySay = null, saySeq = 0, judging = false;
const heardSeq = new Map();
const $id = (i) => document.getElementById(i);
const talkUI = { bar: $id('talkbar'), box: $id('say'), who: $id('talkwho'), hint: $id('talkhint'), listening: false, buf: '', part: '' };
let dict = null;
(async () => {
  try { dict = globalThis.claude?.use ? await Promise.race([globalThis.claude.use('dictation'), new Promise((r) => setTimeout(() => r(null), 8000))]) : null; } catch { dict = null; }
  if (!dict) return;
  dict.onPartial(({ text }) => { talkUI.part = text; if (talkUI.listening) talkUI.box.value = (talkUI.buf + ' ' + text).trim(); });
  dict.onFinal(({ text }) => { talkUI.buf += text; talkUI.part = ''; if (talkUI.listening) talkUI.box.value = talkUI.buf.trim(); });
})();
const iAmHead = () => mode === 'play' && Wd.phase === 'play' && Wd.seats.head === Math.max(0, Wd.players.indexOf(myKey));
function talkOpen(listening) {
  const i = talkTarget(Wd), who = i >= 0 ? personDef(Wd, i).name : 'nobody nearby';
  talkUI.who.textContent = (listening ? 'Listening... ' : 'Say to ') + who + ':';
  talkUI.hint.textContent = listening ? 'let go of T to say it' : 'Enter: say it \u00b7 Esc: never mind';
  talkUI.bar.hidden = false; talkUI.bar.classList.toggle('listening', listening); talkUI.listening = listening;
  talkUI.box.value = ''; talkUI.buf = ''; talkUI.part = '';
  if (!listening) { unlock(); talkUI.box.focus(); }
}
function talkClose() { talkUI.bar.hidden = true; talkUI.listening = false; talkUI.box.blur(); }
function sayLine(text) {
  text = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 160); if (!text) return;
  if (isHost) hostHears(text); else { mySay = [++saySeq, text, performance.now()]; Wd.coatSay = text; Wd.coatSayT = 4; }
}
function hostHears(text) {
  if (Wd.phase !== 'play') return;
  const W0 = Wd, i = talkTarget(Wd);
  Wd.coatSay = text; Wd.coatSayT = 4;
  if (i < 0) { ui.toast('Nobody is close enough to hear you.'); return; }
  if (judging) { ui.toast('Wait for an answer first.'); return; }
  judging = true; const p = Wd.people[i], prior = lastLine(p); p.say = '...'; p.sayT = 9;
  judge(Wd, i, text, prior).then((v) => { if (Wd === W0 && Wd.phase === 'play') hostTalk(Wd, i, text, v); }).catch(() => {}).finally(() => { judging = false; });
}
addEventListener('keydown', (e) => {
  if (e.target === talkUI.box) {
    if (e.key === 'Enter') { e.preventDefault(); const t = talkUI.box.value; talkClose(); sayLine(t); }
    else if (e.key === 'Escape') { e.preventDefault(); talkClose(); }
    return;
  }
  if (e.repeat || e.target?.tagName === 'INPUT' || mode !== 'play') return;
  if (e.code !== 'KeyT' && e.code !== 'Enter') return;
  if (!iAmHead()) { if (Wd.phase === 'play') ui.toast('Only the Head can talk.'); return; }
  e.preventDefault();
  if (e.code === 'KeyT' && dict) {
    talkOpen(true);
    dict.start().catch((err) => { if (err && (err.code === 'not_granted' || err.code === 'unavailable')) dict = null; if (talkUI.listening) talkOpen(false); });
  } else talkOpen(false);
});
addEventListener('keyup', (e) => {
  if (e.code !== 'KeyT' || !talkUI.listening) return;
  talkUI.listening = false; talkUI.hint.textContent = 'one moment...';
  dict.stop().catch(() => {}).finally(() => { const t = (talkUI.buf + ' ' + talkUI.part).trim(); talkClose(); if (t) sayLine(t); else ui.toast('Did not catch that. Hold T while you speak.'); });
});
talkUI.box.addEventListener('blur', () => { if (!talkUI.listening) setTimeout(() => { if (document.activeElement !== talkUI.box) talkUI.bar.hidden = true; }, 100); });

function frame(now) {
  requestAnimationFrame(frame);
  try { tick(now); } catch (e) { fail(e); }
}
let failed = 0;
function fail(e) { console.error(e); if (failed++ < 1) ui.status('Something broke: ' + (e?.message || e), true); if (mode !== 'menu' && failed > 120) toMenu(); }
function tick(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now; fps += (1 / Math.max(dt, 0.001) - fps) * 0.05;
  // back off quality if this device cannot keep up
  slow = dt > 0.024 ? slow + dt : Math.max(0, slow - dt * 0.5);
  if (slow > 2.5 && params.get('hq') !== '1') { slow = 0; if (post.on && post.ao > 0) post.ao = 0; else if (post.on) post.on = false; else if (pixelRatio > 0.8) { pixelRatio = Math.max(0.75, pixelRatio * 0.8); resize(); } else if (renderer.shadowMap.enabled) { renderer.shadowMap.enabled = false; sun.castShadow = false; } }

  if (mode === 'menu') {
    menuT += dt; Wd.time += dt; Wd.body.lx = Math.sin(menuT * 1.3) * 0.12; Wd.body.lz = Math.cos(menuT * 0.9) * 0.08; Wd.ord.hy = Math.sin(menuT * 0.5) * 0.5;
    cam.layers.set(0); cam.fov = 50; cam.updateProjectionMatrix();
    cam.position.set(4.6 + Math.sin(menuT * 0.12) * 1.2, 2.4, -3.6); cam.lookAt(2.4, 1.3, 3.2);
    stackView.update(Wd, dt, 'menu', null); kidsView.update(Wd, dt); peopleView.update(Wd, dt); updateTown(townView, Wd, dt, null);
    post.render(scene, cam, performance.now() / 1000); return;
  }

  const pid = Math.max(0, Wd.players.indexOf(myKey));
  const scatter = Wd.phase === 'scatter';
  const myKids = Wd.kids.filter((k) => k.owner === pid);
  const ctx = { parts: myParts(Wd.seats, pid), kid: !scatter && myKids.length > 0, scatter, hands: [Wd.seats.armL === pid, Wd.seats.armR === pid], car: !!Wd.car };
  if (bot) bot.update(Wd, dt);
  input.update(dt, ctx);
  // all-in-one keeps its balance a little by itself: with full hands it turns more gently, and when the
  // stack starts to wobble it eases off the walking so one player can carry things across a room
  if (input.all && !scatter && !Wd.car && ctx.parts.includes('legs') && !Wd.body.down) {
    const full = Wd.items.filter((it) => it.held >= 0).length, lean = Math.hypot(Wd.body.lx, Wd.body.lz);
    if (full) input.legs.t *= 0.7;
    if (lean > 0.24) input.legs.f *= clamp(1 - (lean - 0.24) / 0.22, 0.15, 1);
  }
  // aim help for the hand I am moving: snap gently to what can be grabbed or signed, and report "in reach / too far"
  let cue = null;
  // all-in-one: hold G and the hands reach for you; the head looks at whoever is talking to the coat
  if (input.all && !scatter && !Wd.car && (ctx.hands[0] || ctx.hands[1]) && input.down('reach')) cue = autoReach(Wd, input, ctx, dt);
  else if ((input.part === 'arms' || input.all) && !scatter && !Wd.car && ctx.hands[input.sel]) {
    const h = input.hand[input.sel];
    if (h.act === 0 && Wd.patT <= 0) cue = assistHand(Wd, input.sel, h, dt, input.steering, ctx.hands[1 - input.sel] ? input.hand[1 - input.sel] : null);
    if (!(cue && cue.snapped) && input.yIdle > 1.2) h.y += (0 - h.y) * ease(dt, 2.5);        // height looks after itself
  }
  // all-in-one: once G is let go, a hand that holds something comes back in close to the coat,
  // so a snack held out at arm's length does not slowly tip the whole stack over
  if (input.all && !input.down('reach') && !scatter && !Wd.car) for (const i of [0, 1]) {
    if (!ctx.hands[i] || !Wd.items.some((it) => it.held === i)) continue;
    const h = input.hand[i], k = ease(dt, 3);
    h.x += ((h.x < 0 ? -0.24 : 0.24) - h.x) * k; h.y += (0.02 - h.y) * k; h.z += (0.26 - h.z) * k;
  }
  lastCue = cue;
  if (input.all && ctx.parts.includes('head') && Wd.phase === 'play') {
    const li = Wd.car ? -1 : lookTarget(Wd), p = li >= 0 ? Wd.people[li] : null;
    const want = p && (p.sayT > 0 || p.greet || p.ask > 0 || p.sus > 0.3) ? wrap(Math.atan2(p.x - Wd.body.x, p.z - Wd.body.z) - Wd.body.yaw) : 0;
    input.look = Math.max(-1.8, Math.min(1.8, want));
  } else input.look = null;
  const P = input.packet();
  if (mySay && now - mySay[2] < 4000) P.u = [mySay[0], mySay[1]];
  if (!isHost && Wd.seats.legs === pid && Wd.phase === 'play' && !Wd.body.down && !Wd.body.popped && !Wd.car) {
    const b = Wd.body; P.l = [P.l[0], P.l[1], P.l[2], Math.round(b.x * 1000) / 1000, Math.round(b.z * 1000) / 1000, Math.round(b.yaw * 1000) / 1000, 1];
  }

  if (isHost) {
    acc = Math.min(acc + dt * speed, 0.25 * speed);
    while (acc >= STEP) {
      acc -= STEP;
      stepWorld(Wd, STEP, Wd.players.map((key, i) => (i === pid ? P : netIn.get(key) || emptyPacket())));
    }
    sendT -= dt; if (link && sendT <= 0) { sendT = 1 / 15; link.publish(pack(Wd)); }
    for (const [who, t] of seen) if (now - t > 5000) link?.onLeave(who);          // a friend who has gone quiet has left
  } else {
    sendT -= dt; if (link && sendT <= 0) { sendT = 1 / 20; link.publish(P); }
    clientStep(dt, pid);
    if (gotSnap && now - hostSeen > 12000) { console.info('[net] no snapshot for 12 s'); link.onLeave('host'); return; }
  }

  for (const [id, k, a] of Wd.ev) {
    if (id <= lastEv) continue; lastEv = id;
    sound.event(k, a); stats.evSeen[k] = Date.now();
    try { callouts.event(Wd, k, a, k === E.END ? (() => { const c = endCard(Wd); return c.afternoon ? c.afternoon.rank : c.rank; })() : ''); } catch { /* a missing clip never stops the game */ }
    if (k === E.BANNER) ui.banner(a);
    if (k === E.RIP || k === E.FALL) { input.legs.f = input.legs.t = 0; input.keep = false; }
    if (k === E.RIP && !Wd.car) popFX.pop(Wd.body.x, Wd.body.z, Wd.body.yaw);
    if (k === E.RESTACK) input.reset();
    if (k === E.CALM) { peopleView.phew(a); setTimeout(() => ui.toast(`Phew! ${personDef(Wd, a).name} bought it.`), 600); }      // the toast waits until the meter has visibly dropped      // the bluff landed, and everyone sees it
    if (k === E.LOOK) ui.toast(`${personDef(Wd, a).name} looked away.`);
    if (k === E.END) { if (isHost) saveCareer(Wd.dis.pts); if (isHost && Wd.run.daily && Wd.run.done > dailyBest(Wd.run.daily)) { try { localStorage.setItem('stacked.daily.' + Wd.run.daily, String(Wd.run.done)); } catch { /* fine */ } } ui.end(Wd, isHost, snapshot); unlock(); }
    if (k === E.WORST) grabSnap = true;                                   // keep a picture of the worst moment for the end card
    if (k === E.LAPSE) { ui.banner(19); ui.toast(['He is reading his clipboard!', 'He is sneezing!', 'He is on the phone!'][a] || 'He is not looking!'); }
    if (k === E.LAPSEEND) ui.banner(20);
    if (k === E.GUST) ui.banner(21);
    if (k === E.HIC) ui.banner(22);
    if (k === E.ASK) { ui.banner(23); sound.event?.(E.GASP); }
  }

  const part = scatter ? 'kid' : input.part;
  const free = myKids.filter((k) => !k.caught);
  const lead = free.length ? free[((input.kid.sel % free.length) + free.length) % free.length] : myKids[0] || Wd.kids[0];
  // a new errand has started: say what it is, and get the screen back from the end card
  const ek = Wd.errand.id + '/' + Wd.run.idx + '/' + Wd.run.done;
  if (ek !== errandKey && Wd.phase === 'play') { errandKey = ek; introT = 4; snapshot = null; ui.show('hud'); ui.note(ERRANDS[Wd.errand.id].intro); ui.bannerT = 4.5; }
  const shared = !input.peek && params.get('view') !== 'split';
  // the arms player gets a close look at the counter while there is something to grab or sign
  let focus = null;
  const stp = ERRANDS[Wd.errand.id]?.steps[Wd.errand.step];
  if (shared && (part === 'arms' || input.all) && !scatter && !Wd.car && Wd.phase === 'play' && Math.abs(Wd.body.v) < 0.4 && stp && (stp.type === 'grab' || stp.type === 'sign' || lastCue)) {
    if (lastCue && lastCue.state !== 'far') focus = { x: lastCue.x, y: lastCue.y, z: lastCue.z };
    else if (stp.type === 'sign' || stp.type === 'grab') { const fx = Math.sin(Wd.body.yaw), fz = Math.cos(Wd.body.yaw); if (lastCue) focus = { x: Wd.body.x + fx * 0.7, y: 1.1, z: Wd.body.z + fz * 0.7 }; }
  }
  if (focus) { keepFocus = { ...focus, t: 0.8 }; } else if (keepFocus && keepFocus.t > 0 && (part === 'arms' || input.all) && Math.abs(Wd.body.v) < 0.4) { keepFocus.t -= dt; focus = keepFocus; } else keepFocus = null;
  introT = Math.max(0, introT - dt); if (Math.abs(Wd.body.v) > 0.3 || Wd.car && Math.abs(Wd.car.v) > 0.3) introT = 0;
  if (introT > 0 && shared && !Wd.car) focus = { intro: 1 };
  placeCamera(cam, Wd, lead ? part : part === 'kid' ? 'legs' : part, input.head, part === 'kid' ? lead : null, dt, shared, focus);
  popFX.update(dt);
  if (popFX.active && !fixCam) {
    // hold a wide shot on the pop before handing over to the kid camera
    const b = Wd.body; cam.layers.set(0); cam.layers.enable(1); cam.layers.enable(2); cam.fov = 58;
    if (!popFX.cam) {
      popFX.cam = [b.x, 3.5, b.z + 0.01];
      for (const a of [0.9, -0.9, 0, 2.2, -2.2]) for (const d of [4.2, 3]) {
        const cx = b.x + Math.sin(b.yaw + a) * d, cz = b.z + Math.cos(b.yaw + a) * d;
        if (los(b.x, b.z, cx, cz)) { popFX.cam = [cx, 2.6, cz]; break; }
      }
    }
    cam.position.set(...popFX.cam); cam.lookAt(b.x, 0.9, b.z); cam.updateProjectionMatrix();
  }
  const outside = Wd.body.down || fixCam || outCam || (shared && part !== 'kid') || popFX.active;
  if (fixCam) {
    cam.layers.enable(1); cam.layers.enable(2); cam.fov = fixCam.fov || 50;
    cam.position.set(...fixCam.p); cam.lookAt(...fixCam.l); cam.updateProjectionMatrix();
  } else if (outCam) {
    // test view (?cam=out): a grown-up's-eye look at the stack from the front and a little to the side
    const b = Wd.body, a = b.yaw + outCam;
    cam.layers.enable(1); cam.layers.enable(2); cam.fov = 50;
    cam.position.set(b.x + Math.sin(a) * 3.2, 1.5, b.z + Math.cos(a) * 3.2); cam.lookAt(b.x, 0.95, b.z); cam.updateProjectionMatrix();
  }
  const mineO = { hand: input.hand, hy: Wd.ord.hy };
  const own = [0, 1].map((i) => (ctx.hands[i] && !Wd.body.down ? handTarget(Wd.body, i, effHand(mineO, i, Wd.time, Wd.patT)) : null));
  placeSun(Wd.body.x, Wd.body.z);
  // in a fall everyone looks from outside, so show the whole stack
  voices.update(Wd, !sound.muted); callouts.update(Wd, dt, !sound.muted);
  setLabel(coatBubble, Wd.coatSayT > 0 && Wd.phase === 'play' ? '\u201c' + Wd.coatSay + '\u201d' : '');
  coatBubble.position.set(Wd.body.x, Wd.body.down ? 1.2 : 2.5 + (Wd.body.lift || 0), Wd.body.z);
  stackView.update(Wd, dt, outside ? "out" : part, own); kidsView.update(Wd, dt); peopleView.update(Wd, dt); updateTown(townView, Wd, dt, part === 'arms' ? cue : null, outside ? 'out' : part);
  sound.update(Wd, dt, { paused: false });
  ui.update(Wd, dt, { part, parts: ctx.parts, kid: ctx.kid, alley: Wd.phase === 'play' && inAlley(Wd.body.x, Wd.body.z), scatter, code, isHost, myKids: free.length,
    canKeep: ctx.parts.includes('legs') && ctx.parts.length > 1, lvl: Wd.dis.lvl, cue, car: !!Wd.car, peek: !shared });
  fitBubble(coatBubble, cam); for (const v of peopleView.m) fitBubble(v.bubble, cam);
  post.render(scene, cam, performance.now() / 1000);
  if (grabSnap) { grabSnap = false; snapshot = shot(); }
  if (input.lastPress > measured && input.lastPress <= now) { measured = input.lastPress; stats.localMs.push(performance.now() - input.lastPress); if (stats.localMs.length > 300) stats.localMs.shift(); }
}
requestAnimationFrame(frame);
// a small picture of what is on screen right now (called straight after drawing, while the picture is still there)
function shot() {
  try { const c = document.createElement('canvas'); c.width = 960; c.height = Math.round(960 * canvas.height / canvas.width); c.getContext('2d').drawImage(canvas, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', 0.8); } catch { return null; }
}

// ---------- test hooks ----------
if (params.get('bot')) { run = { mode: 'single', errand: 'bank', noMods: true }; begin(true, null, 'solo'); bot = new Bot(input, () => lastCue); }
globalThis.__stacked = { get W() { return Wd; }, get stackView() { return stackView; }, get bot() { return bot; }, get mode() { return mode; }, get link() { return link; }, input, sound, renderer, scene, post, CFG, stats, get cue() { return lastCue; }, get fps() { return fps; } };
