import test from "node:test";
import assert from "node:assert/strict";
import { GestureRecognizer, VirtualCursor } from "./gestures.js";

test("quick tap = left click", () => {
  const g = new GestureRecognizer();
  g.down(1, 100, 100, 0);
  assert.deepEqual(g.up(1, 100), [{ a: "click", b: "left" }]);
});
test("slow press is not a click", () => {
  const g = new GestureRecognizer(); g.down(1, 0, 0, 0);
  assert.deepEqual(g.up(1, 600), []);
});
test("one-finger drag moves cursor with sensitivity, no click", () => {
  const g = new GestureRecognizer({ sensitivity: 2 });
  g.down(1, 0, 0, 0);
  assert.deepEqual(g.move(1, 20, 0), [{ a: "move", dx: 40, dy: 0 }]);
  assert.deepEqual(g.up(1, 100), []);
});
test("small jitter does not move the cursor", () => {
  const g = new GestureRecognizer(); g.down(1, 0, 0, 0);
  assert.deepEqual(g.move(1, 3, 3), []);
});
test("two-finger tap = right click", () => {
  const g = new GestureRecognizer();
  g.down(1, 0, 0, 0); g.down(2, 50, 0, 10);
  g.up(2, 100);
  assert.deepEqual(g.up(1, 110), [{ a: "click", b: "right" }]);
});
test("two-finger parallel drag scrolls", () => {
  const g = new GestureRecognizer();
  g.down(1, 0, 0, 0); g.down(2, 50, 0, 0);
  const all = [...g.move(1, 0, 30), ...g.move(2, 50, 30), ...g.move(1, 0, 60), ...g.move(2, 50, 60)];
  assert.ok(all.length > 0 && all.every((a) => a.a === "scroll"), JSON.stringify(all));
  assert.ok(all.reduce((n, a) => n + a.dy, 0) < 0); // fingers down => content scrolls up (natural)
});
test("pinch emits zoom, not scroll", () => {
  const g = new GestureRecognizer();
  g.down(1, 0, 0, 0); g.down(2, 100, 0, 0);
  const all = [...g.move(2, 150, 0), ...g.move(2, 200, 0), ...g.move(2, 260, 0)];
  assert.ok(all.length > 0 && all.every((a) => a.a === "zoom"), JSON.stringify(all));
  assert.ok(all.every((a) => a.scale > 1));
});
test("tap then press-drag => button down, up on release", () => {
  const g = new GestureRecognizer();
  g.down(1, 0, 0, 0); g.up(1, 80);                 // first tap (click)
  assert.deepEqual(g.down(1, 0, 0, 200), [{ a: "down", b: "left" }]);
  g.move(1, 30, 0);
  assert.deepEqual(g.up(1, 600), [{ a: "up", b: "left" }]);
});
test("virtual cursor clamps to the screen", () => {
  const c = new VirtualCursor(100, 100);
  assert.deepEqual(c.moveBy(1000, -1000), { x: 1, y: 0 });
});
