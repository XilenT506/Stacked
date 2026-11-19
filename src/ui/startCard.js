// The start card before the first job: the goal in one sentence, the 6 keys that matter (or the gamepad
// buttons, if a pad is plugged in) and "press any key". Any key, click or pad button closes it (keys typed
// into the Online panel's code box and clicks on that panel don't). Playing alone, the job waits for it;
// main.js swallows the key or click that closed it, so pressing R to start does not also unstack.
import { typingIn } from '../core/input.js';

export class StartCard {
  constructor(el, cfg, goal) {
    this.el = el; this.cfg = cfg; this.goal = goal; this.open = true; this.pad = null;
    const close = (e) => { if (!this.open || typingIn(e.target) || e.target?.closest?.('#net')) return; this.close(); };
    addEventListener('keydown', close, true); addEventListener('pointerdown', close, true);
    this.draw(false);
  }

  draw(pad) {
    if (pad === this.pad) return; this.pad = pad;
    const C = this.cfg;
    this.el.innerHTML = `<h1>${C.title}</h1><p class="goal">${this.goal}</p>
      <table>${C.keys.map((k) => `<tr><td><kbd>${pad ? k.pad : k.keys}</kbd></td><td>${k.what}</td></tr>`).join('')}</table>
      <p class="go">${pad ? C.go.pad : C.go.keys}</p>`;
    this.el.style.display = 'block';
  }

  // every frame while open: switch to the pad version when a pad is there; any pad button closes it
  update(pads) {
    if (!this.open) return false;
    const pad = [...(pads || [])].find(Boolean);
    this.draw(!!pad);
    if (pad) { const down = pad.buttons.some((b) => b.pressed); if (down && this.padReleased) this.close(); this.padReleased = !down; }
    return this.open;
  }

  close() { if (!this.open) return; this.open = false; this.el.style.display = 'none'; this.onClose?.(); }
}
