/// <reference types="@cloudflare/workers-types" />
// eslint-disable-next-line @typescript-eslint/triple-slash-reference -- El tsconfig web excluye server; el navegador de prueba necesita esta declaración de Node 24.
/// <reference path="../scripts/node-sqlite.d.ts" />
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { Hono } from "hono";
import { operatorAuth, operatorHash, operatorRequestAllowed, operatorSession } from "../src/operator-auth";
import type { AppEnv, Env } from "../src/env";

export const TEST_KEY = "ab".repeat(32);
export const TEST_TOTP = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
export async function operatorFixture(origin = "https://app.example") {
  const database = new DatabaseSync(":memory:");
  database.exec("CREATE TABLE attempts (key TEXT PRIMARY KEY, count INTEGER NOT NULL, window_start INTEGER NOT NULL)");
  database.exec(readFileSync("server/migrations/0007_operator_sessions.sql", "utf8"));
  function prepare(sql: string, args: (string | number | null)[] = []) {
    return {
      bind: (...values: (string | number | null)[]) => prepare(sql, values),
      first: async () => database.prepare(sql).get(...args) ?? null,
      run: async () => ({ success: true, meta: { changes: database.prepare(sql).run(...args).changes } }),
    };
  }
  const env = {
    APP_ORIGIN: origin, OPERATOR_EMAIL: "owner@example.com", OPERATOR_KEY_HASH: await operatorHash(TEST_KEY), OPERATOR_TOTP_SECRET: TEST_TOTP,
    DB: { prepare, batch: async (statements: { run(): Promise<unknown> }[]) => {
      database.exec("BEGIN");
      try { const result = []; for (const statement of statements) result.push(await statement.run()); database.exec("COMMIT"); return result; }
      catch (error) { database.exec("ROLLBACK"); throw error; }
    } },
  } as unknown as Env;
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => { await next(); c.header("Cache-Control", "no-store"); });
  app.route("/api/admin/auth", operatorAuth);
  app.use("/api/admin/platform/*", async (c, next) => {
    const email = operatorRequestAllowed(c.req.raw, c.env) && await operatorSession(c.req.raw, c.env);
    if (!email) return c.json({ error: "unauthorized" }, 404);
    c.set("operatorEmail", email);
    return next();
  });
  return { database, env, app };
}
