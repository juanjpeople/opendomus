import assert from "node:assert/strict";
import { test } from "node:test";
import { backCameras, pickBackCamera, zoomSteps } from "./camera-lens";
import { centerCrop, fitWithin, locate } from "./qr-reader";

test("elige la trasera principal y no el gran angular", () => {
  // Así nombra Chrome las cámaras de un Android con varias lentes traseras.
  const android = [
    { deviceId: "front", label: "camera2 1, facing front", kind: "videoinput" },
    { deviceId: "wide", label: "camera2 2, facing back", kind: "videoinput" },
    { deviceId: "main", label: "camera2 0, facing back", kind: "videoinput" },
    { deviceId: "mic", label: "Micrófono", kind: "audioinput" },
  ];
  assert.equal(pickBackCamera(android), "main");
  assert.deepEqual(backCameras(android).map((device) => device.deviceId), ["wide", "main"]);
  // iPhone: la principal es "Back Camera"; el gran angular y el tele se evitan.
  const iphone = [
    { deviceId: "ultra", label: "Back Ultra Wide Camera" },
    { deviceId: "tele", label: "Back Telephoto Camera" },
    { deviceId: "main", label: "Back Camera" },
  ];
  assert.equal(pickBackCamera(iphone), "main");
});

test("sin nombres (antes del permiso o en una notebook) deja la cámara que dio el navegador", () => {
  assert.equal(pickBackCamera([{ deviceId: "a", label: "" }, { deviceId: "b", label: "" }]), null);
  assert.equal(pickBackCamera([{ deviceId: "web", label: "Integrated Webcam" }]), null);
  assert.equal(pickBackCamera([]), null);
});

test("ofrece 1×, 2× y 3× solo dentro del rango de la cámara", () => {
  assert.deepEqual(zoomSteps({ min: 1, max: 8 }), [1, 2, 3]);
  assert.deepEqual(zoomSteps({ min: 1, max: 2.5 }), [1, 2]);
  assert.deepEqual(zoomSteps({ min: 1, max: 1 }), []);
  assert.deepEqual(zoomSteps(null), []);
});

test("el lector recorta el centro con más detalle y ubica cada etiqueta en el cuadro original", () => {
  // 1920 × 1080: el recorte del 60 % del lado menor (648 px) entra entero, sin achicar.
  assert.deepEqual(centerCrop(1920, 1080, 0.6, 720), { sx: 636, sy: 216, side: 648, out: 648 });
  assert.deepEqual(centerCrop(4000, 3000, 0.6, 720), { sx: 1100, sy: 600, side: 1800, out: 720 });
  assert.deepEqual(fitWithin(1920, 1080, 800), { width: 800, height: 450, scale: 800 / 1920 });
  const found = locate([{ x: 900, y: 500 }, { x: 1020, y: 500 }, { x: 900, y: 620 }, { x: 1020, y: 620 }], 1920, 1080);
  assert.deepEqual(found.center, { x: 960 / 1920, y: 560 / 1080 });
  assert.equal(found.size, 120 / 1920);
});
