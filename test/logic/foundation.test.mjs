// Logic tests (no graphics): the clock steps at a fixed rate and Rapier runs in Node.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Clock, STEP } from '../../src/core/clock.js';
import { initPhysics, makeWorld } from '../../src/physics/world.js';

test('clock gives one step per 1/60 s and never more than its cap', () => {
  const c = new Clock(5);
  assert.equal(c.advance(STEP * 3 + 0.0001), 3);
  assert.equal(c.advance(1), 5);            // a long pause does not make the game race to catch up
});

test('a dropped box comes to rest on the floor', async () => {
  const R = await initPhysics(), world = makeWorld(R);
  world.createCollider(R.ColliderDesc.cuboid(6, 0.1, 6).setTranslation(0, -0.1, 0));
  const box = world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(0, 4, 0));
  world.createCollider(R.ColliderDesc.cuboid(0.5, 0.5, 0.5), box);
  for (let i = 0; i < 60 * 5; i++) world.step();
  const y = box.translation().y;
  assert.ok(Math.abs(y - 0.5) < 0.05, `box rests at y=${y.toFixed(3)}`);
  assert.ok(box.isSleeping() || Math.hypot(...Object.values(box.linvel())) < 0.01, 'box has stopped');
});
