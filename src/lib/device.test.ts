import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { describeUserAgent, deviceLabel } from "./device";

describe("dispositivos", () => {
  test("reconoce los navegadores y sistemas de todos los días", () => {
    const cases: [string, string, boolean][] = [
      ["Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36", "Chrome · Windows", false],
      ["Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36 Edg/131.0", "Edge · Windows", false],
      ["Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1", "Safari · iOS", true],
      ["Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36", "Chrome · Android", true],
      ["Mozilla/5.0 (Macintosh; Intel Mac OS X 14.5; rv:132.0) Gecko/20100101 Firefox/132.0", "Firefox · macOS", false],
    ];
    for (const [ua, label, mobile] of cases) {
      assert.equal(deviceLabel(ua), label);
      assert.equal(describeUserAgent(ua).mobile, mobile, label);
    }
  });

  test("lo desconocido queda vacío (la pantalla muestra un texto genérico)", () => {
    assert.equal(deviceLabel(""), "");
    assert.equal(deviceLabel("curl/8.0"), "");
  });
});
