import assert from "node:assert/strict";
import { test } from "node:test";
import { billboard, multiply } from "./matrix";

const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

test("una etiqueta conserva su posición real cuando la cámara se traslada", () => {
  const camera = [...identity]; camera[12] = 20; camera[13] = 2;
  const anchor = [...identity]; anchor[12] = 1; anchor[13] = 1.5; anchor[14] = -3;
  const model = billboard(camera, anchor, .4, .25);
  assert.deepEqual(Array.from(model.slice(12)), [1, 1.5, -3, 1]);
  const inverseView = [...identity]; inverseView[12] = -20;
  const projected = multiply(inverseView, model);
  assert.equal(projected[12], -19);
  assert.equal(projected[14], -3);
  assert.deepEqual(Array.from(multiply(identity, model)), Array.from(model));
});
