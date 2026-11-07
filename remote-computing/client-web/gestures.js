// Touch -> remote-desktop actions (trackpad model, like a laptop):
//  1 finger drag        move cursor (relative; sensitivity configurable)
//  1 finger tap         left click
//  2 finger tap         right click
//  2 finger drag        scroll (natural direction)
//  tap, then press+drag drag-and-drop (button held)
//  2 finger pinch       local zoom/pan of the view (no remote action)
// Pure state machine: feed pointer events with timestamps, get actions back. Unit-testable.

export const TAP_MAX_MS = 220;
export const TAP_MAX_MOVE = 8;       // px
export const DOUBLE_TAP_GAP_MS = 300;

export class GestureRecognizer {
  constructor({ sensitivity = 1.6 } = {}) {
    this.sens = sensitivity;
    this.pts = new Map();   // id -> {x,y,x0,y0,t0}
    this.lastTapEnd = -Infinity;
    this.dragging = false;
    this.maxFingers = 0;
    this.moved = false;
    this.pinchBase = null;
    this.mode2 = null; this.startPinch = null;
  }

  /** @returns {Array<object>} actions: {a:"move",dx,dy} {a:"click",b} {a:"down",b} {a:"up",b} {a:"scroll",dx,dy} {a:"zoom",scale,cx,cy} */
  down(id, x, y, t) {
    const out = [];
    if (this.pts.size === 0) { this.maxFingers = 0; this.moved = false; this.pinchBase = null; }
    this.pts.set(id, { x, y, x0: x, y0: y, t0: t });
    this.maxFingers = Math.max(this.maxFingers, this.pts.size);
    if (this.pts.size === 1 && t - this.lastTapEnd <= DOUBLE_TAP_GAP_MS) {
      this.dragging = true;               // tap-then-press => drag
      out.push({ a: "down", b: "left" });
    }
    if (this.pts.size === 2) { this.pinchBase = this._pinchState(); this.startPinch = this.pinchBase; this.mode2 = null; }
    return out;
  }

  move(id, x, y) {
    const p = this.pts.get(id); if (!p) return [];
    const dx = x - p.x, dy = y - p.y; p.x = x; p.y = y;
    if (Math.hypot(x - p.x0, y - p.y0) > TAP_MAX_MOVE) this.moved = true;
    if (this.pts.size === 1) {
      return this.moved ? [{ a: "move", dx: dx * this.sens, dy: dy * this.sens }] : [];
    }
    if (this.pts.size === 2) {
      const cur = this._pinchState();
      const base = this.pinchBase;
      if (!this.mode2) {                 // decide once: scroll vs zoom, then lock
        const dDist = Math.abs(cur.dist - this.startPinch.dist);
        const dCent = Math.hypot(cur.cx - this.startPinch.cx, cur.cy - this.startPinch.cy);
        if (Math.max(dDist, dCent) < 12) return [];
        this.mode2 = dDist > dCent * 1.5 ? "zoom" : "scroll";
        this.pinchBase = cur; return [];
      }
      this.pinchBase = cur;
      if (this.mode2 === "zoom") return [{ a: "zoom", scale: cur.dist / base.dist, cx: cur.cx, cy: cur.cy }];
      return [{ a: "scroll", dx: -(cur.cx - base.cx), dy: -(cur.cy - base.cy) }];
    }
    return [];
  }

  up(id, t) {
    const p = this.pts.get(id); const out = [];
    if (!p) return out;
    this.pts.delete(id);
    if (this.pts.size > 0) return out;
    // last finger lifted
    if (this.dragging) { out.push({ a: "up", b: "left" }); this.dragging = false; this.lastTapEnd = -Infinity; return out; }
    const quick = t - p.t0 <= TAP_MAX_MS && !this.moved;
    if (quick && this.maxFingers === 1) { out.push({ a: "click", b: "left" }); this.lastTapEnd = t; }
    else if (quick && this.maxFingers === 2) { out.push({ a: "click", b: "right" }); }
    return out;
  }

  _pinchState() {
    const [a, b] = [...this.pts.values()];
    return { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
  }
}

/** Keeps a virtual cursor in normalised 0..1 coordinates, driven by relative moves. */
export class VirtualCursor {
  constructor(width, height) { this.w = width; this.h = height; this.x = 0.5; this.y = 0.5; }
  resize(w, h) { this.w = w; this.h = h; }
  moveBy(dx, dy) {
    this.x = Math.min(1, Math.max(0, this.x + dx / this.w));
    this.y = Math.min(1, Math.max(0, this.y + dy / this.h));
    return { x: this.x, y: this.y };
  }
}
