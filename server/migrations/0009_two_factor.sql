-- Verificación en dos pasos de la cuenta (opcional): código de una app autenticadora, códigos de
-- respaldo y llaves de acceso (passkeys) como segundo paso. Tablas de los plugins `twoFactor` y
-- `passkey` de Better Auth, generadas con su esquema (ver server/src/auth-options.ts).
-- El secreto y los códigos de respaldo se guardan cifrados con BETTER_AUTH_SECRET.
alter table "user" add column "twoFactorEnabled" integer default 0;

create table "twoFactor" ("id" text not null primary key, "secret" text not null, "backupCodes" text not null, "userId" text not null references "user" ("id") on delete cascade, "verified" integer, "failedVerificationCount" integer, "lockedUntil" date);

create table "passkey" ("id" text not null primary key, "name" text, "publicKey" text not null, "userId" text not null references "user" ("id") on delete cascade, "credentialID" text not null, "counter" integer not null, "deviceType" text not null, "backedUp" integer not null, "transports" text, "createdAt" date, "aaguid" text);

create index "twoFactor_secret_idx" on "twoFactor" ("secret");

create index "twoFactor_userId_idx" on "twoFactor" ("userId");

create index "passkey_userId_idx" on "passkey" ("userId");

create index "passkey_credentialID_idx" on "passkey" ("credentialID");
