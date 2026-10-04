import assert from "node:assert/strict";
import { test } from "node:test";
import { authorizationUrl } from "./social";

test("OAuth solo navega al endpoint HTTPS del proveedor elegido", () => {
  assert.equal(authorizationUrl("github", "https://github.com/login/oauth/authorize?state=test"), "https://github.com/login/oauth/authorize?state=test");
  assert.equal(authorizationUrl("google", "https://accounts.google.com/o/oauth2/v2/auth?state=test"), "https://accounts.google.com/o/oauth2/v2/auth?state=test");
  for (const url of ["javascript:alert(1)", "http://github.com/login/oauth/authorize", "https://github.com.evil.example/login/oauth/authorize", "https://github.com/login", "https://user:secret@github.com/login/oauth/authorize", "https://github.com:444/login/oauth/authorize", "https://github.com/login/oauth/authorize#secret", "https://accounts.google.com/o/oauth2/v2/auth"]) {
    assert.throws(() => authorizationUrl("github", url));
  }
});
