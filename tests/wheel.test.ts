import test from "node:test";
import assert from "node:assert/strict";
import { scrollShelfWheel } from "../frontend/src/shelf/wheel.ts";

const wheel = (deltaY: number, options = {}) => ({
  deltaY, deltaX: 0, deltaMode: 0, ctrlKey: false, shiftKey: false,
  cancelable: true, defaultPrevented: false,
  preventDefault() { this.defaultPrevented = true; },
  ...options,
});

test("wheel traverses a shelf and releases the page at either edge", () => {
  const shelf = { clientWidth: 480, scrollWidth: 1800, scrollLeft: 0 };
  for (const [delta, mode, expected, handled] of [
    [-120, 0, 0, false], [3, 1, 48, true], [1, 2, 528, true],
    [2000, 0, 1320, true], [100, 0, 1320, false], [-60, 0, 1260, true],
  ] as const) {
    const event = wheel(delta, { deltaMode: mode });
    scrollShelfWheel(shelf, event);
    assert.equal(shelf.scrollLeft, expected);
    assert.equal(event.defaultPrevented, handled);
  }
});

test("native gestures, zoom and shelves that fit keep the browser default", () => {
  for (const options of [{ deltaX: 70 }, { ctrlKey: true }, { shiftKey: true }, { cancelable: false }]) {
    const shelf = { clientWidth: 400, scrollWidth: 800, scrollLeft: 10 };
    const event = wheel(30, options);
    scrollShelfWheel(shelf, event);
    assert.equal(shelf.scrollLeft, 10);
    assert.equal(event.defaultPrevented, false);
  }
  const event = wheel(50);
  scrollShelfWheel({ clientWidth: 400, scrollWidth: 400, scrollLeft: 0 }, event);
  assert.equal(event.defaultPrevented, false);
});
