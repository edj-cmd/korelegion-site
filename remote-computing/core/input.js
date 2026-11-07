// Wire format for the input DataChannels. JSON for debuggability; messages are tiny.
// Pointer coordinates are normalised 0..1 of the *remote display* so resolution scaling is invisible.
//   channel "ptr"  : unordered, maxRetransmits=0  -> only {t:"mv"}
//   channel "ctl"  : ordered, reliable            -> everything else

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const BUTTONS = new Set(["left", "right", "middle"]);
const MODS = new Set(["shift", "ctrl", "alt", "meta"]);

export const msg = {
  move: (x, y) => ({ t: "mv", x: clamp01(x), y: clamp01(y) }),
  button: (button, down, x, y) => ({ t: "btn", b: button, d: !!down, x: clamp01(x), y: clamp01(y) }),
  scroll: (dx, dy) => ({ t: "scr", dx, dy }),
  key: (code, down, mods = []) => ({ t: "key", c: code, d: !!down, m: mods }),
  text: (s) => ({ t: "txt", s }),
  clipboard: (s) => ({ t: "clip", s }),
};

/** Host-side validation. Never trust the peer: returns a sanitised message or null. */
export function validate(m) {
  if (!m || typeof m !== "object") return null;
  const num = (v) => typeof v === "number" && Number.isFinite(v);
  switch (m.t) {
    case "mv": return num(m.x) && num(m.y) ? msg.move(m.x, m.y) : null;
    case "btn": return BUTTONS.has(m.b) && num(m.x) && num(m.y) ? msg.button(m.b, m.d, m.x, m.y) : null;
    case "scr": return num(m.dx) && num(m.dy)
      ? { t: "scr", dx: Math.max(-2000, Math.min(2000, m.dx)), dy: Math.max(-2000, Math.min(2000, m.dy)) } : null;
    case "key": return typeof m.c === "string" && m.c.length <= 32 && Array.isArray(m.m) && m.m.every((x) => MODS.has(x))
      ? msg.key(m.c, m.d, m.m) : null;
    case "txt": case "clip": return typeof m.s === "string" && m.s.length <= 100_000 ? { t: m.t, s: m.s } : null;
    default: return null;
  }
}

/** Coalesces high-rate pointer moves to at most one per animation frame / tick; keeps only the latest. */
export class MoveCoalescer {
  constructor(send) { this.send = send; this.pending = null; }
  push(x, y) { this.pending = msg.move(x, y); }
  flush() { if (this.pending) { this.send(this.pending); this.pending = null; } }
}
