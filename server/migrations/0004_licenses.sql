-- Licencias de la nube. OpenDomus es gratis y local por defecto; la nube es opcional y una casa
-- en la nube necesita una licencia. Hoy las emite Juan a mano (beta por invitación); mañana las
-- emite solo el cobro (webhook). Los invitados a una casa no necesitan licencia: es de la casa.

create table cloud_licenses (
  id text primary key,
  code_hash text not null unique,              -- SHA-256 del código: el código en claro no se guarda
  plan text not null,                          -- 'beta'; después 'familia', …
  max_households integer not null default 1,
  used integer not null default 0,
  status text not null default 'active' check (status in ('active', 'revoked')),
  expires_at integer,                          -- hasta cuándo se puede canjear (null: sin vencimiento)
  source text not null default 'manual',       -- 'manual'; después 'paddle', 'mercadopago'
  external_id text,                            -- id del cobro o de la suscripción, si viene de un pago
  note text,
  created_at integer not null
);

-- El plan de cada casa. En pausa se puede bajar todo (nadie pierde acceso a sus datos) pero no subir.
create table household_plans (
  household_id text primary key references households ("id") on delete cascade,
  license_id text references cloud_licenses ("id"),
  plan text not null,
  status text not null default 'active' check (status in ('active', 'paused')),
  period_end integer,                          -- fin del período pago (null en la beta)
  updated_at integer not null
);

-- Las casas que ya existían (pruebas) quedan en el plan beta.
insert into household_plans (household_id, plan, status, updated_at)
  select id, 'beta', 'active', created_at from households;
