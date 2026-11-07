-- ═══════════════════════════════════════════════════════════════════
--  Panel Dulce Ruby — base de datos (Supabase / Postgres)
--  Cómo usarlo: Supabase → SQL Editor → New query → pegar TODO → Run.
--  Se puede correr más de una vez sin romper nada.
--
--  Cada fila tiene dueña (owner = usuaria logueada). Las políticas RLS
--  hacen que cada cuenta vea y toque SÓLO sus propios datos.
-- ═══════════════════════════════════════════════════════════════════

-- ── Insumos (stock de materia prima y envases) ─────────────────────
create table if not exists public.dr_insumos (
  id         uuid primary key default gen_random_uuid(),
  owner      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nombre     text not null check (length(trim(nombre)) > 0),
  unidad     text not null check (unidad in ('g', 'ml', 'u')),
  stock      numeric not null default 0,
  minimo     numeric not null default 0 check (minimo >= 0),
  costo      numeric not null default 0 check (costo >= 0),   -- $ por g / ml / unidad (última compra)
  orden      integer not null default 0,
  created_at timestamptz not null default now()
);

-- ── Productos (receta por tanda) ───────────────────────────────────
create table if not exists public.dr_productos (
  id         uuid primary key default gen_random_uuid(),
  owner      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nombre     text not null check (length(trim(nombre)) > 0),
  emoji      text not null default '',
  rinde      numeric not null default 1 check (rinde > 0),     -- unidades por tanda
  receta     jsonb not null default '[]'::jsonb,                 -- [{ insumoId, cantidad }]
  orden      integer not null default 0,
  created_at timestamptz not null default now()
);

-- ── Presentaciones (cómo se vende: unidad, bandeja, caja…) ─────────
create table if not exists public.dr_presentaciones (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  producto_id uuid not null references public.dr_productos (id) on delete cascade,
  nombre      text not null check (length(trim(nombre)) > 0),
  unidades    numeric not null default 1 check (unidades > 0),
  precio      numeric not null default 0 check (precio >= 0),
  extras      jsonb not null default '[]'::jsonb,                -- envases por venta [{ insumoId, cantidad }]
  orden       integer not null default 0,
  created_at  timestamptz not null default now()
);

-- ── Movimientos (compras, producción, ventas, ajustes) ─────────────
create table if not exists public.dr_movimientos (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  tipo        text not null check (tipo in ('compra', 'produccion', 'venta', 'ajuste')),
  fecha       date not null default current_date,
  ref_id      uuid,
  producto_id uuid,
  cantidad    numeric not null default 0,
  unidades    numeric not null default 0,
  monto       numeric not null default 0,     -- $ pagado (compra) o cobrado (venta)
  costo       numeric not null default 0,     -- costo de mercadería
  descripcion text not null default '',
  deltas      jsonb not null default '[]'::jsonb,  -- cambios de stock aplicados (para deshacer)
  creado      timestamptz not null default now()
);

create index if not exists dr_insumos_owner_idx         on public.dr_insumos (owner);
create index if not exists dr_productos_owner_idx       on public.dr_productos (owner);
create index if not exists dr_presentaciones_owner_idx  on public.dr_presentaciones (owner);
create index if not exists dr_presentaciones_prod_idx   on public.dr_presentaciones (producto_id);
create index if not exists dr_movimientos_owner_fecha   on public.dr_movimientos (owner, fecha desc);

-- ── Seguridad: cada usuaria sólo ve lo suyo ────────────────────────
alter table public.dr_insumos        enable row level security;
alter table public.dr_productos      enable row level security;
alter table public.dr_presentaciones enable row level security;
alter table public.dr_movimientos    enable row level security;

do $$
declare t text;
begin
  foreach t in array array['dr_insumos', 'dr_productos', 'dr_presentaciones', 'dr_movimientos'] loop
    execute format('drop policy if exists "duena" on public.%I', t);
    execute format(
      'create policy "duena" on public.%I for all to authenticated
         using (owner = (select auth.uid())) with check (owner = (select auth.uid()))', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- ── Registrar un movimiento + aplicar sus cambios de stock (atómico) ──
create or replace function public.dr_registrar(p_mov jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  d jsonb;
  filas integer;
begin
  if auth.uid() is null then
    raise exception 'Sesión vencida: volvé a entrar.';
  end if;

  insert into public.dr_movimientos
    (id, tipo, fecha, ref_id, producto_id, cantidad, unidades, monto, costo, descripcion, deltas, creado)
  values (
    (p_mov ->> 'id')::uuid,
    p_mov ->> 'tipo',
    coalesce((p_mov ->> 'fecha')::date, current_date),
    nullif(p_mov ->> 'refId', '')::uuid,
    nullif(p_mov ->> 'productoId', '')::uuid,
    coalesce((p_mov ->> 'cantidad')::numeric, 0),
    coalesce((p_mov ->> 'unidades')::numeric, 0),
    coalesce((p_mov ->> 'monto')::numeric, 0),
    coalesce((p_mov ->> 'costo')::numeric, 0),
    coalesce(p_mov ->> 'descripcion', ''),
    coalesce(p_mov -> 'deltas', '[]'::jsonb),
    coalesce((p_mov ->> 'creado')::timestamptz, now())
  );

  for d in select * from jsonb_array_elements(coalesce(p_mov -> 'deltas', '[]'::jsonb)) loop
    update public.dr_insumos
       set stock = stock + (d ->> 'delta')::numeric,
           costo = coalesce((d ->> 'costoNuevo')::numeric, costo)
     where id = (d ->> 'insumoId')::uuid;
    get diagnostics filas = row_count;
    if filas = 0 then
      raise exception 'Insumo % no encontrado', d ->> 'insumoId';
    end if;
  end loop;
end;
$$;

-- ── Deshacer un movimiento: devuelve el stock (y el costo si no cambió después) ──
create or replace function public.dr_deshacer(p_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  m public.dr_movimientos;
  d jsonb;
begin
  select * into m from public.dr_movimientos where id = p_id for update;
  if not found then
    raise exception 'Movimiento no encontrado';
  end if;

  for d in select * from jsonb_array_elements(m.deltas) loop
    update public.dr_insumos
       set stock = stock - (d ->> 'delta')::numeric,
           costo = case
                     when d ? 'costoNuevo' and d ? 'costoAnterior'
                          and abs(costo - (d ->> 'costoNuevo')::numeric) < 0.000001
                     then (d ->> 'costoAnterior')::numeric
                     else costo
                   end
     where id = (d ->> 'insumoId')::uuid;
  end loop;

  delete from public.dr_movimientos where id = p_id;
end;
$$;

revoke all on function public.dr_registrar(jsonb) from public, anon;
revoke all on function public.dr_deshacer(uuid)   from public, anon;
grant execute on function public.dr_registrar(jsonb) to authenticated;
grant execute on function public.dr_deshacer(uuid)   to authenticated;
