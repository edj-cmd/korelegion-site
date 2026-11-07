import test from "node:test";
import assert from "node:assert/strict";
import { msg, validate, MoveCoalescer } from "./input.js";

test("coordinates clamp to 0..1", () => {
  assert.deepEqual(msg.move(-1, 2), { t: "mv", x: 0, y: 1 });
});
test("validate accepts well-formed messages", () => {
  for (const m of [msg.move(.5,.5), msg.button("left", true, .1, .2), msg.scroll(0, 40), msg.key("KeyA", true, ["meta"]), msg.text("hi"), msg.clipboard("x")])
    assert.ok(validate(m), JSON.stringify(m));
});
test("validate rejects malformed/hostile messages", () => {
  for (const m of [null, 5, {}, { t: "mv", x: "a", y: 1 }, { t: "mv", x: NaN, y: 1 }, { t: "btn", b: "back", d: true, x: 0, y: 0 },
    { t: "key", c: "A".repeat(99), d: true, m: [] }, { t: "key", c: "A", d: true, m: ["super"] }, { t: "txt", s: 5 }, { t: "rm -rf" }])
    assert.equal(validate(m), null, JSON.stringify(m));
});
test("validate clamps scroll magnitude", () => {
  assert.equal(validate({ t: "scr", dx: 1e9, dy: -1e9 }).dx, 2000);
});
test("coalescer sends only the latest move per flush", () => {
  const out = []; const c = new MoveCoalescer((m) => out.push(m));
  c.push(.1,.1); c.push(.2,.2); c.push(.3,.3); c.flush(); c.flush();
  assert.equal(out.length, 1); assert.equal(out[0].x, .3);
});
