-- ORBTIME — esquema para la fase 2 (sincronizar Mac ↔ iPhone).
--
-- Cómo aplicarlo:
--   1. Crea un proyecto en supabase.com
--   2. Authentication -> Sign In / Providers: apaga "Allow new users to sign
--      up" y "Allow anonymous sign-ins". Las cuentas del equipo se crean por
--      invitación.
--   3. SQL Editor -> pega este archivo -> Run
--   4. Da de alta al equipo (al final de este archivo)
--   5. Copia URL y anon key a un archivo .env (mira .env.example)
--
-- Quién ve qué: solo quien está en public.equipo. Tener sesión no basta. Con
-- rol 'caja' abre cuentas, cobra y marca salidas; con 'consulta' solo mira.
-- Nadie borra desde la app. Sin sesión (la anon key sola) no se ve nada.
--
-- El prototipo de macOS funciona sin esto: guarda todo en disco. Estas tablas
-- son el espejo del modelo local (src/tipos.ts), listo para cuando haya un
-- segundo dispositivo con el que sincronizar.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- paquetes --

create table if not exists public.paquetes (
  id                 text primary key,
  nombre             text        not null,
  color              text        not null default '#4ea1ff',
  precio_hora        numeric(10,2) not null check (precio_hora >= 0),
  precio_dia         numeric(10,2) not null check (precio_dia >= 0),
  precio_all_access  numeric(10,2) not null check (precio_all_access >= 0),
  precio_happy_hour  numeric(10,2)          check (precio_happy_hour is null or precio_happy_hour >= 0),
  orden              integer     not null default 0,
  actualizado_en     timestamptz not null default now()
);

comment on column public.paquetes.precio_happy_hour is
  'Precio del all access en happy hour. null = este paquete no tiene happy hour.';

-- ---------------------------------------------------------------- cuentas ---

create table if not exists public.cuentas (
  id             text primary key,
  numero         integer     not null,
  nombre         text        not null,
  paquete_id     text        not null references public.paquetes(id) on update cascade,
  notas          text        not null default '',
  fecha          date        not null,
  abierta_en     timestamptz not null default now(),
  cerrada_en     timestamptz,
  total_cobrado  numeric(10,2),
  -- 'transferencia' solo llega de cuentas cobradas con la v0.1.
  metodo_pago    text        check (metodo_pago in ('efectivo','tarjeta','transferencia')),
  actualizado_en timestamptz not null default now(),

  -- Una cuenta cobrada tiene que tener total y método; una abierta, ninguno.
  constraint cuenta_cobro_coherente check (
    (cerrada_en is null and total_cobrado is null and metodo_pago is null)
    or
    (cerrada_en is not null and total_cobrado is not null and metodo_pago is not null)
  )
);

create index if not exists cuentas_fecha_idx on public.cuentas (fecha desc);
-- El consecutivo "Cuenta 3" es único dentro del día, no de toda la historia.
create unique index if not exists cuentas_numero_del_dia_idx on public.cuentas (fecha, numero);
create index if not exists cuentas_abiertas_idx on public.cuentas (cerrada_en) where cerrada_en is null;

-- --------------------------------------------------------------- personas ---

create table if not exists public.personas (
  id             text primary key,
  cuenta_id      text        not null references public.cuentas(id) on delete cascade,
  nombre         text        not null,
  entrada        timestamptz not null default now(),
  salida         timestamptz,
  -- Cómo paga: por hora, pase de día o pase all access.
  modalidad      text        not null default 'tiempo'
                 check (modalidad in ('tiempo','dia','all_access')),
  estudiante     boolean     not null default false,
  -- Umbrales de alarma ya avisados. Compartirlos evita que el iPhone repita
  -- una notificación que la Mac ya dio.
  alarmas_vistas integer[]   not null default '{}',
  actualizado_en timestamptz not null default now(),

  constraint salida_despues_de_entrada check (salida is null or salida >= entrada)
);

create index if not exists personas_cuenta_idx on public.personas (cuenta_id);
create index if not exists personas_dentro_idx on public.personas (salida) where salida is null;

-- ----------------------------------------------------------------- equipo ---
-- Quién opera la caja. Se llena a mano desde el SQL Editor (ver el final);
-- desde la app solo se lee la fila propia, para saber el rol.

create table if not exists public.equipo (
  user_id  uuid primary key references auth.users(id) on delete cascade,
  rol      text not null check (rol in ('caja','consulta'))
);

-- Las políticas preguntan por el equipo con estas dos funciones. Viven en un
-- esquema que la API no expone y corren como su dueño, así que no dependen
-- de las políticas de equipo.
create schema if not exists privado;
revoke all on schema privado from public, anon;
grant usage on schema privado to authenticated;

create or replace function privado.es_del_equipo()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.equipo where user_id = (select auth.uid()));
$$;

create or replace function privado.es_caja()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.equipo where user_id = (select auth.uid()) and rol = 'caja'
  );
$$;

revoke all on function privado.es_del_equipo(), privado.es_caja() from public, anon;
grant execute on function privado.es_del_equipo(), privado.es_caja() to authenticated;

-- --------------------------------------------- marca de última escritura ----

create or replace function public.tocar_actualizado_en()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.actualizado_en = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['paquetes','cuentas','personas'] loop
    execute format(
      'drop trigger if exists tocar_%1$s on public.%1$s;
       create trigger tocar_%1$s before update on public.%1$s
       for each row execute function public.tocar_actualizado_en();', t);
  end loop;
end;
$$;

-- ------------------------------------------------------------------- RLS ----
-- Un solo local. Para varias sucursales habría que agregar local_id y
-- filtrar por él aquí.

alter table public.paquetes enable row level security;
alter table public.cuentas  enable row level security;
alter table public.personas enable row level security;
alter table public.equipo   enable row level security;

drop policy if exists "equipo_ve_su_fila" on public.equipo;
create policy "equipo_ve_su_fila" on public.equipo
  for select to authenticated using (user_id = (select auth.uid()));

-- El equipo lee; solo caja escribe. Nadie borra desde la app: no hay grant
-- ni política de DELETE. Si la sincronización llega a necesitarlo, se agregan
-- los dos, la política con privado.es_caja().
do $$
declare t text;
begin
  foreach t in array array['paquetes','cuentas','personas'] loop
    -- Las de la primera versión dejaban entrar a cualquiera con sesión.
    execute format('drop policy if exists "equipo_lee_%1$s" on public.%1$s;', t);
    execute format('drop policy if exists "equipo_escribe_%1$s" on public.%1$s;', t);

    execute format('drop policy if exists "equipo_ve_%1$s" on public.%1$s;', t);
    execute format(
      'create policy "equipo_ve_%1$s" on public.%1$s
       for select to authenticated using ((select privado.es_del_equipo()));', t);

    execute format('drop policy if exists "caja_agrega_%1$s" on public.%1$s;', t);
    execute format(
      'create policy "caja_agrega_%1$s" on public.%1$s
       for insert to authenticated with check ((select privado.es_caja()));', t);

    execute format('drop policy if exists "caja_edita_%1$s" on public.%1$s;', t);
    execute format(
      'create policy "caja_edita_%1$s" on public.%1$s
       for update to authenticated
       using ((select privado.es_caja())) with check ((select privado.es_caja()));', t);
  end loop;
end;
$$;

-- -------------------------------------------------------------- permisos ----
-- Explícitos: los proyectos nuevos de Supabase ya no los dan solos, y los
-- viejos le daban todo también a anon. Sin sesión no se toca nada.

revoke all on public.paquetes, public.cuentas, public.personas, public.equipo
  from anon, authenticated;
grant select, insert, update on public.paquetes, public.cuentas, public.personas
  to authenticated;
grant select on public.equipo to authenticated;

-- -------------------------------------------------------------- realtime ----
-- Con esto, marcar una salida en el iPhone se ve en la Mac al instante.

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end;
$$;

alter publication supabase_realtime add table public.cuentas;
alter publication supabase_realtime add table public.personas;
alter publication supabase_realtime add table public.paquetes;

-- Realtime necesita la fila completa para calcular los cambios.
alter table public.cuentas  replica identity full;
alter table public.personas replica identity full;
alter table public.paquetes replica identity full;

-- --------------------------------------------------------------- reporte ----
-- El mismo corte del día que exporta la app, pero calculado en Postgres.
-- security_invoker: la vista respeta las políticas de arriba. Sin esto
-- correría como su dueño (postgres) y se saltaría RLS.

create or replace view public.reporte_dia
with (security_invoker = true) as
select
  c.fecha,
  c.id                                                as cuenta_id,
  c.nombre                                            as cuenta,
  p.nombre                                            as persona,
  p.modalidad,
  p.estudiante,
  p.entrada,
  p.salida,
  round(extract(epoch from (coalesce(p.salida, now()) - p.entrada)) / 60.0, 1) as minutos,
  -- Se cobra la hora empezada; en los pases de día no aplica.
  case when p.modalidad = 'tiempo'
       then ceil(extract(epoch from (coalesce(p.salida, now()) - p.entrada)) / 3600.0)
  end                                                 as horas_cobradas,
  pq.nombre                                           as paquete,
  c.total_cobrado,
  c.metodo_pago
from public.cuentas c
join public.personas p on p.cuenta_id = c.id
join public.paquetes pq on pq.id = c.paquete_id
order by c.fecha desc, c.abierta_en desc, p.entrada;

revoke all on public.reporte_dia from anon, authenticated;
grant select on public.reporte_dia to authenticated;

-- ------------------------------------------------------- datos del negocio --
-- Los tres paquetes tal como están en la caja. Si los cambias en Ajustes,
-- vuelve a correr esta parte o deja que la app los suba.

insert into public.paquetes
  (id, nombre, color, precio_hora, precio_dia, precio_all_access, precio_happy_hour, orden)
values
  ('black', 'Black', '#8b93a7', 59, 180, 200, null, 0),
  ('blue',  'Blue',  '#4ea1ff', 75, 240, 280, null, 1),
  ('gold',  'Gold',  '#ffb03a', 90, 290, 330,  240, 2)
on conflict (id) do update set
  nombre            = excluded.nombre,
  color             = excluded.color,
  precio_hora       = excluded.precio_hora,
  precio_dia        = excluded.precio_dia,
  precio_all_access = excluded.precio_all_access,
  precio_happy_hour = excluded.precio_happy_hour,
  orden             = excluded.orden;

-- ---------------------------------------------------------- dar de alta ----
-- Primero invita a la persona (Authentication -> Users -> Invite user) y
-- luego, aquí mismo, dale su rol:
--
--   insert into public.equipo (user_id, rol)
--   select id, 'caja' from auth.users where email = 'caja@ejemplo.mx';
--
-- Quitarle el acceso:
--
--   delete from public.equipo
--   where user_id = (select id from auth.users where email = 'caja@ejemplo.mx');
