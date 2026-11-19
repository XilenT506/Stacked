// Logic tests for M1-06: loot (pockets, carrying, two-coat carrying, drops), the getaway gate, the quota
// maths, and a bot that finishes a whole job.
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
import { Loot } from '../../src/systems/loot.js';
import { Job, jobResult } from '../../src/systems/job.js';
import { buildPlace, spawnThings } from '../../src/world/place.js';
import { Bot } from '../helpers/bot.mjs';

const J = (p) => JSON.parse(readFileSync(new URL('../../' + p, import.meta.url)));
const DATA = J('data/interactables.json'), SHOP = J('data/places/supermarket.json'), GROWN = J('data/grownups.json');
const LOOKS = J('data/loot.json'), B = J('data/balance.json'), SIG = J('data/signals.json').types;
const R = await initPhysics();
const DT = 1 / 60;

function setup({ people = [], coats = [[-14.5, 0, 16]] } = {}) {
  const world = makeWorld(R), signals = new Signals(SIG), mess = new Mess(signals, B);
  const place = buildPlace(R, world, { ...SHOP, people: { list: people } });
  const things = new Things(R, world, signals, DATA, { mess, spots: SHOP.events, balance: B });
  spawnThings(place, things);
  const ppl = new People(R, world, place, GROWN, { signals, mess, things: things.list });
  const sus = new Suspicion(B), loot = new Loot(place, LOOKS, B), job = new Job(place, B);
  const cs = coats.map((p, i) => new Coat(R, world, signals, B, p, i ? ['pip', 'mo', 'sid'] : undefined, { mess }));
  const hands = cs.map((c) => { const h = new Hands(c, things, B); h.loot = loot; return h; });
  const events = [];
  // inputs: per coat { move, grab, natural }
  const step = (inputs = []) => {
    ppl.step(DT, cs);
    cs.forEach((c, k) => { const I = inputs[k] || {}; hands[k].step(DT, { grab: !!I.grab, natural: !!I.natural }); c.step(DT, I.move || { x: 0, z: 0 }, false, null, !!I.natural); hands[k].carry(); });
    sus.step(DT, ppl, cs);
    world.step(); things.step(DT); signals.flush(DT); mess.step(DT); loot.step(DT, cs); job.step(DT);
    events.push(...loot.take(), ...ppl.take());
  };
  const run = (sec, inputs, until) => { for (let i = 0; i < Math.round(sec / DT); i++) { step(typeof inputs === 'function' ? inputs() : i === 0 ? inputs : (inputs || []).map((I) => ({ ...I, grab: false }))); if (until?.()) return true; } return false; };
  const put = (c, x, z) => c.walker.body.setTranslation({ x, y: c.walker.half + c.walker.radius + 0.02, z }, true);
  return { world, place, people: ppl, sus, loot, job, coats: cs, hands, events, run, put, nav: ppl.nav };
}
const item = (s, id) => s.loot.items.find((it) => it.id === id);

test('quota maths: Clean Job +50% at Heat 0, Chaos Bonus ×1.2 / ×1.5 / ×2 at Heat 1 to 3', () => {
  assert.deepEqual([0, 1, 2, 3].map((h) => jobResult({ banked: 100, heat: h, quota: 150, balance: B }).total), [150, 120, 150, 200]);   // M1-F3: sweets at the plan's scale
  const clean = jobResult({ banked: 100, heat: 0, quota: 150, balance: B });
  assert.ok(clean.clean && clean.met && clean.bonusName === 'Clean Job');
  const r1 = jobResult({ banked: 100, heat: 1, quota: 150, balance: B });
  assert.ok(!r1.met); assert.equal(r1.short, 30); assert.equal(r1.bonusName, 'Chaos Bonus');
  assert.equal(jobResult({ banked: 0, heat: 3, quota: 150, balance: B }).total, 0);
  assert.equal(jobResult({ banked: 33, heat: 1, quota: 0, balance: B }).total, 40);      // rounded to whole sweets
});

test('small loot goes in your pockets (up to the pocket limit), big loot is carried and slows you down', () => {
  const s = setup({ coats: [[-0.2, 0, -4]] }); const c = s.coats[0];
  s.run(0.05, [{ grab: true }]);
  assert.equal(item(s, 'pick_n_mix').state, 'pocket');
  s.put(c, -0.3, 2.6); s.run(0.2);
  s.run(0.05, [{ grab: true }]); s.run(0.05, [{ grab: true }]);       // chocolate (small, nearest) then the giant lolly
  assert.equal(item(s, 'chocolate').state, 'pocket');
  assert.equal(item(s, 'giant_lolly').state, 'carried');
  assert.ok(c.carrySpeedMul < 1 && c.carryKg > 0);
  const z0 = c.position.z; s.run(1, [{ move: { x: 0, z: -1 } }]);
  assert.ok(z0 - c.position.z < B.heights['3'].speed * 0.95, 'carrying is slower');
  // pockets are limited
  for (const it of s.loot.items.filter((i) => i.kind === 'small').slice(0, 8)) { it.state = 'pocket'; it.owner = c; }
  const free = s.loot.items.find((i) => i.kind === 'small' && i.state === 'lying');
  if (free) { s.put(c, free.x, free.z + 0.4); assert.notEqual(s.loot.near(c)?.kind, 'small'); }
});

test('dropping loot loses value (never below 40%); a kid falling out drops what you carry', () => {
  const s = setup({ coats: [[0.5, 0, 2.7]] }); const c = s.coats[0], it = item(s, 'giant_lolly');
  s.run(0.05, [{ grab: true }]); assert.equal(it.state, 'carried');
  s.run(0.05, [{ grab: true }]); assert.equal(it.state, 'lying'); assert.equal(it.value, 34);
  for (let i = 0; i < 10; i++) s.loot.drop(it, 'test');
  assert.equal(it.value, 16, 'floored at 40% of 40');
  s.run(0.05, [{ grab: true }]); assert.equal(it.state, 'carried');
  c.hit(10); s.run(0.05);
  assert.equal(it.state, 'lying', 'a kid fell out and the lolly went flying'); assert.equal(c.carryKg, 0);
});

test('two coats carry big loot together: half the weight each, and pulling apart drops it', () => {
  const s = setup({ coats: [[0.5, 0, 2.7], [0.5, 0, 4.3]] }); const [a, b] = s.coats, it = item(s, 'giant_lolly');
  s.run(0.05, [{ grab: true }]); s.run(0.05, [{}, { grab: true }]);
  assert.deepEqual(it.carriers, [a, b]);
  assert.equal(a.carryKg, it.mass / 2); assert.ok(a.carrySpeedMul > 1 - it.mass * B.loot.perKg);
  s.run(1.2, [{ move: { x: 0, z: -1 } }, { move: { x: 0, z: 1 } }]);
  assert.equal(it.state, 'lying'); assert.ok(s.events.some((e) => e.type === 'drop' && e.why === 'pulled apart'));
});

test('the getaway gate banks everything you bring, and the job adds it up', () => {
  const s = setup({ coats: [[16, 0, 16]] }); const c = s.coats[0];
  for (const id of ['chocolate', 'coin_jar']) Object.assign(item(s, id), { state: 'pocket', owner: c });
  s.run(1, [{ move: { x: 0, z: 1 } }], () => s.loot.banked.length === 2);
  assert.equal(s.loot.bankedValue, 45);
  const r = s.job.finish('got away', s.loot, s.sus);
  assert.equal(r.total, 68); assert.ok(r.clean); assert.ok(!r.met);
});

test('a bot finishes a job: sneaks past the grown-ups, grabs sweets and the giant lolly, and gets them out', () => {
  const s = setup({ people: SHOP.people.list });
  const bot = new Bot(s.coats[0], s.nav, [
    { go: [-14.5, 10] }, { go: [-6, 5] }, { go: [0.5, 4.6] },
    { go: [-0.2, 2.5] }, { press: true }, { go: [-0.2, -0.5] }, { press: true }, { go: [-0.2, -4] }, { press: true },
    { go: [0.5, 2.8], within: 0.6 }, { press: true },
    { go: [-6, 5] }, { go: [-14.5, 10.5] }, { go: [-14.5, 15] }, { go: [16, 18.5], within: 0.8 },
  ]);
  let t = 0;
  while (!bot.done && t < 240) { s.run(DT, [bot.input(DT, s.people.list)]); t += DT; }
  assert.ok(bot.done, `the bot got stuck: ${bot.log.at(-1)} (step ${bot.i})`);
  s.run(0.5);
  const r = s.job.finish('got away', s.loot, s.sus);
  assert.ok(r.banked >= 40 + 15 + 8 + 12 - 8, `banked only ${r.banked}`);
  assert.ok(s.loot.banked.some((it) => it.id === 'giant_lolly'), 'brought the giant lolly out');
  console.log(`bot job: ${t.toFixed(0)} s, banked ${r.banked}, Heat ${r.heat}, ×${r.mult} = ${r.total} of ${r.quota}`);
});
