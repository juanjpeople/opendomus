-- Recuperación con el kit, sin depender del email. Del código del kit salen, en el dispositivo,
-- dos cosas independientes: la clave que abre la copia de las claves privadas y una prueba de que
-- se tiene el kit. El servidor guarda solo el hash de esa prueba: con él no puede abrir nada.
alter table user_keys add column recovery_verifier text;

-- Quien dejó la casa. Sus cambios viejos siguen en el registro de la casa y un dispositivo nuevo
-- los tiene que poder verificar (firma y rol de ese momento); los nuevos, el servidor ya no los acepta.
create table former_members (
  household_id text not null references households ("id") on delete cascade,
  user_id text not null references "user" ("id") on delete cascade,
  role text not null,
  removed_at integer not null,
  removed_by text not null,
  primary key (household_id, user_id)
);

-- Límite de intentos para lo que no pasa por Better Auth (recuperar con el kit, confirmar la
-- contraseña). Ventana fija: `count` intentos desde `window_start`.
create table attempts (
  key text primary key,
  count integer not null,
  window_start integer not null
);
