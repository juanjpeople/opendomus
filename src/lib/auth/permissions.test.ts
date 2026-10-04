import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { PermissionError } from "@/lib/errors";
import { assertCan, can, PERMISSIONS, ROLES, type Actor, type Role } from "./permissions";

const actor = (role: Role): Actor => ({ id: role, name: role, role });

describe("permisos", () => {
  test("fail-closed: sin usuario o con un rol desconocido no hay permisos", () => {
    for (const permission of PERMISSIONS) {
      assert.equal(can(null, permission), false);
      assert.equal(can(undefined, permission), false);
      assert.equal(can({ id: "x", name: "x", role: "intruso" as Role }, permission), false);
    }
  });

  test("el administrador puede todo", () => {
    for (const permission of PERMISSIONS) assert.equal(can(actor("admin"), permission), true);
  });

  test("un chico ve, pero no cambia nada", () => {
    const kid = actor("kid");
    assert.equal(can(kid, "inventory.view"), true);
    assert.equal(can(kid, "shopping.view"), true);
    assert.equal(can(kid, "calendar.view"), true);
    for (const permission of ["inventory.adjust", "inventory.consume", "inventory.delete", "shopping.manage", "members.manage", "settings.data"] as const) {
      assert.equal(can(kid, permission), false, permission);
    }
  });

  test("un adulto maneja la casa pero no los miembros ni los datos", () => {
    const adult = actor("adult");
    assert.equal(can(adult, "inventory.consume"), true);
    assert.equal(can(adult, "shopping.manage"), true);
    assert.equal(can(adult, "members.manage"), false);
    assert.equal(can(adult, "settings.data"), false);
  });

  test("cada rol tiene al menos un permiso", () => {
    for (const role of ROLES) assert.ok(PERMISSIONS.some((permission) => can(actor(role), permission)), role);
  });

  test("assertCan corta con PermissionError y dice qué faltó", () => {
    assert.doesNotThrow(() => assertCan(actor("adult"), "inventory.view"));
    assert.throws(
      () => assertCan(actor("kid"), "shopping.manage"),
      (error: unknown) => error instanceof PermissionError && error.permission === "shopping.manage",
    );
    assert.throws(() => assertCan(null, "inventory.view"), PermissionError);
  });
});
