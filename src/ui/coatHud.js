// The HUD: the top line (place, fps, keys), three heads and the wobble bar, the area and height label,
// a hint for what E does here, and tannoy announcements across the top of the screen.
import { KID_COLORS } from '../render/coatView.js';

export class CoatHud {
  constructor() {
    this.topEl = document.getElementById('hud');
    this.heads = document.getElementById('heads'); this.bar = document.getElementById('wobble'); this.label = document.getElementById('height');
    this.hintEl = document.getElementById('hint'); this.annEl = document.getElementById('announce');
    this.shake = 0; this.annT = 0;
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
