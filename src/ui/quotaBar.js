// The quota bar, top middle of the HUD (M1-F3): one money line, the same one the getaway gate shows
// ("Banked 42 · Holding 15 · Quota 150"), over a bar with banked sweets (gold) and sweets in hand (pale)
// against the quota. The Clean Job / Chaos bonus only shows on the results screen.
import { moneyLine } from '../systems/job.js';

export function quotaHtml(job, loot) {
  const m = moneyLine(loot, job), q = m.quota || 1;
  const w1 = Math.min(100, m.banked / q * 100), w2 = Math.min(100 - w1, m.holding / q * 100);
  return `<div class="qt">Banked <b>${m.banked}</b> · Holding <span>${m.holding}</span> · Quota ${m.quota}</div><div class="qb"><div style="width:${w1}%"></div><div class="hand" style="width:${w2}%"></div><i></i></div>`;
}
