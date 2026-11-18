// The HUD: the top line (place, fps, keys), three heads and the wobble bar, the area and height label,
// a hint for what E does here, and tannoy announcements across the top of the screen.
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
  status(sus, closing) {
    if (!sus) { this.heatEl.style.display = this.closeEl.style.display = 'none'; return; }
    this.heatEl.style.display = this.closeEl.style.display = 'block';
    const colors = ['#7fbf5f', '#e0a83a', '#e07a3a', '#c4553d'];
    this.heatEl.innerHTML = `<b>HEAT</b> ${[0, 1, 2].map((i) => `<span class="pip" style="background:${i < sus.level ? colors[sus.level] : '#fff'}"></span>`).join('')} <span style="color:${colors[sus.level]}">${sus.name}</span>`;
    const t = closing.startsIn, mm = Math.floor(t / 60), ss = String(Math.floor(t % 60)).padStart(2, '0');
    const left = closing.sections.length - closing.next;
    this.closeEl.textContent = !closing.started ? `Closing Time in ${mm}:${ss}` : left > 0 ? `CLOSING TIME! ${left} section${left > 1 ? 's' : ''} still open` : 'CLOSING TIME! The shop is shut';
    this.closeEl.className = closing.started ? 'urgent' : '';
  }

  // the gadget slots, bottom right: name, ammo, the one in hand, and the slingshot's charge
  gadgets(coat, data) {
    const G = coat.gadgets, el = this.gadEl ??= document.getElementById('gadgets');
    if (!G) { el.style.display = 'none'; return; }
    el.style.display = 'block';
    const html = G.slots.map((id, i) => { const d = data.gadgets[id], cur = i === G.i;
      const charge = cur && d.charge ? `<div class="charge"><div style="width:${Math.min(100, G.charge / d.charge.full * 100)}%"></div></div>` : '';
      return `<div class="slot${cur ? ' cur' : ''}"><b>${i + 1}</b> ${d.name} <span>${G.ammo[id]}</span>${charge}</div>`; }).join('');
    if (html !== this.lastGad) { el.innerHTML = html; this.lastGad = html; }
    this.blindEl ??= document.getElementById('blind');
    this.blindEl.style.opacity = (coat.effects?.blinded ?? 0) > 0 ? 0.85 : 0;
  }

  top(text) { this.topEl.textContent = text; }

  announce(text, title = 'Tannoy') {
    this.annEl.innerHTML = `<b>${title}:</b> “${text}”`; this.annEl.style.opacity = 1; this.annT = 4.5;
  }

  update(dt, coat, ev, area, hint) {
    if (ev.some((e) => e.type === 'spill' || e.type === 'hit')) this.shake = 0.4;
    this.shake = Math.max(0, this.shake - dt);
    const ids = coat.pile ? [...coat.pile.kids, ...coat.stack] : [...coat.stack, ...coat.loose.map((k) => k.id)];
    this.heads.innerHTML = ids.map((id) => {
      const out = coat.loose.some((k) => k.id === id), hid = coat.pile?.kids.includes(id);
      return `<span class="head${out ? ' out' : ''}${hid ? ' hid' : ''}" style="background:#${KID_COLORS[id].toString(16).padStart(6, '0')}"></span>`;
    }).join('');
    this.bar.style.width = (coat.wobble * 100).toFixed(1) + '%';
    this.bar.style.background = coat.wobble > 0.75 ? '#c4553d' : coat.wobble > 0.45 ? '#e0a83a' : '#7fbf5f';
    this.bar.parentElement.style.transform = this.shake ? `translateX(${Math.sin(this.shake * 80) * 4}px)` : '';
    const hidden = coat.hidden ? ` · hidden (${{ inside: 'in a box', pose: 'posing', stand: 'standing still', shopping: 'on the belt' }[coat.hidden.mode] || coat.hidden.mode})` : '';
    this.label.textContent = (area ? area.name + ' · ' : '') + (coat.pile ? 'Just a kid (the coat is on the floor: R there to stack up)'
      : coat.state.label + (coat.loose.length ? ` · ${coat.loose.length} kid${coat.loose.length > 1 ? 's' : ''} loose! walk over them` : '')) + hidden;
    this.hintEl.textContent = hint || ''; this.hintEl.style.opacity = hint ? 1 : 0;
    this.annT -= dt; if (this.annT <= 0) this.annEl.style.opacity = 0;
  }
}
