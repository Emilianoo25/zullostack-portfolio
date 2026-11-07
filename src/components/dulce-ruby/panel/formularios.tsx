/** Hojas (formularios) del panel */
import { useMemo, useState } from 'preact/hooks';
import type { Cambio } from './datos';
import {
  alertasStock,
  aplicarMovimiento,
  costoPresentacion,
  costoProducto,
  deshacerMovimiento,
  hoy,
  insumosEnUso,
  mapaInsumos,
  movAjuste,
  movCompra,
  movProduccion,
  movVenta,
  necesidadesProduccion,
  nuevoId,
  stockTerminado,
  type Datos,
  type Insumo,
  type ItemReceta,
  type Movimiento,
  type Presentacion,
  type Producto,
  type Unidad,
} from './modelo';
import { cantidad, costoUnitario, NOMBRE_UNIDAD, pesos, pesosFinos, porcentaje, UNIDADES_ENTRADA } from './formato';
import { Aviso, Boton, Campo, Fecha, Fichas, Hoja, Icono, Numero, Segmentos, Stepper, Texto } from './ui';

export type HojaAbierta =
  | { h: 'produccion'; productoId?: string }
  | { h: 'venta'; presentacionId?: string }
  | { h: 'compra'; insumoId?: string }
  | { h: 'insumo'; id?: string }
  | { h: 'producto'; id?: string }
  | { h: 'presentacion'; id?: string; productoId: string }
  | { h: 'alertas' }
  | { h: 'deshacer'; mov: Movimiento };

export interface Ctx {
  datos: Datos;
  hacer: (c: Cambio, siguiente: Datos, mensaje?: string) => Promise<boolean>;
  abrir: (h: HojaAbierta) => void;
  cerrar: () => void;
}

const UNIDAD_PRECIO: Record<Unidad, { label: string; factor: number }> = {
  g: { label: 'kg', factor: 1000 },
  ml: { label: 'litro', factor: 1000 },
  u: { label: 'unidad', factor: 1 },
};

/** Botón de borrar en dos pasos */
function BorrarDosPasos({ onBorrar, texto = 'Borrar', cargando }: { onBorrar: () => void; texto?: string; cargando?: boolean }) {
  const [seguro, setSeguro] = useState(false);
  return seguro ? (
    <Boton tipo="peligro" icono="borrar" onClick={onBorrar} cargando={cargando}>
      ¿Seguro? Tocá para borrar
    </Boton>
  ) : (
    <Boton tipo="fantasma" icono="borrar" onClick={() => setSeguro(true)}>
      {texto}
    </Boton>
  );
}

function ListaNecesidades({ items }: { items: { insumo: Insumo; necesita: number; tiene: number; falta: number }[] }) {
  if (!items.length) return null;
  return (
    <ul class="pn-necesita">
      {items.map((n) => (
        <li class={n.falta > 0 ? 'is-falta' : ''}>
          <span>{n.insumo.nombre}</span>
          <strong>{cantidad(n.necesita, n.insumo.unidad)}</strong>
          <em>{n.falta > 0 ? `faltan ${cantidad(n.falta, n.insumo.unidad)}` : `tenés ${cantidad(n.tiene, n.insumo.unidad)}`}</em>
        </li>
      ))}
    </ul>
  );
}

/* ═══════════════════════ PRODUCCIÓN ═══════════════════════ */
export function HojaProduccion({ ctx, productoId }: { ctx: Ctx; productoId?: string }) {
  const { datos } = ctx;
  const [pid, setPid] = useState<string | null>(productoId ?? datos.productos[0]?.id ?? null);
  const [unid, setUnid] = useState<number | null>(12);
  const [fecha, setFecha] = useState(hoy());
  const [guardando, setGuardando] = useState(false);
  const mapa = useMemo(() => mapaInsumos(datos), [datos]);
  const prod = datos.productos.find((p) => p.id === pid);
  const u = unid && unid > 0 ? unid : 0;
  const nec = prod && u ? necesidadesProduccion(prod, u, mapa) : [];
  const cp = prod ? costoProducto(prod, mapa) : null;
  const faltan = nec.filter((n) => n.falta > 0);

  const rapidos = [
    { v: 6, l: '½ docena' },
    { v: 12, l: '1 docena' },
    { v: 24, l: '2 docenas' },
    ...(prod && prod.rinde > 0 && ![6, 12, 24].includes(prod.rinde) ? [{ v: prod.rinde, l: `1 tanda (${prod.rinde})` }] : []),
  ];

  async function registrar() {
    if (!prod || !u) return;
    setGuardando(true);
    const mov = movProduccion(prod, u, fecha, mapa);
    const ok = await ctx.hacer({ t: 'registrar', mov }, aplicarMovimiento(datos, mov), `Registrado: ${u} ${prod.nombre}`);
    setGuardando(false);
    if (ok) ctx.cerrar();
  }

  if (!datos.productos.length)
    return (
      <Hoja titulo="Registrar producción" onCerrar={ctx.cerrar}>
        <Aviso>Primero creá un producto en la pestaña Recetas.</Aviso>
      </Hoja>
    );

  return (
    <Hoja
      titulo="Registrar producción"
      subtitulo="Se descuentan solos los ingredientes de la receta"
      onCerrar={ctx.cerrar}
      pie={
        <Boton icono="produccion" onClick={registrar} disabled={!prod || !u} cargando={guardando}>
          {prod && u ? `Registrar ${u} ${prod.nombre.toLowerCase()}` : 'Registrar'}
        </Boton>
      }
    >
      <Campo label="¿Qué hiciste?">
        <Fichas opciones={datos.productos.map((p) => ({ v: p.id, label: `${p.emoji} ${p.nombre}` }))} valor={pid} onCambio={setPid} />
      </Campo>
      <Campo label="¿Cuántas unidades?">
        <Numero valor={unid} onCambio={setUnid} decimales={0} sufijo="unidades" ariaLabel="Unidades producidas" />
        <div class="pn-rapidos">
          {rapidos.map((r) => (
            <button type="button" class={unid === r.v ? 'is-on' : ''} onClick={() => setUnid(r.v)}>
              {r.l}
            </button>
          ))}
        </div>
      </Campo>
      <Campo label="Fecha">
        <Fecha valor={fecha} onCambio={setFecha} />
      </Campo>

      {prod && cp?.sinReceta && (
        <Aviso tipo="alerta">
          <strong>{prod.nombre}</strong> no tiene receta cargada: se registra la producción pero no se descuenta stock.{' '}
          <button type="button" class="pn-link" onClick={() => ctx.abrir({ h: 'producto', id: prod.id })}>
            Cargar receta
          </button>
        </Aviso>
      )}

      {nec.length > 0 && (
        <div class="pn-preview">
          <h4>Se descuenta del stock</h4>
          <ListaNecesidades items={nec} />
          <p class="pn-preview__total">
            Costo de esta producción <strong>{pesos((cp?.porUnidad ?? 0) * u)}</strong>
            <span> · {pesosFinos(cp?.porUnidad ?? 0)} c/u</span>
          </p>
        </div>
      )}
      {faltan.length > 0 && (
        <Aviso tipo="alerta">
          No te alcanza {faltan.map((f) => f.insumo.nombre).join(', ')}. Se registra igual y el stock queda en negativo hasta
          que cargues la compra.
        </Aviso>
      )}
    </Hoja>
  );
}

/* ═══════════════════════ VENTA ═══════════════════════ */
export function HojaVenta({ ctx, presentacionId }: { ctx: Ctx; presentacionId?: string }) {
  const { datos } = ctx;
  const [prid, setPrid] = useState<string | null>(presentacionId ?? datos.presentaciones[0]?.id ?? null);
  const pres = datos.presentaciones.find((p) => p.id === prid);
  const [cant, setCant] = useState(1);
  const [precio, setPrecio] = useState<number | null>(pres?.precio ?? null);
  const [fecha, setFecha] = useState(hoy());
  const [guardando, setGuardando] = useState(false);

  const elegir = (id: string) => {
    setPrid(id);
    setPrecio(datos.presentaciones.find((p) => p.id === id)?.precio ?? null);
  };

  const cp = pres ? costoPresentacion(pres, datos) : null;
  const cobras = (precio ?? 0) * cant;
  const cuesta = (cp?.total ?? 0) * cant;
  const terminado = pres ? stockTerminado(datos).get(pres.productoId) ?? 0 : 0;
  const usa = pres ? pres.unidades * cant : 0;
  const mapa = mapaInsumos(datos);
  const envasesFaltan = pres
    ? pres.extras.filter((e) => (mapa.get(e.insumoId)?.stock ?? 0) < e.cantidad * cant).map((e) => mapa.get(e.insumoId)?.nombre ?? '')
    : [];

  async function registrar() {
    if (!pres || precio === null) return;
    setGuardando(true);
    const mov = movVenta(pres, cant, precio, fecha, datos);
    const ok = await ctx.hacer(
      { t: 'registrar', mov },
      aplicarMovimiento(datos, mov),
      `Venta registrada: ganaste ${pesos(mov.monto - mov.costo)}`,
    );
    setGuardando(false);
    if (ok) ctx.cerrar();
  }

  if (!datos.presentaciones.length)
    return (
      <Hoja titulo="Registrar venta" onCerrar={ctx.cerrar}>
        <Aviso>Primero cargá cómo vendés (unidad, caja, docena…) en la pestaña Recetas.</Aviso>
      </Hoja>
    );

  return (
    <Hoja
      titulo="Registrar venta"
      onCerrar={ctx.cerrar}
      pie={
        <Boton icono="venta" onClick={registrar} disabled={!pres || precio === null} cargando={guardando}>
          Registrar venta · {pesos(cobras)}
        </Boton>
      }
    >
      {datos.productos.map((p) => {
        const ops = datos.presentaciones.filter((x) => x.productoId === p.id);
        if (!ops.length) return null;
        return (
          <Campo label={`${p.emoji} ${p.nombre}`}>
            <Fichas opciones={ops.map((o) => ({ v: o.id, label: o.nombre, sub: pesos(o.precio) }))} valor={prid} onCambio={elegir} />
          </Campo>
        );
      })}
      <div class="pn-fila2">
        <Campo label="Cantidad">
          <Stepper valor={cant} onCambio={setCant} />
        </Campo>
        <Campo label="Precio de cada una" ayuda={pres && precio !== pres.precio ? `Lista: ${pesos(pres.precio)}` : undefined}>
          <Numero valor={precio} onCambio={setPrecio} prefijo="$" decimales={0} ariaLabel="Precio unitario" />
        </Campo>
      </div>
      <Campo label="Fecha">
        <Fecha valor={fecha} onCambio={setFecha} />
      </Campo>

      {pres && (
        <div class="pn-resultado">
          <div>
            <span>Cobrás</span>
            <strong>{pesos(cobras)}</strong>
          </div>
          <div>
            <span>Te cuesta</span>
            <strong>{pesos(cuesta)}</strong>
          </div>
          <div class="is-ganancia">
            <span>Ganás</span>
            <strong>{pesos(cobras - cuesta)}</strong>
          </div>
        </div>
      )}
      {cp?.incompleto && <Aviso tipo="alerta">La ganancia puede estar inflada: faltan precios o la receta de este producto.</Aviso>}
      {pres && usa > terminado && (
        <Aviso>
          Según lo registrado tenés {Math.max(0, terminado)} {cp?.producto?.nombre.toLowerCase()} hechas y esta venta usa {usa}.
          ¿Te faltó registrar una producción?
        </Aviso>
      )}
      {envasesFaltan.length > 0 && <Aviso tipo="alerta">No te alcanzan: {envasesFaltan.join(', ')}.</Aviso>}
    </Hoja>
  );
}

/* ═══════════════════════ COMPRA ═══════════════════════ */
export function HojaCompra({ ctx, insumoId }: { ctx: Ctx; insumoId?: string }) {
  const { datos } = ctx;
  const [iid, setIid] = useState<string>(insumoId ?? datos.insumos[0]?.id ?? '');
  const ins = datos.insumos.find((i) => i.id === iid);
  const [cant, setCant] = useState<number | null>(null);
  const [factor, setFactor] = useState<number>(ins && ins.unidad !== 'u' ? 1000 : 1);
  const [total, setTotal] = useState<number | null>(null);
  const [fecha, setFecha] = useState(hoy());
  const [guardando, setGuardando] = useState(false);

  const elegir = (id: string) => {
    setIid(id);
    const i = datos.insumos.find((x) => x.id === id);
    setFactor(i && i.unidad !== 'u' ? 1000 : 1);
  };

  const base = (cant ?? 0) * factor;
  const nuevoCosto = base > 0 && total ? total / base : null;
  const cambio = ins && nuevoCosto && ins.costo > 0 ? nuevoCosto / ins.costo - 1 : null;
  const entrada = ins ? UNIDADES_ENTRADA[ins.unidad] : [];
  const etiqueta = entrada.find((e) => e.factor === factor)?.label ?? '';

  async function registrar() {
    if (!ins || !base || total === null) return;
    setGuardando(true);
    const mov = movCompra(ins, base, total, fecha, `${String(cant).replace('.', ',')} ${etiqueta}`);
    const ok = await ctx.hacer({ t: 'registrar', mov }, aplicarMovimiento(datos, mov), `Compra cargada: ${ins.nombre}`);
    setGuardando(false);
    if (ok) ctx.cerrar();
  }

  if (!datos.insumos.length)
    return (
      <Hoja titulo="Cargar compra" onCerrar={ctx.cerrar}>
        <Aviso>Primero creá tus insumos en la pestaña Stock.</Aviso>
      </Hoja>
    );

  return (
    <Hoja
      titulo="Cargar compra"
      subtitulo="Suma stock y actualiza el precio con lo que pagaste"
      onCerrar={ctx.cerrar}
      pie={
        <Boton icono="compra" onClick={registrar} disabled={!ins || !base || total === null} cargando={guardando}>
          Cargar compra{total ? ` · ${pesos(total)}` : ''}
        </Boton>
      }
    >
      <Campo label="¿Qué compraste?">
        <span class="pn-input pn-select">
          <select value={iid} onChange={(e) => elegir((e.currentTarget as HTMLSelectElement).value)}>
            {datos.insumos.map((i) => (
              <option value={i.id}>{i.nombre}</option>
            ))}
          </select>
        </span>
      </Campo>
      {ins && (
        <>
          <Campo label="¿Cuánto?">
            <div class="pn-con-unidad">
              <Numero valor={cant} onCambio={setCant} placeholder="0" autoFocus ariaLabel="Cantidad comprada" />
              <Segmentos opciones={entrada.map((e) => ({ v: e.factor, label: e.label }))} valor={factor} onCambio={setFactor} ariaLabel="Unidad" />
            </div>
          </Campo>
          <Campo label="¿Cuánto pagaste en total?">
            <Numero valor={total} onCambio={setTotal} prefijo="$" decimales={0} placeholder="0" ariaLabel="Total pagado" />
          </Campo>
          <Campo label="Fecha">
            <Fecha valor={fecha} onCambio={setFecha} />
          </Campo>
          {base > 0 && (
            <div class="pn-preview">
              <p>
                Stock: <strong>{cantidad(ins.stock, ins.unidad)}</strong> → <strong>{cantidad(ins.stock + base, ins.unidad)}</strong>
              </p>
              {nuevoCosto !== null && (
                <p>
                  Precio nuevo: <strong>{costoUnitario(nuevoCosto, ins.unidad)}</strong>
                  {cambio !== null && Math.abs(cambio) >= 0.005 && (
                    <span class={cambio > 0 ? 'pn-sube' : 'pn-baja'}>
                      {' '}
                      ({cambio > 0 ? '+' : ''}
                      {porcentaje(cambio)} vs. {costoUnitario(ins.costo, ins.unidad)})
                    </span>
                  )}
                </p>
              )}
            </div>
          )}
        </>
      )}
    </Hoja>
  );
}

/* ═══════════════════════ INSUMO ═══════════════════════ */
export function HojaInsumo({ ctx, id }: { ctx: Ctx; id?: string }) {
  const { datos } = ctx;
  const original = datos.insumos.find((i) => i.id === id);
  const enUso = insumosEnUso(datos);
  const usado = !!original && enUso.has(original.id);
  const [nombre, setNombre] = useState(original?.nombre ?? '');
  const [unidad, setUnidad] = useState<Unidad>(original?.unidad ?? 'g');
  const [minimo, setMinimo] = useState<number | null>(original ? original.minimo : null);
  const [stock, setStock] = useState<number | null>(original ? original.stock : null);
  const fp = UNIDAD_PRECIO[unidad];
  const [precio, setPrecio] = useState<number | null>(original && original.costo > 0 ? Math.round(original.costo * fp.factor * 100) / 100 : null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const dondeSeUsa = original
    ? [
        ...datos.productos.filter((p) => p.receta.some((r) => r.insumoId === original.id)).map((p) => p.nombre),
        ...datos.presentaciones.filter((p) => p.extras.some((r) => r.insumoId === original.id)).map((p) => p.nombre),
      ]
    : [];

  async function guardar() {
    const n = nombre.trim();
    if (!n) return setError('Ponele un nombre.');
    if (datos.insumos.some((i) => i.id !== id && i.nombre.toLowerCase() === n.toLowerCase())) return setError('Ya existe un insumo con ese nombre.');
    setGuardando(true);
    const costo = precio && precio > 0 ? precio / UNIDAD_PRECIO[unidad].factor : 0;
    const ins: Insumo = {
      id: original?.id ?? nuevoId(),
      nombre: n,
      unidad,
      minimo: minimo ?? 0,
      costo,
      stock: original ? original.stock : stock ?? 0,
      orden: original?.orden ?? datos.insumos.length,
    };
    const d1: Datos = { ...datos, insumos: original ? datos.insumos.map((i) => (i.id === ins.id ? ins : i)) : [...datos.insumos, ins] };
    let ok = await ctx.hacer({ t: 'insumos', items: [ins] }, d1, original ? 'Insumo actualizado' : `Agregado: ${n}`);
    if (ok && original && stock !== null && Math.abs(stock - original.stock) > 1e-9) {
      const mov = movAjuste(ins, stock, hoy());
      ok = await ctx.hacer({ t: 'registrar', mov }, aplicarMovimiento(d1, mov), 'Stock ajustado');
    }
    setGuardando(false);
    if (ok) ctx.cerrar();
  }

  async function borrar() {
    if (!original) return;
    setGuardando(true);
    const ok = await ctx.hacer(
      { t: 'borrarInsumo', id: original.id },
      { ...datos, insumos: datos.insumos.filter((i) => i.id !== original.id) },
      `Borrado: ${original.nombre}`,
    );
    setGuardando(false);
    if (ok) ctx.cerrar();
  }

  return (
    <Hoja
      titulo={original ? `Editar ${original.nombre}` : 'Nuevo insumo'}
      subtitulo={original ? undefined : 'Ingredientes, envases o cualquier cosa que gastes'}
      onCerrar={ctx.cerrar}
      pie={
        <>
          {original && !usado && <BorrarDosPasos onBorrar={borrar} cargando={guardando} />}
          <Boton icono="ok" onClick={guardar} cargando={guardando}>
            Guardar
          </Boton>
        </>
      }
    >
      <Campo label="Nombre">
        <Texto valor={nombre} onCambio={(s) => (setNombre(s), setError(''))} placeholder="Ej: Harina 0000" autoFocus={!original} />
      </Campo>
      <Campo label="Se mide en" ayuda={original && (usado || original.stock !== 0) ? 'No se puede cambiar porque ya tiene stock o se usa en recetas.' : undefined}>
        <Segmentos
          opciones={(['g', 'ml', 'u'] as Unidad[]).map((u) => ({ v: u, label: NOMBRE_UNIDAD[u] }))}
          valor={unidad}
          onCambio={(u) => (!original || (!usado && original.stock === 0)) && setUnidad(u)}
          ariaLabel="Unidad"
        />
      </Campo>
      <div class="pn-fila2">
        <Campo label={original ? 'Stock actual (contado)' : 'Stock que tenés hoy'} ayuda={original ? 'Si lo cambiás, queda registrado como ajuste.' : undefined}>
          <Numero valor={stock} onCambio={setStock} sufijo={unidad === 'u' ? 'u.' : unidad} placeholder="0" ariaLabel="Stock" />
        </Campo>
        <Campo label="Avisame si baja de" ayuda="Para la alerta de poco stock">
          <Numero valor={minimo} onCambio={setMinimo} sufijo={unidad === 'u' ? 'u.' : unidad} placeholder="0" ariaLabel="Stock mínimo" />
        </Campo>
      </div>
      <Campo label={`Precio por ${fp.label}`} ayuda="Se actualiza solo cada vez que cargás una compra.">
        <Numero valor={precio} onCambio={setPrecio} prefijo="$" placeholder="0" ariaLabel="Precio" />
      </Campo>
      {error && <Aviso tipo="error">{error}</Aviso>}
      {usado && <Aviso>Se usa en: {dondeSeUsa.join(', ')}. Para borrarlo, sacalo primero de esas recetas/envases.</Aviso>}
    </Hoja>
  );
}

/* ═══════════════════════ EDITOR DE ITEMS (receta / envases) ═══════════════════════ */
function EditorItems({
  items,
  onCambio,
  insumos,
  textoAgregar,
  vacio,
}: {
  items: ItemReceta[];
  onCambio: (it: ItemReceta[]) => void;
  insumos: Insumo[];
  textoAgregar: string;
  vacio: string;
}) {
  const mapa = new Map(insumos.map((i) => [i.id, i]));
  const libres = insumos.filter((i) => !items.some((x) => x.insumoId === i.id));
  return (
    <div class="pn-items">
      {items.length === 0 && <p class="pn-items__vacio">{vacio}</p>}
      {items.map((it, k) => {
        const ins = mapa.get(it.insumoId);
        return (
          <div class="pn-items__fila">
            <span class="pn-input pn-select">
              <select
                aria-label="Insumo"
                value={it.insumoId}
                onChange={(e) => {
                  const v = (e.currentTarget as HTMLSelectElement).value;
                  onCambio(items.map((x, j) => (j === k ? { ...x, insumoId: v } : x)));
                }}
              >
                {[ins, ...libres].filter(Boolean).map((i) => (
                  <option value={i!.id}>{i!.nombre}</option>
                ))}
              </select>
            </span>
            <Numero
              valor={it.cantidad || null}
              onCambio={(n) => onCambio(items.map((x, j) => (j === k ? { ...x, cantidad: n ?? 0 } : x)))}
              sufijo={ins ? (ins.unidad === 'u' ? 'u.' : ins.unidad) : ''}
              placeholder="0"
              ariaLabel={`Cantidad de ${ins?.nombre ?? 'insumo'}`}
            />
            <button type="button" class="pn-icono-btn" aria-label={`Quitar ${ins?.nombre ?? ''}`} onClick={() => onCambio(items.filter((_, j) => j !== k))}>
              <Icono n="borrar" />
            </button>
          </div>
        );
      })}
      {libres.length > 0 && (
        <button type="button" class="pn-agregar" onClick={() => onCambio([...items, { insumoId: libres[0].id, cantidad: 0 }])}>
          <Icono n="mas" /> {textoAgregar}
        </button>
      )}
    </div>
  );
}

const EMOJIS = ['🍩', '🧀', '🥐', '🍪', '🧁', '🍰', '🎂', '🍫', '🥯', '🍞', '🥧', '🍓'];

/* ═══════════════════════ PRODUCTO (receta) ═══════════════════════ */
export function HojaProducto({ ctx, id }: { ctx: Ctx; id?: string }) {
  const { datos } = ctx;
  const original = datos.productos.find((p) => p.id === id);
  const [nombre, setNombre] = useState(original?.nombre ?? '');
  const [emoji, setEmoji] = useState(original?.emoji ?? '🍩');
  const [rinde, setRinde] = useState<number | null>(original?.rinde ?? 12);
  const [receta, setReceta] = useState<ItemReceta[]>(original?.receta ?? []);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const borrador: Producto = {
    id: original?.id ?? nuevoId(),
    nombre: nombre.trim(),
    emoji,
    rinde: rinde && rinde > 0 ? rinde : 1,
    receta: receta.filter((r) => r.cantidad > 0),
    orden: original?.orden ?? datos.productos.length,
  };
  const cp = costoProducto(borrador, mapaInsumos(datos));
  const presDeEste = original ? datos.presentaciones.filter((p) => p.productoId === original.id) : [];

  async function guardar() {
    if (!borrador.nombre) return setError('Ponele un nombre.');
    if (!rinde || rinde <= 0) return setError('Indicá cuántas unidades salen por tanda.');
    setGuardando(true);
    const productos = original ? datos.productos.map((p) => (p.id === borrador.id ? borrador : p)) : [...datos.productos, borrador];
    const ok = await ctx.hacer({ t: 'producto', item: borrador }, { ...datos, productos }, original ? 'Receta guardada' : `Producto creado: ${borrador.nombre}`);
    setGuardando(false);
    if (ok) {
      if (!original) ctx.abrir({ h: 'presentacion', productoId: borrador.id });
      else ctx.cerrar();
    }
  }

  async function borrar() {
    if (!original) return;
    setGuardando(true);
    const ok = await ctx.hacer(
      { t: 'borrarProducto', id: original.id },
      {
        ...datos,
        productos: datos.productos.filter((p) => p.id !== original.id),
        presentaciones: datos.presentaciones.filter((p) => p.productoId !== original.id),
      },
      `Borrado: ${original.nombre}`,
    );
    setGuardando(false);
    if (ok) ctx.cerrar();
  }

  return (
    <Hoja
      titulo={original ? `Receta de ${original.nombre}` : 'Nuevo producto'}
      subtitulo="Cargá la receta de UNA tanda y cuántas unidades te salen"
      onCerrar={ctx.cerrar}
      pie={
        <>
          {original && <BorrarDosPasos onBorrar={borrar} cargando={guardando} />}
          <Boton icono="ok" onClick={guardar} cargando={guardando}>
            Guardar
          </Boton>
        </>
      }
    >
      <div class="pn-fila2 pn-fila2--nombre">
        <Campo label="Nombre">
          <Texto valor={nombre} onCambio={(s) => (setNombre(s), setError(''))} placeholder="Ej: Mini donas" />
        </Campo>
        <Campo label="Unidades por tanda">
          <Numero valor={rinde} onCambio={setRinde} decimales={0} sufijo="u." ariaLabel="Unidades por tanda" />
        </Campo>
      </div>
      <Campo label="Ícono">
        <div class="pn-emojis">
          {EMOJIS.map((e) => (
            <button type="button" class={e === emoji ? 'is-on' : ''} aria-pressed={e === emoji} onClick={() => setEmoji(e)}>
              {e}
            </button>
          ))}
        </div>
      </Campo>
      <Campo label="Ingredientes de una tanda">
        {datos.insumos.length === 0 ? (
          <Aviso>Primero cargá tus insumos en la pestaña Stock.</Aviso>
        ) : (
          <EditorItems
            items={receta}
            onCambio={setReceta}
            insumos={datos.insumos}
            textoAgregar="Agregar ingrediente"
            vacio="Todavía no hay ingredientes."
          />
        )}
      </Campo>

      {!cp.sinReceta && (
        <div class="pn-preview">
          <p>
            Cada {borrador.nombre ? borrador.nombre.toLowerCase().replace(/s$/, '') : 'unidad'} te cuesta{' '}
            <strong class="pn-grande">{pesosFinos(cp.porUnidad)}</strong>
          </p>
          <p class="pn-muted">Una tanda: {pesos(cp.porTanda)}</p>
          {cp.desglose.slice(0, 4).map((x) => (
            <div class="pn-barra-costo">
              <span>{x.insumo.nombre}</span>
              <span class="pn-barra-costo__track">
                <span style={{ width: `${Math.max(2, x.parte * 100)}%` }} />
              </span>
              <em>{porcentaje(x.parte)}</em>
            </div>
          ))}
        </div>
      )}
      {cp.sinCosto.length > 0 && <Aviso tipo="alerta">Sin precio cargado: {cp.sinCosto.map((i) => i.nombre).join(', ')}. El costo va a dar menos de lo real.</Aviso>}
      {original && presDeEste.length > 0 && <p class="pn-muted pn-chico">Si lo borrás, también se borran sus {presDeEste.length} formas de venta.</p>}
      {error && <Aviso tipo="error">{error}</Aviso>}
    </Hoja>
  );
}

/* ═══════════════════════ PRESENTACIÓN ═══════════════════════ */
export function HojaPresentacion({ ctx, id, productoId }: { ctx: Ctx; id?: string; productoId: string }) {
  const { datos } = ctx;
  const original = datos.presentaciones.find((p) => p.id === id);
  const producto = datos.productos.find((p) => p.id === (original?.productoId ?? productoId));
  const [nombre, setNombre] = useState(original?.nombre ?? '');
  const [unidades, setUnidades] = useState<number | null>(original?.unidades ?? 1);
  const [precio, setPrecio] = useState<number | null>(original?.precio ?? null);
  const [extras, setExtras] = useState<ItemReceta[]>(original?.extras ?? []);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const borrador: Presentacion = {
    id: original?.id ?? nuevoId(),
    productoId: producto?.id ?? productoId,
    nombre: nombre.trim(),
    unidades: unidades && unidades > 0 ? unidades : 1,
    precio: precio ?? 0,
    extras: extras.filter((e) => e.cantidad > 0),
    orden: original?.orden ?? datos.presentaciones.filter((p) => p.productoId === productoId).length,
  };
  const cp = costoPresentacion(borrador, datos);

  async function guardar() {
    if (!borrador.nombre) return setError('Ponele un nombre (ej: Caja de 15).');
    if (precio === null) return setError('Falta el precio de venta.');
    setGuardando(true);
    const presentaciones = original ? datos.presentaciones.map((p) => (p.id === borrador.id ? borrador : p)) : [...datos.presentaciones, borrador];
    const ok = await ctx.hacer({ t: 'presentaciones', items: [borrador] }, { ...datos, presentaciones }, 'Guardado');
    setGuardando(false);
    if (ok) ctx.cerrar();
  }

  async function borrar() {
    if (!original) return;
    setGuardando(true);
    const ok = await ctx.hacer(
      { t: 'borrarPresentacion', id: original.id },
      { ...datos, presentaciones: datos.presentaciones.filter((p) => p.id !== original.id) },
      `Borrado: ${original.nombre}`,
    );
    setGuardando(false);
    if (ok) ctx.cerrar();
  }

  return (
    <Hoja
      titulo={original ? `Editar ${original.nombre}` : 'Nueva forma de venta'}
      subtitulo={producto ? `${producto.emoji} ${producto.nombre}` : undefined}
      onCerrar={ctx.cerrar}
      pie={
        <>
          {original && <BorrarDosPasos onBorrar={borrar} cargando={guardando} />}
          <Boton icono="ok" onClick={guardar} cargando={guardando}>
            Guardar
          </Boton>
        </>
      }
    >
      <Campo label="Nombre">
        <Texto valor={nombre} onCambio={(s) => (setNombre(s), setError(''))} placeholder="Ej: Caja de 15" />
      </Campo>
      <div class="pn-fila2">
        <Campo label="Trae">
          <Numero valor={unidades} onCambio={setUnidades} decimales={0} sufijo="unidades" ariaLabel="Unidades" />
        </Campo>
        <Campo label="Precio de venta">
          <Numero valor={precio} onCambio={setPrecio} prefijo="$" decimales={0} placeholder="0" ariaLabel="Precio" />
        </Campo>
      </div>
      <Campo label="Envase que usa (opcional)" ayuda="Caja, bandeja, bolsita… Se descuenta del stock en cada venta.">
        <EditorItems items={extras} onCambio={setExtras} insumos={datos.insumos} textoAgregar="Agregar envase" vacio="Sin envase." />
      </Campo>
      <div class="pn-resultado">
        <div>
          <span>Cobrás</span>
          <strong>{pesos(borrador.precio)}</strong>
        </div>
        <div>
          <span>Te cuesta</span>
          <strong>{pesos(cp.total)}</strong>
        </div>
        <div class={cp.ganancia >= 0 ? 'is-ganancia' : 'is-perdida'}>
          <span>Ganás</span>
          <strong>{pesos(cp.ganancia)}</strong>
        </div>
      </div>
      {cp.incompleto && <Aviso tipo="alerta">Cálculo incompleto: falta la receta o algún precio.</Aviso>}
      {error && <Aviso tipo="error">{error}</Aviso>}
    </Hoja>
  );
}

/* ═══════════════════════ ALERTAS ═══════════════════════ */
export function HojaAlertas({ ctx }: { ctx: Ctx }) {
  const alertas = alertasStock(ctx.datos);
  return (
    <Hoja titulo="Avisos de stock" onCerrar={ctx.cerrar}>
      {alertas.length === 0 ? (
        <Aviso tipo="ok">Todo en orden: no te falta nada.</Aviso>
      ) : (
        <ul class="pn-alertas-lista">
          {alertas.map((a) => (
            <li class={`is-${a.nivel}`}>
              <div>
                <strong>{a.insumo.nombre}</strong>
                <span>
                  {a.nivel === 'agotado' ? 'Sin stock' : `Quedan ${cantidad(a.insumo.stock, a.insumo.unidad)}`}
                  {a.alcanza.length > 0 && ` · alcanza para ${a.alcanza.map((x) => `${x.unidades} ${x.producto.nombre.toLowerCase()}`).join(' / ')}`}
                </span>
              </div>
              <Boton tipo="secundario" icono="compra" onClick={() => ctx.abrir({ h: 'compra', insumoId: a.insumo.id })}>
                Compré
              </Boton>
            </li>
          ))}
        </ul>
      )}
    </Hoja>
  );
}

/* ═══════════════════════ DESHACER ═══════════════════════ */
export function HojaDeshacer({ ctx, mov }: { ctx: Ctx; mov: Movimiento }) {
  const [guardando, setGuardando] = useState(false);
  const mapa = mapaInsumos(ctx.datos);
  async function deshacer() {
    setGuardando(true);
    const ok = await ctx.hacer({ t: 'deshacer', mov }, deshacerMovimiento(ctx.datos, mov), 'Listo, se deshizo');
    setGuardando(false);
    if (ok) ctx.cerrar();
  }
  return (
    <Hoja
      titulo="¿Deshacer este movimiento?"
      subtitulo={mov.descripcion}
      onCerrar={ctx.cerrar}
      pie={
        <Boton tipo="peligro" icono="deshacer" onClick={deshacer} cargando={guardando}>
          Sí, deshacer
        </Boton>
      }
    >
      {mov.deltas.length > 0 ? (
        <>
          <p class="pn-muted">El stock vuelve a como estaba:</p>
          <ul class="pn-necesita">
            {mov.deltas.map((x) => {
              const ins = mapa.get(x.insumoId);
              if (!ins) return null;
              return (
                <li>
                  <span>{ins.nombre}</span>
                  <strong>
                    {x.delta > 0 ? '−' : '+'}
                    {cantidad(Math.abs(x.delta), ins.unidad)}
                  </strong>
                  <em>queda {cantidad(ins.stock - x.delta, ins.unidad)}</em>
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <p class="pn-muted">Se borra del historial (no cambia el stock).</p>
      )}
    </Hoja>
  );
}
