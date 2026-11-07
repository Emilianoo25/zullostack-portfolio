import type { Unidad } from './modelo';

const nf = (max: number, min = 0) =>
  new Intl.NumberFormat('es-AR', { maximumFractionDigits: max, minimumFractionDigits: min });

const n0 = nf(0);
const n1 = nf(1);
const n2 = nf(2);

/** $ 12.300 (redondeado) */
export const pesos = (n: number): string => {
  const v = Math.round(n);
  return (v < 0 ? '−$' : '$') + n0.format(Math.abs(v));
};

/** $ con decimales sólo si hacen falta (costos chicos: $187,5) */
export const pesosFinos = (n: number): string => {
  const abs = Math.abs(n);
  const s = abs >= 100 ? n0.format(Math.round(abs)) : abs >= 10 ? n1.format(abs) : n2.format(abs);
  return (n < 0 ? '−$' : '$') + s;
};

export const porcentaje = (x: number): string => `${Math.round(x * 100)}%`;

export const numero = (n: number, dec = 2): string => nf(dec).format(n);

export const NOMBRE_UNIDAD: Record<Unidad, string> = { g: 'gramos', ml: 'mililitros', u: 'unidades' };

/** 1250 g → "1,25 kg" · 300 ml → "300 ml" · 12 u → "12 u." */
export function cantidad(n: number, u: Unidad): string {
  const neg = n < 0;
  const a = Math.abs(n);
  let s: string;
  if (u === 'u') s = `${n1.format(a)} u.`;
  else if (a >= 1000) s = `${n2.format(a / 1000)} ${u === 'g' ? 'kg' : 'l'}`;
  else s = `${a >= 10 ? n0.format(a) : n1.format(a)} ${u}`;
  return (neg ? '−' : '') + s;
}

/** Costo unitario legible: $3.200/kg · $1.800/l · $250/u. */
export function costoUnitario(costo: number, u: Unidad): string {
  if (costo <= 0) return 'sin precio';
  if (u === 'g') return `${pesos(costo * 1000)}/kg`;
  if (u === 'ml') return `${pesos(costo * 1000)}/l`;
  return `${pesosFinos(costo)}/u.`;
}

/** Unidades de carga para cada unidad base */
export const UNIDADES_ENTRADA: Record<Unidad, { label: string; factor: number }[]> = {
  g: [
    { label: 'g', factor: 1 },
    { label: 'kg', factor: 1000 },
  ],
  ml: [
    { label: 'ml', factor: 1 },
    { label: 'l', factor: 1000 },
  ],
  u: [
    { label: 'u.', factor: 1 },
    { label: 'docena', factor: 12 },
  ],
};

/**
 * Lee números escritos "a la argentina": 1.500 = mil quinientos · 1,5 = uno y medio.
 * Devuelve NaN si no se entiende.
 */
export function leerNumero(txt: string): number {
  const s = String(txt).trim().replace(/\s|\$/g, '');
  if (!s) return NaN;
  if (s.includes(',')) return Number(s.replace(/\./g, '').replace(',', '.'));
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) return Number(s.replace(/\./g, ''));
  return Number(s);
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export const nombreMes = (yyyymm: string): string => {
  const [y, m] = yyyymm.split('-').map(Number);
  return `${MESES[m - 1]} ${y}`;
};

export function fechaCorta(yyyymmdd: string): string {
  const [y, m, d] = yyyymmdd.split('-').map(Number);
  const f = new Date(y, m - 1, d);
  const hoy = new Date();
  const ayer = new Date();
  ayer.setDate(hoy.getDate() - 1);
  const igual = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (igual(f, hoy)) return 'Hoy';
  if (igual(f, ayer)) return 'Ayer';
  return `${d} ${MESES[m - 1].slice(0, 3)}${y !== hoy.getFullYear() ? ` ${y}` : ''}`;
}
