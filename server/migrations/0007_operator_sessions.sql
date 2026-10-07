-- Credenciales de operador independientes de las cuentas domésticas.
CREATE TABLE operator_sessions (
  token_hash TEXT PRIMARY KEY,
  config_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX operator_sessions_expiry ON operator_sessions(expires_at);
CREATE TABLE operator_totp (
  config_hash TEXT PRIMARY KEY,
  last_step INTEGER NOT NULL
);
