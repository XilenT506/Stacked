// Online play. One player hosts; friends join with a room code. Each screen only sends small "latest state"
// messages: the host sends the world snapshot, everyone else sends what they are pressing.
//
// Two ways to carry those messages:
//  - RtcLink: WebRTC data channels, set up through our own tiny signalling server (server/signal.mjs).
//    Used when the game is served by that server.
//  - RoomLink: the live "room" a claude.ai artifact page gets. Used on the published link, where the page
//    frame does not allow WebRTC. Same messages, different pipe.

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
export const makeCode = () => Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
const after = (ms, msg) => new Promise((_, rej) => setTimeout(() => rej(new Error(msg)), ms));

class Link {
  constructor() { this.onState = () => {}; this.onLeave = () => {}; this.key = 'solo'; this.isHost = true; }
}

// ---------- WebRTC ----------
// on a home network (the offline build) the browsers find each other directly; online they ask a STUN server
const LAN = /^(localhost|127\.|192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(location.hostname);
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
    try { const r = await fetch('sig/ping'); return r.ok; } catch { return false; }
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

// Which way of playing online does this page have? Resolves { kind, make() } or null.
export async function findOnline() {
  const room = await RoomLink.available();
  if (room) return { kind: 'room', make: () => new RoomLink(room) };
  if (await RtcLink.available()) return { kind: 'webrtc', make: () => new RtcLink() };
  return null;
}
