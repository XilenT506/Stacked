// Logic tests for M1-F11: clear words, and a next job that feels new. Playing alone nobody says "Player 1
// joined!", job 2 asks for something else with a higher quota, the results card waits for a key, the
// messages agree with each other, and E picks what's in front of you.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initPhysics } from '../../src/physics/world.js';
import { Game } from '../../src/core/game.js';
import { jobBrief } from '../../src/systems/job.js';
import { pointerFor } from '../../src/systems/pointer.js';
import { looseLine } from '../../src/ui/looseLine.js';
import { DATA } from '../helpers/data.mjs';

const R = await initPhysics();
const inp = (o = {}) => ({ move: { x: 0, z: 0 }, aim: null, run: false, use: false, natural: false, presses: {}, ...o });
const put = (w, x, z) => { const p = { x, y: w.half + w.radius + 0.02, z }; w.body.setTranslation(p, true); w.body.setNextKinematicTranslation(p); w.vel.x = w.vel.z = 0; };

test('playing alone there is no "Player 1 joined!"; a second player is still greeted', () => {
  const g = new Game(R, DATA); g.addPlayer('p1');
  assert.ok(!g.take().some((e) => e.k === 'announce' && /joined/.test(e.text)), 'nothing about joining when alone');
  g.addPlayer('p2');
  assert.ok(g.take().some((e) => e.k === 'announce' && e.text === 'Player 2 joined!'));
});

test("job 2 is not a copy of job 1: another target, a higher quota, and its own briefing", () => {
  const g = new Game(R, DATA); g.addPlayer('p1'); g.take();
  const one = { target: g.job.target, quota: g.job.quota, loot: g.brief.targetLoot };
  g.loot.items.find((i) => i.id === 'chocolate').state = 'banked'; g.finish('got away');
  for (let i = 0; i < 60 * (DATA.balance.shop.resultsSeconds + 0.5); i++) g.step();
  g.setInput('p1', inp({ presses: { grab: 1 } })); g.step();
  assert.equal(g.phase, 'shop');
  g.shop.ready.add('p1'); g.step();
  assert.equal(g.phase, 'job', 'the next job');
  const two = { target: g.job.target, quota: g.job.quota, loot: g.brief.targetLoot };
  console.log(`  job 1: ${one.target} (quota ${one.quota}); job 2: ${two.target} (quota ${two.quota})`);
  assert.notEqual(two.loot, one.loot); assert.notEqual(two.target, one.target); assert.ok(two.quota > one.quota);
  const brief = g.take().find((e) => e.k === 'announce' && e.title === 'Job 2');
  assert.ok(brief && brief.text.includes(two.quota) && /fizzy pop/.test(brief.text), 'a briefing line for job 2');
  // the arrow and the map follow the new target
  assert.equal(pointerFor(g, g.players[0].coat, DATA.place).label, g.brief.sign);
  // round the list and the quota keeps climbing
  const n = 1 + DATA.place.jobs.list.length;
  assert.ok(jobBrief(DATA.place, n).quota > jobBrief(DATA.place, 0).quota && jobBrief(DATA.place, n).targetLoot === DATA.place.job.targetLoot);
});

test('the results card waits for a key instead of moving on by itself', () => {
  const g = new Game(R, DATA); g.addPlayer('p1'); g.finish('got away');
  for (let i = 0; i < 60 * 30; i++) { g.setInput('p1', inp()); g.step(); }
  assert.equal(g.phase, 'job', 'still on the results after 30 s');
  g.setInput('p1', inp({ presses: { stack: 1 } })); g.step();
  assert.equal(g.phase, 'shop', 'any key moves on');
});

test('the messages agree: loose, carried off and caged kids are told apart; Nan keeps her capital N', () => {
  assert.equal(looseLine([{ id: 'a' }, { id: 'b', carriedBy: {} }]), ' · 1 kid loose! walk over them · 1 kid being carried to the Lost & Found');
  assert.equal(looseLine([{ id: 'a', carriedBy: {}, caged: true }, { id: 'b', caged: true }]), ' · 2 kids in the Lost & Found');
  assert.equal(looseLine([]), '');
  const g = new Game(R, DATA); g.addPlayer('p1'); const c = g.players[0].coat, cake = g.loot.items.find((i) => i.id === 'birthday_cake');
  put(c.walker, cake.x, cake.z + 0.9); c.walker.yaw = Math.PI; for (let i = 0; i < 3; i++) g.step();
  assert.equal(g.hint('p1'), "E: pick up Nan's birthday cake (80 sweets)");
});

test('at the gate: only kids really inside count, and E right after banking never starts the getaway', () => {
  const g = new Game(R, DATA); g.addPlayer('p1'); g.addPlayer('p2'); g.take();
  const [a, b] = g.players.map((p) => p.coat), gate = DATA.place.getaway.at;
  put(b.walker, 0, 15);                                      // a friend waiting out in the car park
  put(a.walker, gate[0], gate[1]); for (let i = 0; i < 5; i++) g.step();
  assert.equal(g.kidsInside(), 0, 'the friend in the car park is not "still inside"');
  // walk in with the cake: it banks, and E straight after is about the cake, not the getaway
  const cake = g.loot.items.find((i) => i.id === 'birthday_cake'); cake.state = 'carried'; cake.carriers = [a]; g.loot.load(cake);
  for (let i = 0; i < 3; i++) g.step();
  assert.equal(cake.state, 'banked');
  g.setInput('p1', inp({ presses: { grab: 1 } })); g.step();
  assert.ok(!g.job.over, 'E straight after banking did not end the job');
  assert.match(g.hint('p1'), /^Banked!/);
});

test('E picks the loot in front of the coat before bigger loot further away; full pockets say so', () => {
  const g = new Game(R, DATA); g.addPlayer('p1'); const c = g.players[0].coat;
  const choc = g.loot.items.find((i) => i.id === 'chocolate'), lolly = g.loot.items.find((i) => i.id === 'giant_lolly');
  // stand between them, facing the chocolate
  put(c.walker, (choc.x + lolly.x) / 2, (choc.z + lolly.z) / 2); for (let i = 0; i < 3; i++) g.step();
  c.walker.yaw = Math.atan2(choc.x - c.walker.feet.x, choc.z - c.walker.feet.z);
  assert.equal(g.loot.near(c)?.id, 'chocolate', `picked ${g.loot.near(c)?.id}`);
  for (const it of g.loot.items.filter((i) => i.kind === 'small' && i !== choc).slice(0, DATA.balance.loot.pockets)) { it.state = 'pocket'; it.owner = c; }
  assert.equal(g.loot.hint(c), `Pockets full (${DATA.balance.loot.pockets} of ${DATA.balance.loot.pockets}): bank them at the getaway gate`);
});
