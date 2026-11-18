// STACKED, new build. M0-02: the physics playground.
// Rapier simulates at a fixed 60 steps a second, three.js draws. A trolley rolls down the ramp into a
// tin pyramid; every impact sends signals (shown as rings on the floor).
// Keys: Space bowls a melon at the tins, L flips the light switch, V shows/hides signal rings, R resets.
import * as T from 'three';
import { Clock, STEP } from './core/clock.js';
import { initPhysics, makeWorld } from './physics/world.js';
import { Signals } from './systems/signals.js';
import { Things } from './world/interact/loader.js';
import { buildPlayground } from './world/playground.js';
import { shapeMesh, staticMesh, follow } from './render/meshes.js';
import { SignalRings } from './render/signalRings.js';
import THINGS from '../data/interactables.json';
import SIGNALS from '../data/signals.json';

const params = new URLSearchParams(location.search);
const quality = params.get('q') || 'high';            // chosen, never switched behind the player's back

const renderer = new T.WebGLRenderer({ antialias: quality !== 'low' });
renderer.setPixelRatio(Math.min(devicePixelRatio, quality === 'high' ? 2 : 1));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = quality !== 'low';
renderer.shadowMap.type = T.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// angled camera from above, about 55 degrees, 14 m away (the game camera comes in M0-03)
const camera = new T.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 200);
const tilt = 55 * Math.PI / 180, dist = 14;
camera.position.set(0, Math.sin(tilt) * dist, Math.cos(tilt) * dist); camera.lookAt(0, 0, 0);

const R = await initPhysics();
let scene, world, signals, things, pg, meshes, rings, lights;

function reset() {
  scene = new T.Scene(); scene.background = new T.Color(0xfff3e2);
  const hemi = new T.HemisphereLight(0xfde9dc, 0xd9906a, 1.2), sun = new T.DirectionalLight(0xffe2b8, 2.2);
  sun.position.set(-6, 12, 6); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10 });
  scene.add(hemi, sun); lights = { hemi, sun };
  world = makeWorld(R); signals = new Signals(SIGNALS.types); things = new Things(R, world, signals, THINGS);
  pg = buildPlayground(R, world, things);
  for (const s of pg.statics) scene.add(staticMesh(s));
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
  if (e.code === 'KeyR') reset();
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
  for (let i = 0; i < steps; i++) { world.step(); things.step(STEP); signals.flush(STEP); }
  for (const { t, m } of meshes) follow(m, t.body);
  rings.update(dt);
  renderer.render(scene, camera);
  frames++; fpsT += dt;
  if (fpsT >= 0.5) { fps = Math.round(frames / fpsT); frames = 0; fpsT = 0;
    hud.textContent = `STACKED playground · ${fps} fps · signals: ${signals.sent}  |  Space: bowl a melon  L: lights  V: signal rings  R: reset`; }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });
globalThis.__stacked2 = { get world() { return world; }, get pg() { return pg; }, get signals() { return signals; }, clock, quality, renderer, get fps() { return fps; }, bowl };
