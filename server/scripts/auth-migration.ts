/**
 * Genera el SQL de las tablas de Better Auth (usuarios, sesiones, cuentas, verificaciones,
 * límite de pedidos) para una migración de D1. Usa una SQLite en memoria (node:sqlite).
 *
 * Uso: `npm run db:auth-migration --workspace server > migrations/000X_auth.sql`
 */
import { DatabaseSync } from "node:sqlite";
import { getMigrations } from "better-auth/db/migration";
import { authOptions } from "../src/auth-options.ts";

const options = authOptions(new DatabaseSync(":memory:"), {
  secret: "solo-para-generar-el-esquema-0123456789",
  baseURL: "http://localhost",
  trustedOrigins: [],
  sendEmail: async () => {},
});

const { compileMigrations } = await getMigrations(options);
process.stdout.write(`-- Generado por scripts/auth-migration.ts (Better Auth). No editar a mano.\n${await compileMigrations()}\n`);
