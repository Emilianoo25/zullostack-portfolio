/**
 * ─────────────────────────────────────────────────────────────
 *  DULCE RUBY — datos del catálogo
 *  Este es el ÚNICO archivo que hay que tocar para cambiar
 *  productos, precios, promos, lugares o fotos.
 *
 *  FOTOS: subí la imagen a  public/dulce-ruby/fotos/
 *  y poné la ruta en el campo `foto`, por ejemplo:
 *      foto: '/dulce-ruby/fotos/donas.jpg'
 *  Si `foto` queda vacío se muestra una ilustración.
 *
 *  PRODUCTO NUEVO: copiá un bloque de `categorias`,
 *  cambiale el `id` y listo: aparece solo en el menú,
 *  en el índice y como 2 páginas nuevas del libro.
 * ─────────────────────────────────────────────────────────────
 */

export type Ilustracion = 'dona' | 'chipa' | 'generica';

export interface Opcion {
  /** Cómo se llama la presentación: "Caja de 15" */
  nombre: string;
  /** Cuántas unidades trae (sirve para calcular el ahorro y el precio por unidad) */
  cantidad: number;
  /** Precio en pesos, sin puntos: 7500 */
  precio: number;
  /** Marca esta opción como la más conveniente / recomendada */
  destacado?: boolean;
}

/** Tip: hasta 3–4 opciones por producto para que entren bien en la página. */
export interface Categoria {
  /** Se usa en el link: dulceruby.../#donas */
  id: string;
  /** Texto corto para el menú de arriba */
  menu: string;
  emoji: string;
  titulo: string;
  /** Frase corta debajo del título */
  bajada: string;
  descripcion: string;
  /** Ruta de la foto principal (vacío = ilustración) */
  foto?: string;
  ilustracion: Ilustracion;
  opciones: Opcion[];
  /** Nota escrita "a mano" en la página de precios (opcional) */
  nota?: string;
}

export interface PromoExtra {
  titulo: string;
  detalle: string;
  /** Precio fijo de la promo (opcional) */
  precio?: number;
  /** Texto del sello: "2x1", "Nuevo", etc. */
  sello?: string;
  /** Mensaje para el botón de WhatsApp */
  mensaje: string;
}

export interface Lugar {
  nombre: string;
  /** Dirección, días y horarios */
  detalle: string;
  /** Link de Google Maps (opcional) */
  mapa?: string;
  /** true = todavía no está cargado → se muestra como "próximamente" */
  pendiente?: boolean;
}

export const marca = {
  nombre: 'Dulce Ruby',
  rubro: 'Mini donas & chipitas',
  /** Número en formato internacional, sin + ni espacios */
  whatsapp: '5491157035091',
  telefonoVisible: '11-5703-5091',
  /** Usuario de Instagram sin @ (opcional, vacío = no se muestra) */
  instagram: '',
  mensajeGeneral: '¡Hola Dulce Ruby! 👋 Vi el catálogo y quiero hacer un pedido.',
  url: 'https://zullostack.vercel.app/dulce-ruby/',
};

export const categorias: Categoria[] = [
  {
    id: 'donas',
    menu: 'Donas',
    emoji: '🍩',
    titulo: 'Mini donas',
    bajada: 'Chiquitas, glaseadas y muy tentadoras',
    descripcion:
      'Ideales para compartir, regalar o darte un gusto. Pedilas por unidad, en bandeja o en caja.',
    foto: '',
    ilustracion: 'dona',
    opciones: [
      { nombre: 'Por unidad', cantidad: 1, precio: 800 },
      { nombre: 'Bandeja de 6', cantidad: 6, precio: 3500 },
      { nombre: 'Caja de 15', cantidad: 15, precio: 7500, destacado: true },
    ],
    nota: '¡La caja de 15 es la que más rinde!',
  },
  {
    id: 'chipitas',
    menu: 'Chipitas',
    emoji: '🧀',
    titulo: 'Chipitas',
    bajada: '¡Salen calentitas!',
    descripcion:
      'Doraditas por fuera y tiernas por dentro. Perfectas para el mate, la merienda o picar algo rico.',
    foto: '',
    ilustracion: 'chipa',
    opciones: [
      { nombre: 'Media docena', cantidad: 6, precio: 2500 },
      { nombre: 'Docena', cantidad: 12, precio: 4000, destacado: true },
    ],
    nota: 'Pedí la docena y ahorrá.',
  },
];

/**
 * La página de Promos muestra SOLA la opción más conveniente de cada
 * producto (calculada con los precios de arriba). Acá podés sumar
 * promos especiales de temporada (Halloween, Día de la Madre, etc.).
 */
export const promosExtra: PromoExtra[] = [
  {
    titulo: '¿Cumple, evento o mesa dulce?',
    detalle: 'Contanos cantidad y fecha y armamos tu pedido a medida.',
    sello: 'Pedidos grandes',
    mensaje: '¡Hola Dulce Ruby! 👋 Quiero consultar por un pedido grande para un evento.',
  },
];

/** Puntos de venta, ferias, retiro, etc. */
export const lugares: Lugar[] = [
  { nombre: 'Punto de retiro', detalle: 'Dirección · días y horarios', pendiente: true },
  { nombre: 'Feria / punto de venta', detalle: 'Dirección · días y horarios', pendiente: true },
];

/* ─────────────────────────  helpers (no hace falta tocar)  ───────────────────────── */

export const formatoPesos = (n: number): string =>
  '$' + Math.round(n).toLocaleString('es-AR').replace(/,/g, '.');

export const linkWhatsapp = (mensaje: string = marca.mensajeGeneral): string =>
  `https://wa.me/${marca.whatsapp}?text=${encodeURIComponent(mensaje)}`;

/** Precio por unidad de la presentación más chica: base para calcular el ahorro */
export const precioUnitarioBase = (c: Categoria): number => {
  const menor = [...c.opciones].sort((a, b) => a.cantidad - b.cantidad)[0];
  return menor.precio / menor.cantidad;
};

export const ahorro = (c: Categoria, o: Opcion): number => {
  const diff = o.cantidad * precioUnitarioBase(c) - o.precio;
  return diff >= 1 ? Math.round(diff) : 0;
};

export const precioPorUnidad = (o: Opcion): number => o.precio / o.cantidad;

export const precioDesde = (c: Categoria): number =>
  Math.min(...c.opciones.map((o) => o.precio));

/** La opción con menor precio por unidad (la "mejor compra") */
export const mejorOpcion = (c: Categoria): Opcion =>
  [...c.opciones].sort((a, b) => precioPorUnidad(a) - precioPorUnidad(b))[0];

/** Identificador estable de cada opción para el carrito: "donas-caja-de-15" */
export const claveOpcion = (c: Categoria, o: Opcion): string =>
  `${c.id}-${o.nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')}`;

export const mensajePedido = (c: Categoria, o: Opcion): string =>
  `¡Hola Dulce Ruby! 👋 Quiero pedir: ${c.titulo} — ${o.nombre} (${formatoPesos(o.precio)}).`;
