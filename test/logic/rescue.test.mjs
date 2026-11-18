// Logic tests for M1-07: caught and rescue (the Lost & Found cage, freeing a friend, Spare Kids, all caught).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initPhysics, makeWorld } from '../../src/physics/world.js';
import { Signals } from '../../src/systems/signals.js';
import { Things } from '../../src/world/interact/loader.js';
import { Mess } from '../../src/systems/mess.js';
import { Coat } from '../../src/entities/coat.js';
import { People } from '../../src/ai/people.js';
import { Suspicion } from '../../src/systems/suspicion.js';
import { Hands } from '../../src/systems/hands.js';
import { Gadgets } from '../../src/systems/gadgets.js';
import { Rescue } from '../../src/systems/rescue.js';
import { buildPlace, spawnThings } from '../../src/world/place.js';
import { Bot } from '../helpers/bot.mjs';

const J = (p) => JSON.parse(readFileSync(new URL('../../' + p, import.meta.url)));
const DATA = J('data/interactables.json'), SHOP = J('data/places/supermarket.json'), GROWN = J('data/grownups.json');
const GADGETS = J('data/gadgets.json'), B = J('data/balance.json'), SIG = J('data/signals.json').types;
const R = await initPhysics();
const DT = 1 / 60;

function setup({ coats = [[-12, 0, 5.5]], solo = coats.length === 1, guardAt = [-12, 10.2] } = {}) {
  const world = makeWorld(R), signals = new Signals(SIG), mess = new Mess(signals, B);
  const place = buildPlace(R, world, { ...SHOP, people: { list: [{ type: 'guard', at: guardAt }] } });
  const things = new Things(R, world, signals, DATA, { mess, spots: SHOP.events, balance: B });
  spawnThings(place, things);
  const people = new People(R, world, place, GROWN, { signals, mess, things: things.list });
  const sus = new Suspicion(B);
  const rescue = new Rescue({ R, world, place, people, balance: B, solo, suspicion: sus });
  const cs = coats.map((p, i) => new Coat(R, world, signals, B, p, i ? ['pip', 'mo', 'sid'] : undefined, { mess }));
  const hands = cs.map((c) => { const h = new Hands(c, things, B); h.rescue = rescue; return h; });
  const gad = new Gadgets(GADGETS, { R, world, signals, things, people, sus }); cs.forEach((c) => gad.arm(c));
  const events = [];
  const step = (inputs = []) => {
    rescue.step(cs); people.step(DT, cs);
    cs.forEach((c, k) => { const I = inputs[k] || {}; gad.use(c, DT, I); hands[k].step(DT, { grab: !!I.grab }); c.step(DT, I.move || { x: 0, z: 0 }, false, null, !!I.natural); hands[k].carry(); });
    world.step(); things.step(DT); signals.flush(DT); mess.step(DT); gad.step(DT, cs);
    events.push(...people.take(), ...rescue.take(), ...gad.take());
  };
  const run = (sec, inputs, until) => { for (let i = 0; i < Math.round(sec / DT); i++) { step(typeof inputs === 'function' ? inputs() : inputs); if (until?.()) return true; } return false; };
  const guard = people.list[0], warden = rescue.warden;
  guard.walker.yaw = Math.PI;
  return { world, place, people, rescue, coats: cs, hands, events, run, guard, warden, nav: people.nav };
}
const lone = (c) => { c.toggleStack(); c.pile = null; };          // just one kid (the other two stay behind)

test('solo: caught as the last kid, a Spare Kid walks in at the entrance and the caught kid goes in the cage', () => {
  const s = setup(); const c = s.coats[0];
  lone(c);
  assert.ok(s.run(8, [], () => s.events.some((e) => e.type === 'spareKid')), `never caught (${s.guard.state})`);
  assert.equal(s.rescue.spares, B.rescue.spareKids - 1);
  assert.equal(c.count, 1); assert.equal(c.stack[0], 'spare1');
  const [sx, sz] = SHOP.spawns.players[0];
  assert.ok(Math.hypot(c.walker.feet.x - sx, c.walker.feet.z - sz) < 1, 'back at the entrance');
  assert.ok(s.run(25, [], () => s.events.some((e) => e.type === 'locked')), `the guard never got to the cage (${s.guard.state})`);
  assert.ok(c.loose.some((k) => k.caged && k.id === 'tank'), 'the caught kid waits in the cage');
});

test('solo with no Spare Kids left: you go in the cage yourself, and that ends the run', () => {
  const s = setup(); const c = s.coats[0];
  s.rescue.spares = 0; lone(c);
  assert.ok(s.run(8, [], () => s.events.some((e) => e.type === 'caught')), 'not caught');
  assert.ok(c.caught && !c.walker.collider.isEnabled());
  assert.ok(s.events.some((e) => e.type === 'allCaught'), 'everyone (just you) is caught');
  assert.ok(s.run(25, [], () => c.inCage), 'never locked up');
  const [x0, z0, x1, z1] = SHOP.lostAndFound.rect, f = c.walker.feet;
  assert.ok(f.x > x0 && f.x < x1 && f.z > z0 && f.z < z1, 'inside the cage');
  s.run(2, [{ move: { x: 0, z: 1 } }]);
  assert.ok(c.walker.feet.z < z1, 'the bars hold');
});

test('two players: a bot lures the cage guard away with the slingshot and frees its caught friend', () => {
  const s = setup({ coats: [[-12, 0, 5.5], [-9, 0, -8]] });
  const [a, b] = s.coats;
  lone(a);
  assert.ok(s.run(8, [], () => a.caught), `A never caught (${s.guard.state})`);
  assert.ok(!s.events.some((e) => e.type === 'allCaught'), 'B is still free');
  assert.ok(s.run(30, [], () => a.inCage), 'A never locked up');
  s.run(4);                                                           // the cage guard is back at his post
  const post = SHOP.lostAndFound.guard;
  assert.ok(Math.hypot(s.warden.feet.x - post[0], s.warden.feet.z - post[1]) < 1.5, 'the guard watches the cage');
  let leftPost = false;
  const bot = new Bot(b, s.nav, [
    { go: [-9, -10.8] },                                              // the staff room doorway
    { fire: { select: 1, aim: { x: -1, z: -0.15 }, hold: 1.1 } },     // ping a stone into the far corner: a noise
    { until: () => (leftPost = Math.hypot(s.warden.feet.x - post[0], s.warden.feet.z - post[1]) > 2.5) },
    { go: [-4.9, -14.3], hurry: true }, { press: true }, { wait: 0.3 },
  ]);
  let t = 0;
  while (!bot.done && t < 40) { s.run(DT, [{}, bot.input(DT, s.people.list)]); t += DT; }
  assert.ok(bot.done, `bot stuck at step ${bot.i}: ${bot.log.at(-1)}`);
  assert.ok(leftPost, 'the guard went to look at the noise');
  assert.ok(s.rescue.open, 'the gate is open');
  assert.ok(s.events.some((e) => e.type === 'freed' && e.coat === a), 'A is free');
  assert.ok(!a.inCage && a.count === 1, 'and comes back as one kid');
  s.run(1.5, [{ move: { x: 0, z: 1 } }]);
  assert.ok(a.walker.feet.z > SHOP.lostAndFound.rect[3] + 0.5, 'A walks out');
});

test('the run ends only when every player is caught at the same time', () => {
  const s = setup({ coats: [[-12, 0, 5.5], [-12.6, 0, 5.5]] });
  const [a, b] = s.coats; lone(a); lone(b);
  assert.ok(s.run(10, [], () => a.caught || b.caught));
  assert.ok(!s.events.some((e) => e.type === 'allCaught'), 'one of them is still free');
  s.rescue.caught(a.caught ? b : a, s.guard); s.run(0.05);
  assert.ok(s.events.some((e) => e.type === 'allCaught'), 'both caught: the run is over');
});
