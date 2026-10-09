import assert from "node:assert/strict";
import { test } from "node:test";
import { cameraHref, containerHref, findRoute, getRouteTrail, legacyRedirect, spaceHref } from "./routes";

test("los enlaces de inventario llevan el id y, si hace falta, el producto o el recinto", () => {
  assert.equal(spaceHref("a b"), "/inventario/lugar?id=a%20b");
  assert.equal(containerHref("c1"), "/inventario/ver?id=c1");
  assert.equal(containerHref("c1", { item: "i/2" }), "/inventario/ver?id=c1&item=i%2F2");
  assert.equal(cameraHref(), "/inventario/camara");
  assert.equal(cameraHref("c1"), "/inventario/camara?id=c1");
  assert.equal(cameraHref({ space: "taller" }), "/inventario/camara?space=taller");
});

test("la página de un recinto cuelga de Inventario en las migas", () => {
  assert.deepEqual(getRouteTrail(findRoute("/inventario/lugar")).map((route) => route.id), ["home", "inventory", "space"]);
  // `/inventario/lugar` es una página: no se confunde con un contenedor de URL vieja.
  assert.equal(legacyRedirect("/inventario/lugar"), null);
  assert.equal(legacyRedirect("/inventario/abc"), "/inventario/ver?id=abc");
});
