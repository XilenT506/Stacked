// STACKED, new build. M1-02: the living supermarket. The shop (data/places/supermarket.json) is full of
// interactive things (data/interactables.json) that talk to each other through signals; timed events
// (data/places/supermarket/events.json) shake things up, and the mess stays for the whole job.
// ?place=playground opens the old physics playground instead.
// Keys: WASD walk, mouse aim, Shift run, E grab/use/ride/hide, right click throw, left click squirt,
// Q act natural (hold by the mannequins to pose), R unstack/restack, O planning overlay.
// Test keys: T next timed event, Space bowls a melon, J slippery puddle, K whack the coat, V signal rings, Backspace reset.
import * as T from 'three';
import { Clock, STEP } from './core/clock.js';
import { initPhysics, makeWorld } from './physics/world.js';
import { Signals } from './systems/signals.js';
import { Mess } from './systems/mess.js';
import { JobEvents } from './systems/jobEvents.js';
import { Hands } from './systems/hands.js';
import { Things } from './world/interact/loader.js';
import { buildPlayground } from './world/playground.js';
import { buildPlace, spawnThings } from './world/place.js';
import { PlaceView } from './render/placeView.js';
import { ThingsView } from './render/thingsView.js';
import { staticMesh } from './render/meshes.js';
import { SignalRings } from './render/signalRings.js';
import { Input } from './core/input.js';
import { Coat } from './entities/coat.js';
import { CoatView } from './render/coatView.js';
import { CoatHud } from './ui/coatHud.js';
import { FollowCamera } from './render/followCamera.js';
import { WallFade } from './render/wallFade.js';
import { Sfx } from './audio/sfx.js';
import SUPERMARKET from '../data/places/supermarket.json';
import SHOP_EVENTS from '../data/places/supermarket/events.json';
import THINGS from '../data/interactables.json';
import CONTROLS from '../data/controls.json';
import SIGNALS from '../data/signals.json';
import BALANCE from '../data/balance.json';
import SOUNDS from '../data/sounds.json';

const params = new URLSearchParams(location.search);
const quality = params.get('q') || 'high';                       // chosen, never switched behind the player's back
const placeName = params.get('place') || 'supermarket';

const renderer = new T.WebGLRenderer({ antialias: quality !== 'low' });
renderer.setPixelRatio(Math.min(devicePixelRatio, quality === 'high' ? 2 : 1));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = quality !== 'low';
renderer.shadowMap.type = T.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const camera = new T.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 200);
const camRig = new FollowCamera(camera);
const input = new Input(CONTROLS).attach();
const sfx = new Sfx(SOUNDS.sounds);
const hud = new CoatHud();

const R = await initPhysics();
let scene, world, place, placeView, areaNow = null, signals, mess, things, thingsView, jobEvents, hands, pg, rings, lights, coat, coatView, fade, aimMark, aimNow = null, events = [];

function reset() {
  scene = new T.Scene(); scene.background = new T.Color(0xfff3e2);
  const hemi = new T.HemisphereLight(0xfde9dc, 0xd9906a, 1.2), sun = new T.DirectionalLight(0xffe2b8, 2.2);
  sun.position.set(-6, 12, 6); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14 });
  scene.add(hemi, sun, sun.target); lights = { hemi, sun };
  world = makeWorld(R); signals = new Signals(SIGNALS.types); mess = new Mess(signals, BALANCE);
  const spots = placeName === 'playground' ? {} : SUPERMARKET.events;
  things = new Things(R, world, signals, THINGS, { mess, spots, balance: BALANCE });
  things.onSound = (name, p) => sfx.play(name, p);
  things.announce = (text) => hud.announce(text);
  fade = new WallFade();
  if (placeName === 'playground') {
    pg = buildPlayground(R, world, things); place = null; placeView = null; jobEvents = null;
    for (const s of pg.statics) { const m = staticMesh(s); scene.add(m); if (s.fade) fade.add(m); }
    coat = new Coat(R, world, signals, BALANCE, [0, 0, 4], undefined, { mess });
    coat.bounds = { x0: -7.5, x1: 7.5, z0: -5.5, z1: 5.5 };         // loose kids stay inside the room
  } else {
    pg = null; place = buildPlace(R, world, SUPERMARKET); placeView = new PlaceView(scene, place, fade);
    spawnThings(place, things);
    const D = place.data, [sx, sz] = D.spawns.players[0];
    coat = new Coat(R, world, signals, BALANCE, [sx, 0, sz], undefined, { mess });
    coat.floorZones = place.slippery;
    coat.bounds = { x0: D.bounds[0] + 1, z0: D.bounds[1] + 1, x1: D.bounds[2] - 1, z1: D.bounds[3] - 1 };
    jobEvents = new JobEvents(SHOP_EVENTS.events, { signals, things, spots, say: (text, name) => { hud.announce(text, name); sfx.play('tannoy_ding'); } }, BALANCE.events);
  }
  hands = new Hands(coat, things, BALANCE);
  thingsView = new ThingsView(scene, things, mess);
  coatView = new CoatView(scene, coat);
  aimMark = new T.Mesh(new T.RingGeometry(0.18, 0.26, 24), new T.MeshBasicMaterial({ color: 0xc4553d, transparent: true, opacity: 0.8 }));
  aimMark.rotation.x = -Math.PI / 2; scene.add(aimMark);
  rings = new SignalRings(scene);
  signals.onDeliver = (s) => rings.add(s);
}
reset();

function bowl() {
  const p = place ? coat.position : { x: -1, z: 0 }, a = place ? (aimNow || { x: 0, z: -1 }) : { x: 1, z: 0 }, off = place ? 1 : 0;
  const m = things.spawn('melon', [p.x + a.x * off, 0.3, p.z + a.z * off + (place ? 0 : (Math.random() - 0.5) * 0.4)]);
  m.body.setLinvel({ x: 7 * a.x, y: 0, z: 7 * a.z }, true);
}
// a slippery puddle where you aim (stands in for spilled cream, oil, a banana skin)
function spillAt() {
  const p = coat.position, a = aimNow || { x: 0, z: 1 };
  signals.emit({ type: 'slippery', position: { x: p.x + a.x * 2, y: 0, z: p.z + a.z * 2 }, range: 1.4 });
}
addEventListener('keydown', (e) => {
  if (e.code === 'Space') bowl();
  if (e.code === 'KeyJ') spillAt();
  if (e.code === 'KeyK') coat.hit(8);
  if (e.code === 'KeyT' && jobEvents?.upcoming) jobEvents.fire(jobEvents.upcoming.id);
  if (e.code === 'Backspace') reset();
  if (e.code === 'KeyV') rings.on = !rings.on;
  if (e.code === 'KeyO' && placeView) placeView.overlay.visible = !placeView.overlay.visible;
  if (e.code === 'KeyL' && pg) things.use(pg.lightSwitch);
});

// the lights follow every light switch in the place: one off and it is dark
function updateLights(dt) {
  const off = things.list.some((t) => t.def.use?.toggles === 'lights' && t.state === 'off');
  const k = off ? 0.12 : 1;
  lights.sun.intensity += (2.2 * k - lights.sun.intensity) * Math.min(1, dt * 6);
  lights.hemi.intensity += (1.2 * Math.max(k, 0.2) - lights.hemi.intensity) * Math.min(1, dt * 6);
}

const clock = new Clock();
let last = performance.now(), fpsT = 0, frames = 0, fps = 0;
function frame(now) {
  const dt = (now - last) / 1000; last = now;
  const steps = clock.advance(dt);
  input.update();
  const wp = coat.position;
  aimNow = camRig.aimToWorld(input.aim, wp, innerWidth, innerHeight);
  const move = camRig.moveToWorld(input.move);
  if (input.pressed('stack')) { coat.toggleStack(); events.push(...coat.events); }
  let grab = input.pressed('grab'), throwIt = input.pressed('throw');
  for (let i = 0; i < steps; i++) {
    hands.step(STEP, { grab, throwIt, use: input.down('use'), natural: input.down('natural'), aim: aimNow }); grab = throwIt = false;
    coat.step(STEP, move, input.down('run'), aimNow, input.down('natural')); events.push(...coat.events);
    hands.carry();
    world.step(); coat.events = []; coat.checkHits(world); events.push(...coat.events);
    things.step(STEP); signals.flush(STEP); mess.step(STEP); jobEvents?.step(STEP);
  }
  thingsView.update(dt);
  coatView.update(dt, events); hud.update(dt, coat, events, areaNow, hands.hint()); events = [];
  aimMark.visible = !!aimNow;
  if (aimNow) aimMark.position.set(wp.x + aimNow.x * 1.6, 0.03, wp.z + aimNow.z * 1.6);
  camRig.update(dt, wp, aimNow);
  lights.sun.position.set(wp.x - 6, 12, wp.z + 6); lights.sun.target.position.set(wp.x, 0, wp.z);   // the shadows follow you around the shop
  updateLights(dt);
  sfx.listener = { x: wp.x, z: wp.z };
  areaNow = place?.areaAt(wp.x, wp.z) ?? null;
  fade.update(dt, camera.position, [coat.walker.feet]);
  rings.update(dt);
  renderer.render(scene, camera);
  frames++; fpsT += dt;
  if (fpsT >= 0.5) {
    fps = Math.round(frames / fpsT); frames = 0; fpsT = 0;
    const next = jobEvents?.upcoming ? ` · next event in ${Math.max(0, Math.ceil(jobEvents.nextAt - jobEvents.time))} s (T: now)` : '';
    hud.top(`STACKED ${place ? place.data.name : 'playground'} · ${fps} fps · ${input.device === 'pad' ? 'gamepad' : 'keyboard and mouse'}${next}  |  WASD walk, mouse aim, Shift run, E grab/use, right click throw, Q act natural, R unstack  ·  O plan  Space melon  J puddle  K whack  V rings  Backspace reset`);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });
globalThis.__stacked2 = { get world() { return world; }, get pg() { return pg; }, get walker() { return coat.walker; }, get coat() { return coat; }, get coatView() { return coatView; },
  get place() { return place; }, get placeView() { return placeView; }, get area() { return areaNow; }, get things() { return things; }, get hands() { return hands; }, get mess() { return mess; },
  get jobEvents() { return jobEvents; }, camRig, get fade() { return fade; }, input, get aim() { return aimNow; }, get signals() { return signals; }, clock, quality, renderer, get fps() { return fps; }, bowl };
