// Logic tests for M0-03: controls, walking, the follow camera and fading walls.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as T from 'three';
import { Input } from '../../src/core/input.js';
import { initPhysics, makeWorld } from '../../src/physics/world.js';
import { Walker } from '../../src/entities/walker.js';
import { FollowCamera } from '../../src/render/followCamera.js';
import { WallFade } from '../../src/render/wallFade.js';

const CONTROLS = JSON.parse(readFileSync(new URL('../../data/controls.json', import.meta.url)));
const pad = (axes = [0, 0, 0, 0], pressed = []) => ({ axes, buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: pressed.includes(i), value: pressed.includes(i) ? 1 : 0 })) });

test('keyboard: W and D walk diagonally at full speed, not faster', () => {
  const inp = new Input(CONTROLS);
  inp.keys.add('KeyW'); inp.keys.add('KeyD'); inp.update();
  assert.ok(Math.abs(Math.hypot(inp.move.x, inp.move.y) - 1) < 1e-9);
  assert.ok(inp.move.x > 0 && inp.move.y > 0);
});

test('every action in the Controls table is mapped, and pressed() fires once', () => {
  for (const a of ['use', 'throw', 'grab', 'natural', 'drink', 'switch', 'run', 'stack', 'point', 'map']) assert.ok(CONTROLS.actions[a], `${a} missing`);
  const inp = new Input(CONTROLS);
  inp.keys.add('KeyE'); inp.update();
  assert.ok(inp.pressed('grab') && inp.down('grab'));
  inp.update();
  assert.ok(!inp.pressed('grab') && inp.down('grab'));
  inp.mouse.add(0); inp.update();
  assert.ok(inp.pressed('use'));
});

test('gamepad: left stick walks, right stick aims, small pushes are ignored, buttons work', () => {
  const inp = new Input(CONTROLS);
  inp.pad = pad([0.05, -0.08, 0, 0]); inp.update();
  assert.deepEqual(inp.move, { x: 0, y: 0 });                        // inside the dead zone
  inp.pad = pad([0, -1, 1, 0], [0, 7]); inp.update();
  assert.ok(inp.move.y > 0.99, 'stick up walks away from the camera');
  assert.equal(inp.aim.mode, 'stick'); assert.ok(inp.aim.x > 0.99);
  assert.ok(inp.down('grab') && inp.down('use'));
  assert.equal(inp.device, 'pad');
});

test('the walker walks about 4 m in a second and runs faster', async () => {
  const R = await initPhysics(), world = makeWorld(R);
  world.createCollider(R.ColliderDesc.cuboid(30, 0.1, 30).setTranslation(0, -0.1, 0));
  const w = new Walker(R, world, [0, 0, 0]);
  for (let i = 0; i < 60; i++) { w.step(1 / 60, { x: 0, z: -1 }, false, null); world.step(); }
  const walked = -w.position.z;
  assert.ok(walked > 3.3 && walked < 4.3, `walked ${walked.toFixed(2)} m`);
  const z0 = w.position.z;
  for (let i = 0; i < 60; i++) { w.step(1 / 60, { x: 0, z: -1 }, true, null); world.step(); }
  assert.ok(z0 - w.position.z > 5.5, `ran ${(z0 - w.position.z).toFixed(2)} m`);
});

test('a wall stops the walker', async () => {
  const R = await initPhysics(), world = makeWorld(R);
  world.createCollider(R.ColliderDesc.cuboid(30, 0.1, 30).setTranslation(0, -0.1, 0));
  world.createCollider(R.ColliderDesc.cuboid(5, 1.2, 0.1).setTranslation(0, 1.2, -3));
  const w = new Walker(R, world, [0, 0, 0]);
  for (let i = 0; i < 120; i++) { w.step(1 / 60, { x: 0, z: -1 }, false, null); world.step(); }
  assert.ok(w.position.z > -2.7, `stopped at z=${w.position.z.toFixed(2)}`);
});

test('the camera sits 14 m away at 55 degrees and looks ahead of the aim', () => {
  const cam = new T.PerspectiveCamera(42, 16 / 9, 0.1, 200), rig = new FollowCamera(cam);
  rig.update(1, { x: 0, y: 0, z: 0 }, null);
  const off = cam.position.clone().sub(rig.focus);
  assert.ok(Math.abs(off.length() - 14) < 1e-6);
  assert.ok(Math.abs(Math.atan2(off.y, off.z) * 180 / Math.PI - 55) < 1e-6);
  for (let i = 0; i < 60; i++) rig.update(1 / 30, { x: 0, y: 0, z: 0 }, { x: 1, z: 0, reach: 1 });
  assert.ok(rig.focus.x > 2, `looks ahead to x=${rig.focus.x.toFixed(2)}`);
});

test('a wall between the camera and the player fades; a wall elsewhere does not', () => {
  const fade = new WallFade(), mat = new T.MeshStandardMaterial();
  const front = new T.Mesh(new T.BoxGeometry(6, 2.4, 0.2), mat); front.position.set(0, 1.2, 2);
  const side = new T.Mesh(new T.BoxGeometry(0.2, 2.4, 6), mat); side.position.set(-6, 1.2, 0);
  front.updateMatrixWorld(); side.updateMatrixWorld();
  fade.add(front); fade.add(side);
  const camPos = new T.Vector3(0, Math.sin(55 * Math.PI / 180) * 14, Math.cos(55 * Math.PI / 180) * 14 + 1.5);
  for (let i = 0; i < 30; i++) fade.update(1 / 30, camPos, [{ x: 0, y: 0, z: 1.6 }]);       // standing right behind the front wall
  assert.ok(fade.items[0].blocking && fade.items[0].k < 0.3, 'front wall faded');
  assert.ok(!fade.items[1].blocking && fade.items[1].k > 0.99, 'side wall stays solid');
  for (let i = 0; i < 30; i++) fade.update(1 / 30, camPos, [{ x: 0, y: 0, z: 4 }]);         // stepped out in front
  assert.ok(!fade.items[0].blocking && fade.items[0].k > 0.95, 'front wall solid again');
});
