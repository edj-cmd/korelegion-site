// Tether web client: used as the iPhone PWA and the MacBook viewer.
// UNTESTED IN A BROWSER AGAINST A REAL HOST — logic modules (gestures/auth/input) are unit-tested; this glue is not.
import { GestureRecognizer, VirtualCursor } from "./gestures.js";
import { generateDeviceKey, exportPublic, sign } from "./core/auth.js";
import { msg, MoveCoalescer } from "./core/input.js";

const $ = (id) => document.getElementById(id);
const video = $("v"), stage = $("stage"), dot = $("dot"), statusEl = $("status");
const setStatus = (text, kind) => { statusEl.textContent = text; dot.className = kind || ""; };

// ---------- persistent identity (IndexedDB; non-extractable key) ----------
const idb = (mode, fn) => new Promise((res, rej) => {
  const o = indexedDB.open("tether", 1);
  o.onupgradeneeded = () => o.result.createObjectStore("kv");
  o.onerror = () => rej(o.error);
  o.onsuccess = () => { const tx = o.result.transaction("kv", mode); const r = fn(tx.objectStore("kv"));
    tx.oncomplete = () => res(r.result); tx.onerror = () => rej(tx.error); };
});
const kvGet = (k) => idb("readonly", (s) => s.get(k));
const kvSet = (k, v) => idb("readwrite", (s) => s.put(v, k));

// ---------- state ----------
let ws, pc, ptr, ctl, retry = 0, closed = false, statsTimer, lastStats = null;
const cursor = new VirtualCursor(innerWidth, innerHeight);
const gesture = new GestureRecognizer();
let view = { s: 1, x: 0, y: 0 };

const sendCtl = (o) => { if (ctl?.readyState === "open") ctl.send(JSON.stringify(o)); };
const coalescer = new MoveCoalescer((m) => { if (ptr?.readyState === "open") ptr.send(JSON.stringify(m)); });
(function raf() { coalescer.flush(); requestAnimationFrame(raf); })();

// ---------- pairing ----------
async function ensurePaired() {
  let dev = await kvGet("device");
  if (dev) return dev;
  $("pair").classList.add("show");
  return new Promise((resolve) => {
    $("pairform").onsubmit = async (e) => {
      e.preventDefault();
      const key = await generateDeviceKey();
      const pub = await exportPublic(key);
      const sock = new WebSocket(wsUrl());
      sock.onopen = () => sock.send(JSON.stringify({ type: "pair", code: $("code").value, name: $("name").value, pub }));
      sock.onmessage = async (ev) => {
        const m = JSON.parse(ev.data);
        if (m.type === "paired") {
          dev = { id: m.id, key }; await kvSet("device", dev);
          $("pair").classList.remove("show"); sock.close(); resolve(dev);
        } else if (m.type === "error") $("pairerr").textContent = `Failed: ${m.reason}`;
      };
    };
  });
}

const wsUrl = () => `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`;

// ---------- connection with automatic reconnect ----------
async function connect() {
  const dev = await ensurePaired();
  setStatus("Connecting…", "wait");
  ws = new WebSocket(wsUrl());
  ws.onopen = () => ws.send(JSON.stringify({ type: "hello", id: dev.id }));
  ws.onmessage = async (ev) => {
    const m = JSON.parse(ev.data);
    if (m.type === "challenge") ws.send(JSON.stringify({ type: "auth", sig: await sign(dev.key.privateKey, "connect", m.challenge) }));
    else if (m.type === "offer") await onOffer(m.sdp);
    else if (m.type === "ice" && pc) pc.addIceCandidate(m.candidate).catch(() => {});
    else if (m.type === "error") { setStatus(`Refused: ${m.reason}`, ""); if (m.reason === "unauthorized") { await kvSet("device", null); closed = true; } }
  };
  ws.onclose = () => scheduleReconnect();
  ws.onerror = () => {};
}

function scheduleReconnect() {
  teardown();
  if (closed) return;
  const delay = Math.min(8000, 400 * 2 ** retry++);   // 0.4s, 0.8s, ... capped 8s
  setStatus(`Reconnecting in ${(delay / 1000).toFixed(1)}s…`, "wait");
  setTimeout(connect, delay);
}

function teardown() {
  clearInterval(statsTimer); try { pc?.close(); } catch {}
  pc = ptr = ctl = null; video.srcObject = null;
}

async function onOffer(sdp) {
  pc = new RTCPeerConnection({ iceServers: [] });          // tailnet: no STUN/TURN needed
  pc.ontrack = (e) => { video.srcObject = e.streams[0]; video.play().catch(() => {}); };
  pc.onicecandidate = (e) => e.candidate && ws.send(JSON.stringify({ type: "ice", candidate: e.candidate }));
  pc.ondatachannel = (e) => {
    if (e.channel.label === "ptr") ptr = e.channel;
    if (e.channel.label === "ctl") {
      ctl = e.channel;
      ctl.onopen = () => { retry = 0; setStatus("Connected", "ok"); sendCtl({ t: "profile", name: $("profile").value }); startStats(); };
      ctl.onmessage = (ev) => { try { const m = JSON.parse(ev.data); if (m.t === "tier") onTier(m); if (m.t === "clip") navigator.clipboard?.writeText(m.s).catch(() => {}); } catch {} };
    }
  };
  pc.onconnectionstatechange = () => { if (["failed", "disconnected", "closed"].includes(pc?.connectionState)) { ws?.close(); } };
  await pc.setRemoteDescription({ type: "offer", sdp });
  await pc.setLocalDescription(await pc.createAnswer());
  ws.send(JSON.stringify({ type: "answer", sdp: pc.localDescription.sdp }));
}

function onTier(m) { statusEl.title = `${m.scale}x ${m.fps}fps ${(m.bitrate / 1e6).toFixed(1)}Mb/s (${m.reason})`; if (lastStats) showStats(m); }

// ---------- stats (1 Hz; only while connected and visible) ----------
function startStats() {
  let prevLost = 0, prevRecv = 0;
  statsTimer = setInterval(async () => {
    if (document.hidden || !pc) return;
    const rep = await pc.getStats(); let rtt = 0, jitter = 0, lost = 0, recv = 0;
    rep.forEach((r) => {
      if (r.type === "candidate-pair" && r.nominated && r.currentRoundTripTime) rtt = r.currentRoundTripTime * 1000;
      if (r.type === "inbound-rtp" && r.kind === "video") { jitter = (r.jitter || 0) * 1000; lost = r.packetsLost; recv = r.packetsReceived; }
    });
    const dl = lost - prevLost, dr = recv - prevRecv; prevLost = lost; prevRecv = recv;
    const lossPct = dl + dr > 0 ? (100 * Math.max(0, dl)) / (dl + dr) : 0;
    lastStats = { rttMs: rtt, lossPct, jitterMs: jitter };
    sendCtl({ t: "stats", ...lastStats });
    showStats();
  }, 1000);
}
function showStats(tier) { statusEl.textContent = `Connected · ${Math.round(lastStats.rttMs)} ms${lastStats.lossPct > 0.5 ? ` · ${lastStats.lossPct.toFixed(1)}% loss` : ""}`; }

// ---------- touch input ----------
const act = (a) => {
  if (a.a === "move") { const p = cursor.moveBy(a.dx, a.dy); coalescer.push(p.x, p.y); }
  else if (a.a === "click") { sendCtl(msg.button(a.b, true, cursor.x, cursor.y)); sendCtl(msg.button(a.b, false, cursor.x, cursor.y)); }
  else if (a.a === "down") sendCtl(msg.button(a.b, true, cursor.x, cursor.y));
  else if (a.a === "up") sendCtl(msg.button(a.b, false, cursor.x, cursor.y));
  else if (a.a === "scroll") sendCtl(msg.scroll(a.dx, a.dy));
  else if (a.a === "zoom") zoomView(a);
};
function zoomView({ scale, cx, cy }) {
  const ns = Math.min(5, Math.max(1, view.s * scale)), k = ns / view.s;
  view.x = cx - (cx - view.x) * k; view.y = cy - (cy - view.y) * k; view.s = ns;
  if (ns === 1) { view.x = 0; view.y = 0; }
  video.style.transform = `translate(${view.x}px,${view.y}px) scale(${view.s})`;
}
stage.addEventListener("pointerdown", (e) => { stage.setPointerCapture(e.pointerId); gesture.down(e.pointerId, e.clientX, e.clientY, e.timeStamp).forEach(act); });
stage.addEventListener("pointermove", (e) => gesture.move(e.pointerId, e.clientX, e.clientY).forEach(act));
const end = (e) => gesture.up(e.pointerId, e.timeStamp).forEach(act);
stage.addEventListener("pointerup", end); stage.addEventListener("pointercancel", end);
// Mouse/trackpad on the MacBook: absolute pointing, wheel, right-click.
stage.addEventListener("pointermove", (e) => { if (e.pointerType === "mouse") { const r = video.getBoundingClientRect(); coalescer.push((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height); } }, true);
stage.addEventListener("wheel", (e) => { e.preventDefault(); sendCtl(msg.scroll(e.deltaX, e.deltaY)); }, { passive: false });
stage.addEventListener("contextmenu", (e) => e.preventDefault());

// ---------- keyboard ----------
const kb = $("kb");
$("kbbtn").onclick = () => { $("keys").classList.toggle("show"); kb.focus(); };
kb.addEventListener("input", (e) => { if (e.data) sendCtl(msg.text(e.data)); kb.value = ""; });
kb.addEventListener("keydown", (e) => { if (["Backspace", "Enter", "Tab", "Escape", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) { e.preventDefault(); keyTap(e.code); } });
document.addEventListener("keydown", (e) => { if (document.activeElement === kb || document.activeElement?.tagName === "INPUT") return;
  e.preventDefault(); sendCtl(msg.key(e.code, true, mods(e))); });
document.addEventListener("keyup", (e) => { if (document.activeElement === kb) return; sendCtl(msg.key(e.code, false, mods(e))); });
const mods = (e) => ["shift", "ctrl", "alt", "meta"].filter((m) => e[m + "Key"]);
const sticky = new Set();
function keyTap(code) { const m = [...sticky]; sendCtl(msg.key(code, true, m)); sendCtl(msg.key(code, false, m)); sticky.clear(); renderKeys(); }
function renderKeys() {
  const bar = $("keys"); bar.innerHTML = "";
  for (const [label, code] of [["Esc", "Escape"], ["Tab", "Tab"], ["↑", "ArrowUp"], ["↓", "ArrowDown"], ["←", "ArrowLeft"], ["→", "ArrowRight"], ["⌫", "Backspace"], ["⏎", "Enter"]]) {
    const b = document.createElement("button"); b.textContent = label; b.onpointerdown = (e) => { e.preventDefault(); keyTap(code); }; bar.append(b);
  }
  for (const m of ["ctrl", "alt", "shift", "meta"]) {
    const b = document.createElement("button"); b.textContent = { meta: "⌘", ctrl: "⌃", alt: "⌥", shift: "⇧" }[m];
    if (sticky.has(m)) b.style.background = "#36a"; b.onpointerdown = (e) => { e.preventDefault(); sticky.has(m) ? sticky.delete(m) : sticky.add(m); renderKeys(); }; bar.append(b);
  }
}
renderKeys();

// ---------- chrome ----------
$("profile").onchange = () => sendCtl({ t: "profile", name: $("profile").value });
$("hide").onclick = () => { $("bar").classList.toggle("hidden"); };
addEventListener("resize", () => cursor.resize(innerWidth, innerHeight));
// iOS suspends the page in the background: on return, reconnect immediately instead of waiting out the backoff.
document.addEventListener("visibilitychange", () => { if (!document.hidden && (!pc || pc.connectionState !== "connected")) { retry = 0; ws?.close(); } });
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
navigator.wakeLock?.request("screen").catch(() => {});
connect();
