// One job: the briefing (target and quota), the clock, and the sums at the end.
//   The loot you banked at the getaway gate × the Heat multiplier: a Clean Job (Heat 0 at the end) gets
//   +50%; otherwise the Chaos Bonus for the Heat you ended on (×1, ×1.2, ×1.5, ×2 from data).
//   Missing the quota does not end the run.
//   moneyLine: the one money line the HUD and the getaway gate both show ("Banked 42 · Holding 15 ·
//   Quota 150"), raw sweets; the bonus only shows on the results screen.
export function moneyLine(loot, job) {
  const banked = Math.round(loot.bankedValue), holding = Math.round(loot.inHand()), quota = job?.quota ?? 0;
  return { banked, holding, quota, text: `Banked ${banked} · Holding ${holding} · Quota ${quota}` };
}

// what job n of a run (0 = the first) asks for: the place's job, then its jobs list in turn; each time round the
// list the quota goes up (M1-F11: the second job used to be a copy of the first)
export function jobBrief(placeData, n = 0) {
  const list = [placeData.job, ...(placeData.jobs?.list ?? [])].filter(Boolean);
  if (!list.length) return { target: '', quota: 0, n };
  const { _about, ...base } = list[n % list.length], round = Math.floor(n / list.length);
  return { ...base, n, quota: base.quota + round * list.length * (placeData.jobs?.quotaStep ?? 0) };
}

export function jobResult({ banked, heat, quota, balance }) {
  const clean = heat === 0, mult = clean ? 1 + balance.job.cleanBonus : balance.heat.chaosBonus[heat];
  const total = Math.round(banked * mult);
  return { banked, heat, clean, mult, bonusName: clean ? 'Clean Job' : heat > 0 ? 'Chaos Bonus' : '', total, quota, met: total >= quota, short: Math.max(0, quota - total) };
}

export class Job {
  constructor(place, balance, brief = jobBrief(place.data)) {
    this.B = balance; this.brief = brief; this.target = brief.target ?? ''; this.quota = brief.quota ?? 0;
    this.time = 0; this.over = false; this.result = null; this.why = '';
  }

  step(dt) { if (!this.over) this.time += dt; }

  // the job ends: everyone got away, or the shop shut with you inside
  finish(why, loot, sus) {
    if (this.over) return this.result;
    this.over = true; this.why = why;
    this.result = { ...jobResult({ banked: loot.bankedValue, heat: sus?.level ?? 0, quota: this.quota, balance: this.B }), why, time: this.time, items: loot.banked.map((it) => ({ name: it.name, value: it.value, base: it.base })) };
    return this.result;
  }
}
