// Online play (ported from legacy/js/network.js). One player hosts; friends join with a room code. Each
// screen only sends small "latest state" messages: the host sends the world snapshot, everyone else sends
// what they are pressing.
//
// Two ways to carry those messages:
//  - RtcLink: WebRTC data channels, set up through our own tiny signalling server (server/signal.mjs).
//    Used when the game is served by that server.
//  - RoomLink: the live "room" a claude.ai artifact page gets. Used on the published link, where the page
//    frame does not allow WebRTC. Same messages, different pipe.
//  - LocalLink: tabs of the same browser on the same computer (BroadcastChannel). Used by the online check
//    and for trying it out with two windows.
//  - MemoryLink: no browser at all, for the logic tests.

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
export const makeCode = () => Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
const after = (ms, msg) => new Promise((_, rej) => setTimeout(() => rej(new Error(msg)), ms));

class Link {
  constructor() { this.onState = () => {}; this.onLeave = () => {}; this.key = 'solo'; this.isHost = true; }
}

// ---------- WebRTC ----------
// on a home network (the offline build) the browsers find each other directly; online they ask a STUN server
const LAN = /^(localhost|127\.|192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(globalThis.location?.hostname ?? "");
const ICE = { iceServers: LAN ? [] : [{ urls: 'stun:stun.l.google.com:19302' }] };
const iceDone = (pc) => new Promise((res) => {
  if (pc.iceGatheringState === 'complete') return res();
  const t = setTimeout(res, 2500);
  pc.addEventListener('icegatheringstatechange', () => { if (pc.iceGatheringState === 'complete') { clearTimeout(t); res(); } });
});
const post = (room, to, body) => fetch(`sig/${room}/${to}`, { method: 'POST', body: JSON.stringify(body) });

export class RtcLink extends Link {
  static async available() {
    if (!globalThis.RTCPeerConnection) return false;
    try { const r = await fetch('sig/ping'); return r.ok && (await r.text()).trim() === 'ok'; } catch { return false; }
  }
  constructor() { super(); this.kind = 'webrtc'; this.chans = new Map(); }

  async host(code) {
    this.isHost = true; this.key = 'H'; this.code = code;
    this.es = new EventSource(`sig/${code}/host`);
    this.es.onmessage = async (m) => {
      const { from, sdp } = JSON.parse(m.data);
      const pc = new RTCPeerConnection(ICE);
      pc.ondatachannel = (e) => this.#wire(from, e.channel, pc);
      await pc.setRemoteDescription(sdp);
      await pc.setLocalDescription(await pc.createAnswer());
      await iceDone(pc);
      post(code, from, { sdp: pc.localDescription });
    };
    await Promise.race([new Promise((res) => { this.es.onopen = res; }), after(6000, 'The game server did not answer.')]);
  }

  async join(code) {
    this.isHost = false; this.key = 'c' + Math.random().toString(36).slice(2, 8); this.code = code;
    const pc = new RTCPeerConnection(ICE);
    const ch = pc.createDataChannel('state', { ordered: false, maxRetransmits: 0 });
    const open = new Promise((res) => { ch.onopen = res; });
    this.#wire('host', ch, pc);
    await pc.setLocalDescription(await pc.createOffer());
    await iceDone(pc);
    this.es = new EventSource(`sig/${code}/${this.key}`);
    this.es.onmessage = (m) => pc.setRemoteDescription(JSON.parse(m.data).sdp);
    await new Promise((res) => { this.es.onopen = res; });
    const r = await post(code, 'host', { from: this.key, sdp: pc.localDescription });
    if (!r.ok) throw new Error('No game with that code.');
    await Promise.race([open, after(12000, 'Could not connect to the host.')]);
    this.es.close();
  }

  #wire(id, ch, pc) {
    this.chans.set(id, ch);
    ch.onmessage = (e) => { try { this.onState(id, JSON.parse(e.data)); } catch { /* ignore a broken packet */ } };
    const gone = () => { if (this.chans.get(id) === ch) { this.chans.delete(id); this.onLeave(id); } };
    ch.onclose = gone;
    pc.onconnectionstatechange = () => { if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) gone(); };
  }

  publish(obj) {
    const s = JSON.stringify(obj);
    for (const ch of this.chans.values()) if (ch.readyState === 'open') ch.send(s);
  }
  close() { this.es?.close(); for (const ch of this.chans.values()) ch.close(); }
}

// ---------- claude.ai artifact room ----------
export class RoomLink extends Link {
  static async available() {
    try { const c = globalThis.claude; if (!c?.use) return null; return await Promise.race([c.use('room'), new Promise((r) => setTimeout(() => r(null), 4000))]); } catch { return null; }
  }
  constructor(room) { super(); this.kind = 'room'; this.room = room; this.hostPeer = null; }

  async #open(code) {
    this.nr = await this.room.join('stk-' + code.toLowerCase());
    await Promise.race([new Promise((res) => {
      this.nr.onPeers((ch) => {
        const me = ch.peers.find((p) => p.isMe && p.sameTab);
        if (me) { this.me = me.peer; res(); }
        for (const p of [...ch.joined, ...ch.updated]) this.#hear(p);
        for (const p of ch.left) {
          if (this.isHost) this.onLeave(p.peer); else if (p.peer === this.hostPeer) { this.hostPeer = null; this.onLeave('host'); }
        }
      });
    }), after(8000, 'Could not reach the room.')]);
  }
  #hear(p) {
    if (p.isMe && p.sameTab) return;
    const pr = p.presence; if (!pr || !pr.d) return;
    if (this.isHost) { if (pr.r === 'c') this.onState(p.peer, pr.d); }
    else if (pr.r === 'h' && (!this.hostPeer || this.hostPeer === p.peer)) { this.hostPeer = p.peer; this.onState('host', pr.d); }
  }
  async host(code) { this.isHost = true; await this.#open(code); this.key = this.me; }
  async join(code) {
    this.isHost = false; await this.#open(code); this.key = this.me;
    for (const p of this.nr.peers()) this.#hear(p);
    const t0 = Date.now();
    while (!this.hostPeer) { if (Date.now() - t0 > 7000) { this.nr.leave(); throw new Error('No game with that code.'); } await new Promise((r) => setTimeout(r, 150)); }
  }
  publish(obj) { this.nr?.presence({ r: this.isHost ? 'h' : 'c', d: obj }).catch(() => {}); }
  close() { this.nr?.leave(); }
}

// ---------- tabs of one browser ----------
export class LocalLink extends Link {
  constructor() { super(); this.kind = 'local'; this.peers = new Map(); }
  #open(code, role) {
    this.ch = new BroadcastChannel('stacked-' + code.toLowerCase()); this.role = role;
    this.ch.onmessage = (e) => {
      const m = e.data; if (!m || m.from === this.key) return;
      if (this.isHost && m.r === 'c') { if (m.bye) { this.peers.delete(m.from); this.onLeave(m.from); return; } this.peers.set(m.from, Date.now()); this.onState(m.from, m.d); }
      if (!this.isHost && m.r === 'h') { this.sawHost = true; if (m.bye) { this.onLeave('host'); return; } this.onState('host', m.d); }
    };
  }
  async host(code) { this.isHost = true; this.key = 'H'; this.code = code; this.#open(code, 'h'); }
  async join(code) {
    this.isHost = false; this.key = 'c' + Math.random().toString(36).slice(2, 8); this.code = code; this.#open(code, 'c');
    const t0 = Date.now();
    while (!this.sawHost) { this.publish({ hello: 1 }); if (Date.now() - t0 > 5000) { this.close(); throw new Error('No game with that code.'); } await new Promise((r) => setTimeout(r, 150)); }
  }
  publish(obj) { this.ch?.postMessage({ r: this.isHost ? 'h' : 'c', from: this.key, d: obj }); }
  close() { try { this.ch?.postMessage({ r: this.isHost ? 'h' : 'c', from: this.key, bye: 1 }); this.ch?.close(); } catch { /* closed */ } }
}

// ---------- no browser: a pair of in-memory ends (logic tests). JSON in between, like the real thing ----------
export class MemoryHub {
  constructor(latency = 0) { this.host = null; this.clients = new Map(); this.latency = latency; this.queue = []; this.time = 0; }
  send(to, from, obj) { this.queue.push({ at: this.time + this.latency, to, from, s: JSON.stringify(obj) }); }
  tick(dt) {
    this.time += dt;
    const due = this.queue.filter((m) => m.at <= this.time); this.queue = this.queue.filter((m) => m.at > this.time);
    for (const m of due) { const d = JSON.parse(m.s); if (m.to === 'host') this.host?.onState(m.from, d); else this.clients.get(m.to)?.onState('host', d); }
  }
}
export class MemoryLink extends Link {
  constructor(hub) { super(); this.kind = 'memory'; this.hub = hub; }
  async host() { this.isHost = true; this.key = 'H'; this.hub.host = this; }
  async join() { this.isHost = false; this.key = 'c' + (this.hub.clients.size + 1); this.hub.clients.set(this.key, this); }
  publish(obj) { if (this.isHost) for (const k of this.hub.clients.keys()) this.hub.send(k, 'host', obj); else this.hub.send('host', this.key, obj); }
  close() { if (!this.isHost) { this.hub.clients.delete(this.key); this.hub.host?.onLeave(this.key); } }
}

// Which way of playing online does this page have? Resolves { kind, make() } or null.
export async function findOnline(prefer = null) {
  if (prefer === 'local' && globalThis.BroadcastChannel) return { kind: 'local', make: () => new LocalLink() };
  const room = await RoomLink.available();
  if (room) return { kind: 'room', make: () => new RoomLink(room) };
  if (await RtcLink.available()) return { kind: 'webrtc', make: () => new RtcLink() };
  if (globalThis.BroadcastChannel) return { kind: 'local', make: () => new LocalLink() };     // at least two tabs on this computer
  return null;
}
