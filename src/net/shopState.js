// The run and Dodgy Del's shop over the network: the host sends the sweet jar, what everyone carries and
// (between jobs) the stall; the client gets objects shaped like Run and Shop so the same screens draw them.
export function runState(game) {
  const R = game.run, S = game.shop;
  const o = { ph: game.phase, run: [R.sweets, R.no, R.jobs], kit: Object.fromEntries([...R.kit].map(([id, k]) => [id, [k.gadgets.map((g) => [g.id, g.copies]), k.drinks]])) };
  if (S) o.shop = { st: S.stock.map((s) => [s.id, s.kind, s.left]), rr: S.rerolls, rd: [...S.ready], ack: Object.fromEntries(S.acks), say: S.say };
  return o;
}

export class MirrorRun {
  constructor(D) { this.D = D; this.sweets = 0; this.no = 1; this.jobs = 0; this.kit = new Map(); }
  of(pid) { return this.kit.get(pid) ?? { gadgets: this.D.gadgets.loadout.slots.map((id) => ({ id, copies: 1 })), drinks: [] }; }
  apply(o) {
    [this.sweets, this.no, this.jobs] = o.run;
    this.kit = new Map(Object.entries(o.kit).map(([id, [g, d]]) => [id, { gadgets: g.map(([gid, copies]) => ({ id: gid, copies })), drinks: d }]));
  }
}

export class MirrorShop {
  constructor(D) { this.S = D.balance.shop; this.stock = []; this.rerolls = 0; this.ready = new Set(); this.acks = new Map(); this.say = ''; }
  price(id) { return this.S.prices[id]; }
  get rerollPrice() { return this.S.reroll.base + this.S.reroll.step * this.rerolls; }
  apply(o) {
    this.stock = o.st.map(([id, kind, left]) => ({ id, kind, left })); this.rerolls = o.rr; this.ready = new Set(o.rd);
    this.acks = new Map(Object.entries(o.ack)); this.say = o.say;
  }
}
