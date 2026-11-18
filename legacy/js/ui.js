// Menu, on-screen text, touch controls and the end card. Plain DOM over the 3D canvas.
import { BANNERS, CFG } from './config.js';
import { endCard } from './game.js';
import { ERRANDS, MODS, objective, hint, hintAll, heldItem, ITEMS } from './errands.js';

const $ = (id) => document.getElementById(id);
const PART_NAME = { legs: 'Legs', arms: 'Arms', head: 'Head', kid: 'Kid' };
const SEES = { legs: 'You see the floor', arms: 'You see the hands and the counter', head: 'You see faces, signs and suspicion', kid: 'You are out of the coat' };
const KEYS = {
  legs: '<b>W S</b> walk &nbsp; <b>A D</b> turn &nbsp; hold <b>Shift</b> tiptoe &nbsp; <b>E</b> stride &nbsp; <b>Q</b> shuffle',
  arms: '<b>WASD</b> or <b>mouse</b> move hand &nbsp; <b>G</b> grab &nbsp; hold <b>C</b> wave &nbsp; <b>X</b> point &nbsp; <b>Z</b> pat pockets &nbsp; <b>F</b> other hand',
  head: '<b>WASD</b> or <b>mouse</b> look &nbsp; hold <b>N</b> nod &nbsp; <b>M</b> shake &nbsp; <b>E</b> eyebrows &nbsp; <b>H</b> tip hat &nbsp; <b>T</b> speak out loud &nbsp; <b>Enter</b> type a line',
  kid: '<b>WASD</b> run',
  // all-in-one: every part at once
  all: '<b>WASD</b> walk &nbsp; <b>Shift</b> tiptoe &nbsp; hold <b>G</b> reach &amp; grab &nbsp; <b>C</b> wave &nbsp; <b>N</b> nod &nbsp; <b>M</b> shake &nbsp; <b>H</b> tip hat &nbsp; <b>T</b> / <b>Enter</b> talk',
};
// touch buttons: [label, action, hold?]. The joystick does all the moving, so there are no direction buttons.
const TOUCH = {
  legs: [['Tiptoe', 'tip', 1], ['Stride', 'stride', 1], ['Shuffle', 'shuffle', 1]],
  arms: [['Grab', 'grab', 0], ['Wave', 'wave', 1], ['Point', 'point', 1], ['Pat pockets', 'pat', 0], ['Other hand', 'hand', 0]],
  head: [['Nod', 'nod', 1], ['Shake', 'shake', 1], ['Eyebrows', 'brow', 1], ['Tip hat', 'hat', 0], ['Talk', 'talk', 1]],
  kid: [],
};
// in the driving test the same keys do car things
const CAR = {
  keys: { all: '<b>W</b> gas &nbsp; <b>S</b> brake &nbsp; <b>A D</b> steer &nbsp; hold <b>Q</b> / <b>E</b> look in the mirrors &nbsp; <b>N</b> nod &nbsp; <b>T</b> / <b>Enter</b> chat', legs: '<b>W</b> gas &nbsp; <b>S</b> brake / reverse &nbsp; <b>K</b> keep the pedal held', arms: '<b>A D</b> or <b>mouse</b> turn the wheel (both hands on it)', head: '<b>A D</b> or <b>mouse</b> look (far left / right = mirrors) &nbsp; hold <b>N</b> nod &nbsp; <b>H</b> tip hat &nbsp; <b>T</b> / <b>Enter</b> chat to Mr Price' },
  sees: { legs: 'You see the road under the dashboard', arms: 'You see the wheel', head: 'You see Mr Price and the mirrors' },
};
const GAIT_NAME = ['Walking', 'Tiptoe: quiet, but sneaky', 'Striding: bold, but wobbly', 'Shuffling: steady, but odd'];

export class UI {
  constructor(input, handlers) {
    this.input = input; this.h = handlers; this.cache = {}; this.bannerT = 0; this.btnKey = ''; this.toastT = 0;
    $('solo').onclick = () => handlers.solo();
    $('host').onclick = () => handlers.host();
    $('joinform').addEventListener('submit', (e) => { e.preventDefault(); const c = $('code').value.trim().toUpperCase(); if (c.length === 4) handlers.join(c); else this.status('Type the 4-letter code your friend sees.', true); });
    $('again').onclick = () => handlers.again();
    $('next').onclick = () => handlers.next();
    $('share').onclick = async () => { const b = $('share'); b.disabled = true; b.textContent = 'Drawing...'; const r = await handlers.share(); b.disabled = false; b.textContent = r === 'saved' ? 'Saved!' : r === 'declined' ? 'Save picture' : 'Could not save'; };
    // which game: the story afternoon, endless survival, or one errand to practise
    this.mode = 'story';
    for (const b of document.querySelectorAll('#modes button')) b.onclick = () => { this.mode = b.dataset.mode; for (const x of document.querySelectorAll('#modes button')) x.setAttribute('aria-pressed', String(x === b)); $('practice').hidden = this.mode !== 'single'; this.dailyNote(); };
    const sel = $('practice'); for (const [k, d] of Object.entries(ERRANDS)) { const o = document.createElement('option'); o.value = k; o.textContent = d.name; sel.appendChild(o); }
    $('tomenu').onclick = $('quit').onclick = () => handlers.menu();
    $('mute').onclick = () => { const m = handlers.mute(); $('mute').textContent = m ? 'Sound: off' : 'Sound: on'; };
    this.#touch();
  }

  status(text, bad = false) { $('status').textContent = text; $('status').className = bad ? 'bad' : ''; }
  online(kind) {
    $('host').disabled = $('join').disabled = !kind;
    if (!kind) this.status('Online play is not available on this page. Solo works everywhere.');
    else this.status(kind === 'room' ? 'Online: friends who can open this page join with your code.' : 'Online: friends join with your code.');
  }
  show(what) { $('menu').hidden = what !== 'menu'; $('hud').hidden = what === 'menu'; $('end').hidden = what !== 'end'; }

  #set(id, html) { if (this.cache[id] !== html) { this.cache[id] = html; $(id).innerHTML = html; } }

  #touch() {
    const app = $('app'), stick = $('stick'), knob = stick.firstElementChild, inp = this.input;
    const enable = () => { if (!app.classList.contains('touch')) { app.classList.add('touch'); $('touch').hidden = false; inp.usedTouch = true; } };
    if (matchMedia('(pointer: coarse)').matches) enable();
    addEventListener('touchstart', enable, { passive: true });
    let sid = null;
    const moveStick = (e) => {
      const r = stick.getBoundingClientRect(), R = r.width / 2;
      let x = (e.clientX - r.left - R) / R, y = (e.clientY - r.top - R) / R;
      const m = Math.hypot(x, y); if (m > 1) { x /= m; y /= m; }
      knob.style.transform = `translate(${x * R * 0.55}px, ${y * R * 0.55}px)`;
      inp.setMove(Math.abs(x) < 0.15 ? 0 : x, Math.abs(y) < 0.15 ? 0 : -y);
    };
    stick.addEventListener('pointerdown', (e) => { sid = e.pointerId; inp.lastPress = performance.now(); try { stick.setPointerCapture(sid); } catch { /* not every pointer can be captured */ } moveStick(e); });
    stick.addEventListener('pointermove', (e) => { if (e.pointerId === sid) moveStick(e); });
    const end = (e) => { if (e.pointerId === sid) { sid = null; knob.style.transform = ''; inp.setMove(0, 0); } };
    stick.addEventListener('pointerup', end); stick.addEventListener('pointercancel', end);
    // dragging on the picture also aims: a second, optional way to move the hand or the eyes
    const cv = $('view'); let aid = null, lx = 0, ly = 0;
    cv.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse') return; aid = e.pointerId; lx = e.clientX; ly = e.clientY; });
    cv.addEventListener('pointermove', (e) => { if (e.pointerId !== aid) return; inp.addAim((e.clientX - lx) * 1.6, (e.clientY - ly) * 1.6); lx = e.clientX; ly = e.clientY; });
    const aend = (e) => { if (e.pointerId === aid) aid = null; };
    cv.addEventListener('pointerup', aend); cv.addEventListener('pointercancel', aend);
  }

  #buttons(part, ctx, scatter) {
    const list = [...(scatter ? (ctx.myKids > 1 ? [['Next kid', 'next', 0]] : []) : TOUCH[part] || [])];
    if (!scatter && part === 'legs' && ctx.canKeep) list.push([this.input.keep ? 'Keep walking: on' : 'Keep walking: off', 'keep', 0]);
    if (!scatter && part === 'legs' && ctx.lvl >= 3) list.push(['Periscope', 'scope', 1]);
    if (ctx.alley && !scatter) list.push(['Kid out / in', 'hop', 0], ['Swap places', 'swap', 0]);
    const key = list.map((l) => l[0]).join();
    if (key === this.btnKey) return; this.btnKey = key;
    const box = $('btns'); box.textContent = '';
    for (const [text, name, hold] of list) {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = text; b.dataset.act = name;
      if (name === 'keep' && this.input.keep) b.classList.add('on');
      if (hold) {
        const on = (v) => (e) => { e.preventDefault(); this.input.setHeld(name, v); b.classList.toggle('on', v); };
        b.addEventListener('pointerdown', on(true)); b.addEventListener('pointerup', on(false)); b.addEventListener('pointercancel', on(false)); b.addEventListener('pointerleave', on(false));
      } else b.addEventListener('pointerdown', (e) => { e.preventDefault(); this.input.press(name); });
      box.appendChild(b);
    }
  }

  // ctx: { part, parts, kid, alley, scatter, code, isHost, myKids, canKeep, lvl, cue }
  update(Wd, dt, ctx) {
    const part = ctx.part, scatter = Wd.phase === 'scatter';
    // objective
    let obj;
    const d = ERRANDS[Wd.errand.id], r = Wd.run;
    if (scatter) obj = Wd.scatterT > 0 ? `Run! Get every kid back to the alley. Grown-ups give up in ${Math.ceil(Wd.scatterT)}s.` : 'They gave up. Free anyone on the bench, then meet in the alley.';
    else if (Wd.phase === 'between') obj = `Errand done! Next: ${ERRANDS[r.list[r.list.length - 1]]?.name}.${r.added ? ' New: ' + r.added + '.' : ''}`;
    else obj = objective(Wd);
    const where = r.mode === 'story' ? `${d.name} &middot; errand ${r.idx + 1} of ${r.list.length}` : r.mode === 'survival' ? `Survival &middot; ${r.done} done &middot; ${r.scatters}/3 Scatters` : d.name;
    const mods = Wd.modList.length ? `<small class="mods">${Wd.modList.map((m) => MODS[m]?.name).join(' &middot; ')}</small>` : '';
    const all = this.input.all && !scatter;
    const tip = !scatter && Wd.phase === 'play' ? (all ? hintAll(Wd, ctx.parts) : hint(Wd, part)) : '';
    this.#set('objective', `<small>${scatter ? 'Scatter' : where}</small>${obj}${tip ? `<small class="hint">${all ? '' : part[0].toUpperCase() + part.slice(1) + ': '}${tip}</small>` : ''}${mods}`);
    // parts
    const avail = scatter || all ? [] : [...ctx.parts, ...(ctx.kid ? ['kid'] : [])];
    const pk = avail.join() + '|' + part;
    if (this.cache.parts !== pk) {
      this.cache.parts = pk; const box = $('parts'); box.textContent = '';
      for (const p of avail) {
        const b = document.createElement('button'); b.type = 'button'; b.textContent = PART_NAME[p]; b.setAttribute('aria-pressed', String(p === part));
        b.addEventListener('pointerdown', (e) => { e.preventDefault(); this.input.press(p); }); box.appendChild(b);
      }
    }
    this.#set('sees', scatter ? 'Tab switches kid' : all ? (ctx.parts.length === 3 ? 'You are the whole coat' : 'You are the ' + ctx.parts.join(' and ')) + ' &middot; P: peek' : (ctx.peek ? (ctx.car && CAR.sees[part] || SEES[part]) + ' &middot; P: back to the street view' : 'P: peek through your part\'s eyes') + (ctx.parts.length > 1 || ctx.kid ? ' &middot; Tab switches' : ''));
    // each part knows something the others do not
    let info = '';
    if (scatter) info = `${Math.ceil(Wd.scatterT)}s<small>until they give up</small>`;
    else if (part === 'head') { const left = Math.max(0, Math.ceil(Wd.clock)); info = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}<small>${Wd.run.mode === 'survival' ? 'until dinner' : 'before closing'}</small>`; }
    else if (ctx.car && part === 'legs') info = `${Math.abs(Wd.car.v * 10).toFixed(0)} mph<small>${Wd.car.v < -0.05 ? 'reversing' : Wd.body.stum ? 'the coat is wobbling!' : 'steady'}</small>`;
    else if (ctx.car && part === 'arms') info = `${Wd.car.wheel > 0.15 ? 'Turning right' : Wd.car.wheel < -0.15 ? 'Turning left' : 'Straight'}<small>the wheel</small>`;
    else if (ctx.car && part === 'head') info = `${Wd.car.slipT > 0 ? 'NOT LOOKING!' : Wd.car.ask > 0 ? 'Asked you something' : 'Watching'}<small>Mr Price</small>`;
    else if (part === 'arms') { const held = [0, 1].map((i) => heldItem(Wd, i)).filter(Boolean).map((it) => ITEMS[it.id].name); info = `${Wd.money} coins<small>${held.length ? 'holding ' + held.join(' and ') : 'empty hands'}</small>`; }
    else if (part === 'legs') info = `${Wd.body.stum ? 'Wobbly!' : 'Steady'}<small>${GAIT_NAME[Wd.ord.gait] || ''}</small>`;
    else info = `${Wd.money} coins<small>out of the coat</small>`;
    const next = CFG.levels[Wd.dis.lvl];
    info += `<small>Disguise level ${Wd.dis.lvl}${next ? ` &middot; ${Wd.dis.pts}/${next} points` : ''}</small>`;
    if (ctx.code) info += `<small>Room ${ctx.code} &middot; ${Wd.players.length} playing</small>`;
    this.#set('info', info);
    $('balance').style.visibility = part === 'legs' && !scatter ? 'visible' : 'hidden';
    if (part === 'legs') {
      const lx = Wd.body.lx / CFG.fallLean, lz = Wd.body.lz / CFG.fallLean, d = $('balance').firstElementChild;
      d.style.transform = `translate(${lx * 38}px, ${-lz * 38}px)`; d.style.background = Math.hypot(lx, lz) > 0.7 ? '#e2694f' : '#fff7ea';
    }
    // arms: is the thing in reach?
    const cue = !scatter && part === 'arms' ? ctx.cue : null;
    let cueText = '', cueClass = '';
    if (cue) {
      const verb = cue.kind === 'sign' ? 'Sign' : cue.kind === 'hold' ? 'Hold down' : 'Grab';
      const steady = Wd.errand.steady;
      if (cue.state === 'on') {
        cueText = cue.kind === 'sign' ? (steady ? 'On the line: slide the pen to the right' : 'On the line, but the form is sliding: hold it flat with the other hand')
          : cue.kind === 'hold' ? 'Holding the form flat: now sign with the other hand (F)' : `In reach: grab ${cue.name} now`;
        cueClass = cue.kind === 'sign' && !steady ? 'near' : 'on';
      }
      else if (cue.state === 'near') { cueText = this.input.all ? `${verb} ${cue.name}: hold G` : `${verb} ${cue.name}: move the hand to the glowing spot`; cueClass = 'near'; }
      else if (cue.state === 'other') { cueText = `${verb} ${cue.name} with the other hand`; cueClass = 'near'; }
      else { cueText = this.input.all ? `Too far from ${cue.name}: step closer` : `Too far from ${cue.name}: ask the legs to step closer`; cueClass = 'far'; }
    }
    if (this.cache.cue !== cueText) { this.cache.cue = cueText; const c = $('cue'); c.textContent = cueText; c.className = cueClass; c.hidden = !cueText; }
    const keep = ctx.canKeep ? ` &nbsp; <b>K</b> keep walking: ${this.input.keep ? 'on' : 'off'}` : '';
    const scope = ctx.lvl >= 3 && part === 'legs' ? ' &nbsp; hold <b>R</b> periscope' : '';
    const extra = ' &nbsp; <b>B</b> kid out / in &nbsp; <b>V</b> swap places';
    this.#set('keys', scatter ? '<b>WASD</b> run &nbsp; <b>Tab</b> next kid' : all ? (ctx.car ? CAR.keys.all : KEYS.all + (ctx.alley ? extra : '')) : ctx.car ? CAR.keys[part] || KEYS[part] : KEYS[part] + (part === 'legs' ? keep + scope : '') + (ctx.alley ? extra : ''));
    this.#buttons(part, ctx, scatter);
    this.bannerT -= dt; $('banner').style.opacity = this.bannerT > 0 ? 1 : 0;
    this.toastT -= dt; $('toast').style.opacity = this.toastT > 0 ? 1 : 0;
  }

  banner(i) { const b = $('banner'); b.textContent = BANNERS[i] || ''; b.classList.toggle('note', (BANNERS[i] || '').length > 42); this.bannerT = 2.8; }
  // a longer message (the errand's story, a friend joined) sits in a small card, so the coat stays in view
  note(text) { const b = $('banner'); b.textContent = text; b.classList.add('note'); this.bannerT = 4; }
  // small green confirmation: a bluff landed
  toast(text) { $('toast').textContent = text; this.toastT = 2.2; }

  // the menu line under "Today's town": what it is, and your best today
  dailyNote() {
    const n = $('dailynote'); n.hidden = this.mode !== 'daily'; if (n.hidden) return;
    const d = new Date(), k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    let best = 0; try { best = Number(localStorage.getItem('stacked.daily.' + k)) || 0; } catch { /* fine */ }
    n.textContent = `Survival in today's town: the same errands and surprises for everyone, all day. ${best ? `Your best today: ${best} errand${best === 1 ? '' : 's'}.` : 'Compare scores with friends.'}`;
  }
  end(Wd, isHost, snap) {
    const c = endCard(Wd);
    $('endtitle').textContent = c.title;
    $('endsub').textContent = c.sub || '';
    $('stars').innerHTML = `<span class="rank r${c.rank}">${c.rank}</span><ul class="why">${c.why.map((w) => `<li>${w}</li>`).join('')}</ul>`;
    $('afternoon').hidden = !c.afternoon;
    if (c.afternoon) $('afternoon').innerHTML = `<small>The whole afternoon</small><span class="rank r${c.afternoon.rank}">${c.afternoon.rank}</span>` + c.afternoon.results.map((x) => `<div>${x.name} <b>${x.rank}</b> <small>${x.time}</small></div>`).join('');
    $('snap').hidden = !snap; if (snap) $('snap').src = snap;
    // what was said out loud: the best bluff and the worst blurt
    const L = $('lines'); L.textContent = ''; L.hidden = !c.lines;
    for (const x of c.lines || []) {
      const d = document.createElement('div'); d.className = 'line';
      const t = document.createElement('small'); t.textContent = x.tag;
      const a = document.createElement('q'); a.textContent = x.said;
      const r = document.createElement('div'); r.textContent = `${x.who}: \u201c${x.reply}\u201d`;
      d.append(t, a, r); L.appendChild(d);
    }
    const q = $('quotes'); q.textContent = '';
    for (const x of c.quotes) { const b = document.createElement('blockquote'); b.textContent = x.text; const ci = document.createElement('cite'); ci.textContent = x.who; b.appendChild(ci); q.appendChild(b); }
    $('worst').innerHTML = '<small>Worst moment</small>'; $('worst').append(c.worst);
    $('tally').innerHTML = `<div><small>Pocket money</small>${c.money} coins</div><div><small>Grown-ups fooled</small>${c.fooled}</div><div><small>Disguise</small>+${c.earned} points &middot; ${c.disguise}</div>`;
    $('again').hidden = !isHost; $('next').hidden = !isHost || !c.next; $('share').textContent = 'Save picture';
    $('again').textContent = c.kind === 'story' ? 'Start the afternoon again' : 'Play again';
    this.show('end');
  }
}
