/**
 * Datos iniciales del panel.
 * - Productos y presentaciones: salen del catálogo (src/data/dulce-ruby.ts).
 * - Insumos típicos: sólo nombres y unidades, en cero (los completa ella).
 * - Demo: números INVENTADOS para mostrar cómo funciona el panel.
 */
import { categorias } from '../../../data/dulce-ruby';
import {
  aplicarMovimiento,
  hoy,
  mapaInsumos,
  movCompra,
  movProduccion,
  movVenta,
  nuevoId,
  type Datos,
  type Insumo,
  type Presentacion,
  type Producto,
  type Unidad,
} from './modelo';
import { cantidad } from './formato';

export function productosDelCatalogo(): Pick<Datos, 'productos' | 'presentaciones'> {
  const productos: Producto[] = [];
  const presentaciones: Presentacion[] = [];
  categorias.forEach((c, i) => {
    const id = nuevoId();
    productos.push({ id, nombre: c.titulo, emoji: c.emoji, rinde: 12, receta: [], orden: i });
    c.opciones.forEach((o, j) =>
      presentaciones.push({
        id: nuevoId(),
        productoId: id,
        nombre: o.nombre,
        unidades: o.cantidad,
        precio: o.precio,
        extras: [],
        orden: j,
      }),
    );
  });
  return { productos, presentaciones };
}

const TIPICOS: [string, Unidad][] = [
  ['Harina 0000', 'g'],
  ['Azúcar', 'g'],
  ['Huevos', 'u'],
  ['Manteca', 'g'],
  ['Leche', 'ml'],
  ['Levadura', 'g'],
  ['Chocolate cobertura', 'g'],
  ['Granitas de colores', 'g'],
  ['Almidón de mandioca', 'g'],
  ['Queso', 'g'],
  ['Aceite', 'ml'],
  ['Palitos', 'u'],
  ['Bandejas', 'u'],
  ['Cajas', 'u'],
  ['Bolsitas', 'u'],
];

export const insumosTipicos = (desde = 0): Insumo[] =>
  TIPICOS.map(([nombre, unidad], i) => ({
    id: nuevoId(),
    nombre,
    unidad,
    stock: 0,
    minimo: 0,
    costo: 0,
    orden: desde + i,
  }));

/** Panel de ejemplo con números inventados (sólo modo prueba) */
export function datosDemo(): Datos {
  const insumos = insumosTipicos();
  const by = (n: string) => insumos.find((i) => i.nombre === n)!;
  // [nombre, comprado, pagado $, mínimo]
  const compras: [string, number, number, number][] = [
    ['Harina 0000', 5000, 6500, 1000],
    ['Azúcar', 2000, 2600, 500],
    ['Huevos', 30, 7200, 6],
    ['Manteca', 1000, 9800, 200],
    ['Leche', 3000, 4200, 500],
    ['Levadura', 250, 2500, 50],
    ['Chocolate cobertura', 1000, 14000, 300],
    ['Granitas de colores', 200, 2400, 50],
    ['Almidón de mandioca', 2000, 5600, 500],
    ['Queso', 1500, 15000, 400],
    ['Aceite', 900, 2700, 200],
    ['Bandejas', 20, 3000, 5],
    ['Cajas', 10, 4500, 3],
    ['Bolsitas', 50, 1500, 10],
  ];
  compras.forEach(([n, , , min]) => (by(n).minimo = min));

  const productos = productosDelCatalogo();
  const donas = productos.productos[0];
  const chipitas = productos.productos[1];
  donas.rinde = 30;
  donas.receta = [
    { insumoId: by('Harina 0000').id, cantidad: 500 },
    { insumoId: by('Azúcar').id, cantidad: 80 },
    { insumoId: by('Huevos').id, cantidad: 2 },
    { insumoId: by('Manteca').id, cantidad: 60 },
    { insumoId: by('Leche').id, cantidad: 250 },
    { insumoId: by('Levadura').id, cantidad: 10 },
    { insumoId: by('Chocolate cobertura').id, cantidad: 300 },
    { insumoId: by('Granitas de colores').id, cantidad: 40 },
  ];
  chipitas.rinde = 40;
  chipitas.receta = [
    { insumoId: by('Almidón de mandioca').id, cantidad: 500 },
    { insumoId: by('Queso').id, cantidad: 300 },
    { insumoId: by('Huevos').id, cantidad: 2 },
    { insumoId: by('Leche').id, cantidad: 150 },
    { insumoId: by('Aceite').id, cantidad: 100 },
  ];
  const pres = productos.presentaciones;
  const p = (prod: Producto, n: string) => pres.find((x) => x.productoId === prod.id && x.nombre === n);
  const bandeja = p(donas, 'Bandeja de 6');
  const caja = p(donas, 'Caja de 15');
  const media = p(chipitas, 'Media docena');
  const docena = p(chipitas, 'Docena');
  if (bandeja) bandeja.extras = [{ insumoId: by('Bandejas').id, cantidad: 1 }];
  if (caja) caja.extras = [{ insumoId: by('Cajas').id, cantidad: 1 }];
  if (media) media.extras = [{ insumoId: by('Bolsitas').id, cantidad: 1 }];
  if (docena) docena.extras = [{ insumoId: by('Bolsitas').id, cantidad: 1 }];

  let d: Datos = { insumos, ...productos, movimientos: [] };
  const dia = (menos: number) => {
    const f = new Date();
    f.setDate(f.getDate() - menos);
    return hoy(f);
  };
  // Compras de hace unos días
  compras.forEach(([n, cant, total]) => {
    const ins = d.insumos.find((i) => i.nombre === n)!;
    d = aplicarMovimiento(d, movCompra(ins, cant, total, dia(6), cantidad(cant, ins.unidad)));
  });
  // Producción y ventas
  const prod = (pr: Producto, u: number, dd: number) => {
    const actual = d.productos.find((x) => x.id === pr.id)!;
    d = aplicarMovimiento(d, movProduccion(actual, u, dia(dd), mapaInsumos(d)));
  };
  const vend = (pr: Presentacion | undefined, c: number, dd: number) => {
    if (pr) d = aplicarMovimiento(d, movVenta(pr, c, pr.precio, dia(dd), d));
  };
  prod(donas, 60, 4);
  prod(chipitas, 60, 4);
  vend(caja, 2, 3);
  vend(docena, 2, 3);
  vend(bandeja, 2, 2);
  prod(donas, 30, 1);
  vend(caja, 1, 1);
  vend(media, 3, 1);
  vend(docena, 1, 0);
  return d;
}
