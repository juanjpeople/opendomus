import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { pickableProfiles } from "./domain";

describe("perfiles que se pueden elegir", () => {
  const members = [
    { id: "juan", userId: "cuenta-juan" },
    { id: "flor", userId: "cuenta-flor" },
    { id: "tomi" }, // sin cuenta: el chico usa la tablet con su PIN
  ];

  test("en una casa local, todos (es un solo dispositivo)", () => {
    assert.deepEqual(pickableProfiles(members, null).map((member) => member.id), ["juan", "flor", "tomi"]);
  });

  test("con la casa en la nube, el propio y los sin cuenta; nunca el de otra cuenta", () => {
    assert.deepEqual(pickableProfiles(members, "cuenta-flor").map((member) => member.id), ["flor", "tomi"]);
  });
});
