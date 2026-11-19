// A run, and Dodgy Del's stall in the alley between two jobs.
//   Run: the team's sweet jar (banked loot with its bonus from each job goes in) and what each player
//   carries from job to job: their gadgets (a second copy doubles the ammo) and their fizzy drinks.
//   Everyone caught at once ends the run: the jar empties and everyone starts again with the starters.
//   Shop: 6 things on the pram (4 gadgets from the pool plus the 2 drinks), sweets from the jar as money,
//   a reroll that gets dearer each time, and Next when everyone is ready. All prices: balance.json shop.
// Players send orders ({ sid, a: 'buy' | 'reroll' | 'ready', i }) that repeat until acknowledged (online).

export class Run {
  constructor(D) { this.D = D; this.S = D.balance.shop; this.no = 0; this.start(); }

  start() { this.no++; this.sweets = this.S.startSweets ?? 0; this.jobs = 0; this.kit = new Map(); }

  // what a player carries: { gadgets: [{ id, copies }], drinks: [id] }
  of(pid) {
    if (!this.kit.has(pid)) this.kit.set(pid, { gadgets: this.D.gadgets.loadout.slots.map((id) => ({ id, copies: 1 })), drinks: [] });
    return this.kit.get(pid);
  }

  earn(result) { this.jobs++; this.sweets += Math.max(0, result?.total ?? 0); }
}

// a small repeatable random number generator, so the stock is the same in a test every time
const rng = (seed) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

export class Shop {
  constructor(D, run, { seed = 1, players = [] } = {}) {
    this.D = D; this.S = D.balance.shop; this.run = run; this.rnd = rng(seed + run.no * 977 + run.jobs * 131);
    this.rerolls = 0; this.ready = new Set(); this.acks = new Map(); this.players = players; this.log = [];
    this.joke = D.shop.jokes[Math.floor(this.rnd() * D.shop.jokes.length)];
    this.say = this.joke; this.stock = []; this.fill();
  }

  price(id) { return this.S.prices[id]; }
  get rerollPrice() { return this.S.reroll.base + this.S.reroll.step * this.rerolls; }

  // 4 different gadgets from the pool (anything with a price), then the drinks
  fill() {
    const pool = Object.keys(this.D.gadgets.gadgets).filter((id) => this.price(id) !== undefined);
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(this.rnd() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    const gadgets = pool.slice(0, this.S.stock.gadgets).map((id) => ({ id, kind: 'gadget', left: 1 }));
    const drinks = this.stock.filter((s) => s.kind === 'drink');
    this.stock = [...gadgets, ...(drinks.length ? drinks : this.S.stock.drinks.map((id) => ({ id, kind: 'drink', left: this.S.stock.drinksEach })))];
  }

  // one player's order. Returns what happened (for Del's reply and the sound), or null for a repeat
  order(pid, o) {
    if (!o || (this.acks.get(pid) ?? 0) >= o.sid) return null;
    this.acks.set(pid, o.sid);
    const r = this.act(pid, o); this.log.push({ pid, ...r }); if (this.log.length > 12) this.log.shift();
    const L = this.D.shop.lines[r.ok ? r.a : r.why];
    if (L) this.say = L[Math.floor(this.rnd() * L.length)];
    return r;
  }

  act(pid, o) {
    if (o.a === 'ready') { if (this.ready.has(pid)) this.ready.delete(pid); else this.ready.add(pid); return { a: 'ready', ok: true }; }
    if (o.a === 'reroll') {
      const cost = this.rerollPrice;
      if (this.run.sweets < cost) return { a: 'reroll', ok: false, why: 'poor' };
      this.run.sweets -= cost; this.rerolls++; this.fill();
      return { a: 'reroll', ok: true, cost };
    }
    if (o.a !== 'buy') return { a: o.a, ok: false, why: 'what' };
    const s = this.stock[o.i];
    if (!s || s.left <= 0) return { a: 'buy', ok: false, why: 'gone' };
    const cost = this.price(s.id), kit = this.run.of(pid);
    if (this.run.sweets < cost) return { a: 'buy', ok: false, why: 'poor', id: s.id };
    if (s.kind === 'gadget') {
      const have = kit.gadgets.find((g) => g.id === s.id);
      if (have ? have.copies >= this.S.maxCopies : kit.gadgets.length >= this.S.maxGadgets) return { a: 'buy', ok: false, why: 'got', id: s.id };
      if (have) have.copies++; else kit.gadgets.push({ id: s.id, copies: 1 });
    } else {
      if (kit.drinks.length >= this.S.maxDrinks) return { a: 'buy', ok: false, why: 'got', id: s.id };
      kit.drinks.push(s.id);
    }
    s.left--; this.run.sweets -= cost;
    return { a: 'buy', ok: true, id: s.id, cost };
  }

  // everyone still in the game has pressed Next
  allReady(ids) { return ids.length > 0 && ids.every((id) => this.ready.has(id)); }
}
