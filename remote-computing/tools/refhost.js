// Reference signaling host (Node, zero dependencies). Implements protocol/PROTOCOL.md exactly so the web client
// can be tested end to end here, and so the Swift host has an executable spec to match.
// It cannot capture a screen or make WebRTC itself: a "media peer" (a browser page in tests) plays the Mac's role.
import http from "node:http"; import crypto from "node:crypto";
import { serveFile } from "./serve.js";
import { PairingSession, DeviceRegistry, newChallenge, verify } from "../core/auth.js";

const GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

function frame(str, opcode = 1) {
  const p = Buffer.from(str); let h;
  if (p.length < 126) h = Buffer.from([0x80 | opcode, p.length]);
  else if (p.length < 65536) { h = Buffer.alloc(4); h[0] = 0x80 | opcode; h[1] = 126; h.writeUInt16BE(p.length, 2); }
  else { h = Buffer.alloc(10); h[0] = 0x80 | opcode; h[1] = 127; h.writeBigUInt64BE(BigInt(p.length), 2); }
  return Buffer.concat([h, p]);
}

class Sock {
  constructor(socket, onMsg, onClose) {
    this.s = socket; this.buf = Buffer.alloc(0); this.closed = false;
    socket.on("data", (d) => { this.buf = Buffer.concat([this.buf, d]); this.parse(onMsg); });
    const c = () => { if (!this.closed) { this.closed = true; onClose(); } };
    socket.on("close", c); socket.on("error", c);
  }
  parse(onMsg) {
    for (;;) {
      const b = this.buf; if (b.length < 2) return;
      const op = b[0] & 0x0f, masked = !!(b[1] & 0x80); let len = b[1] & 0x7f, off = 2;
      if (len === 126) { if (b.length < 4) return; len = b.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (b.length < 10) return; len = Number(b.readBigUInt64BE(2)); off = 10; }
      if (len > 1_000_000) return this.close();
      const need = off + (masked ? 4 : 0) + len; if (b.length < need) return;
      let payload = b.subarray(off + (masked ? 4 : 0), need);
      if (masked) { const m = b.subarray(off, off + 4); payload = Buffer.from(payload.map((x, i) => x ^ m[i % 4])); }
      this.buf = b.subarray(need);
      if (op === 8) return this.close();
      if (op === 9) this.s.write(frame(payload.toString(), 10));
      if (op === 1) onMsg(payload.toString());
    }
  }
  send(o) { if (!this.closed) this.s.write(frame(JSON.stringify(o))); }
  close() { try { this.s.write(Buffer.from([0x88, 0])); this.s.end(); } catch {} }
}

export function startRefHost({ port = 8787, registry = new DeviceRegistry(), now } = {}) {
  let pairing = new PairingSession({ now });
  let media = null;           // media peer socket
  const clients = new Map();  // session -> Sock (authenticated clients)
  const log = [];

  const server = http.createServer((req, res) => serveFile(req, res));
  server.on("upgrade", (req, socket) => {
    if (new URL(req.url, "http://x").pathname !== "/ws") return socket.destroy();
    const key = req.headers["sec-websocket-key"];
    socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${crypto.createHash("sha1").update(key + GUID).digest("base64")}\r\n\r\n`);
    let deviceId = null, challenge = null, session = null, authed = false, role = "client";
    const sock = new Sock(socket, async (text) => {
      let m; try { m = JSON.parse(text); } catch { return; }
      if (m.type === "media-peer") { role = "media"; media = sock; return; }
      if (role === "media") {                       // relay media peer -> client by session
        const c = clients.get(m.session); if (c) { const { session: _s, ...rest } = m; c.send(rest); } return;
      }
      if (m.type === "pair") {
        const r = pairing.redeem(String(m.code));
        if (r !== "ok") return sock.send({ type: "error", reason: r });
        const id = crypto.randomUUID(); registry.add(id, String(m.name || "device").slice(0, 40), m.pub);
        pairing = new PairingSession({ now }); log.push(`paired ${id}`);
        return sock.send({ type: "paired", id });
      }
      if (m.type === "hello") {
        if (!registry.get(m.id)) return sock.send({ type: "error", reason: "unauthorized" });
        deviceId = m.id; challenge = newChallenge(); return sock.send({ type: "challenge", challenge });
      }
      if (m.type === "auth" && deviceId && challenge) {
        const ok = await verify(registry.get(deviceId).spki, "connect", challenge, String(m.sig)); challenge = null;
        if (!ok) { log.push("auth-fail"); return sock.send({ type: "error", reason: "unauthorized" }); }
        authed = true; session = crypto.randomUUID(); clients.set(session, sock); log.push(`auth ${deviceId}`);
        sock.send({ type: "ready" });
        if (media) media.send({ type: "start", session });
        return;
      }
      if (authed && (m.type === "answer" || m.type === "ice") && media) media.send({ ...m, session });
    }, () => {
      if (role === "media" && media === sock) media = null;
      if (session) { clients.delete(session); media?.send({ type: "stop", session }); }
    });
  });
  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve({
    server, registry, log, port,
    get pairingCode() { return pairing.code; },
    dropClients() { for (const c of clients.values()) c.close(); },
    close() { for (const c of clients.values()) c.close(); media?.close(); server.close(); server.closeAllConnections?.(); },
  })));
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const h = await startRefHost({ port: Number(process.argv[2]) || 8787 });
  console.log(`reference host on http://127.0.0.1:${h.port}  pairing code: ${h.pairingCode}`);
}
