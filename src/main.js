// STACKED, new build. M0-03: the physics playground with a walking capsule, the follow camera and controls.
// Rapier simulates at a fixed 60 steps a second, three.js draws. A trolley rolls down the ramp into a
// tin pyramid; every impact sends signals (shown as rings on the floor).
// Controls come from data/controls.json (WASD + mouse, or a gamepad as twin-stick).
// Test keys: Space bowls a melon at the tins, L flips the light switch, V shows/hides signal rings, Backspace resets.
import * as T from 'three';
import { Clock, STEP } from './core/clock.js';
import { initPhysics, makeWorld } from './physics/world.js';
import { Signals } from './systems/signals.js';
import { Things } from './world/interact/loader.js';
import { buildPlayground } from './world/playground.js';
import { shapeMesh, staticMesh, follow } from './render/meshes.js';
import { SignalRings } from './render/signalRings.js';
import { Input } from './core/input.js';
import { Walker } from './entities/walker.js';
import { FollowCamera } from './render/followCamera.js';
import { WallFade } from './render/wallFade.js';
import THINGS from '../data/interactables.json';
import CONTROLS from '../data/controls.json';
import SIGNALS from '../data/signals.json';

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
let scene, world, signals, things, pg, meshes, rings, lights, walker, walkerMesh, fade, aimMark, aimNow = null;

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
  walker = new Walker(R, world, [0, 0, 4]);
  walkerMesh = new T.Group();
  const body = new T.Mesh(new T.CapsuleGeometry(0.35, 1.1, 6, 16), new T.MeshStandardMaterial({ color: 0x8a5a3c, roughness: 0.8 }));
  const nose = new T.Mesh(new T.ConeGeometry(0.12, 0.35, 12), new T.MeshStandardMaterial({ color: 0xf4c542 }));
  nose.rotation.x = Math.PI / 2; nose.position.set(0, 0.35, 0.42);
  body.castShadow = nose.castShadow = true; walkerMesh.add(body, nose); scene.add(walkerMesh);
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
addEventListener('keydown', (e) => {
  if (e.code === 'Space') bowl();
  if (e.code === 'Backspace') reset();
  if (e.code === 'KeyV') rings.on = !rings.on;
  if (e.code === 'KeyL') {
    const st = things.use(pg.lightSwitch);
    lights.sun.intensity = st === 'off' ? 0.25 : 2.2; lights.hemi.intensity = st === 'off' ? 0.25 : 1.2;
  }
});

const hud = document.getElementById('hud');
const clock = new Clock();
let last = performance.now(), fpsT = 0, frames = 0, fps = 0;
function frame(now) {
  const dt = (now - last) / 1000; last = now;
  const steps = clock.advance(dt);
  input.update();
  const wp = walker.position;
  aimNow = camRig.aimToWorld(input.aim, wp, innerWidth, innerHeight);
  const move = camRig.moveToWorld(input.move);
  for (let i = 0; i < steps; i++) { walker.step(STEP, move, input.down('run'), aimNow); world.step(); things.step(STEP); signals.flush(STEP); }
  for (const { t, m } of meshes) follow(m, t.body);
  follow(walkerMesh, walker.body);
  aimMark.visible = !!aimNow;
  if (aimNow) aimMark.position.set(wp.x + aimNow.x * 1.6, 0.03, wp.z + aimNow.z * 1.6);
  camRig.update(dt, wp, aimNow);
  fade.update(dt, camera.position, [walker.feet]);
  rings.update(dt);
  renderer.render(scene, camera);
  frames++; fpsT += dt;
  if (fpsT >= 0.5) { fps = Math.round(frames / fpsT); frames = 0; fpsT = 0;
    hud.textContent = `STACKED playground · ${fps} fps · ${input.device === 'pad' ? 'gamepad' : 'keyboard and mouse'} · signals: ${signals.sent}  |  WASD walk, mouse aim, Shift run (or a gamepad)  ·  Space: bowl a melon  L: lights  V: rings  Backspace: reset`; }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });
globalThis.__stacked2 = { get world() { return world; }, get pg() { return pg; }, get walker() { return walker; }, get fade() { return fade; }, input, get aim() { return aimNow; }, get signals() { return signals; }, clock, quality, renderer, get fps() { return fps; }, bowl };
