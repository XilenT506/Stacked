// The HUD: the top line (place, fps, keys), three heads and the wobble bar, the area and height label,
// a hint for what E does here, and tannoy announcements across the top of the screen.
import { quotaHtml } from './quotaBar.js';
import { KID_COLORS } from '../render/coatView.js';

export class CoatHud {
  constructor() {
    this.topEl = document.getElementById('hud');
    this.heads = document.getElementById('heads'); this.bar = document.getElementById('wobble'); this.label = document.getElementById('height');
    this.hintEl = document.getElementById('hint'); this.annEl = document.getElementById('announce');
    this.shake = 0; this.annT = 0;
    this.heatEl = document.getElementById('heat'); this.closeEl = document.getElementById('closing');
  }

  // Heat (0 Calm .. 3 Panic) and the Closing Time clock, top right
  status(sus, closing, rescue = null) {
    if (!sus) { this.heatEl.style.display = this.closeEl.style.display = 'none'; return; }
    this.heatEl.style.display = this.closeEl.style.display = 'block';
    const colors = ['#7fbf5f', '#e0a83a', '#e07a3a', '#c4553d'];
    this.heatEl.innerHTML = `<b>HEAT</b> ${[0, 1, 2].map((i) => `<span class="pip" style="background:${i < sus.level ? colors[sus.level] : '#fff'}"></span>`).join('')} <span style="color:${colors[sus.level]}">${sus.name}</span>${rescue?.solo ? ` · Spare Kids ${'●'.repeat(rescue.spares)}${'○'.repeat(Math.max(0, rescue.B.spareKids - rescue.spares))}` : ''}`;
    const t = closing.startsIn, mm = Math.floor(t / 60), ss = String(Math.floor(t % 60)).padStart(2, '0');
    const left = closing.sections.length - closing.next;
    this.closeEl.textContent = !closing.started ? `Closing Time in ${mm}:${ss}` : left > 0 ? `CLOSING TIME! ${left} section${left > 1 ? 's' : ''} still open` : 'CLOSING TIME! The shop is shut';
    this.closeEl.className = closing.started ? 'urgent' : '';
  }

  // the team's Giggle meter, under Heat; it shakes during a Giggle Rush
  giggleMeter(g, max, rush) {
    const el = this.gigEl ??= document.getElementById('giggles');
    if (!g) { el.style.display = 'none'; return; }
    el.style.display = 'block'; el.className = rush ? 'rush' : '';
    const html = `<b>GIGGLES</b> ${g.total}${rush ? ' · <b>GIGGLE RUSH!</b>' : ''}<div class="gb"><div style="width:${Math.min(100, (g.meter / max) * 100)}%"></div></div>`;
    if (html !== this.lastGig) { el.innerHTML = html; this.lastGig = html; }
  }

  // a funny moment: big bouncy words in the middle of the screen
  giggle(e) {
    const el = this.popEl ??= document.getElementById('giggle');
    el.innerHTML = `${e.label}${e.giggles ? `<small>+${e.giggles} Giggles</small>` : ''}`;
    this.popT = 2.4;                                                      // drawn frame by frame in tickPop
  }

  // the shout pops in big, settles, then floats up and fades
  tickPop(dt) {
    const el = this.popEl; if (!el || !(this.popT > 0)) { if (el) el.style.opacity = 0; return; }
    this.popT -= dt; const age = 2.4 - this.popT;
    const scale = age < 0.15 ? 0.3 + (age / 0.15) * 0.9 : age < 0.3 ? 1.2 - ((age - 0.15) / 0.15) * 0.2 : 1;
    el.style.opacity = this.popT < 0.4 ? Math.max(0, this.popT / 0.4) : 1;
    el.style.transform = `translate(-50%, ${-50 - Math.max(0, 0.4 - this.popT) * 25}%) rotate(-4deg) scale(${scale})`;
  }

  // the gadget slots, bottom right: name, ammo, the one in hand, and the slingshot's charge
  gadgets(coat, data) {
    const G = coat.gadgets, el = this.gadEl ??= document.getElementById('gadgets');
    if (!G) { el.style.display = 'none'; return; }
    el.style.display = 'block';
    const html = G.slots.map((id, i) => { const d = data.gadgets[id], cur = i === G.i;
      const charge = cur && d.charge ? `<div class="charge"><div style="width:${Math.min(100, G.charge / d.charge.full * 100)}%"></div></div>` : '';
      return `<div class="slot${cur ? ' cur' : ''}"><b>${i + 1}</b> ${d.name} <span>${G.ammo[id]}</span>${charge}</div>`; }).join('');
    const drinks = (coat.drinks || []).map((id) => data.drinks?.[id]?.name ?? id);
    const all = html + (drinks.length ? `<div class="slot drink"><b>F</b> ${drinks.join(', ')}</div>` : '');
    if (all !== this.lastGad) { el.innerHTML = all; this.lastGad = all; }
    this.blindEl ??= document.getElementById('blind');
    this.blindEl.style.opacity = (coat.effects?.blinded ?? 0) > 0 ? 0.85 : 0;
  }

  // the quota bar, top middle (src/ui/quotaBar.js): the same money line as the getaway gate, no bonus
  quota(job, loot) {
    const el = this.quotaEl ??= document.getElementById('quota');
    if (!job) { el.style.display = 'none'; return; }
    el.style.display = 'block';
    const html = quotaHtml(job, loot);
    if (html !== this.lastQ) { el.innerHTML = html; this.lastQ = html; }
  }

  // the end of a job: what came out, the bonus, the total against the quota
  results(r, jar = null) {
    const el = this.resEl ??= document.getElementById('results');
    if (!r) { el.style.display = 'none'; return; }
    if (el.style.display === 'block') return;
    const next = r.why === 'all caught' ? 'The run is over: a new run starts in a moment.' : `Next: Dodgy Del's stall in the alley. Sweet jar: <b>${jar ?? r.total}</b>`;
    el.style.display = 'block';
    el.innerHTML = `<h2>${r.why === 'got away' ? 'You got away!' : r.why === 'all caught' ? 'Everyone got caught!' : 'Shut in at Closing Time!'}</h2>
      <ul>${r.items.map((i) => `<li>${i.name}<b>${i.value}${i.value < i.base ? ` <s>${i.base}</s>` : ''}</b></li>`).join('') || '<li>Nothing at all...</li>'}</ul>
      <p>Loot <b>${r.banked}</b> × ${r.mult} ${r.bonusName ? `(${r.bonusName}${r.clean ? '' : `, Heat ${r.heat}`})` : ''} = <b>${r.total}</b> sweets</p>
      ${r.giggles ? `<p class="gg">Giggles: ${r.giggles.total}</p><ul class="gg">${r.giggles.moments.map((m) => `<li>${m.label}${m.count > 1 ? ` ×${m.count}` : ''}<b>+${m.giggles}</b></li>`).join('') || '<li>No funny business. Suspicious.</li>'}</ul>` : ''}
      <p class="${r.met ? 'ok' : 'no'}">${r.met ? `Quota met! (${r.quota})` : `Quota missed by ${r.short} (needed ${r.quota}).`}</p>
      <p class="small">${next}</p>`;
  }

  top(text) { this.topEl.textContent = text; }

  announce(text, title = 'Tannoy') {
    this.annEl.innerHTML = `<b>${title}:</b> “${text}”`; this.annEl.style.opacity = 1; this.annT = 4.5;
  }

  update(dt, coat, ev, area, hint) {
    this.tickPop(dt);
    if (ev.some((e) => e.type === 'spill' || e.type === 'hit')) this.shake = 0.4;
    this.shake = Math.max(0, this.shake - dt);
    const ids = coat.pile ? [...coat.pile.kids, ...coat.stack] : [...coat.stack, ...coat.loose.map((k) => k.id)];
    this.heads.innerHTML = ids.map((id) => {
      const out = coat.loose.some((k) => k.id === id), hid = coat.pile?.kids.includes(id);
      return `<span class="head${out ? ' out' : ''}${hid ? ' hid' : ''}" style="background:#${(KID_COLORS[id] ?? 0xf2e6d8).toString(16).padStart(6, '0')}"></span>`;
    }).join('');
    this.bar.style.width = (coat.wobble * 100).toFixed(1) + '%';
    this.bar.style.background = coat.wobble > 0.75 ? '#c4553d' : coat.wobble > 0.45 ? '#e0a83a' : '#7fbf5f';
    this.bar.parentElement.classList.toggle('flash', coat.wobble > (this.flashAt ?? 0.8) && !coat.pile);
    this.bar.parentElement.style.transform = this.shake ? `translateX(${Math.sin(this.shake * 80) * 4}px)` : '';
    const hidden = coat.hidden ? ` · hidden (${{ inside: 'in a box', pose: 'posing', stand: 'standing still', shopping: 'on the belt' }[coat.hidden.mode] || coat.hidden.mode})` : '';
    this.label.textContent = (area ? area.name + ' · ' : '') + (coat.pile ? 'Just a kid (the coat is on the floor: R there to stack up)'
      : coat.state.label + (coat.loose.length ? ` · ${coat.loose.length} kid${coat.loose.length > 1 ? 's' : ''} loose! walk over them` : '')) + hidden;
    this.hintEl.textContent = hint || ''; this.hintEl.style.opacity = hint ? 1 : 0;
    this.annT -= dt; if (this.annT <= 0) this.annEl.style.opacity = 0;
  }
}
