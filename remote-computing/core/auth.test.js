import test from "node:test";
import assert from "node:assert/strict";
import { generateDeviceKey, exportPublic, newChallenge, sign, verify, PairingSession, DeviceRegistry } from "./auth.js";

test("signature verifies for the right key, purpose and challenge", async () => {
  const k = await generateDeviceKey(); const pub = await exportPublic(k);
  const c = newChallenge(); const sig = await sign(k.privateKey, "connect", c);
  assert.equal(await verify(pub, "connect", c, sig), true);
});

test("rejects wrong key, wrong purpose, wrong challenge, garbage", async () => {
  const a = await generateDeviceKey(), b = await generateDeviceKey();
  const pubA = await exportPublic(a), pubB = await exportPublic(b);
  const c = newChallenge(); const sig = await sign(a.privateKey, "connect", c);
  assert.equal(await verify(pubB, "connect", c, sig), false);
  assert.equal(await verify(pubA, "pair", c, sig), false);
  assert.equal(await verify(pubA, "connect", newChallenge(), sig), false);
  assert.equal(await verify(pubA, "connect", c, "AAAA"), false);
  assert.equal(await verify("not-a-key", "connect", c, sig), false);
});

test("private key is non-extractable", async () => {
  const k = await generateDeviceKey();
  await assert.rejects(crypto.subtle.exportKey("pkcs8", k.privateKey));
});

test("pairing code: single use", () => {
  const p = new PairingSession();
  assert.equal(p.redeem(p.code), "ok");
  assert.equal(p.redeem(p.code), "used");
});

test("pairing code: expires", () => {
  let t = 0; const p = new PairingSession({ now: () => t });
  t = 5 * 60_000 + 1;
  assert.equal(p.redeem(p.code), "expired");
});

test("pairing code: locks after 5 bad attempts, even for the right code", () => {
  const p = new PairingSession();
  const wrong = p.code === "00000000" ? "11111111" : "00000000";
  for (let i = 0; i < 5; i++) assert.equal(p.redeem(wrong), "bad-code");
  assert.equal(p.redeem(p.code), "locked");
});

test("registry add / revoke", () => {
  const r = new DeviceRegistry(); r.add("d1", "iPhone", "spki");
  assert.equal(r.get("d1").name, "iPhone");
  r.revoke("d1"); assert.equal(r.get("d1"), undefined);
});
