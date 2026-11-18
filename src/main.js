// STACKED, new build. M0-01: an empty game that proves the pieces work together:
// three.js draws, Rapier simulates at a fixed 60 steps a second, and a box falls onto the floor.
import * as T from 'three';
import { Clock } from './core/clock.js';
import { initPhysics, makeWorld } from './physics/world.js';

const params = new URLSearchParams(location.search);
const quality = params.get('q') || 'high';            // chosen, never switched behind the player's back

const renderer = new T.WebGLRenderer({ antialias: quality !== 'low' });
renderer.setPixelRatio(Math.min(devicePixelRatio, quality === 'high' ? 2 : 1));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = quality !== 'low';
document.body.appendChild(renderer.domElement);

const scene = new T.Scene();
scene.background = new T.Color(0xfff3e2);
const camera = new T.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 200);
camera.position.set(0, 11, 9); camera.lookAt(0, 0, 0);
scene.add(new T.HemisphereLight(0xfde9dc, 0xd9906a, 1.2));
const sun = new T.DirectionalLight(0xffe2b8, 2.2); sun.position.set(-5, 10, 4); sun.castShadow = true; scene.add(sun);

const floorMesh = new T.Mesh(new T.BoxGeometry(12, 0.2, 12), new T.MeshStandardMaterial({ color: 0xe9b48a }));
floorMesh.position.y = -0.1; floorMesh.receiveShadow = true; scene.add(floorMesh);
const boxMesh = new T.Mesh(new T.BoxGeometry(1, 1, 1), new T.MeshStandardMaterial({ color: 0xc4553d }));
boxMesh.castShadow = true; scene.add(boxMesh);

const R = await initPhysics();
const world = makeWorld(R);
world.createCollider(R.ColliderDesc.cuboid(6, 0.1, 6).setTranslation(0, -0.1, 0));
const box = world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(0, 4, 0).setAngvel({ x: 1, y: 0.5, z: 0.3 }));
world.createCollider(R.ColliderDesc.cuboid(0.5, 0.5, 0.5).setRestitution(0.3), box);

const clock = new Clock();
let last = performance.now();
function frame(now) {
  const steps = clock.advance((now - last) / 1000); last = now;
  for (let i = 0; i < steps; i++) world.step();
  const p = box.translation(), q = box.rotation();
  boxMesh.position.set(p.x, p.y, p.z); boxMesh.quaternion.set(q.x, q.y, q.z, q.w);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });
globalThis.__stacked2 = { world, box, clock, quality, renderer };   // tests look in here
