// STACKED, new build. M0-04: the coat (three kids, one trench coat) in the physics playground.
// Rapier simulates at a fixed 60 steps a second, three.js draws. A trolley rolls down the ramp into a
// tin pyramid; every impact sends signals (shown as rings on the floor).
// Controls come from data/controls.json (WASD + mouse, or a gamepad as twin-stick).
// R unstacks and restacks. Test keys: Space bowls a melon, J spills something slippery where you aim,
// K whacks the coat (a kid falls out), L flips the light switch, V shows/hides signal rings, Backspace resets.
import * as T from 'three';
import { Clock, STEP } from './core/clock.js';
import { initPhysics, makeWorld } from './physics/world.js';
import { Signals } from './systems/signals.js';
import { Things } from './world/interact/loader.js';
import { buildPlayground } from './world/playground.js';
import { shapeMesh, staticMesh, follow } from './render/meshes.js';
import { SignalRings } from './render/signalRings.js';
import { Input } from './core/input.js';
import { Coat } from './entities/coat.js';
import { CoatView, KID_COLORS } from './render/coatView.js';
import { FollowCamera } from './render/followCamera.js';
import { WallFade } from './render/wallFade.js';
import THINGS from '../data/interactables.json';
import CONTROLS from '../data/controls.json';
import SIGNALS from '../data/signals.json';
import BALANCE from '../data/balance.json';

const params = new URLSearchParams(location.search);
const quality = params.get('q') || 'high';            // chosen, never switched behind the player's back

const renderer = new T.WebGLRenderer({ antialias: quality !== 'low' });
renderer.setPixelRatio(Math.min(devicePixelRatio, quality === 'high' ? 2 : 1));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = quality !== 'low';
renderer.shadowMap.type = T.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const camera = new T.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 200);
const camRig = new FollowCamera(camera);
const input = new Input(CONTROLS).attach();

const R = await initPhysics();
let scene, world, signals, things, pg, meshes, rings, lights, coat, coatView, puddles, fade, aimMark, aimNow = null, events = [];

function reset() {
  scene = new T.Scene(); scene.background = new T.Color(0xfff3e2);
  const hemi = new T.HemisphereLight(0xfde9dc, 0xd9906a, 1.2), sun = new T.DirectionalLight(0xffe2b8, 2.2);
  sun.position.set(-6, 12, 6); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10 });
  scene.add(hemi, sun); lights = { hemi, sun };
  world = makeWorld(R); signals = new Signals(SIGNALS.types); things = new Things(R, world, signals, THINGS);
  pg = buildPlayground(R, world, things);
  fade = new WallFade();
  for (const s of pg.statics) { const m = staticMesh(s); scene.add(m); if (s.fade) fade.add(m); }
  coat = new Coat(R, world, signals, BALANCE, [0, 0, 4]);
  coat.bounds = { x0: -7.5, x1: 7.5, z0: -5.5, z1: 5.5 };         // loose kids stay inside the room
  coatView = new CoatView(scene, coat);
  puddles = new Map();
  aimMark = new T.Mesh(new T.RingGeometry(0.18, 0.26, 24), new T.MeshBasicMaterial({ color: 0xc4553d, transparent: true, opacity: 0.8 }));
  aimMark.rotation.x = -Math.PI / 2; scene.add(aimMark);
  meshes = things.list.map((t) => { const m = shapeMesh(t.def.shape, t.def.color); scene.add(m); return { t, m }; });
  rings = new SignalRings(scene);
  signals.onDeliver = (s) => rings.add(s);
}
reset();

function bowl() {
  const m = things.spawn('ball', [-1, 0.3, (Math.random() - 0.5) * 0.4]);
  m.body.setLinvel({ x: 7, y: 0, z: 0 }, true);
  const mesh = shapeMesh(m.def.shape, m.def.color); scene.add(mesh); meshes.push({ t: m, m: mesh });
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
  if (e.code === 'Backspace') reset();
  if (e.code === 'KeyV') rings.on = !rings.on;
  if (e.code === 'KeyL') {
    const st = things.use(pg.lightSwitch);
    lights.sun.intensity = st === 'off' ? 0.25 : 2.2; lights.hemi.intensity = st === 'off' ? 0.25 : 1.2;
  }
});

const hud = document.getElementById('hud');
// the coat HUD: three heads (who is in the coat) and the wobble bar
const heads = document.getElementById('heads'), bar = document.getElementById('wobble'), label = document.getElementById('height');
let shake = 0;
function updateHud(ev) {
  if (ev.some((e) => e.type === 'spill' || e.type === 'hit')) shake = 0.4;
  shake = Math.max(0, shake - 1 / 60);
  const ids = coat.pile ? [...coat.pile.kids, ...coat.stack] : [...coat.stack, ...coat.loose.map((k) => k.id)];
  heads.innerHTML = ids.map((id) => {
    const out = coat.loose.some((k) => k.id === id), hid = coat.pile?.kids.includes(id);
    return `<span class="head${out ? ' out' : ''}${hid ? ' hid' : ''}" style="background:#${KID_COLORS[id].toString(16).padStart(6, '0')}"></span>`;
  }).join('');
  bar.style.width = (coat.wobble * 100).toFixed(1) + '%';
  bar.style.background = coat.wobble > 0.75 ? '#c4553d' : coat.wobble > 0.45 ? '#e0a83a' : '#7fbf5f';
  bar.parentElement.style.transform = shake ? `translateX(${Math.sin(shake * 80) * 4}px)` : '';
  label.textContent = coat.pile ? 'Just a kid (the coat is on the floor: R there to stack up)' : coat.state.label + (coat.loose.length ? ` · ${coat.loose.length} kid${coat.loose.length > 1 ? 's' : ''} loose! walk over them` : '');
}
function drawPuddles() {
  const live = new Set(coat.patches);
  for (const p of coat.patches) if (!puddles.has(p)) {
    const m = new T.Mesh(new T.CircleGeometry(p.r, 28), new T.MeshStandardMaterial({ color: 0xfff6c8, roughness: 0.1, transparent: true, opacity: 0.55 }));
    m.rotation.x = -Math.PI / 2; m.position.set(p.x, 0.015, p.z); scene.add(m); puddles.set(p, m);
  }
  for (const [p, m] of puddles) if (!live.has(p)) { scene.remove(m); puddles.delete(p); }
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
  for (let i = 0; i < steps; i++) {
    coat.step(STEP, move, input.down('run'), aimNow, input.down('natural')); events.push(...coat.events);
    world.step(); coat.events = []; coat.checkHits(world); events.push(...coat.events);
    things.step(STEP); signals.flush(STEP);
  }
  for (const { t, m } of meshes) follow(m, t.body);
  coatView.update(dt, events); updateHud(events); events = [];
  drawPuddles();
  aimMark.visible = !!aimNow;
  if (aimNow) aimMark.position.set(wp.x + aimNow.x * 1.6, 0.03, wp.z + aimNow.z * 1.6);
  camRig.update(dt, wp, aimNow);
  fade.update(dt, camera.position, [coat.walker.feet]);
  rings.update(dt);
  renderer.render(scene, camera);
  frames++; fpsT += dt;
  if (fpsT >= 0.5) { fps = Math.round(frames / fpsT); frames = 0; fpsT = 0;
    hud.textContent = `STACKED playground · ${fps} fps · ${input.device === 'pad' ? 'gamepad' : 'keyboard and mouse'}  |  WASD walk, mouse aim, Shift run, Q act natural, R unstack/restack  ·  Space: bowl a melon  J: slippery puddle  K: whack  L: lights  V: rings  Backspace: reset`; }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });
globalThis.__stacked2 = { get world() { return world; }, get pg() { return pg; }, get walker() { return coat.walker; }, get coat() { return coat; }, get coatView() { return coatView; }, camRig, get fade() { return fade; }, input, get aim() { return aimNow; }, get signals() { return signals; }, clock, quality, renderer, get fps() { return fps; }, bowl };
