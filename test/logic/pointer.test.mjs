// Logic tests for M1-F1: the first minute. The arrow points at Nan's cake, then at the getaway gate once
// you carry it (and at nothing once it is banked); the crayon map knows the bakery and the gate from the
// start; and keys typed into a text box (the room code) never reach the coat.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initPhysics } from '../../src/physics/world.js';
import { Game } from '../../src/core/game.js';
import { Input } from '../../src/core/input.js';
import { pointerFor } from '../../src/systems/pointer.js';
import { arrowFor } from '../../src/ui/pointerHud.js';
import { DATA } from '../helpers/data.mjs';
import { readFileSync } from 'node:fs';

const CONTROLS = JSON.parse(readFileSync(new URL('../../data/controls.json', import.meta.url)));
const R = await initPhysics();
const idle = (presses = {}) => ({ move: { x: 0, z: 0 }, aim: null, run: false, use: false, natural: false, presses });
const ang = (a, b) => Math.atan2(b.z - a.z, b.x - a.x);

test('the arrow points at the cake, then at the gate once it is carried', () => {
  const g = new Game(R, DATA); g.addPlayer('p1'); g.addPlayer('p2');
  const [p1, p2] = g.players, c = p1.coat, cake = g.loot.items.find((it) => it.id === 'birthday_cake');
  for (let i = 0; i < 10; i++) { g.setInput('p1', idle()); g.setInput('p2', idle()); g.step(); }
  let ptr = pointerFor(g, c, DATA.place);
  assert.equal(ptr.to, 'target'); assert.equal(ptr.label, "NAN'S CAKE");
  assert.ok(Math.hypot(ptr.x - cake.x, ptr.z - cake.z) < 0.01, 'at the cake');
  // the screen arrow: a point off the right of the screen gives an arrow on the right edge, pointing right
  const a = arrowFor(3000, 346, false, 1280, 720);
  assert.ok(!a.on && a.x > 1180 && Math.abs(a.angle) < 0.01, JSON.stringify(a));
  assert.ok(arrowFor(640, 300, false, 1280, 720).on, 'on screen: no arrow');
  assert.ok(Math.abs(arrowFor(640, 300, true, 1280, 720).angle - Math.PI / 2) < 0.01, 'behind the camera: flipped');
  // walk up to the cake and pick it up (E)
  c.walker.body.setTranslation({ x: cake.x - 0.6, y: 1, z: cake.z }, true); c.walker.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
  for (let i = 0; i < 20; i++) { g.setInput('p1', idle()); g.setInput('p2', idle()); g.step(); }
  assert.equal(g.loot.near(c), cake, p1.hands.hint());
  g.setInput('p1', idle({ grab: 1 })); g.setInput('p2', idle()); g.step();
  for (let i = 0; i < 3; i++) { g.setInput('p1', idle({ grab: 1 })); g.setInput('p2', idle()); g.step(); }
  assert.equal(cake.state, 'carried'); assert.ok(cake.carriers.includes(c));
  ptr = pointerFor(g, c, DATA.place);
  assert.equal(ptr.to, 'gate');
  assert.deepEqual([ptr.x, ptr.z], DATA.place.getaway.at);
  const f = c.walker.feet; assert.ok(Math.abs(ang(f, ptr) - ang(f, { x: 16, z: 18.5 })) < 1e-6, 'from the bakery towards the car park');
  assert.equal(pointerFor(g, p2.coat, DATA.place).to, 'target', 'a friend who does not hold it is still shown the cake (to help carry)');
  cake.state = 'banked';
  assert.equal(pointerFor(g, c, DATA.place), null, 'banked: nothing to point at');
});

test('the crayon map knows the target\'s area and the gate from the briefing', () => {
  const g = new Game(R, DATA); g.addPlayer('p1');
  assert.ok(g.map.seenAreas.has('bakery') && g.map.seenAreas.has('getaway'));
});

test('keys typed into a text box belong to the box, not the coat', () => {
  const h = {}, inp = new Input(CONTROLS).attach({ addEventListener: (t, f) => { h[t] = f; } });
  let stopped = 0;
  for (const code of ['KeyY', 'KeyD', 'KeyQ', 'KeyR']) h.keydown({ code, target: { tagName: 'INPUT' }, preventDefault: () => stopped++ });
  inp.update();
  assert.equal(inp.keys.size, 0); assert.equal(stopped, 0, 'the letters are not swallowed');
  assert.ok(!inp.down('stack') && !inp.down('natural') && inp.move.x === 0);
  h.keydown({ code: 'KeyR', target: { tagName: 'BODY' }, preventDefault: () => stopped++ }); inp.update();
  assert.ok(inp.pressed('stack') && stopped === 1, 'outside a text box R still unstacks');
});
