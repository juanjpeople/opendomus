import assert from "node:assert/strict";
import { test } from "node:test";
import QRCode from "qrcode";
import { readQrPixels } from "./qr-reader";

test("el lector local decodifica etiquetas sin BarcodeDetector ni conexión", () => {
  const value = "https://localhost/c?code=K7QM";
  const qr = QRCode.create(value);
  const size = (qr.modules.size + 8) * 4;
  for (const inverted of [false, true]) {
    const pixels = new Uint8ClampedArray(size * size * 4);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const row = Math.floor(y / 4) - 4, col = Math.floor(x / 4) - 4;
      const dark = row >= 0 && col >= 0 && row < qr.modules.size && col < qr.modules.size && !!qr.modules.get(row, col);
      const color = dark !== inverted ? 0 : 255;
      const index = (y * size + x) * 4;
      pixels[index] = pixels[index + 1] = pixels[index + 2] = color;
      pixels[index + 3] = 255;
    }
    assert.equal(readQrPixels(pixels, size, size), value);
  }
  assert.equal(readQrPixels(new Uint8ClampedArray(64 * 64 * 4).fill(255), 64, 64), null);
});
