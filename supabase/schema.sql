-- ═══════════════════════════════════════════════════════════════════
-- AgroScanner — Esquema de referencia para Supabase (PostgreSQL)
--
-- Cómo usar:
--   1. Crear un proyecto en https://supabase.com
--   2. Abrir el SQL Editor y ejecutar este archivo completo
--   3. Copiar la URL y la anon key del proyecto a tu .env
--      (ver frontend/AgroScannerApp/.env.example)
--
-- Contexto:
--   La app es offline-first: sincroniza únicamente cuando el usuario
--   acepta compartir datos (usuarios.compartir_datos = true).
--   Los invitados (id = 'guest') y los datos locales nunca se suben.
--   El id de usuarios es el mismo UUID de auth.users (Supabase Auth).
--
--   Nota de terminología: la app DETECTA enfermedades; no emite
--   diagnósticos. El módulo de ML está en desarrollo (ver /ml-model).
-- ═══════════════════════════════════════════════════════════════════

-- ── Tablas ─────────────────────────────────────────────────────────

create table if not exists public.usuarios (
  id               uuid primary key references auth.users (id) on delete cascade,
  nombre           text not null,
  email            text,
  zona_agricola    text,
  telefono         text,
  compartir_datos  boolean not null default false,
  fecha_creacion   timestamptz not null default now()
);

create table if not exists public.parcelas (
  id                uuid primary key,
  alias             text not null,
  geometria         jsonb not null default '[]'::jsonb,
  metros_cuadrados  double precision,
  area_timestamp    timestamptz,
  usuario_id        uuid not null references public.usuarios (id) on delete cascade,
  fecha_creacion    timestamptz not null default now()
);

create table if not exists public.cultivos (
  id                    integer primary key,
  nombre                text unique not null,
  tratamiento_sugerido  text
);

create table if not exists public.enfermedades (
  id           integer primary key,
  nombre       text unique not null,
  descripcion  text not null
);

create table if not exists public.cultivo_enfermedad (
  cultivo_id     integer not null references public.cultivos (id) on delete cascade,
  enfermedad_id  integer not null references public.enfermedades (id) on delete cascade,
  tratamiento    text not null,
  primary key (cultivo_id, enfermedad_id)
);

create table if not exists public.detecciones (
  id               uuid primary key,
  usuario_id       uuid not null references public.usuarios (id) on delete cascade,
  parcela_id       uuid not null references public.parcelas (id) on delete cascade,
  cultivo_id       integer not null references public.cultivos (id),
  enfermedad_id    integer references public.enfermedades (id),
  imagen_uri       text not null,
  nivel_confianza  double precision not null,  -- escala 0-100
  latitud          double precision,
  longitud         double precision,
  pin_latitud      double precision not null,
  pin_longitud     double precision not null,
  compartido       boolean not null default true,
  fecha_creacion   timestamptz not null default now()
);

create index if not exists idx_parcelas_usuario    on public.parcelas (usuario_id);
create index if not exists idx_detecciones_usuario on public.detecciones (usuario_id);
create index if not exists idx_detecciones_parcela on public.detecciones (parcela_id);

-- ── Row Level Security ─────────────────────────────────────────────

alter table public.usuarios            enable row level security;
alter table public.parcelas            enable row level security;
alter table public.detecciones         enable row level security;
alter table public.cultivos            enable row level security;
alter table public.enfermedades        enable row level security;
alter table public.cultivo_enfermedad  enable row level security;

-- usuarios: cada quien ve y edita únicamente su propia fila
drop policy if exists usuarios_select_propio on public.usuarios;
create policy usuarios_select_propio on public.usuarios
  for select using ((select auth.uid()) = id);

drop policy if exists usuarios_insert_propio on public.usuarios;
create policy usuarios_insert_propio on public.usuarios
  for insert with check ((select auth.uid()) = id);

drop policy if exists usuarios_update_propio on public.usuarios;
create policy usuarios_update_propio on public.usuarios
  for update using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- parcelas y detecciones: acceso exclusivo del propietario
drop policy if exists parcelas_propietario on public.parcelas;
create policy parcelas_propietario on public.parcelas
  for all using ((select auth.uid()) = usuario_id)
  with check ((select auth.uid()) = usuario_id);

drop policy if exists detecciones_propietario on public.detecciones;
create policy detecciones_propietario on public.detecciones
  for all using ((select auth.uid()) = usuario_id)
  with check ((select auth.uid()) = usuario_id);

-- catálogos: lectura para cualquier usuario (datos de referencia)
drop policy if exists cultivos_lectura on public.cultivos;
create policy cultivos_lectura on public.cultivos
  for select using (true);

drop policy if exists enfermedades_lectura on public.enfermedades;
create policy enfermedades_lectura on public.enfermedades
  for select using (true);

drop policy if exists cultivo_enfermedad_lectura on public.cultivo_enfermedad;
create policy cultivo_enfermedad_lectura on public.cultivo_enfermedad
  for select using (true);

-- ── Datos de referencia (mismos que el seed local de la app) ───────

insert into public.cultivos (id, nombre, tratamiento_sugerido) values
  (1, 'Limón',   'Aplicar fertilizante rico en nitrógeno cada 30 días'),
  (2, 'Papaya',  'Riego constante y fertilizante orgánico mensual'),
  (3, 'Plátano', 'Aplicar mulch orgánico para retener humedad')
on conflict (id) do nothing;

insert into public.enfermedades (id, nombre, descripcion) values
  (1, 'HLB',             'Enfermedad del Huanglongbing causada por la bacteria Candidatus Liberibacter. Afecta el transporte de nutrientes en los vasos del floema.'),
  (2, 'Shigatoka Negra', 'Enfermedad fúngica causada por Mycosphaerella fijiensis. Produce manchas negras en las hojas.'),
  (3, 'Araña Roja',      'Plaga causada por Tetranychus urticae. Se alimenta de savia de las hojas causando decoloración y manchas amarillas.')
on conflict (id) do nothing;

insert into public.cultivo_enfermedad (cultivo_id, enfermedad_id, tratamiento) values
  (1, 1, 'Aplicar aceite de neem + cobre cada 15 días. Remover hojas afectadas. Control de pulgón vector.'),
  (3, 2, 'Aplicar fungicida a base de cobre cada 7 días. Mejorar circulación de aire. Evitar exceso de humedad.'),
  (2, 3, 'Aplicar acaricida natural (jabón potasio) cada semana. Introducir depredadores naturales como phytoseiulus.')
on conflict do nothing;

-- ── Storage: bucket para las imágenes de detecciones ───────────────

insert into storage.buckets (id, name, public)
values ('detecciones', 'detecciones', true)
on conflict (id) do nothing;

-- Los usuarios autenticados solo escriben dentro de su propia carpeta.
-- Ruta de los objetos: <usuario_id>/<deteccion_id>.<ext>
drop policy if exists detecciones_propias_insert on storage.objects;
create policy detecciones_propias_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'detecciones'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists detecciones_propias_update on storage.objects;
create policy detecciones_propias_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'detecciones'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists detecciones_propias_delete on storage.objects;
create policy detecciones_propias_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'detecciones'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
