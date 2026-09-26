-- ORBTIME — esquema para la fase 2 (sincronizar Mac ↔ iPhone).
--
-- Cómo aplicarlo:
--   1. Crea un proyecto en supabase.com
--   2. SQL Editor -> pega este archivo -> Run
--   3. Copia URL y anon key a un archivo .env (mira .env.example)
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

-- --------------------------------------------- marca de última escritura ----

create or replace function public.tocar_actualizado_en()
returns trigger
language plpgsql
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
-- Un solo local: cualquier miembro del equipo que inicie sesión opera la caja.
-- Para varias sucursales habría que agregar local_id y filtrar por él aquí.

alter table public.paquetes enable row level security;
alter table public.cuentas  enable row level security;
alter table public.personas enable row level security;

do $$
declare t text;
begin
  foreach t in array array['paquetes','cuentas','personas'] loop
    execute format('drop policy if exists "equipo_lee_%1$s" on public.%1$s;', t);
    execute format(
      'create policy "equipo_lee_%1$s" on public.%1$s
       for select to authenticated using (true);', t);

    execute format('drop policy if exists "equipo_escribe_%1$s" on public.%1$s;', t);
    execute format(
      'create policy "equipo_escribe_%1$s" on public.%1$s
       for all to authenticated using (true) with check (true);', t);
  end loop;
end;
$$;

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

create or replace view public.reporte_dia as
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
