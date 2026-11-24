// Input from data/controls.json: keyboard, mouse and gamepad (twin-stick).
// The browser feeds raw events in (attach); the game reads a clean state each frame:
//   input.update()                          once per frame
//   input.move  -> {x, y}  screen-space, -1..1 (y up = away from the camera)
//   input.aim   -> {mode:'mouse', sx, sy} (pixels) or {mode:'stick', x, y} or null
//   input.down('run'), input.pressed('grab')  (pressed = this frame only)
//   input.device -> 'keys' or 'pad'  (whichever was used last)
// Raw state can also be set directly, which is how the logic tests drive it.
// keys typed into a text box (the room code, say) belong to the box, not the game
export const onPanel = (el) => !!el?.closest?.('button, input, select, textarea, a, #net, #startcard, #results, #shop');
export const typingIn = (el) => !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);

export class Input {
  constructor(cfg, padIndex = 0) {
    this.cfg = cfg; this.padIndex = padIndex;
    this.keys = new Set(); this.mouse = new Set(); this.wheel = 0;
    this.tapKeys = new Set(); this.tapMouse = new Set();     // pressed since the last frame (a quick tap still counts on a slow frame)
    this.mx = 0; this.my = 0; this.mouseMoved = false;
    this.pad = null;               // {axes:[], buttons:[{pressed, value}]} like navigator.getGamepads()
    this.prev = new Set(); this.now = new Set();
    this.move = { x: 0, y: 0 }; this.aim = null; this.device = 'keys';
  }

  attach(target = globalThis) {
    const keyOwned = new Set(Object.values(this.cfg.actions).flatMap((a) => a.keys || []).concat(Object.values(this.cfg.move.keys).flat()));
    target.addEventListener('keydown', (e) => { if (typingIn(e.target)) return; if (keyOwned.has(e.code)) e.preventDefault(); this.keys.add(e.code); this.tapKeys.add(e.code); this.device = 'keys'; });
    target.addEventListener('keyup', (e) => this.keys.delete(e.code));
    target.addEventListener('blur', () => { this.keys.clear(); this.mouse.clear(); });
    target.addEventListener('mousemove', (e) => { this.mx = e.clientX; this.my = e.clientY; this.mouseMoved = true; this.device = 'keys'; });
    // a click on a button or box on the page (Host, Join, the code box...) is not a shot (M1-F11)
    target.addEventListener('mousedown', (e) => { if (onPanel(e.target)) return; this.mouse.add(e.button); this.tapMouse.add(e.button); this.device = 'keys'; });
    target.addEventListener('mouseup', (e) => this.mouse.delete(e.button));
    target.addEventListener('contextmenu', (e) => e.preventDefault());
    target.addEventListener('wheel', (e) => { this.wheel += Math.sign(e.deltaY); }, { passive: true });
    this.readPads = () => (globalThis.navigator?.getGamepads?.() || [])[this.padIndex] || null;
    return this;
  }

  update() {
    if (this.readPads) this.pad = this.readPads();
    const c = this.cfg, dz = c.deadzone, pad = this.pad;
    const btn = (i) => !!pad?.buttons?.[i] && (pad.buttons[i].pressed || pad.buttons[i].value > 0.5);
    const stick = (ax) => { const x = pad?.axes?.[ax[0]] ?? 0, y = pad?.axes?.[ax[1]] ?? 0, m = Math.hypot(x, y); return m < dz ? null : { x, y, m }; };

    // move: keys, or the left stick (which wins while it is pushed)
    const k = c.move.keys, has = (list) => list.some((code) => this.keys.has(code));
    let mx = (has(k.right) ? 1 : 0) - (has(k.left) ? 1 : 0), my = (has(k.up) ? 1 : 0) - (has(k.down) ? 1 : 0);
    const kl = Math.hypot(mx, my); if (kl > 1) { mx /= kl; my /= kl; }
    const ls = stick(c.move.padAxes);
    if (ls) { const s = Math.min(1, (ls.m - dz) / (1 - dz)) / ls.m; mx = ls.x * s; my = -ls.y * s; this.device = 'pad'; }
    this.move = { x: mx, y: my };

    // aim: the right stick when pushed, otherwise the mouse (if it has been used)
    const rs = stick(c.aim.padAxes);
    if (rs) { this.aim = { mode: 'stick', x: rs.x / rs.m, y: -rs.y / rs.m }; this.device = 'pad'; }
    else if (this.device === 'pad') this.aim = null;                      // keep facing the way you walk
    else if (this.mouseMoved) this.aim = { mode: 'mouse', sx: this.mx, sy: this.my };

    // actions
    this.prev = this.now; this.now = new Set();
    for (const [name, a] of Object.entries(c.actions)) {
      const on = (a.keys || []).some((code) => this.keys.has(code) || this.tapKeys.has(code)) || (a.mouse || []).some((b) => this.mouse.has(b) || this.tapMouse.has(b)) || (a.pad || []).some(btn);
      if ((a.pad || []).some(btn)) this.device = 'pad';
      if (on) this.now.add(name);
    }
    if (this.wheel) { this.now.add('switch'); this.wheel = 0; }
    this.tapKeys.clear(); this.tapMouse.clear();
  }

  down(name) { return this.now.has(name); }
  pressed(name) { return this.now.has(name) && !this.prev.has(name); }
}
