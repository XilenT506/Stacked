// One running job, for 1 to 4 players: everything that is simulated (physics, grown-ups, things, loot,
// Heat, Closing Time, the cage). It knows nothing about drawing or the network: the host (or a solo or
// couch game) owns one of these, feeds it each player's input and asks it for presentation events.
//   const game = new Game(R, DATA); game.addPlayer('p1'); every step: game.setInput(id, input); game.step();
// Players joining after the first 20 seconds of a job wait for the next one (game.reset()).
import { STEP } from './clock.js';
import { makeWorld } from '../physics/world.js';
import { Signals } from '../systems/signals.js';
import { Mess } from '../systems/mess.js';
import { JobEvents } from '../systems/jobEvents.js';
import { Hands } from '../systems/hands.js';
import { Things } from '../world/interact/loader.js';
import { buildPlace, spawnThings } from '../world/place.js';
import { Coat } from '../entities/coat.js';
import { People } from '../ai/people.js';
import { Suspicion } from '../systems/suspicion.js';
import { ClosingTime } from '../systems/closingTime.js';
import { Security } from '../systems/security.js';
import { Gadgets } from '../systems/gadgets.js';
import { Loot } from '../systems/loot.js';
import { Job } from '../systems/job.js';
import { Rescue } from '../systems/rescue.js';
import { TeamMap } from '../systems/teamMap.js';

export const KIDS = [['sid', 'mo', 'tank'], ['pip', 'kit', 'bo'], ['ziggy', 'nell', 'ash'], ['dot', 'rex', 'flo']];
const NO_INPUT = { move: { x: 0, z: 0 }, aim: null, run: false, use: false, natural: false, presses: {}, map: false, sc: [] };
const STILL = { x: 0, z: 0 };

export class Game {
  // D = { place, events, things, controls?, signals, balance, grownups, gadgets, loot, crayonmap }
  constructor(R, D, { joinWindow = 20 } = {}) {
    this.R = R; this.D = D; this.joinWindow = joinWindow;
    this.order = []; this.waiting = []; this.out = []; this.jobNo = 0;
    this.reset();
  }

  get coats() { return this.players.map((p) => p.coat); }
  player(id) { return this.players.find((p) => p.id === id); }

  // a new job: rebuild the shop and put everyone (including people who were waiting) at the entrance
  reset() {
    const { R, D } = this, B = D.balance;
    this.jobNo++; this.time = 0;
    this.order = [...this.order, ...this.waiting.filter((id) => !this.order.includes(id))].slice(0, 4); this.waiting = [];
    this.world = makeWorld(R); this.signals = new Signals(D.signals.types); this.mess = new Mess(this.signals, B);
    this.place = buildPlace(R, this.world, D.place);
    this.things = new Things(R, this.world, this.signals, D.things, { mess: this.mess, spots: D.place.events, balance: B });
    this.things.onSound = (name, p) => this.emit({ k: 'sound', name, x: p?.x, z: p?.z });
    this.things.announce = (text) => this.emit({ k: 'announce', text, title: 'Tannoy' });
    spawnThings(this.place, this.things);
    this.people = new People(R, this.world, this.place, D.grownups, { signals: this.signals, mess: this.mess, things: this.things.list });
    this.sus = new Suspicion(B);
    this.closing = new ClosingTime(R, this.world, this.place, B, { nav: this.people.nav });
    this.security = new Security({ people: this.people, closing: this.closing, suspicion: this.sus, place: this.place, balance: B });
    this.rescue = new Rescue({ R, world: this.world, place: this.place, people: this.people, balance: B, solo: this.order.length <= 1, suspicion: this.sus });
    this.loot = new Loot(this.place, D.loot, B); this.job = new Job(this.place, B);
    this.gadgets = new Gadgets(D.gadgets, { R, world: this.world, signals: this.signals, things: this.things, people: this.people, sus: this.sus, balance: B });
    this.jobEvents = new JobEvents(D.events.events, { signals: this.signals, things: this.things, spots: D.place.events, say: (text, title) => { this.emit({ k: 'announce', text, title }); this.emit({ k: 'sound', name: 'tannoy_ding' }); } }, B.events);
    this.map = new TeamMap(this.place, D.crayonmap);
    this.jobEvents.onFire = (e, at) => this.map.note(e.name, at);
    this.players = [];
    for (const id of this.order) this.spawnPlayer(id);
    this.emit({ k: 'newJob', job: this.jobNo });
  }

  spawnPlayer(id) {
    const D = this.place.data, i = this.players.length, [sx, sz] = D.spawns.players[i % D.spawns.players.length], B = this.D.balance;
    const coat = new Coat(this.R, this.world, this.signals, B, [sx, 0, sz], KIDS[i % 4], { mess: this.mess });
    coat.floorZones = this.place.slippery; coat.pid = id; coat.slot = i;
    coat.bounds = { x0: D.bounds[0] + 1, z0: D.bounds[1] + 1, x1: D.bounds[2] - 1, z1: D.bounds[3] - 1 };
    const hands = new Hands(coat, this.things, B); hands.loot = this.loot; hands.rescue = this.rescue;
    this.gadgets.arm(coat);
    const p = { id, coat, hands, input: NO_INPUT, seen: {}, events: [] };
    this.players.push(p);
    return p;
  }

  // a player wants in: straight away early in a job (or as the first player), otherwise at the next job
  addPlayer(id) {
    if (this.order.includes(id) || this.waiting.includes(id)) return this.player(id) ? 'playing' : 'waiting';
    if (this.order.length + this.waiting.length >= 4) return 'full';
    if (!this.players.length || this.time < this.joinWindow) { this.order.push(id); this.spawnPlayer(id); this.rescue.solo = this.order.length <= 1; this.emit({ k: 'announce', text: `Player ${this.order.length} joined!`, title: 'Hello' }); return 'playing'; }
    this.waiting.push(id); this.emit({ k: 'announce', text: 'A friend is waiting to join: they come in at the next job.', title: 'Hello' });
    return 'waiting';
  }

  removePlayer(id) {
    this.waiting = this.waiting.filter((w) => w !== id); this.order = this.order.filter((w) => w !== id);
    const p = this.player(id); if (!p) return;
    p.coat.walker.collider.setEnabled(false); p.coat.walker.body.setTranslation({ x: 0, y: -50, z: 0 }, true);
    this.players = this.players.filter((q) => q !== p);
    this.emit({ k: 'announce', text: 'A friend left.', title: 'Bye' });
  }

  // input: { move: {x, z} world, aim: {x, z} | null, run, use, natural, presses: { grab, throw, stack, slot1, slot2, slot3, switch } counters,
  //         map: the crayon map is open, sc: scribbles not yet acknowledged (each with the player's own sid) }
  // presses are counters (they only ever go up), so a press is never lost between network packets
  setInput(id, input) { const p = this.player(id); if (p) p.input = input; }
  pressed(p, name) { const n = p.input.presses?.[name] ?? 0, was = p.seen[name] ?? 0; if (n > was) { p.seen[name] = n; return true; } return false; }

  emit(e) { this.out.push(e); }
  take() { const e = this.out; this.out = []; return e; }

  step(dt = STEP) {
    const B = this.D.balance, coats = this.coats;
    this.time += dt;
    this.rescue.step(coats);
    this.people.step(dt, coats);
    for (const p of this.players) {
      const c = p.coat, I = p.input, h = p.hands;
      for (const sc of I.sc || []) this.map.add(p.id, sc, c.slot);
      // with the map open the coat stands still behind a big sheet of paper
      c.mapOpen = !!I.map && !c.inCage && !c.hidden;
      if (this.pressed(p, 'stack')) c.toggleStack();
      let grab = this.pressed(p, 'grab');
      if (grab && c.atGate && !this.job.over) { this.finish('got away'); grab = false; }
      const sel = this.pressed(p, 'slot1') ? 0 : this.pressed(p, 'slot2') ? 1 : this.pressed(p, 'slot3') ? 2 : null;
      this.gadgets.use(c, dt, { fire: I.use && !h.held && !c.mapOpen, select: sel, cycle: this.pressed(p, 'switch') ? 1 : 0, aim: I.aim });
      h.step(dt, { grab, throwIt: this.pressed(p, 'throw'), use: I.use, natural: I.natural, aim: I.aim });
      c.step(dt, c.mapOpen ? STILL : I.move, I.run && !c.mapOpen, I.aim, I.natural);
      p.events.push(...c.events);
      for (const e of h.events) if (e.type === 'throw') this.sus.instant(this.people, c, B.suspicion.throw);
    }
    this.sus.step(dt, this.people, coats);
    this.closing.step(dt); this.security.step(); this.gadgets.step(dt, coats);
    this.loot.step(dt, coats); this.job.step(dt);
    this.map.step(dt, { coats: coats.filter((c) => !c.inCage), people: this.people, nav: this.people.nav, solo: this.order.length <= 1, closing: this.closing, caretaker: this.security.caretaker });
    if (!this.job.over && !this.closing.endedJob && this.closing.next >= this.closing.sections.length) { this.closing.endedJob = true; this.finish('shut in'); }
    for (const p of this.players) p.hands.carry();
    this.world.step();
    for (const p of this.players) { const c = p.coat; c.events = []; c.checkHits(this.world); p.events.push(...c.events); }
    this.things.step(dt); this.signals.flush(dt); this.mess.step(dt); this.jobEvents.step(dt);
    this.present();
  }

  finish(why) { if (!this.job.over) { this.job.finish(why, this.loot, this.sus); this.emit({ k: 'result', result: this.job.result }); } }

  // turn what happened into things to see and hear (the same list goes to every screen)
  present() {
    const S = this.D.balance;
    for (const p of this.players) { for (const e of p.events) if (['spill', 'hit', 'restack', 'unstack', 'stumble', 'effect'].includes(e.type)) this.emit({ k: 'coat', pid: p.id, type: e.type }); p.events = []; }
    for (const e of this.people.take()) {
      if (e.type === 'say' && e.clip) this.emit({ k: 'say', who: e.who.id, clip: e.clip, x: e.who.feet.x, z: e.who.feet.z });
      if (e.type === 'slip') this.emit({ k: 'sound', name: 'slip_whee', x: e.who.feet.x, z: e.who.feet.z });
    }
    for (const e of this.sus.take()) {
      if (e.type === 'bust') this.emit({ k: 'shout', who: e.who.id, text: "THAT'S NOT A GROWN-UP!" });
      if (e.type === 'heat') this.emit({ k: 'announce', text: ['', 'People are starting to stare.', 'Security has been called!', 'PANIC! The front doors are locked!'][e.level], title: `Heat ${e.level}: ${S.heat.names[e.level]}` });
    }
    for (const e of this.security.take()) {
      if (e.type === 'caretaker') { this.emit({ k: 'announce', text: e.why === 'closing' ? 'The Caretaker is doing his rounds. Get out!' : 'Someone has called the Caretaker!', title: 'Uh oh' }); this.emit({ k: 'shout', who: this.security.caretaker.id, text: "Right. Who's still in here?", sec: 3 }); }
      if (e.type === 'start') { this.map.note('Closing Time!', this.place.data.getaway.at); this.emit({ k: 'announce', text: 'Closing Time! The shutters are coming down, section by section.', title: 'Tannoy' }); this.emit({ k: 'sound', name: 'tannoy_ding' }); }
      if (e.type === 'warn') this.emit({ k: 'announce', text: `${e.section.name} closes in ${S.closingTime.warn} seconds!`, title: 'Tannoy' });
      if (e.type === 'shut') this.emit({ k: 'sound', name: 'machine_clunk' });
    }
    const g = this.rescue.gateAt;
    for (const e of this.rescue.take()) {
      if (e.type === 'spareKid') this.emit({ k: 'announce', text: `Caught! A Spare Kid comes in at the entrance (${e.left} left). Your kid is in the Lost & Found in the staff room.`, title: 'Got you!' });
      if (e.type === 'caught') this.emit({ k: 'announce', text: 'Caught! Off to the Lost & Found. A friend can get you out.', title: 'Got you!' });
      if (e.type === 'locked') this.emit({ k: 'sound', name: 'machine_clunk', x: g.x, z: g.z });
      if (e.type === 'gateOpen') { this.emit({ k: 'sound', name: 'switch_click', x: g.x, z: g.z }); this.emit({ k: 'announce', text: 'The Lost & Found is open: everyone out!', title: 'Rescue' }); }
      if (e.type === 'allCaught') this.finish('all caught');
    }
    for (const e of this.loot.take()) {
      const at = e.coat ? e.coat.walker.feet : { x: e.item.x, z: e.item.z };
      if (e.type === 'pocket' || e.type === 'carry' || e.type === 'coCarry') this.emit({ k: 'sound', name: 'paper_flap', x: at.x, z: at.z });
      if (e.type === 'bank') this.emit({ k: 'sound', name: 'pose_ding', x: at.x, z: at.z });
      if (e.type === 'drop') this.emit({ k: 'sound', name: 'box_thud', x: at.x, z: at.z });
    }
    for (const e of this.gadgets.take()) {
      if (e.type === 'fire' && e.sound) this.emit({ k: 'sound', name: e.sound, x: e.at.x, z: e.at.z });
      if (e.type === 'hit') this.emit({ k: 'sound', name: 'bonk', x: e.at.x, z: e.at.z });
      if (e.type === 'trigger') this.emit({ k: 'sound', name: 'slip_whee', x: e.at.x, z: e.at.z });
    }
  }

  // what E does for this player right now (shown at the bottom of their screen)
  hint(id) {
    const p = this.player(id); if (!p) return '';
    if (p.coat.atGate && !this.job.over) return `E: get away! (${this.loot.bankedValue} sweets banked; this ends the job)`;
    return p.hands.hint();
  }

  get lightsOff() { return this.things.list.some((t) => t.def.use?.toggles === 'lights' && t.state === 'off'); }

  // test keys (host only)
  test(key, id) {
    const p = this.player(id) ?? this.players[0]; if (!p) return;
    const c = p.coat, a = p.input.aim || { x: 0, z: -1 }, f = c.walker.position;
    if (key === 'melon') { const m = this.things.spawn('melon', [f.x + a.x, 0.3, f.z + a.z]); m.body.setLinvel({ x: 7 * a.x, y: 0, z: 7 * a.z }, true); }
    if (key === 'puddle') this.signals.emit({ type: 'slippery', position: { x: f.x + a.x * 2, y: 0, z: f.z + a.z * 2 }, range: 1.4 });
    if (key === 'whack') c.hit(8);
    if (key === 'event' && this.jobEvents.upcoming) this.jobEvents.fire(this.jobEvents.upcoming.id);
    if (key === 'heat') this.sus.addHeat(1, 'test key');
    if (key === 'closing') this.closing.start();
  }
}
