// Adaptive performance policy. Pure function: no timers, no I/O, no globals.
// The host (Swift) runs a port of this; the same test vectors apply (see perf.test.js).
// Philosophy: degrade fast, recover slowly, never oscillate; responsiveness > sharpness.

/** @typedef {{scale:number, fps:number, bitrate:number}} Tier  scale=1 native, 0.5 half-res; bitrate bits/s */

const M = 1_000_000;

/** Tier ladders, best first. Each profile restricts how far up/down we may go. */
export const PROFILES = {
  performance: { // favours smoothness: keeps fps high, drops resolution first
    tiers: [
      { scale: 1.0, fps: 60, bitrate: 12 * M },
      { scale: 0.75, fps: 60, bitrate: 7 * M },
      { scale: 0.75, fps: 45, bitrate: 4 * M },
      { scale: 0.5, fps: 30, bitrate: 2 * M },
      { scale: 0.5, fps: 24, bitrate: 1 * M },
    ],
    start: 1,
  },
  balanced: {
    tiers: [
      { scale: 1.0, fps: 60, bitrate: 14 * M },
      { scale: 1.0, fps: 45, bitrate: 9 * M },
      { scale: 0.75, fps: 30, bitrate: 5 * M },
      { scale: 0.5, fps: 30, bitrate: 2.5 * M },
      { scale: 0.5, fps: 20, bitrate: 1.2 * M },
    ],
    start: 1,
  },
  quality: { // favours sharpness: keeps resolution, accepts lower fps
    tiers: [
      { scale: 1.0, fps: 60, bitrate: 25 * M },
      { scale: 1.0, fps: 30, bitrate: 15 * M },
      { scale: 1.0, fps: 24, bitrate: 8 * M },
      { scale: 0.75, fps: 24, bitrate: 4 * M },
      { scale: 0.5, fps: 15, bitrate: 1.5 * M },
    ],
    start: 1,
  },
  lowbandwidth: {
    tiers: [
      { scale: 0.5, fps: 30, bitrate: 1.5 * M },
      { scale: 0.5, fps: 20, bitrate: 0.8 * M },
      { scale: 0.375, fps: 15, bitrate: 0.4 * M },
    ],
    start: 0,
  },
};

export const GOOD_TICKS_TO_RECOVER = 8; // ~8 s at 1 Hz
export const RECOVER_HEADROOM = 1.3;    // bandwidth must exceed next tier by 30%

/**
 * @typedef {Object} Stats
 * @property {number} rttMs
 * @property {number} lossPct        0..100 over last interval
 * @property {number} jitterMs
 * @property {number} availBps       sender-side bandwidth estimate
 * @property {number} [encodeMsAvg]  per-frame encode time
 * @property {number} [fpsOut]       achieved encoded fps
 */

export function initialState(profileName) {
  const p = PROFILES[profileName];
  if (!p) throw new Error(`unknown profile ${profileName}`);
  return { profile: profileName, tier: p.start, goodTicks: 0, baseRtt: Infinity };
}

/** Returns true when the network is clearly hurting interactivity. */
function isBad(state, s, cur) {
  const rttBad = Number.isFinite(state.baseRtt) && s.rttMs > state.baseRtt * 2 + 40;
  const lossBad = s.lossPct > 2;
  const bwBad = s.availBps > 0 && s.availBps < cur.bitrate * 0.8;
  const jitterBad = s.jitterMs > 30;
  const encodeBad = s.encodeMsAvg !== undefined && s.fpsOut !== undefined &&
    s.encodeMsAvg > 1000 / cur.fps; // host can't keep up with the frame budget
  return rttBad || lossBad || bwBad || jitterBad || encodeBad;
}

/**
 * One policy step (call about once per second).
 * @returns {{state:object, target:Tier, changed:boolean, reason:string}}
 */
export function step(state, s) {
  const tiers = PROFILES[state.profile].tiers;
  const baseRtt = Math.min(state.baseRtt, s.rttMs > 0 ? s.rttMs : Infinity);
  const st = { ...state, baseRtt };
  const cur = tiers[st.tier];

  if (isBad(st, s, cur)) {
    st.goodTicks = 0;
    // A severe shortfall can skip tiers so we land under the estimate in one move.
    let next = st.tier;
    if (next < tiers.length - 1) next++;
    while (next < tiers.length - 1 && s.availBps > 0 && tiers[next].bitrate > s.availBps * 0.85) next++;
    const changed = next !== state.tier;
    st.tier = next;
    return { state: st, target: tiers[next], changed, reason: changed ? "degrade" : "at-floor" };
  }

  st.goodTicks = state.goodTicks + 1;
  if (st.tier > 0 && st.goodTicks >= GOOD_TICKS_TO_RECOVER) {
    const up = tiers[st.tier - 1];
    if (s.availBps === 0 || s.availBps >= up.bitrate * RECOVER_HEADROOM) {
      st.tier -= 1;
      st.goodTicks = 0;
      return { state: st, target: up, changed: true, reason: "recover" };
    }
  }
  return { state: st, target: cur, changed: false, reason: "hold" };
}

/** Switching profile resets tier to the profile's start without losing the RTT baseline. */
export function setProfile(state, profileName) {
  const base = initialState(profileName);
  return { ...base, baseRtt: state.baseRtt };
}
