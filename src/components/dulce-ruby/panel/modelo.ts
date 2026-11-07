/**
 * Panel Dulce Ruby — modelo y cálculos (funciones puras).
 *
 * Unidades base: gramos (g), mililitros (ml) o unidades (u).
 * - Insumo.costo: $ por unidad base, tomado de la ÚLTIMA compra.
 * - Producto.receta: cantidades por TANDA; Producto.rinde: cuántas unidades salen por tanda.
 * - Presentacion.extras: envases que se usan por cada venta (caja, bandeja, bolsa…).
 * - Movimiento.deltas: cambios de stock aplicados → permiten deshacer exacto.
 */

export type Unidad = 'g' | 'ml' | 'u';

export interface Insumo {
  id: string;
  nombre: string;
  unidad: Unidad;
  stock: number;
  /** Aviso de "poco stock" cuando stock <= minimo (0 = sin aviso propio) */
  minimo: number;
  /** $ por unidad base (último precio de compra) */
  costo: number;
  orden: number;
}

export interface ItemReceta {
  insumoId: string;
  cantidad: number;
}

export interface Producto {
  id: string;
  nombre: string;
  emoji: string;
  /** Unidades que salen por tanda de receta */
  rinde: number;
  receta: ItemReceta[];
  orden: number;
}

export interface Presentacion {
  id: string;
  productoId: string;
  nombre: string;
  /** Unidades del producto que lleva (Caja de 15 → 15) */
  unidades: number;
  precio: number;
  /** Envases por cada venta */
  extras: ItemReceta[];
  orden: number;
}

export type TipoMovimiento = 'compra' | 'produccion' | 'venta' | 'ajuste';

export interface Delta {
  insumoId: string;
  delta: number;
  costoNuevo?: number;
  costoAnterior?: number;
}

export interface Movimiento {
  id: string;
  tipo: TipoMovimiento;
  /** YYYY-MM-DD */
  fecha: string;
  /** insumo (compra/ajuste), producto (producción) o presentación (venta) */
  refId: string | null;
  productoId: string | null;
  cantidad: number;
  /** Unidades de producto involucradas (producción/venta) */
  unidades: number;
  /** Plata: lo que pagaste (compra) o cobraste (venta) */
  monto: number;
  /** Costo de mercadería (producción/venta) */
  costo: number;
  descripcion: string;
  deltas: Delta[];
  /** ISO timestamp */
  creado: string;
}

export interface Datos {
  insumos: Insumo[];
  productos: Producto[];
  presentaciones: Presentacion[];
  movimientos: Movimiento[];
}

export const datosVacios = (): Datos => ({ insumos: [], productos: [], presentaciones: [], movimientos: [] });

/* ─────────────────────────── utilidades ─────────────────────────── */

export const nuevoId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });

/** Fecha local YYYY-MM-DD */
export const hoy = (d: Date = new Date()): string => {
  const z = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
};

export const mesDe = (fecha: string): string => fecha.slice(0, 7);

const EPS = 1e-9;
const redondear = (n: number, dec = 4) => Math.round(n * 10 ** dec) / 10 ** dec;

export type MapaInsumos = Map<string, Insumo>;
export const mapaInsumos = (d: Pick<Datos, 'insumos'>): MapaInsumos => new Map(d.insumos.map((i) => [i.id, i]));

/* ─────────────────────────── costos ─────────────────────────── */

export interface CostoProducto {
  /** Costo de UNA unidad del producto */
  porUnidad: number;
  /** Costo de una tanda */
  porTanda: number;
  desglose: { insumo: Insumo; cantidadPorUnidad: number; costoPorUnidad: number; parte: number }[];
  /** Insumos de la receta sin precio cargado */
  sinCosto: Insumo[];
  sinReceta: boolean;
}

export function costoProducto(p: Producto, mapa: MapaInsumos): CostoProducto {
  const rinde = p.rinde > 0 ? p.rinde : 1;
  const items = p.receta
    .map((it) => ({ it, insumo: mapa.get(it.insumoId) }))
    .filter((x): x is { it: ItemReceta; insumo: Insumo } => !!x.insumo && x.it.cantidad > 0);

  const desglose = items.map(({ it, insumo }) => {
    const cantidadPorUnidad = it.cantidad / rinde;
    return { insumo, cantidadPorUnidad, costoPorUnidad: cantidadPorUnidad * insumo.costo, parte: 0 };
  });
  const porUnidad = desglose.reduce((s, x) => s + x.costoPorUnidad, 0);
  desglose.forEach((x) => (x.parte = porUnidad > 0 ? x.costoPorUnidad / porUnidad : 0));
  desglose.sort((a, b) => b.costoPorUnidad - a.costoPorUnidad);

  return {
    porUnidad,
    porTanda: porUnidad * rinde,
    desglose,
    sinCosto: items.filter((x) => x.insumo.costo <= 0).map((x) => x.insumo),
    sinReceta: items.length === 0,
  };
}

export const costoExtras = (extras: ItemReceta[], mapa: MapaInsumos): number =>
  extras.reduce((s, e) => s + e.cantidad * (mapa.get(e.insumoId)?.costo ?? 0), 0);

export interface CostoPresentacion {
  producto: Producto | undefined;
  /** Costo de las unidades de producto */
  mercaderia: number;
  envases: number;
  total: number;
  ganancia: number;
  /** ganancia / precio (0..1) */
  margen: number;
  /** El cálculo está incompleto (falta receta o precios) */
  incompleto: boolean;
}

export function costoPresentacion(pres: Presentacion, d: Datos, mapa = mapaInsumos(d)): CostoPresentacion {
  const producto = d.productos.find((p) => p.id === pres.productoId);
  const cp = producto ? costoProducto(producto, mapa) : null;
  const mercaderia = (cp?.porUnidad ?? 0) * pres.unidades;
  const envases = costoExtras(pres.extras, mapa);
  const total = mercaderia + envases;
  const ganancia = pres.precio - total;
  const extrasSinCosto = pres.extras.some((e) => (mapa.get(e.insumoId)?.costo ?? 0) <= 0);
  return {
    producto,
    mercaderia,
    envases,
    total,
    ganancia,
    margen: pres.precio > 0 ? ganancia / pres.precio : 0,
    incompleto: !cp || cp.sinReceta || cp.sinCosto.length > 0 || extrasSinCosto,
  };
}

/* ─────────────────────────── stock ─────────────────────────── */

export type NivelStock = 'agotado' | 'bajo' | 'ok';

/** Insumos que se usan en alguna receta o envase */
export function insumosEnUso(d: Datos): Set<string> {
  const s = new Set<string>();
  d.productos.forEach((p) => p.receta.forEach((r) => r.cantidad > 0 && s.add(r.insumoId)));
  d.presentaciones.forEach((p) => p.extras.forEach((r) => r.cantidad > 0 && s.add(r.insumoId)));
  return s;
}

export function nivelStock(i: Insumo): NivelStock {
  if (i.stock <= EPS) return 'agotado';
  if (i.minimo > 0 && i.stock <= i.minimo + EPS) return 'bajo';
  return 'ok';
}

/** Cuántas unidades de cada producto alcanzan con el stock de ESTE insumo */
export function alcanzaPara(i: Insumo, productos: Producto[]): { producto: Producto; unidades: number }[] {
  return productos
    .map((p) => {
      const it = p.receta.find((r) => r.insumoId === i.id && r.cantidad > 0);
      if (!it) return null;
      const porUnidad = it.cantidad / (p.rinde > 0 ? p.rinde : 1);
      return { producto: p, unidades: Math.max(0, Math.floor((i.stock + EPS) / porUnidad)) };
    })
    .filter((x): x is { producto: Producto; unidades: number } => x !== null);
}

export interface Alerta {
  insumo: Insumo;
  nivel: Exclude<NivelStock, 'ok'>;
  alcanza: { producto: Producto; unidades: number }[];
}

/** Avisos de stock: sólo insumos con mínimo cargado o que se usan en recetas/envases */
export function alertasStock(d: Datos): Alerta[] {
  const enUso = insumosEnUso(d);
  return d.insumos
    .filter((i) => i.minimo > 0 || enUso.has(i.id))
    .map((i) => ({ insumo: i, nivel: nivelStock(i), alcanza: alcanzaPara(i, d.productos) }))
    .filter((a): a is Alerta => a.nivel !== 'ok')
    .sort((a, b) => (a.nivel === b.nivel ? a.insumo.nombre.localeCompare(b.insumo.nombre) : a.nivel === 'agotado' ? -1 : 1));
}

/** Máximo que se puede producir con el stock actual y qué insumo lo limita */
export function maxProducible(p: Producto, mapa: MapaInsumos): { unidades: number | null; limita: Insumo | null } {
  const rinde = p.rinde > 0 ? p.rinde : 1;
  let min = Infinity;
  let limita: Insumo | null = null;
  for (const it of p.receta) {
    const ins = mapa.get(it.insumoId);
    if (!ins || it.cantidad <= 0) continue;
    const u = Math.max(0, Math.floor((ins.stock + EPS) / (it.cantidad / rinde)));
    if (u < min) {
      min = u;
      limita = ins;
    }
  }
  return min === Infinity ? { unidades: null, limita: null } : { unidades: min, limita };
}

/** Unidades hechas y todavía sin vender, por producto */
export function stockTerminado(d: Datos): Map<string, number> {
  const m = new Map<string, number>();
  for (const mov of d.movimientos) {
    if (!mov.productoId) continue;
    if (mov.tipo === 'produccion') m.set(mov.productoId, (m.get(mov.productoId) ?? 0) + mov.unidades);
    if (mov.tipo === 'venta') m.set(mov.productoId, (m.get(mov.productoId) ?? 0) - mov.unidades);
  }
  return m;
}

/* ─────────────────────── necesidades / faltantes ─────────────────────── */

export interface Necesidad {
  insumo: Insumo;
  necesita: number;
  tiene: number;
  falta: number;
}

function sumarNecesidades(items: { insumoId: string; cantidad: number }[], mapa: MapaInsumos): Necesidad[] {
  const acc = new Map<string, number>();
  items.forEach((x) => acc.set(x.insumoId, (acc.get(x.insumoId) ?? 0) + x.cantidad));
  return [...acc.entries()]
    .map(([id, necesita]) => {
      const insumo = mapa.get(id);
      if (!insumo || necesita <= 0) return null;
      return { insumo, necesita, tiene: insumo.stock, falta: Math.max(0, necesita - insumo.stock) };
    })
    .filter((x): x is Necesidad => x !== null);
}

export function necesidadesProduccion(p: Producto, unidades: number, mapa: MapaInsumos): Necesidad[] {
  const rinde = p.rinde > 0 ? p.rinde : 1;
  return sumarNecesidades(
    p.receta.map((r) => ({ insumoId: r.insumoId, cantidad: (r.cantidad / rinde) * unidades })),
    mapa,
  );
}

/* ─────────────────────────── movimientos ─────────────────────────── */

const base = (tipo: TipoMovimiento, fecha: string): Movimiento => ({
  id: nuevoId(),
  tipo,
  fecha,
  refId: null,
  productoId: null,
  cantidad: 0,
  unidades: 0,
  monto: 0,
  costo: 0,
  descripcion: '',
  deltas: [],
  creado: new Date().toISOString(),
});

/** Compra: suma stock y actualiza el costo con el precio de ESTA compra */
export function movCompra(ins: Insumo, cantidad: number, total: number, fecha: string, detalle: string): Movimiento {
  const costoNuevo = cantidad > 0 ? redondear(total / cantidad, 6) : ins.costo;
  return {
    ...base('compra', fecha),
    refId: ins.id,
    cantidad,
    monto: total,
    descripcion: `Compra · ${detalle} ${ins.nombre}`,
    deltas: [{ insumoId: ins.id, delta: cantidad, costoNuevo, costoAnterior: ins.costo }],
  };
}

/** Producción: descuenta los insumos de la receta */
export function movProduccion(p: Producto, unidades: number, fecha: string, mapa: MapaInsumos): Movimiento {
  const rinde = p.rinde > 0 ? p.rinde : 1;
  const deltas = p.receta
    .filter((r) => r.cantidad > 0 && mapa.has(r.insumoId))
    .map((r) => ({ insumoId: r.insumoId, delta: -redondear((r.cantidad / rinde) * unidades) }));
  const costo = costoProducto(p, mapa).porUnidad * unidades;
  return {
    ...base('produccion', fecha),
    refId: p.id,
    productoId: p.id,
    cantidad: unidades,
    unidades,
    costo,
    descripcion: `Producción · ${unidades} ${p.nombre}`,
    deltas,
  };
}

/** Venta: cobra, descuenta envases y calcula la ganancia con el costo actual */
export function movVenta(pres: Presentacion, cantidad: number, precioUnitario: number, fecha: string, d: Datos): Movimiento {
  const mapa = mapaInsumos(d);
  const cp = costoPresentacion(pres, d, mapa);
  const producto = cp.producto;
  return {
    ...base('venta', fecha),
    refId: pres.id,
    productoId: pres.productoId,
    cantidad,
    unidades: pres.unidades * cantidad,
    monto: precioUnitario * cantidad,
    costo: cp.total * cantidad,
    descripcion: `Venta · ${cantidad} × ${pres.nombre}${producto ? ` (${producto.nombre})` : ''}`,
    deltas: pres.extras
      .filter((e) => e.cantidad > 0 && mapa.has(e.insumoId))
      .map((e) => ({ insumoId: e.insumoId, delta: -e.cantidad * cantidad })),
  };
}

/** Ajuste manual: deja el stock en el valor contado */
export function movAjuste(ins: Insumo, stockContado: number, fecha: string): Movimiento {
  return {
    ...base('ajuste', fecha),
    refId: ins.id,
    cantidad: stockContado - ins.stock,
    descripcion: `Ajuste de stock · ${ins.nombre}`,
    deltas: [{ insumoId: ins.id, delta: redondear(stockContado - ins.stock) }],
  };
}

/** Aplica los deltas del movimiento y lo agrega al historial */
export function aplicarMovimiento(d: Datos, mov: Movimiento): Datos {
  const porId = new Map(mov.deltas.map((x) => [x.insumoId, x]));
  return {
    ...d,
    insumos: d.insumos.map((i) => {
      const x = porId.get(i.id);
      if (!x) return i;
      return { ...i, stock: redondear(i.stock + x.delta), costo: x.costoNuevo ?? i.costo };
    }),
    movimientos: [mov, ...d.movimientos.filter((m) => m.id !== mov.id)],
  };
}

/** Revierte los deltas (y el costo, si nadie lo cambió después) y borra el movimiento */
export function deshacerMovimiento(d: Datos, mov: Movimiento): Datos {
  const porId = new Map(mov.deltas.map((x) => [x.insumoId, x]));
  return {
    ...d,
    insumos: d.insumos.map((i) => {
      const x = porId.get(i.id);
      if (!x) return i;
      const restaurarCosto =
        x.costoNuevo !== undefined && x.costoAnterior !== undefined && Math.abs(i.costo - x.costoNuevo) < 1e-6;
      return { ...i, stock: redondear(i.stock - x.delta), costo: restaurarCosto ? x.costoAnterior! : i.costo };
    }),
    movimientos: d.movimientos.filter((m) => m.id !== mov.id),
  };
}

/* ─────────────────────────── resúmenes ─────────────────────────── */

export interface Resumen {
  ventas: number;
  costoVentas: number;
  ganancia: number;
  compras: number;
  cantidadVentas: number;
  unidadesVendidas: number;
  unidadesProducidas: number;
}

export function resumen(movs: Movimiento[], filtro: (m: Movimiento) => boolean = () => true): Resumen {
  const r: Resumen = {
    ventas: 0,
    costoVentas: 0,
    ganancia: 0,
    compras: 0,
    cantidadVentas: 0,
    unidadesVendidas: 0,
    unidadesProducidas: 0,
  };
  for (const m of movs) {
    if (!filtro(m)) continue;
    if (m.tipo === 'venta') {
      r.ventas += m.monto;
      r.costoVentas += m.costo;
      r.cantidadVentas += m.cantidad;
      r.unidadesVendidas += m.unidades;
    } else if (m.tipo === 'compra') {
      r.compras += m.monto;
    } else if (m.tipo === 'produccion') {
      r.unidadesProducidas += m.unidades;
    }
  }
  r.ganancia = r.ventas - r.costoVentas;
  return r;
}

/* ─────────────────────────── simulador ─────────────────────────── */

export interface Simulacion {
  cobras: number;
  cuesta: number;
  ganas: number;
  margen: number;
  porVenta: number;
  incompleto: boolean;
  necesita: Necesidad[];
}

export function simular(pres: Presentacion, cantidad: number, d: Datos): Simulacion {
  const mapa = mapaInsumos(d);
  const cp = costoPresentacion(pres, d, mapa);
  const cobras = pres.precio * cantidad;
  const cuesta = cp.total * cantidad;
  const unidades = pres.unidades * cantidad;
  const items: { insumoId: string; cantidad: number }[] = [];
  if (cp.producto) {
    const rinde = cp.producto.rinde > 0 ? cp.producto.rinde : 1;
    cp.producto.receta.forEach((r) => items.push({ insumoId: r.insumoId, cantidad: (r.cantidad / rinde) * unidades }));
  }
  pres.extras.forEach((e) => items.push({ insumoId: e.insumoId, cantidad: e.cantidad * cantidad }));
  return {
    cobras,
    cuesta,
    ganas: cobras - cuesta,
    margen: cobras > 0 ? (cobras - cuesta) / cobras : 0,
    porVenta: cp.ganancia,
    incompleto: cp.incompleto,
    necesita: sumarNecesidades(items, mapa),
  };
}

/** Cuántas ventas de esta presentación hacen falta para ganar `meta` */
export function ventasParaGanar(pres: Presentacion, meta: number, d: Datos): number | null {
  const g = costoPresentacion(pres, d).ganancia;
  if (g <= 0 || meta <= 0) return null;
  return Math.ceil(meta / g);
}
