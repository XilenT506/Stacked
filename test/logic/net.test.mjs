// Logic tests for M1-08: multiplayer. A host runs the Game; two clients steer their coats with input
// packets and draw from snapshots (JSON through an in-memory link with 50 ms of lag). Couch players are
// just more players in the same Game.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initPhysics } from '../../src/physics/world.js';
import { Game } from '../../src/core/game.js';
import { Mirror } from '../../src/net/snapshot.js';
import { HostSession, ClientSession } from '../../src/net/session.js';
import { MemoryHub, MemoryLink } from '../../src/net/links.js';
import { Bot, botInput } from '../helpers/bot.mjs';
import { DATA } from '../helpers/data.mjs';

const R = await initPhysics();
const DT = 1 / 60;

async function online(nClients = 2) {
  const hub = new MemoryHub(0.05), game = new Game(R, DATA);
  game.addPlayer('host');
  const hl = new MemoryLink(hub); await hl.host('TEST');
  const host = new HostSession(game, hl);
  const clients = [];
  for (let i = 0; i < nClients; i++) { const l = new MemoryLink(hub); await l.join('TEST'); clients.push(new ClientSession(new Mirror(DATA), l)); }
  const tick = (inputs = {}) => {
    for (const c of clients) { if (inputs[c.id]) c.send(inputs[c.id]); c.tick(DT); }
    hub.tick(DT); game.step(); host.share(game.take()); host.tick(DT); hub.tick(0);
    for (const c of clients) { c.mirror.update(DT); c.take(); }
  };
  for (let i = 0; i < 30; i++) tick();                          // everyone says hello and joins
  return { hub, game, host, clients, tick };
}

test('host plus two clients play one job: each steers their own coat, and everyone sees the same mess', async () => {
  const { game, clients, tick } = await online(2);
  assert.deepEqual(game.order, ['host', clients[0].id, clients[1].id], 'both friends are in');
  const [a, b] = clients;
  const nav = game.people.nav, ca = () => a.mirror.coatMap.get(a.id), cb = () => b.mirror.coatMap.get(b.id);
  // A walks to the ketchup shelf, picks up a bottle and squirts a trail; B waits for the mess, then walks out
  // to the getaway gate. (Until M1-F3 A 'kicked the vending machine', but the mess there only came from a bug
  // that shoved a coat holding a mop across the floor.)
  const kicked = () => game.mess.patches.some((p) => p.color === DATA.things.things.ketchup.splat);
  const botA = new Bot(ca(), nav, [{ go: [-14.5, 10] }, { go: [-6, 5] }, { go: [-4.1, -1.4], within: 0.4 }, { press: true }, { wait: 0.3 }, { fire: { hold: 1.5 } }, { until: kicked }]);
  const botB = new Bot(cb(), nav, [{ until: kicked }, { wait: 2 }, { go: [-11, 13] }, { go: [16, 18.5], within: 0.8 }, { press: true }, { wait: 0.5 }, { press: true }]);   // E, 'kids still inside!', E again
  const cA = {}, cB = {};
  let t = 0;
  while (!(botA.done && botB.done) && t < 120) {
    botA.coat = ca(); botB.coat = cb();
    tick({ [a.id]: botInput(botA.input(DT, []), cA), [b.id]: botInput(botB.input(DT, []), cB) }); t += DT;
  }
  assert.ok(botA.done, `A got stuck: ${botA.log.at(-1)} (hint: ${game.hint(a.id)}, at ${JSON.stringify(game.player(a.id).coat.walker.feet)}, held ${game.player(a.id).hands.held?.def.name})`); assert.ok(botB.done, `B got stuck: ${botB.log.at(-1)}`);
  for (let i = 0; i < 20; i++) tick();
  assert.ok(game.job.over && game.job.why === 'got away', 'B ended the job at the gate');
  // the same mess on every screen
  assert.ok(game.mess.patches.length > 0);
  for (const c of clients) {
    const mine = c.mirror.mess.patches, his = game.mess.patches;
    assert.equal(mine.length, his.length, 'same number of puddles');
    his.forEach((p, i) => { assert.ok(Math.hypot(p.x - mine[i].x, p.z - mine[i].z) < 0.02 && p.color === mine[i].color, `puddle ${i}`); });
    // toppled tins in the same places
    const tins = game.things.list.filter((x) => x.name === 'tin' && !x.gone);
    let off = 0; for (const tn of tins) { const m = c.mirror.thingMap.get(tn.id); off = Math.max(off, Math.hypot(m.position.x - tn.position.x, m.position.z - tn.position.z)); }
    assert.ok(off < 0.3, `tins within 30 cm (worst ${off.toFixed(2)} m)`);
    assert.ok(c.mirror.job.over, 'the result reached everyone');
  }
  assert.ok(game.players.some((p) => p.id === b.id && p.coat.atGate));
});

test('a friend who joins late waits for the next job, then plays; a friend who leaves is taken out', async () => {
  const { game, clients, tick, hub } = await online(1);
  for (let i = 0; i < Math.round(game.joinWindow / DT) + 10; i++) game.step();
  const late = new ClientSession(new Mirror(DATA), new MemoryLink(hub)); await late.link.join('TEST');
  for (let i = 0; i < 20; i++) { late.tick(DT); tick(); }
  assert.deepEqual(game.waiting, [late.id], 'waiting for the next job');
  assert.ok(!game.player(late.id));
  game.reset();
  assert.ok(game.player(late.id), 'in at the next job'); assert.equal(game.players.length, 3);
  clients[0].link.close(); tick();
  assert.equal(game.players.length, 2, 'the one who left is gone');
});

test('couch: two local players in one game play a job together (both pocket sweets, both get out)', () => {
  const game = new Game(R, DATA); game.addPlayer('p1'); game.addPlayer('p2');
  const [c1, c2] = game.coats, nav = game.people.nav;
  const route = (sweet) => [{ go: [-14.5, 10] }, { go: [-6, 5] }, { go: [0.5, 4.6] }, { go: sweet }, { press: true }, { go: [-6, 5] }, { go: [-14.5, 10.5] }, { go: [-14.5, 15] }, { go: [16, 18.5], within: 0.8 }];
  const b1 = new Bot(c1, nav, route([-0.2, 2.5])), b2 = new Bot(c2, nav, [{ wait: 1.5 }, ...route([-0.2, -0.5])]);
  const k1 = {}, k2 = {};
  let t = 0;
  while (!(b1.done && b2.done) && t < 150) { game.setInput('p1', botInput(b1.input(DT, game.people.list), k1)); game.setInput('p2', botInput(b2.input(DT, game.people.list), k2)); game.step(); game.take(); t += DT; }
  assert.ok(b1.done && b2.done, `stuck: ${b1.log.at(-1)} / ${b2.log.at(-1)}`);
  for (let i = 0; i < 30; i++) game.step();
  assert.equal(game.loot.banked.length, 2, 'both sweets banked');
  // (a kid may have fallen out on the way: then the first E at the gate warns, and E again leaves it behind)
  const left = game.kidsInside();
  k1.grab = (k1.grab ?? 0) + 1; game.setInput('p1', { move: { x: 0, z: 0 }, aim: null, presses: { ...k1 } }); game.step();
  if (left) {
    assert.ok(!game.job.over, 'warned first'); assert.match(game.hint('p1'), /^E again: leave \d kids? behind/);
    k1.grab++; game.setInput('p1', { move: { x: 0, z: 0 }, aim: null, presses: { ...k1 } }); game.step();
    assert.equal(game.job.result.leftBehind, left);
  }
  assert.ok(game.job.over);
});
