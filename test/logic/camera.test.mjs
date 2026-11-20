// Logic test for M1-F6: the camera never turns on its own. A coat rides a trolley round a corner, lets go,
// unstacks, gets piled on by grown-ups and shaken by a big hit: through all of it the camera's angle stays
// exactly the same, and W always means "up the screen" (away from the camera).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { initPhysics } from '../../src/physics/world.js';
import { Game } from '../../src/core/game.js';
import { FollowCamera } from '../../src/render/followCamera.js';
import { DATA } from '../helpers/data.mjs';

const R = await initPhysics();
const DT = 1 / 60;

test('a trolley ride and a pile-up never turn the camera; W is always up the screen', () => {
  const g = new Game(R, DATA); g.addPlayer('p1');
  const p = g.players[0], c = p.coat, cam = new T.PerspectiveCamera(42, 16 / 9, 0.1, 200), rig = new FollowCamera(cam);
  const start = new T.Quaternion(); let worst = 0, n = 0, presses = {};
  const press = (k) => { presses = { ...presses, [k]: (presses[k] ?? 0) + 1 }; };
  // one frame: screen-space keys -> world move through the camera, step the game, move the camera
  const frame = (keys = { x: 0, y: 0 }, mouse = null) => {
    g.setInput('p1', { move: rig.moveToWorld(keys), aim: mouse, run: false, use: false, natural: false, presses });
    g.step(); g.take();
    rig.update(DT, c.walker.feet, mouse, 1);
    if (n++ === 0) start.copy(cam.quaternion);
    worst = Math.max(worst, start.angleTo(cam.quaternion));
  };
  const run = (sec, keys, mouse) => { for (let i = 0; i < sec * 60; i++) frame(keys, mouse); };
  // walk to the trolley by the car park and grab it
  const tr = g.things.list.find((t) => t.name === 'trolley' && Math.hypot(t.position.x + 9, t.position.z - 15) < 1);
  c.walker.body.setTranslation({ x: tr.position.x, y: 1.2, z: tr.position.z + 1.1 }, true);
  run(0.3); press('grab'); run(0.2);
  assert.ok(p.hands.riding, `riding the trolley (${p.hands.hint()})`);
  // ride: W (up the screen), then D (right), with the mouse off to one side
  const a = { ...c.walker.feet };
  run(1.2, { x: 0, y: 1 }, { x: 0.7, z: -0.7, reach: 1 });
  assert.ok(c.walker.feet.z < a.z - 1, 'W rode up the screen (away from the camera)');
  const b = { ...c.walker.feet };
  run(1.2, { x: 1, y: 0 }, { x: 1, z: 0, reach: 1 });
  assert.ok(c.walker.feet.x > b.x + 1, 'D rode to the right');
  press('grab'); run(0.5);                                                         // let go
  assert.ok(!p.hands.riding);
  // a pile-up: unstack into a pile, grown-ups all over the coat, then a big whack and a shake
  press('stack'); run(0.4);
  for (const gu of g.people.list.slice(0, 4)) gu.walker.body.setTranslation({ x: c.walker.feet.x + (Math.random() - 0.5), y: 0.9, z: c.walker.feet.z + (Math.random() - 0.5) }, true);
  run(0.5); press('stack'); run(0.4);
  g.test('whack', 'p1'); rig.shake(1); run(1.0);
  // and after all that, W still walks up the screen
  const d = { ...c.walker.feet }; run(0.8, { x: 0, y: 1 }); 
  assert.ok(c.walker.feet.z < d.z - 0.5 || c.loose.length, 'W still means up the screen');
  assert.ok(worst < 1e-6, `the camera turned by ${(worst * 180 / Math.PI).toFixed(3)} degrees`);
  assert.deepEqual(rig.moveToWorld({ x: 0, y: 1 }), { x: 0, z: -1 });
});
