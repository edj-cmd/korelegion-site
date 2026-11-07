import test from "node:test";
import assert from "node:assert/strict";
import { initialState, step, setProfile, PROFILES, GOOD_TICKS_TO_RECOVER } from "./perf.js";

const good = { rttMs: 20, lossPct: 0, jitterMs: 3, availBps: 50e6 };

test("holds on a healthy link at the top tier", () => {
  let s = initialState("balanced");
  s = { ...s, tier: 0 };
  for (let i = 0; i < 30; i++) {
    const r = step(s, good);
    assert.equal(r.changed, false);
    s = r.state;
  }
  assert.equal(s.tier, 0);
});

test("degrades immediately on packet loss", () => {
  let s = { ...initialState("balanced"), tier: 0 };
  const r = step(s, { ...good, lossPct: 5 });
  assert.equal(r.changed, true);
  assert.equal(r.reason, "degrade");
  assert.ok(r.state.tier > 0);
});

test("skips tiers when bandwidth collapses", () => {
  let s = { ...initialState("balanced"), tier: 0 };
  const r = step(s, { ...good, availBps: 2e6 });
  const t = PROFILES.balanced.tiers[r.state.tier];
  assert.ok(t.bitrate <= 2e6 / 0.85 + 1, `landed on ${t.bitrate}`);
});

test("degrades when RTT more than doubles the baseline", () => {
  let s = { ...initialState("balanced"), tier: 0 };
  s = step(s, good).state; // learn baseline 20 ms
  const r = step(s, { ...good, rttMs: 150 });
  assert.equal(r.reason, "degrade");
});

test("recovers one tier only after sustained good ticks, no oscillation", () => {
  let s = { ...initialState("balanced"), tier: 2 };
  let changes = 0;
  for (let i = 0; i < GOOD_TICKS_TO_RECOVER - 1; i++) {
    const r = step(s, good); s = r.state; if (r.changed) changes++;
  }
  assert.equal(changes, 0);
  const r = step(s, good);
  assert.equal(r.reason, "recover");
  assert.equal(r.state.tier, 1);
});

test("does not recover without bandwidth headroom", () => {
  let s = { ...initialState("balanced"), tier: 2 };
  const tight = { ...good, availBps: PROFILES.balanced.tiers[1].bitrate * 1.05 };
  for (let i = 0; i < 20; i++) s = step(s, tight).state;
  assert.equal(s.tier, 2);
});

test("a bad tick resets the recovery counter", () => {
  let s = { ...initialState("balanced"), tier: 2 };
  for (let i = 0; i < GOOD_TICKS_TO_RECOVER - 1; i++) s = step(s, good).state;
  s = step(s, { ...good, lossPct: 10 }).state;
  assert.equal(s.goodTicks, 0);
});

test("floor holds and reports at-floor", () => {
  const last = PROFILES.balanced.tiers.length - 1;
  const r = step({ ...initialState("balanced"), tier: last }, { ...good, lossPct: 20 });
  assert.equal(r.reason, "at-floor");
  assert.equal(r.state.tier, last);
});

test("encoder overload degrades", () => {
  let s = { ...initialState("balanced"), tier: 0 };
  const r = step(s, { ...good, encodeMsAvg: 40, fpsOut: 20 });
  assert.equal(r.reason, "degrade");
});

test("profile switch keeps RTT baseline", () => {
  let s = step(initialState("balanced"), good).state;
  const p = setProfile(s, "lowbandwidth");
  assert.equal(p.baseRtt, 20);
  assert.equal(p.tier, 0);
});

test("simulated congestion episode degrades then fully recovers", () => {
  let s = { ...initialState("performance"), tier: 0 };
  const trace = [];
  for (let t = 0; t < 120; t++) {
    const congested = t >= 10 && t < 30;
    trace.push(congested ? { rttMs: 200, lossPct: 6, jitterMs: 40, availBps: 1.5e6 } : good);
  }
  let min = 0;
  for (const x of trace) { s = step(s, x).state; min = Math.max(min, s.tier); }
  assert.ok(min >= 3, "should have degraded during congestion");
  assert.equal(s.tier, 0, "should be back at top tier");
});
