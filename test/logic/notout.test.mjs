// Logic tests for M1-F7: caught, but not out. One mistake costs a kid, not the run: after a grab the shop
// takes a breath (Heat drops a level, nobody else starts a chase for a few seconds), a kid who falls out gets
// a head start, a Spare Kid comes in safe and is ignored for its first seconds, R next to a grown-up warns
// first, a solo player is never told a friend will help, and a wipe after the quota is met keeps the run.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initPhysics } from '../../src/physics/world.js';
import { Game } from '../../src/core/game.js';
import { Bot } from '../helpers/bot.mjs';
import { DATA } from '../helpers/data.mjs';

const R = await initPhysics();
const DT = 1 / 60, B = DATA.balance;
const inp = (presses = {}, move = { x: 0, z: 0 }, run = false) => ({ move, aim: null, run, use: false, natural: false, presses });
const put = (c, x, z) => { c.walker.body.setTranslation({ x, y: c.walker.half + c.walker.radius + 0.02, z }, true); c.walker.vel.x = c.walker.vel.z = 0; };
const lone = (c) => { c.stack = [c.stack[0]]; c.applyHeight(); };

test('one mistake costs a kid, not the run: a bot runs past the tills with the giant lolly and is still playing 60 s later', () => {
  const g = new Game(R, DATA); g.addPlayer('p1'); g.take();
  const c = g.players[0].coat, lolly = g.loot.items.find((i) => i.id === 'giant_lolly');
  put(c, lolly.x, lolly.z + 1.2);
  // pick up the lolly, then run west along the tills to the entrance, past the cashiers and the guard
  // then it carries on like a player would: back past the tills (walking) towards the bakery, round and back
  const back = [[-10, 6], [-2, 6], [6, 6], [12, 0], [12, -3], [6, 6], [-6, 6], [-14.5, 10]].map((go) => ({ go, hurry: true }));
  const bot = new Bot(c, g.people.nav, [{ press: true }, { go: [-1, 5.8], hurry: true }, { go: [-15, 5.8], hurry: true }, { go: [-14.5, 10], hurry: true }, ...back, ...back]);
  let presses = 0, t = 0, kidsLost = 0, busts = 0, heatMax = 0;
  const grabbed = new Set();
  for (; t < 60; t += DT) {
    const o = bot.input(DT, g.people.list); if (o.grab) presses++;
    g.setInput('p1', inp({ grab: presses }, o.move, bot.i >= 1 && bot.i <= 3));
    g.step();
    for (const e of g.take()) if (e.k === 'shout' && e.text === "THAT'S NOT A GROWN-UP!") busts++;
    heatMax = Math.max(heatMax, g.sus.level);
    for (const k of c.loose) if (k.carriedBy || k.caged) grabbed.add(k.id);
    if (bot.i === 1 && t < 2) assert.equal(lolly.state, 'carried', 'it picked up the lolly');
    if (g.job.over) break;
  }
  kidsLost = grabbed.size;
  console.log(`  ran past the tills with the lolly: ${busts} busts, Heat up to ${heatMax}, ${kidsLost} kids grabbed, ${B.rescue.spareKids - g.rescue.spares} Spare Kids used; now ${c.count} kid(s), Heat ${g.sus.level}`);
  assert.ok(bot.i >= 2, `it really ran past the tills (${bot.log.join(', ')})`);
  assert.ok(!g.job.over, `the job is still on (${g.job.why})`);
  assert.ok(!c.caught && !c.inCage && c.count >= 1, 'a coat (or a Spare Kid) is still playing');
  assert.ok(g.rescue.spares >= 1, 'it still has a Spare Kid to spare');
});

test('after a grab the shop takes a breath: Heat drops a level and nobody else starts a chase for a few seconds', () => {
  const g = new Game(R, DATA); g.addPlayer('p1'); g.take();
  const c = g.players[0].coat, guard = g.people.byType('guard')[0];
  g.sus.addHeat(B.heat.thresholds[1], 'test key'); assert.equal(g.sus.level, 2);
  guard.events.push({ type: 'grabKid', kid: 'tank' }); g.people.step(DT, g.coats); g.present();
  assert.equal(g.sus.level, 1, 'Heat went down one level');
  const a = g.take().find((e) => e.k === 'announce' && e.title?.startsWith('Heat 1'));
  assert.ok(a && /calm/.test(a.text), 'and the screen says so');
  // a lone kid right in front of a guard: no chase while the shop catches its breath
  lone(c); const gf = guard.feet; put(c, gf.x + Math.sin(guard.walker.yaw) * 2.5, gf.z + Math.cos(guard.walker.yaw) * 2.5);
  for (let t = 0; t < B.rescue.breather.seconds - 1; t += DT) { g.setInput('p1', inp()); g.step(); assert.notEqual(guard.state, 'chase', `chased at ${t.toFixed(1)} s`); }
  // a second grab soon after does not drop the Heat again (once every heatDropEvery seconds)
  g.people.list[1].events.push({ type: 'grabKid', kid: 'mo' }); g.people.step(DT, g.coats); g.present();
  assert.equal(g.sus.level, 1);
});

test('a kid who falls out gets a head start before a grown-up can grab it', () => {
  const g = new Game(R, DATA); g.addPlayer('p1'); g.take();
  const c = g.players[0].coat, guard = g.people.byType('guard')[0];
  guard.hostile.add(c); put(c, guard.feet.x, guard.feet.z + 1.5);
  const kid = c.spill(); Object.assign(kid, { x: guard.feet.x + 0.5, z: guard.feet.z + 0.3, vx: 0, vz: 0, waiting: true });
  for (let t = 0; t < B.looseKid.headStart - 0.1; t += DT) { g.setInput('p1', inp()); g.step(); assert.ok(!kid.carriedBy, `grabbed after ${t.toFixed(2)} s`); }
});

test('a Spare Kid is not grabbed in its first 5 seconds, even by a guard right next to it', () => {
  const g = new Game(R, DATA); g.addPlayer('p1'); g.take();
  const c = g.players[0].coat, guard = g.people.byType('guard')[0];
  lone(c); g.rescue.caught(c, guard); g.present();
  assert.equal(c.stack[0], 'spare1'); assert.ok(c.safe > 4.9, 'it comes in safe');
  const f = c.walker.feet;                                 // a second guard waiting right at the door, looking at it
  const other = g.people.add({ type: 'guard', at: [f.x + 1, f.z] }); other.walker.yaw = -Math.PI / 2; other.hostile.add(c);
  g.people.ctx.calmUntil = -1; g.sus.calmUntil = -1;      // (no breather: only the Spare Kid's own safe time)
  for (let t = 0; t < B.rescue.spareSafe - 0.1; t += DT) {
    g.setInput('p1', inp()); g.step();
    assert.ok(!c.caught && c.stack[0] === 'spare1' && g.rescue.spares === B.rescue.spareKids - 1, `grabbed after ${t.toFixed(2)} s`);
    assert.notEqual(other.state, 'chase', 'nobody even starts a chase');
  }
  assert.match(g.hint('p1'), /Just arrived/);
  // then it is fair game again
  let chased = false; for (let t = 0; t < 3 && !chased; t += DT) { g.setInput('p1', inp()); g.step(); chased = g.people.list.some((p) => p.state === 'chase' || p.carrying); }
  assert.ok(chased, 'after its safe time the grown-ups notice it');
});

test('R next to a grown-up who can see you warns first; R again unstacks anyway', () => {
  const g = new Game(R, DATA); g.addPlayer('p1'); g.take();
  const c = g.players[0].coat, guard = g.people.byType('guard')[0], gf = guard.feet;
  put(c, gf.x + Math.sin(guard.walker.yaw) * 3, gf.z + Math.cos(guard.walker.yaw) * 3);
  for (let i = 0; i < 5; i++) { g.setInput('p1', inp()); g.step(); }
  g.setInput('p1', inp({ stack: 1 })); g.step();
  assert.equal(c.count, 3, 'still stacked'); assert.match(g.hint('p1'), /A grown-up is watching! R again/);
  g.setInput('p1', inp({ stack: 2 })); g.step();
  assert.equal(c.count, 1, 'R again: unstacked'); assert.ok(c.pile);
  // nobody watching: R unstacks straight away
  const h = new Game(R, DATA); h.addPlayer('p1'); h.take(); const d = h.players[0].coat;
  put(d, 0, -23); for (let i = 0; i < 5; i++) { h.setInput('p1', inp()); h.step(); }
  assert.ok(!h.watched(d), 'nobody can see the loading yard');
  h.setInput('p1', inp({ stack: 1 })); h.step(); assert.equal(d.count, 1);
});

test('solo: the caught messages never mention a friend, and the cage hint only shows when someone is in it', () => {
  const g = new Game(R, DATA); g.addPlayer('p1'); g.take();
  const c = g.players[0].coat, guard = g.people.byType('guard')[0];
  const texts = [];
  const grab = () => { lone(c); g.rescue.caught(c, guard); g.present(); texts.push(...g.take().filter((e) => e.k === 'announce' && e.to === 'p1').map((e) => e.text)); };
  grab(); grab(); grab();                                 // Spare Kid 1, Spare Kid 2, then no Spare Kids left
  assert.equal(g.job.why, 'all caught', 'that was the last kid: the job is over');
  c.inCage = true;
  assert.ok(texts.some((t) => /^You're Spare Kid 1 of 2/.test(t)) && texts.some((t) => /^You're Spare Kid 2 of 2/.test(t)));
  assert.ok(texts.some((t) => /No Spare Kids left/.test(t)), texts.join(' / '));
  for (const t of [...texts, g.rescue.hint(c)]) assert.doesNotMatch(t, /friend/i, t);
  // the cage hint: nothing at an empty cage, "E: open" once someone is inside
  const h = new Game(R, DATA); h.addPlayer('p1'); h.addPlayer('p2'); const [a, b] = h.players.map((p) => p.coat);
  const gate = h.rescue.gateAt; put(b, gate.x, gate.z + 0.6); for (let i = 0; i < 3; i++) h.step();
  assert.equal(h.rescue.hint(b), '', 'empty cage: no hint');
  a.inCage = true; assert.equal(h.rescue.hint(b), 'E: open the Lost & Found cage');
});

test('a wipe after the quota is met keeps the banked sweets and the run', () => {
  const g = new Game(R, DATA); g.addPlayer('p1'); g.take();
  const runNo = g.run.no, jar = g.run.sweets;
  for (const it of g.loot.items) { if (g.loot.bankedValue >= g.job.quota) break; it.state = 'banked'; }
  assert.ok(g.loot.bankedValue >= g.job.quota);
  const c = g.players[0].coat; g.rescue.spares = 0; lone(c); g.rescue.caught(c, g.people.byType('guard')[0]);
  for (let i = 0; i < 3; i++) { g.setInput('p1', inp()); g.step(); }
  assert.equal(g.job.why, 'all caught'); assert.ok(g.job.result.met, 'the quota was met');
  for (let t = 0; t < B.shop.resultsSeconds + 1 && g.phase === 'job'; t += DT) { g.setInput('p1', inp()); g.step(); }
  assert.equal(g.phase, 'shop', "on to Del's, not a new run");
  assert.equal(g.run.no, runNo, 'same run');
  assert.ok(g.run.sweets >= jar + g.job.quota, `the sweets are in the jar (${g.run.sweets})`);
  assert.ok(!g.take().some((e) => e.k === 'announce' && /New run/.test(e.text)));
  // without the quota it is still the end of the run
  const h = new Game(R, DATA); h.addPlayer('p1'); h.take(); const d = h.players[0].coat;
  h.rescue.spares = 0; lone(d); h.rescue.caught(d, h.people.byType('guard')[0]);
  for (let t = 0; t < B.shop.resultsSeconds + 1; t += DT) { h.setInput('p1', inp()); h.step(); }
  assert.equal(h.run.no, runNo + 1, 'a new run');
});
