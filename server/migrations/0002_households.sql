-- Casas, membresías, claves e invitaciones. Cifrado de extremo a extremo: todo lo que es de la
-- casa (su nombre, las claves de cada nivel) llega acá ya cifrado. El servidor ordena y autoriza;
-- no puede leer.

-- Claves de cada persona. Las públicas, en claro (para que otros le entreguen claves);
-- las privadas, cifradas con una clave derivada de su contraseña EN SU DISPOSITIVO,
-- y otra copia con la clave de su kit de recuperación.
create table user_keys (
  user_id text primary key references "user" ("id") on delete cascade,
  kdf_version integer not null,
  enc_public_key text not null,         -- X25519, base64url
  sign_public_key text not null,        -- Ed25519, base64url
  private_keys text not null,           -- AES-256-GCM con la clave de la contraseña
  recovery_private_keys text not null,  -- AES-256-GCM con la clave del kit de recuperación
  created_at integer not null,
  updated_at integer not null
);

create table households (
  id text primary key,
  encrypted_name text not null,              -- cifrado con la clave Familia
  family_key_version integer not null default 1,
  adults_key_version integer not null default 1,
  created_by text not null references "user" ("id"),
  created_at integer not null
);

create table memberships (
  household_id text not null references households ("id") on delete cascade,
  user_id text not null references "user" ("id") on delete cascade,
  role text not null check (role in ('admin', 'adult', 'kid')),
  joined_at integer not null,
  primary key (household_id, user_id)
);
create index memberships_user_idx on memberships (user_id);

-- Cada clave de nivel (Familia, Adultos, Privado) "ensobrada" para cada persona que la puede
-- usar: cifrada con su clave pública. Sacar a alguien = nueva versión sin sobre para esa persona.
create table key_envelopes (
  household_id text not null references households ("id") on delete cascade,
  scope text not null check (scope in ('family', 'adults', 'private')),
  version integer not null,
  recipient_user_id text not null references "user" ("id") on delete cascade,
  envelope text not null,
  created_by text not null,
  created_at integer not null,
  primary key (household_id, scope, version, recipient_user_id)
);

-- Invitaciones por link o QR. El link lleva un secreto en el fragmento (#…), que el navegador
-- nunca manda al servidor. De ese secreto salen dos claves: una para probar que tenés el link
-- (acá se guarda solo su hash) y otra que abre las claves de la casa (acá van ya cifradas con ella).
create table invites (
  id text primary key,
  household_id text not null references households ("id") on delete cascade,
  role text not null check (role in ('admin', 'adult', 'kid')),
  token_hash text not null,
  wrapped_keys text not null,
  created_by text not null references "user" ("id"),
  created_at integer not null,
  expires_at integer not null,
  used_at integer,
  used_by text
);
create index invites_household_idx on invites (household_id);
