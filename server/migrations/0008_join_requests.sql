-- Pedidos para entrar a una casa. Abrir una invitación ya no hace miembro a nadie: deja un pedido
-- con las claves ya ensobradas para quien entra, y un admin lo aprueba (o lo rechaza). Así, un
-- link reenviado a quien no era no alcanza para entrar.
create table join_requests (
  invite_id text primary key references invites ("id") on delete cascade,
  household_id text not null references households ("id") on delete cascade,
  user_id text not null references "user" ("id") on delete cascade,
  role text not null check (role in ('admin', 'adult', 'kid')),
  envelopes text not null,  -- JSON: [{ scope, version, envelope }], cifrados para quien entra
  created_at integer not null
);
create index join_requests_household_idx on join_requests (household_id);
create index join_requests_user_idx on join_requests (user_id);
