-- Operación del servicio: actividad, avisos de inactividad, feedback y auditoría administrativa.
-- El contenido de las casas sigue cifrado; estas tablas guardan solo metadatos operativos.

alter table households add column last_activity_at integer;
update households set last_activity_at = created_at where last_activity_at is null;
create index households_activity_idx on households (last_activity_at);

create table inactivity_notices (
  household_id text not null references households (id) on delete cascade,
  days_before_pause integer not null check (days_before_pause in (30, 7, 1)),
  due_at integer not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'cancelled')),
  created_at integer not null,
  updated_at integer not null,
  primary key (household_id, days_before_pause)
);
create index inactivity_notices_status_idx on inactivity_notices (status, due_at);

create table feedback (
  id text primary key,
  user_id text references "user" (id) on delete set null,
  email text,
  category text not null check (category in ('idea', 'problem', 'question', 'other')),
  message text not null,
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at integer not null,
  updated_at integer not null
);
create index feedback_status_idx on feedback (status, created_at);

create table admin_audit (
  id text primary key,
  actor_user_id text references "user" (id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text not null,
  details text,
  created_at integer not null
);
create index admin_audit_created_idx on admin_audit (created_at);
