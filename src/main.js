// STACKED, new build. M1-08: 1 to 4 players. Solo, couch (up to 4 on one screen with gamepads: press A on
// a pad to join), or online with a join code (one player hosts and runs the game, friends send what they
// press and get snapshots 20 times a second). The job itself lives in src/core/game.js; the screen in
// src/render/stage.js. M1-09: Tab (Back on a pad) opens the crayon map (src/ui/crayonmap/). M1-10: between jobs, Dodgy Del's
// shop (src/ui/shop/); F (RB) drinks a fizzy drink. M1-F1: a start card before the first job, an arrow and a sign
// that point the way (src/systems/pointer.js). Page options: ?host=CODE, ?join=CODE, ?net=local (tabs of one
// browser), ?q=low|high, ?dev=1 (the developer line and the test keys, no start card; the shots and checks use it).
// Keys: WASD walk, mouse aim, Shift run, left click gadget (1 2 3 pick), E grab/use, right click throw,
// Q act natural, R unstack. Test keys (solo/host, with ?dev=1): T next event, H Heat+1, C Closing Time, Space melon,
// J puddle, K whack, O plan overlay, Backspace new job.
import * as T from 'three';
import { Clock, STEP } from './core/clock.js';
import { initPhysics, makeWorld } from './physics/world.js';
import { buildPlace } from './world/place.js';
import { Input } from './core/input.js';
import { Game } from './core/game.js';
import { Mirror } from './net/snapshot.js';
import { HostSession, ClientSession } from './net/session.js';
import { findOnline, makeCode } from './net/links.js';
import { Stage } from './render/stage.js';
import { CoatHud } from './ui/coatHud.js';
import { CrayonMap } from './ui/crayonmap/crayonMap.js';
import { DelShop } from './ui/shop/delShop.js';
import { StartCard } from './ui/startCard.js';
import { PointerHud } from './ui/pointerHud.js';
import { pointerFor } from './systems/pointer.js';
import { KID_COLORS } from './render/coatView.js';
import { typingIn } from './core/input.js';
import STARTCARD from '../data/startcard.json';
import { FollowCamera } from './render/followCamera.js';
import { Sfx } from './audio/sfx.js';
import { Voices } from './audio/voices.js';
import { Callouts } from './audio/callouts.js';
import { Music } from './audio/music.js';
import JUICE from '../data/juice.json';
import SUPERMARKET from '../data/places/supermarket.json';
import SHOP_EVENTS from '../data/places/supermarket/events.json';
import THINGS from '../data/interactables.json';
import CONTROLS from '../data/controls.json';
import SIGNALS from '../data/signals.json';
import BALANCE from '../data/balance.json';
import SOUNDS from '../data/sounds.json';
import GROWNUPS from '../data/grownups.json';
import GADGETS from '../data/gadgets.json';
import LOOT from '../data/loot.json';
import CRAYONMAP from '../data/crayonmap.json';
import DEL from '../data/shop.json';
import GIGGLES from '../data/giggles.json';
import WHY from '../data/why.json';
import REACTIONS from '../data/reactions.json';

const DATA = { place: SUPERMARKET, events: SHOP_EVENTS, things: THINGS, signals: SIGNALS, balance: BALANCE, grownups: GROWNUPS, gadgets: GADGETS, loot: LOOT, crayonmap: CRAYONMAP, shop: DEL, giggles: GIGGLES, juice: JUICE, why: WHY, reactions: REACTIONS };
const params = new URLSearchParams(location.search);
const quality = params.get('q') || 'high';                       // chosen, never switched behind the player's back
const dev = params.get('dev') === '1';
document.body.classList.toggle('dev', dev);
const PRESS = ['grab', 'throw', 'stack', 'slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'switch', 'drink', 'point'];

const renderer = new T.WebGLRenderer({ antialias: quality !== 'low' });
renderer.setPixelRatio(Math.min(devicePixelRatio, quality === 'high' ? 2 : 1));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = quality !== 'low';
renderer.shadowMap.type = T.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);
const camera = new T.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 200);
const camRig = new FollowCamera(camera);
const sfx = new Sfx(SOUNDS.sounds), voices = new Voices(), hud = Object.assign(new CoatHud(), { flashAt: BALANCE.wobble.flashAt }), callouts = new Callouts(JUICE), music = new Music(JUICE.music);

const R = await initPhysics();
const place = buildPlace(R, makeWorld(R), SUPERMARKET);          // for drawing the shop (the game has its own)
const stage = new Stage({ place, data: DATA, hud, sfx, voices, callouts, camRig });

// ---- who plays on this screen: player 1 on keyboard + mouse (or the first pad); more pads join with A ----
const keyboard = new Input(CONTROLS, 0).attach();
const newLocal = (id, input, pad) => ({ id, input, pad, counters: {}, mapOpen: false, sid: 0, outbox: [], shopSid: 0, shopOut: [], swallow: false });
const locals = [newLocal('p1', keyboard, 0)];
let mode = 'solo', game = null, mirror = null, host = null, client = null, roomCode = '';

function startLocal() { game = new Game(R, DATA); for (const l of locals) game.addPlayer(l.id); stage.build(game); }
startLocal();

// couch: a pad nobody uses yet joins when its A or Start button is pressed
function checkPads() {
  if (mode === 'client') return;
  const pads = navigator.getGamepads?.() || [];
  for (let i = 1; i < Math.min(4, pads.length); i++) {
    const p = pads[i]; if (!p || locals.some((l) => l.pad === i)) continue;
    if (p.buttons?.[0]?.pressed || p.buttons?.[9]?.pressed) {
      const id = 'p' + (locals.length + 1), input = new Input(CONTROLS, i); input.readPads = () => (navigator.getGamepads?.() || [])[i] || null;
      locals.push(newLocal(id, input, i));
      const r = game.addPlayer(id);
      hud.announce(r === 'playing' ? `Player ${locals.length} is in!` : `Player ${locals.length} joins at the next job.`, 'Couch');
    }
  }
}

// one local player's input for the game (presses are counters, so none get lost on the way)
// while a player has the crayon map open, their buttons draw on the map instead of doing things in the shop
function readInput(l, coat, shopping) {
  const inp = l.input; inp.update();
  // the key or click that closed the start card does nothing else (until it is let go)
  if (l.swallow) { if (!inp.keys.size && !inp.mouse.size && !inp.pad?.buttons?.some((b) => b.pressed)) l.swallow = false; return { move: { x: 0, z: 0 }, aim: null, run: false, use: false, natural: false, presses: { ...l.counters }, map: false, sc: l.outbox.slice(), shop: [] }; }
  if (shopping) { l.mapOpen = false; return { move: { x: 0, z: 0 }, aim: null, run: false, use: false, natural: false, presses: { ...l.counters }, map: false, sc: [], shop: l.shopOut.slice() }; }
  if (inp.pressed('map')) { l.mapOpen = !l.mapOpen; l.mute = true; }
  if (l.mute && !inp.down('use') && !inp.down('grab')) l.mute = false;       // a click that closed the map is not a shot
  const pos = coat ? coat.walker.position : { x: 0, z: 0 };
  const aim = l === locals[0] ? camRig.aimToWorld(inp.aim, pos, innerWidth, innerHeight) : (inp.aim?.mode === 'stick' ? camRig.aimToWorld(inp.aim, pos) : null);
  if (!l.mapOpen && !l.mute) for (const n of PRESS) if (inp.pressed(n)) l.counters[n] = (l.counters[n] ?? 0) + 1;
  const busy = l.mapOpen || l.mute;
  return { move: camRig.moveToWorld(inp.move), aim, run: inp.down('run'), use: inp.down('use') && !busy, natural: inp.down('natural') && !l.mapOpen, presses: { ...l.counters }, map: l.mapOpen, sc: l.outbox.slice(), shop: [] };
}

// the crayon map: the first player on this screen with it open steers it; what they draw waits in their
// outbox until the game (or the host) says it has it
const mapOwner = () => locals.find((l) => l.mapOpen) || null;
const crayonMap = new CrayonMap(SUPERMARKET, CRAYONMAP, (s) => { const l = mapOwner(); if (l) l.outbox.push({ sid: ++l.sid, ...s }); });
crayonMap.onClose = () => { const l = mapOwner(); if (l) { l.mapOpen = false; l.mute = true; } };
let mapJob = -1;

// Dodgy Del's: each player on this screen moves their own ring; their orders wait in their outbox until acknowledged
const delShop = new DelShop(DATA, CRAYONMAP.playerColors, (li, o) => { const l = locals[li]; if (l) l.shopOut.push({ sid: ++l.shopSid, ...o }); });

// ---- online: host or join ----
const net = document.getElementById('net'), netStatus = (t, bad = false) => { net.querySelector('.status').textContent = t; net.querySelector('.status').style.color = bad ? '#c4553d' : ''; };
let online = null;
findOnline(params.get('net')).then((o) => { online = o; net.querySelector('.kind').textContent = o ? `(${o.kind === 'room' ? 'claude.ai room' : o.kind === 'webrtc' ? 'internet' : 'this computer only'})` : '(not available here)'; });
async function hostGame(code = makeCode()) {
  online ??= await findOnline(params.get('net')); if (!online) return netStatus('Online play is not available here.', true);
  const link = online.make(); netStatus('Opening a room...');
  try { await link.host(code); } catch (e) { return netStatus(e.message, true); }
  mode = 'host'; roomCode = code; host = new HostSession(game, link);
  netStatus(`Hosting. Room code: ${code}. Friends open this page and join with it.`); net.classList.add('on');
}
async function joinGame(code) {
  online ??= await findOnline(params.get('net')); if (!online) return netStatus('Online play is not available here.', true);
  code = code.toUpperCase().trim(); const link = online.make(); netStatus('Joining...');
  try { await link.join(code); } catch (e) { return netStatus(e.message, true); }
  mode = 'client'; roomCode = code; game = null; locals.length = 1;
  mirror = new Mirror(DATA); client = new ClientSession(mirror, link); stage.build(mirror);
  netStatus(`In room ${code}. Waiting for the host...`); net.classList.add('on');
}
net.querySelector('.host').onclick = (e) => { e.target.blur(); hostGame(); };
net.querySelector('.join').onclick = (e) => { e.target.blur(); joinGame(net.querySelector('input').value); };
net.querySelector('input').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.target.blur(); joinGame(e.target.value); } });
if (params.get('host')) hostGame(params.get('host').toUpperCase());
if (params.get('join')) joinGame(params.get('join'));

// ---- test keys (solo and host only) ----
// M: sound and music on or off (any mode)
addEventListener('keydown', (e) => { if (e.code === 'KeyM' && !typingIn(e.target)) { const on = music.toggle(); sfx.on = voices.on = callouts.on = on; hud.announce(on ? 'Sound on' : 'Sound off', 'M'); } });
addEventListener('keydown', (e) => {
  if (!dev || !game || typingIn(e.target)) return;
  const k = { Space: 'melon', KeyJ: 'puddle', KeyK: 'whack', KeyT: 'event', KeyH: 'heat', KeyC: 'closing', KeyY: 'shop' }[e.code];
  if (k) game.test(k, 'p1');
  if (e.code === 'Backspace') { game.reset(); }
  if (e.code === 'KeyO') stage.placeView.overlay.visible = !stage.placeView.overlay.visible;
});

// the start card before the first job (not with ?dev=1 unless ?card=1); playing alone, the job waits for it
const card = new StartCard(document.getElementById('startcard'), STARTCARD, SUPERMARKET.job.goal);
card.onClose = () => { document.body.classList.remove('carded'); for (const l of locals) l.swallow = true; };
if (dev && params.get('card') !== '1') card.close(); else document.body.classList.add('carded');
const pointerHud = new PointerHud(document.getElementById('pointer'));

const clock = new Clock();
let heldEvents = [];
let lastAim = null, last = performance.now(), fpsT = 0, frames = 0, fps = 0, areaNow = null;
function frame(now) {
  const dt = Math.min(0.25, (now - last) / 1000); last = now;
  const model = game ?? mirror;
  const myId = mode === 'client' ? client.id : 'p1';
  card.update(navigator.getGamepads?.());
  if (!card.open) checkPads();
  const coatOf = (id) => model.coats.find((c) => c.pid === id);
  const shopping = model.phase === 'shop' && !!model.shop;
  const inputs = locals.map((l) => ({ l, I: readInput(l, coatOf(mode === 'client' ? myId : l.id), shopping) }));
  lastAim = inputs[0].I.aim;
  let events = [];
  // a freeze-frame on a big hit: the picture holds still for a moment (playing alone the game waits too;
  // hosting, the game goes on for the friends and what happened meanwhile is shown straight after)
  const holding = (stage.juice?.freezeT ?? 0) > 0;
  if (holding) stage.juice.freezeT -= dt;
  const waiting = card.open && mode === 'solo';
  if (game) {
    if ((!holding || host) && !waiting) {
      const steps = clock.advance(dt);
      for (let i = 0; i < steps; i++) { for (const { l, I } of inputs) game.setInput(l.id, I); game.step(STEP); }
      events = game.take();
      if (host) { host.share(events); host.tick(dt); }
    }
  } else {
    client.send(inputs[0].I); client.tick(dt); mirror.update(dt); events = client.take();
    if (mirror.got && mirror.order) netStatus(mirror.coatMap.has(myId) ? `In room ${roomCode}: ${mirror.coats.length} playing.` : `In room ${roomCode}: you join at the next job (${mirror.coats.length} playing).`);
    if (client.hostGone) netStatus('The host left the game.', true);
  }
  if (holding) { heldEvents.push(...events); renderer.render(stage.scene, camera); requestAnimationFrame(frame); return; }
  events = heldEvents.concat(events); heldEvents = [];
  // the camera: one coat, or everyone on this screen (pulled back to keep them all in)
  const mine = (mode === 'client' ? [coatOf(myId)] : locals.map((l) => coatOf(l.id))).filter(Boolean);
  const watch = mine[0] ?? model.coats[0];
  const pts = mine.length ? mine.map((c) => c.walker.feet) : model.coats.map((c) => c.walker.feet);
  const focus = pts.length ? { x: pts.reduce((a, p) => a + p.x, 0) / pts.length, z: pts.reduce((a, p) => a + p.z, 0) / pts.length } : { x: -14, z: 14 };
  const spread = pts.reduce((m, p) => Math.max(m, Math.hypot(p.x - focus.x, p.z - focus.z)), 0);
  camRig.update(dt, focus, mine.length === 1 ? inputs[0].I.aim : null, Math.min(2.2, 1 + Math.max(0, spread - 3) / 9), mine.length === 1 && inputs[0].I.use);
  // the crayon map: drop scribbles the game has, then draw the map for whoever has it open
  if (model.jobNo !== mapJob) { mapJob = model.jobNo; for (const l of locals) l.outbox = []; }
  for (const l of locals) { const ack = +(model.map.acks.get(mode === 'client' ? myId : l.id) ?? 0); if (l.outbox.length) l.outbox = l.outbox.filter((s) => s.sid > ack); }
  for (const l of locals) { const ack = +(model.shop?.acks.get(mode === 'client' ? myId : l.id) ?? 0); l.shopOut = shopping ? l.shopOut.filter((o) => o.sid > ack) : []; }
  delShop.show(shopping);
  if (shopping) delShop.draw(dt, model, locals.map((l) => ({ pid: mode === 'client' ? myId : l.id, slot: coatOf(mode === 'client' ? myId : l.id)?.slot ?? 0 })), locals.map((l) => l.input));
  const owner = mapOwner();
  crayonMap.show(!!owner);
  if (owner) crayonMap.draw(dt, model, mode === 'client' ? myId : owner.id, owner !== locals[0] || owner.input.device === 'pad' ? owner.input.pad : null);
  stage.update(dt, { watch, focus, camera, events, me: mode === 'client' ? [myId] : locals.map((l) => l.id), aims: inputs.map(({ l, I }) => { const c = coatOf(mode === 'client' ? myId : l.id); return { aim: I.aim, at: c?.walker.feet ?? focus, coat: c }; }) });
  // the HUD shows player 1 of this screen
  if (watch) {
    areaNow = place.areaAt(watch.walker.feet.x, watch.walker.feet.z);
    hud.update(dt, watch, [], areaNow, game ? game.hint(watch.pid) : watch.hint ?? '');
    hud.gadgets(watch, { ...GADGETS, drinks: DEL.drinks });
  }
  // the arrows at the screen edge: the way to go, and each of your loose kids in their colour
  const kids = watch ? (watch.loose ?? []).filter((k) => !k.caged).map((k) => ({ x: k.x, z: k.z, label: k.carriedBy ? 'KID! (grabbed)' : 'KID!', to: 'kid', color: '#' + (KID_COLORS[k.id] ?? 0xffffff).toString(16).padStart(6, '0') })) : [];
  pointerHud.update(card.open || shopping || !watch ? [] : [pointerFor(model, watch, SUPERMARKET), ...kids], camera, innerWidth, innerHeight);
  hud.status(model.sus, model.closing, model.rescue); hud.giggleMeter(shopping ? null : model.giggles, BALANCE.giggles.meter, model.coats.some((c) => c.superT > 0)); hud.quota(model.job, model.loot, model.sus); hud.results(shopping ? null : model.job?.result, model.run?.sweets);
  sfx.listener = voices.listener = { x: focus.x, z: focus.z };
  // music layers follow Heat (and Closing Time); the kids mutter while you walk
  music.set({ heat: model.sus?.level ?? 0, closing: !!model.closing?.started, rush: model.coats.some((c) => c.superT > 0), between: shopping || !!model.job?.over });
  callouts.update(dt, !!watch && Math.hypot(watch.walker.vel?.x ?? 0, watch.walker.vel?.z ?? 0) > 0.8);
  renderer.render(stage.scene, camera);
  frames++; fpsT += dt;
  if (fpsT >= 0.5) {
    fps = Math.round(frames / fpsT); frames = 0; fpsT = 0;
    const who = mode === 'client' ? 'online (joined)' : mode === 'host' ? `online host, room ${roomCode}` : locals.length > 1 ? `couch, ${locals.length} players` : 'solo';
    const next = game?.jobEvents.upcoming ? ` · next event in ${Math.max(0, Math.ceil(game.jobEvents.nextAt - game.jobEvents.time))} s` : '';
    hud.top(`STACKED ${SUPERMARKET.name} · ${fps} fps · ${who}${next}  |  WASD walk, mouse aim, Shift run, left click gadget (1-5), E grab/use, right click throw, F drink, Q act natural, R unstack, Tab crayon map, middle click point, M sound · gamepad: A on a 2nd pad joins${game ? '  ·  T event H heat C closing Space melon J puddle K whack O plan Y Del\'s shop Backspace new job' : ''}`);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });

// for the tests: the same names as before, now pointing into the game (or the mirror on a client)
const P1 = () => (game ? game.player(locals[0].id) : null);
globalThis.__stacked2 = {
  get game() { return game; }, get mirror() { return mirror; }, get model() { return game ?? mirror; }, get mode() { return mode; }, get locals() { return locals; },
  get world() { return game?.world; }, get coat() { return P1()?.coat ?? mirror?.coats[0]; }, get walker() { return this.coat.walker; }, get hands() { return P1()?.hands; },
  get things() { return game?.things ?? mirror?.things; }, get mess() { return (game ?? mirror).mess; }, get people() { return (game ?? mirror).people; }, get sus() { return (game ?? mirror).sus; },
  get closing() { return (game ?? mirror).closing; }, get security() { return game?.security; }, get rescue() { return (game ?? mirror).rescue; }, get loot() { return (game ?? mirror).loot; }, get job() { return (game ?? mirror).job; },
  get gadgets() { return (game ?? mirror).gadgets; }, get jobEvents() { return game?.jobEvents; }, get signals() { return game?.signals; },
  get coatView() { return stage.coatViews.get(this.coat); }, get peopleView() { return stage.peopleView; }, get placeView() { return stage.placeView; }, get lootView() { return stage.lootView; }, get fade() { return stage.fade; },
  get place() { return place; }, get area() { return areaNow; }, get host() { return host; }, get client() { return client; },
  get aim() { return lastAim; }, crayonMap, delShop, callouts, music, get juice() { return stage.juice; }, get run() { return (game ?? mirror).run; }, get shop() { return (game ?? mirror).shop; }, get map() { return (game ?? mirror).map; }, camRig, input: keyboard, clock, quality, renderer, get fps() { return fps; }, hostGame, joinGame, card, get pointer() { return pointerHud.state; }, get pointers() { return pointerHud.states; },
};
