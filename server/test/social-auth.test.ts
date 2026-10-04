import assert from "node:assert/strict";
import { test } from "node:test";
import { authOptions } from "../src/auth-options";
import { enabledSocialProviders, socialProviders } from "../src/social-auth";

test("OAuth solo habilita proveedores completos y su lista pública no contiene credenciales", () => {
  assert.deepEqual(enabledSocialProviders({}), []);
  assert.deepEqual(enabledSocialProviders({ GOOGLE_CLIENT_ID: "id", GITHUB_CLIENT_SECRET: "secret" }), []);
  const env = { GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "private-secret", GITHUB_CLIENT_ID: "gh", GITHUB_CLIENT_SECRET: " " };
  assert.deepEqual(enabledSocialProviders(env), ["google"]);
  assert.deepEqual(socialProviders(env).google, { clientId: "id", clientSecret: "private-secret" });
});

test("OAuth exige vinculación explícita y conserva el alta cifrada por contraseña", () => {
  const config = authOptions({} as never, {
    secret: "test-only", baseURL: "https://app.example", trustedOrigins: ["https://app.example"],
    google: { clientId: "google-id", clientSecret: "google-secret" },
    github: { clientId: "github-id", clientSecret: "github-secret" },
  });
  assert.equal(config.account?.accountLinking?.disableImplicitLinking, true);
  assert.equal(config.account?.accountLinking?.allowDifferentEmails, false);
  assert.deepEqual(config.account?.accountLinking?.trustedProviders, []);
  assert.equal(config.account?.encryptOAuthTokens, true);
  for (const provider of ["google", "github"] as const) {
    const options = config.socialProviders?.[provider];
    assert(options && typeof options !== "function");
    assert.equal(options.disableSignUp, true);
    assert.equal(options.requireEmailVerification, true);
  }
});
