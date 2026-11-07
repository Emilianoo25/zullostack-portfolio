/**
 * Dónde se guardan los datos del panel.
 * - Modo PRUEBA: en el navegador (localStorage). Sirve para ver/probar el panel.
 * - Modo NUBE: Supabase (cuenta de Dulce Ruby). Se activa cargando URL + clave publicable
 *   en src/data/dulce-ruby-panel.ts o en las variables PUBLIC_DR_SUPABASE_URL / PUBLIC_DR_SUPABASE_KEY.
 *
 * La lógica (qué stock se descuenta, cuánto cuesta) vive en modelo.ts y es la misma en los dos modos.
 * El backend sólo persiste el cambio; en la nube los movimientos se aplican de forma atómica (RPC).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { panelConfig } from '../../../data/dulce-ruby-panel';
import type { Datos, Insumo, Movimiento, Presentacion, Producto } from './modelo';

export type Cambio =
  | { t: 'insumos'; items: Insumo[] }
  | { t: 'borrarInsumo'; id: string }
  | { t: 'producto'; item: Producto }
  | { t: 'borrarProducto'; id: string }
  | { t: 'presentaciones'; items: Presentacion[] }
  | { t: 'borrarPresentacion'; id: string }
  | { t: 'registrar'; mov: Movimiento }
  | { t: 'deshacer'; mov: Movimiento }
  | { t: 'reemplazarTodo' };

export interface Backend {
  modo: 'prueba' | 'nube';
  cargar(): Promise<Datos | null>;
  /** Persiste `cambio`. `siguiente` es el estado completo resultante (lo usa el modo prueba). */
  sync(cambio: Cambio, siguiente: Datos): Promise<void>;
}

/* ─────────────────────────── configuración ─────────────────────────── */

export function configNube(): { url: string; key: string } | null {
  const env = import.meta.env as Record<string, string | undefined>;
  const url = (env.PUBLIC_DR_SUPABASE_URL || panelConfig.supabaseUrl || '').trim();
  const key = (env.PUBLIC_DR_SUPABASE_KEY || panelConfig.supabaseKey || '').trim();
  return url && key ? { url, key } : null;
}

/* ─────────────────────────── modo prueba ─────────────────────────── */

const CLAVE = 'dr-panel-prueba-v1';

export function backendPrueba(): Backend {
  return {
    modo: 'prueba',
    async cargar() {
      try {
        const raw = localStorage.getItem(CLAVE);
        return raw ? (JSON.parse(raw) as Datos) : null;
      } catch {
        return null;
      }
    },
    async sync(_c, siguiente) {
      try {
        localStorage.setItem(CLAVE, JSON.stringify(siguiente));
      } catch {
        throw new Error('No se pudo guardar en este navegador (¿modo incógnito o memoria llena?).');
      }
    },
  };
}

/* ─────────────────────────── modo nube (Supabase) ─────────────────────────── */

type Fila = Record<string, unknown>;
const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));

const insumoAFila = (i: Insumo): Fila => ({
  id: i.id,
  nombre: i.nombre,
  unidad: i.unidad,
  stock: i.stock,
  minimo: i.minimo,
  costo: i.costo,
  orden: i.orden,
});
const filaAInsumo = (f: Fila): Insumo => ({
  id: String(f.id),
  nombre: String(f.nombre),
  unidad: f.unidad as Insumo['unidad'],
  stock: num(f.stock),
  minimo: num(f.minimo),
  costo: num(f.costo),
  orden: num(f.orden),
});

const productoAFila = (p: Producto): Fila => ({
  id: p.id,
  nombre: p.nombre,
  emoji: p.emoji,
  rinde: p.rinde,
  receta: p.receta,
  orden: p.orden,
});
const filaAProducto = (f: Fila): Producto => ({
  id: String(f.id),
  nombre: String(f.nombre),
  emoji: String(f.emoji ?? ''),
  rinde: num(f.rinde) || 1,
  receta: (f.receta as Producto['receta']) ?? [],
  orden: num(f.orden),
});

const presentacionAFila = (p: Presentacion): Fila => ({
  id: p.id,
  producto_id: p.productoId,
  nombre: p.nombre,
  unidades: p.unidades,
  precio: p.precio,
  extras: p.extras,
  orden: p.orden,
});
const filaAPresentacion = (f: Fila): Presentacion => ({
  id: String(f.id),
  productoId: String(f.producto_id),
  nombre: String(f.nombre),
  unidades: num(f.unidades),
  precio: num(f.precio),
  extras: (f.extras as Presentacion['extras']) ?? [],
  orden: num(f.orden),
});

const filaAMovimiento = (f: Fila): Movimiento => ({
  id: String(f.id),
  tipo: f.tipo as Movimiento['tipo'],
  fecha: String(f.fecha),
  refId: (f.ref_id as string | null) ?? null,
  productoId: (f.producto_id as string | null) ?? null,
  cantidad: num(f.cantidad),
  unidades: num(f.unidades),
  monto: num(f.monto),
  costo: num(f.costo),
  descripcion: String(f.descripcion ?? ''),
  deltas: (f.deltas as Movimiento['deltas']) ?? [],
  creado: String(f.creado),
});

function chequear<T>(r: { data: T; error: { message: string; code?: string } | null }): T {
  if (r.error) {
    if (r.error.code === '42P01' || /does not exist|schema cache/i.test(r.error.message)) {
      throw new Error('Faltan las tablas del panel en Supabase: corré el archivo supabase/dulce-ruby-panel.sql.');
    }
    throw new Error(r.error.message);
  }
  return r.data;
}

export function backendNube(sb: SupabaseClient): Backend {
  return {
    modo: 'nube',
    async cargar() {
      const [ins, prod, pres, movs] = await Promise.all([
        sb.from('dr_insumos').select('*').order('orden').order('nombre'),
        sb.from('dr_productos').select('*').order('orden'),
        sb.from('dr_presentaciones').select('*').order('orden'),
        sb.from('dr_movimientos').select('*').order('fecha', { ascending: false }).order('creado', { ascending: false }).limit(2000),
      ]);
      return {
        insumos: (chequear(ins) as Fila[]).map(filaAInsumo),
        productos: (chequear(prod) as Fila[]).map(filaAProducto),
        presentaciones: (chequear(pres) as Fila[]).map(filaAPresentacion),
        movimientos: (chequear(movs) as Fila[]).map(filaAMovimiento),
      };
    },
    async sync(c) {
      switch (c.t) {
        case 'insumos':
          if (c.items.length) chequear(await sb.from('dr_insumos').upsert(c.items.map(insumoAFila)));
          return;
        case 'borrarInsumo':
          chequear(await sb.from('dr_insumos').delete().eq('id', c.id));
          return;
        case 'producto':
          chequear(await sb.from('dr_productos').upsert(productoAFila(c.item)));
          return;
        case 'borrarProducto':
          chequear(await sb.from('dr_productos').delete().eq('id', c.id));
          return;
        case 'presentaciones':
          if (c.items.length) chequear(await sb.from('dr_presentaciones').upsert(c.items.map(presentacionAFila)));
          return;
        case 'borrarPresentacion':
          chequear(await sb.from('dr_presentaciones').delete().eq('id', c.id));
          return;
        case 'registrar':
          chequear(await sb.rpc('dr_registrar', { p_mov: c.mov }));
          return;
        case 'deshacer':
          chequear(await sb.rpc('dr_deshacer', { p_id: c.mov.id }));
          return;
        case 'reemplazarTodo':
          throw new Error('No disponible en la nube.');
      }
    },
  };
}
