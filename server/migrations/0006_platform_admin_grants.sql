-- Un correo autodeclarado nunca otorga administración global.
-- El operador habilita una cuenta específica desde la API protegida por ADMIN_TOKEN.
create table platform_admin_grants (
  user_id text primary key references "user" (id) on delete cascade,
  granted_at integer not null
);
