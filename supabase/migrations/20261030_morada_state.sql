-- Estado de Morada: una fila por colección del motor (users, listings, orders...).
-- Solo la Edge Function "api" accede (conexión directa); RLS sin políticas bloquea la API pública.
create table if not exists public.morada_kv (
  k text primary key,
  v jsonb not null,
  updated_at timestamptz not null default now()
);
create table if not exists public.morada_meta (
  id int primary key default 1 check (id = 1),
  version bigint not null default 0
);
insert into public.morada_meta (id, version) values (1, 0) on conflict do nothing;
alter table public.morada_kv enable row level security;
alter table public.morada_meta enable row level security;

-- Fotos de los avisos: públicas. Documentos legales: privados, se entregan con enlaces firmados.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
       ('docs', 'docs', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
