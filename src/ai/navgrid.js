// A walking grid for grown-ups: the place cut into 0.4 m squares, marked blocked where walls, shelves
// and fixed things stand (widened by a grown-up's width). A* finds a path, which is then straightened.
// The same grid answers "can I see that?": only tall things (shelves, walls) block the view.
export class NavGrid {
  constructor(bounds, cell = 0.4) {
    this.cell = cell; this.x0 = bounds[0]; this.z0 = bounds[1];
    this.w = Math.ceil((bounds[2] - bounds[0]) / cell); this.h = Math.ceil((bounds[3] - bounds[1]) / cell);
    this.block = new Uint8Array(this.w * this.h);     // 1 = can't walk here
    this.tall = new Uint8Array(this.w * this.h);      // 1 = blocks the view
  }

  // a box footprint: centre x, z, size sx, sz, height, rotation yaw; pad = how wide a walker is
  addBox(x, z, sx, sz, height, yaw = 0, pad = 0.32) {
    const c = Math.cos(yaw), s = Math.sin(yaw), hx = sx / 2, hz = sz / 2, r = Math.hypot(hx, hz) + pad;
    const [i0, j0] = this.cellOf(x - r, z - r), [i1, j1] = this.cellOf(x + r, z + r);
    for (let j = Math.max(0, j0); j <= Math.min(this.h - 1, j1); j++) for (let i = Math.max(0, i0); i <= Math.min(this.w - 1, i1); i++) {
      const px = this.x0 + (i + 0.5) * this.cell - x, pz = this.z0 + (j + 0.5) * this.cell - z;
      const lx = px * c - pz * s, lz = px * s + pz * c;
      const dx = Math.max(0, Math.abs(lx) - hx), dz = Math.max(0, Math.abs(lz) - hz);
      if (Math.hypot(dx, dz) <= pad) this.block[j * this.w + i] = 1;
      if (height > 1.5 && dx === 0 && dz === 0) this.tall[j * this.w + i] = 1;
    }
  }

  // build from a place (walls, furniture) and its fixed interactive things
  static fromPlace(place, things = []) {
    const g = new NavGrid(place.bounds);
    for (const s of place.statics) if (s.kind !== 'ground') g.addBox(s.pos[0], s.pos[2], s.size[0], s.size[2], s.pos[1] + s.size[1] / 2);
    for (const t of things) {
      if (!t.def.shape || t.gone) continue;
      // grown-ups walk round displays on the floor (tins, bottles, boxes) instead of through them
      if (t.def.body !== 'fixed') {
        if (t.kind === 'ride' || t.position.y > 0.6) continue;
        const r = t.def.shape.radius ?? Math.max(...(t.def.shape.size || [0.3, 0, 0.3]).filter((_, i) => i !== 1)) / 2;
        g.addBox(t.position.x, t.position.z, r * 2, r * 2, 0, 0, 0.3);
        continue;
      }
      const sh = t.def.shape, p = t.position, parts = sh.type === 'compound' ? sh.parts : [sh];
      let sx = 0.3, sz = 0.3, top = 1;
      for (const q of parts) {
        if (q.type === 'box') { sx = Math.max(sx, q.size[0]); sz = Math.max(sz, q.size[2]); top = Math.max(top, (q.offset?.[1] ?? 0) + q.size[1] / 2); }
        else { const r = q.radius * 2; sx = Math.max(sx, r); sz = Math.max(sz, r); top = Math.max(top, (q.offset?.[1] ?? 0) + (q.height ?? q.radius * 2) / 2); }
      }
      if (t.def.ride?.type === 'belt') continue;                     // sits on a till, already blocked
      g.addBox(p.x, p.z, sx, sz, p.y + top, t.yaw, 0.32);
    }
    return g;
  }

  cellOf(x, z) { return [Math.floor((x - this.x0) / this.cell), Math.floor((z - this.z0) / this.cell)]; }
  centre(i, j) { return { x: this.x0 + (i + 0.5) * this.cell, z: this.z0 + (j + 0.5) * this.cell }; }
  inside(i, j) { return i >= 0 && j >= 0 && i < this.w && j < this.h; }
  free(i, j) { return this.inside(i, j) && !this.block[j * this.w + i]; }
  walkable(x, z) { const [i, j] = this.cellOf(x, z); return this.free(i, j); }

  // the nearest free cell to a point (a target inside a shelf moves to the aisle next to it)
  nearestFree(x, z, maxR = 8) {
    const [ci, cj] = this.cellOf(x, z);
    if (this.free(ci, cj)) return [ci, cj];
    for (let r = 1; r <= maxR; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
      if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
      if (this.free(ci + di, cj + dj)) return [ci + di, cj + dj];
    }
    return null;
  }

  // walk along a line of cells; true when nothing in the way (blocked or, for sight, tall)
  clear(ax, az, bx, bz, sight = false) {
    const d = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(d / (this.cell * 0.5)));
    for (let k = 0; k <= n; k++) {
      const [i, j] = this.cellOf(ax + (bx - ax) * k / n, az + (bz - az) * k / n);
      if (!this.inside(i, j)) return false;
      if ((sight ? this.tall : this.block)[j * this.w + i]) return false;
    }
    return true;
  }

  // A* from a to b; returns a short list of points to walk through (straightened), or null
  path(ax, az, bx, bz) {
    const s = this.nearestFree(ax, az), e = this.nearestFree(bx, bz);
    if (!s || !e) return null;
    const W = this.w, start = s[1] * W + s[0], goal = e[1] * W + e[0];
    const g = new Float32Array(W * this.h).fill(Infinity), from = new Int32Array(W * this.h).fill(-1), closed = new Uint8Array(W * this.h);
    const heap = new Heap(); heap.push(Math.hypot(s[0] - e[0], s[1] - e[1]), start); g[start] = 0;
    const hfn = (k) => Math.hypot((k % W) - e[0], Math.floor(k / W) - e[1]);
    while (heap.size) {
      const cur = heap.pop();
      if (cur === goal) break;
      if (closed[cur]) continue;
      closed[cur] = 1;
      const ci = cur % W, cj = Math.floor(cur / W);
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const ni = ci + di, nj = cj + dj;
        if (!this.free(ni, nj) || (di && dj && (!this.free(ci + di, cj) || !this.free(ci, cj + dj)))) continue;
        const nk = nj * W + ni; if (closed[nk]) continue;
        const ng = g[cur] + (di && dj ? 1.414 : 1);
        if (ng < g[nk]) { g[nk] = ng; from[nk] = cur; heap.push(ng + hfn(nk), nk); }
      }
    }
    if (from[goal] === -1 && goal !== start) return null;
    const cells = []; for (let k = goal; k !== -1; k = from[k]) cells.push(k);
    cells.reverse();
    const pts = cells.map((k) => this.centre(k % W, Math.floor(k / W)));
    pts[pts.length - 1] = this.walkable(bx, bz) ? { x: bx, z: bz } : pts[pts.length - 1];
    // straighten: skip points while the straight line stays walkable
    const out = []; let a = { x: ax, z: az }, k = 0;
    while (k < pts.length) {
      let far = k;
      for (let m = pts.length - 1; m > k; m--) if (this.clear(a.x, a.z, pts[m].x, pts[m].z)) { far = m; break; }
      out.push(pts[far]); a = pts[far]; k = far + 1;
    }
    return out;
  }
}

// a small binary heap of (priority, value), lowest priority first
class Heap {
  constructor() { this.p = []; this.v = []; }
  get size() { return this.p.length; }
  push(pr, v) {
    const p = this.p, a = this.v; let i = p.length; p.push(pr); a.push(v);
    while (i > 0) { const up = (i - 1) >> 1; if (p[up] <= pr) break; p[i] = p[up]; a[i] = a[up]; i = up; }
    p[i] = pr; a[i] = v;
  }
  pop() {
    const p = this.p, a = this.v, top = a[0], lp = p.pop(), lv = a.pop();
    if (p.length) {
      let i = 0; const n = p.length;
      for (;;) { let c = 2 * i + 1; if (c >= n) break; if (c + 1 < n && p[c + 1] < p[c]) c++; if (p[c] >= lp) break; p[i] = p[c]; a[i] = a[c]; i = c; }
      p[i] = lp; a[i] = lv;
    }
    return top;
  }
}
