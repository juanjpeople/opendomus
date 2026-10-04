import assert from "node:assert/strict";
import { test } from "node:test";
import { DAY, inactivityNoticeWindow, inactiveBefore } from "../src/inactivity";

test("los avisos cubren 30, 7 y 1 días sin superponerse", () => {
  const now = 200 * DAY;
  assert.deepEqual(inactivityNoticeWindow(30, 0, now), {
    dueAtOffset: 60 * DAY,
    activeBefore: 140 * DAY,
    activeAfter: 117 * DAY,
  });
  assert.deepEqual(inactivityNoticeWindow(7, 1, now), {
    dueAtOffset: 83 * DAY,
    activeBefore: 117 * DAY,
    activeAfter: 111 * DAY,
  });
  assert.deepEqual(inactivityNoticeWindow(1, 2, now), {
    dueAtOffset: 89 * DAY,
    activeBefore: 111 * DAY,
    activeAfter: 110 * DAY,
  });
  assert.equal(inactiveBefore(now), 110 * DAY);
});
