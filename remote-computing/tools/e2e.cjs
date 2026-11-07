// End-to-end test: REAL web client (headless Chromium) <-> reference host (Node) <-> fake "Mac" media peer (second page
// with a canvas video track). Exercises pairing, auth, WebRTC, data channels, input, profiles, stats and reconnect.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const PORT = 8811, URL = `http://127.0.0.1:${PORT}/`;

const MEDIA_PAGE = `
window.__rx = []; window.__sessions = 0;
const ws = new WebSocket("ws://127.0.0.1:${PORT}/ws"); const pcs = new Map();
ws.onopen = () => ws.send(JSON.stringify({ type: "media-peer" }));
const cv = document.createElement("canvas"); cv.width = 640; cv.height = 360; const g = cv.getContext("2d"); let n = 0;
setInterval(() => { g.fillStyle = "#" + ((n++ * 997) % 0xffffff).toString(16).padStart(6, "0"); g.fillRect(0, 0, 640, 360); }, 33);
const stream = cv.captureStream(30);
ws.onmessage = async (ev) => {
  const m = JSON.parse(ev.data);
  if (m.type === "start") {
    window.__sessions++; const pc = new RTCPeerConnection({ iceServers: [] }); pcs.set(m.session, pc);
    stream.getTracks().forEach((t) => pc.addTrack(t, stream));
    const ptr = pc.createDataChannel("ptr", { ordered: false, maxRetransmits: 0 });
    const ctl = pc.createDataChannel("ctl");
    ptr.onmessage = (e) => window.__rx.push(JSON.parse(e.data)); ctl.onmessage = (e) => window.__rx.push(JSON.parse(e.data));
    pc.onicecandidate = (e) => e.candidate && ws.send(JSON.stringify({ type: "ice", session: m.session, candidate: e.candidate }));
    await pc.setLocalDescription(await pc.createOffer());
    ws.send(JSON.stringify({ type: "offer", session: m.session, sdp: pc.localDescription.sdp }));
  } else if (m.type === "answer") await pcs.get(m.session)?.setRemoteDescription({ type: "answer", sdp: m.sdp });
  else if (m.type === "ice") pcs.get(m.session)?.addIceCandidate(m.candidate).catch(() => {});
  else if (m.type === "stop") { pcs.get(m.session)?.close(); pcs.delete(m.session); }
};`;

(async () => {
  const { startRefHost } = await import("./refhost.js");
  const host = await startRefHost({ port: PORT });
  const browser = await chromium.launch({ args: ["--disable-features=WebRtcHideLocalIpsWithMdns"] });
  const results = []; const ok = (name) => { results.push(name); console.log("PASS", name); };
  try {
    const mediaCtx = await browser.newContext(); const media = await mediaCtx.newPage();
    await media.goto(URL + "robots-none").catch(() => {}); await media.setContent("<html></html>");
    await media.goto(URL); await media.evaluate(MEDIA_PAGE); // same-origin page so ws works

    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
    const page = await ctx.newPage(); const errs = [];
    page.on("pageerror", (e) => errs.push(e.message));

    // ---- wrong code is rejected
    await page.goto(URL);
    await page.fill("#name", "Test iPhone"); await page.fill("#code", host.pairingCode === "00000000" ? "11111111" : "00000000");
    await page.click("#pairform button"); await page.waitForFunction(() => document.getElementById("pairerr").textContent.includes("bad-code"));
    ok("wrong pairing code rejected");

    // ---- correct code pairs and connects
    await page.fill("#code", host.pairingCode); await page.click("#pairform button");
    await page.waitForFunction(() => document.getElementById("status").textContent.startsWith("Connected"), null, { timeout: 15000 });
    ok("paired, authenticated, WebRTC connected");
    assert.equal(host.registry.toJSON() && Object.keys(host.registry.toJSON()).length, 1); ok("host stored exactly one paired device");

    // ---- video actually arrives
    await page.waitForFunction(() => document.getElementById("v").videoWidth > 0, null, { timeout: 10000 });
    ok("video track decoded in client (" + await page.evaluate(() => document.getElementById("v").videoWidth + "x" + document.getElementById("v").videoHeight) + ")");

    // ---- touch tap -> left click arrives on host
    await page.touchscreen.tap(200, 400);
    await media.waitForFunction(() => window.__rx.some((m) => m.t === "btn" && m.b === "left" && m.d === true));
    await media.waitForFunction(() => window.__rx.some((m) => m.t === "btn" && m.b === "left" && m.d === false));
    ok("touch tap -> left click down/up on host");

    // ---- profile change arrives; stats arrive
    await page.selectOption("#profile", "lowbandwidth");
    await media.waitForFunction(() => window.__rx.some((m) => m.t === "profile" && m.name === "lowbandwidth"));
    ok("profile change delivered to host");
    await media.waitForFunction(() => window.__rx.some((m) => m.t === "stats" && typeof m.rttMs === "number"), null, { timeout: 8000 });
    ok("1 Hz stats delivered to host");

    // ---- typed text & key bar
    await page.click("#kbbtn"); await page.keyboard.type("hi");
    await media.waitForFunction(() => window.__rx.some((m) => m.t === "txt"));
    await page.click("#keys button:has-text('Esc')");
    await media.waitForFunction(() => window.__rx.some((m) => m.t === "key" && m.c === "Escape"));
    ok("soft keyboard text and Esc key delivered");

    // ---- mouse (MacBook mode): absolute move over unreliable channel + right click + wheel
    await page.mouse.move(100, 300); await page.mouse.move(120, 320);
    await media.waitForFunction(() => window.__rx.some((m) => m.t === "mv"));
    await page.mouse.wheel(0, 120);
    await media.waitForFunction(() => window.__rx.some((m) => m.t === "scr" && m.dy > 0));
    ok("mouse move (unreliable channel) and wheel delivered");
    const sessionsBefore = await media.evaluate(() => window.__sessions);

    // ---- automatic reconnect after the host drops the connection (re-auth with stored key, new peer connection)
    host.dropClients();
    await page.waitForFunction(() => /Reconnecting/.test(document.getElementById("status").textContent), null, { timeout: 5000 });
    await page.waitForFunction(() => document.getElementById("status").textContent.startsWith("Connected"), null, { timeout: 15000 });
    assert.equal(await media.evaluate(() => window.__sessions), sessionsBefore + 1);
    await page.waitForFunction(() => document.getElementById("v").videoWidth > 0);
    ok("automatic reconnect with a fresh session and video");

    // ---- revoked device is refused and drops its credentials
    const id = Object.keys(host.registry.toJSON())[0]; host.registry.revoke(id); host.dropClients();
    await page.waitForFunction(() => document.getElementById("status").textContent.startsWith("Refused: unauthorized"), null, { timeout: 15000 });
    ok("revoked device refused");

    assert.deepEqual(errs, [], "page errors: " + errs.join("; "));
    ok("no page errors");
    console.log(`\n${results.length} checks passed`);
  } catch (e) { console.error("FAIL:", e.message); process.exitCode = 1; }
  finally { await browser.close(); host.close(); }
})();
