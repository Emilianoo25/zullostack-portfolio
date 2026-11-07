/** Pantallas (pestañas) del panel */
import { useMemo, useState } from 'preact/hooks';
import {
  alcanzaPara,
  alertasStock,
  costoPresentacion,
  costoProducto,
  hoy,
  insumosEnUso,
  mapaInsumos,
  maxProducible,
  mesDe,
  nivelStock,
  resumen,
  simular,
  stockTerminado,
  ventasParaGanar,
  type Movimiento,
  type Presentacion,
  type TipoMovimiento,
} from './modelo';
import { cantidad, costoUnitario, fechaCorta, nombreMes, pesos, pesosFinos, porcentaje } from './formato';
import { insumosTipicos } from './semillas';
import type { Ctx } from './formularios';
import { Aviso, Boton, Campo, Fichas, Icono, Numero, Segmentos, Stepper, Tarjeta, Vacio } from './ui';
import type { NombreIcono } from './iconos';

export type Tab = 'inicio' | 'stock' | 'recetas' | 'ganancias' | 'historial';

/* ── Banner de avisos (arriba de Inicio y Stock) ─────────────────── */
export function BannerAlertas({ ctx }: { ctx: Ctx }) {
  const alertas = alertasStock(ctx.datos);
  if (!alertas.length) return null;
  const agotados = alertas.filter((a) => a.nivel === 'agotado').length;
  return (
    <button type="button" class={`pn-banner ${agotados ? 'is-agotado' : ''}`} onClick={() => ctx.abrir({ h: 'alertas' })}>
      <span class="pn-banner__ico">
        <Icono n="alerta" />
      </span>
      <span class="pn-banner__txt">
        <strong>
          {agotados ? `Te quedaste sin ${alertas.filter((a) => a.nivel === 'agotado').map((a) => a.insumo.nombre).slice(0, 2).join(' y ')}` : 'Te queda poco stock'}
        </strong>
        <span>
          {alertas
            .slice(0, 3)
            .map((a) => (a.nivel === 'agotado' ? `${a.insumo.nombre}: 0` : `${a.insumo.nombre}: ${cantidad(a.insumo.stock, a.insumo.unidad)}`))
            .join(' · ')}
          {alertas.length > 3 && ` y ${alertas.length - 3} más`}
        </span>
      </span>
      <Icono n="flecha" class="pn-banner__go" />
    </button>
  );
}

/* ── Fila de movimiento (historial) ─────────────────────────────── */
const ICONO_MOV: Record<TipoMovimiento, NombreIcono> = {
  compra: 'compra',
  produccion: 'produccion',
  venta: 'venta',
  ajuste: 'editar',
};

function FilaMovimiento({ mov, ctx }: { mov: Movimiento; ctx: Ctx }) {
  const g = mov.monto - mov.costo;
  return (
    <li class={`pn-mov is-${mov.tipo}`}>
      <span class="pn-mov__ico">
        <Icono n={ICONO_MOV[mov.tipo]} />
      </span>
      <span class="pn-mov__txt">
        <strong>{mov.descripcion.replace(/^[^·]+·\s*/, '')}</strong>
        <span>
          {{ compra: 'Compra', produccion: 'Producción', venta: 'Venta', ajuste: 'Ajuste' }[mov.tipo]} · {fechaCorta(mov.fecha)}
          {mov.tipo === 'produccion' && mov.costo > 0 && ` · costo ${pesos(mov.costo)}`}
        </span>
      </span>
      <span class="pn-mov__monto">
        {mov.tipo === 'venta' && (
          <>
            <strong class="pn-pos">+{pesos(mov.monto)}</strong>
            <em>ganaste {pesos(g)}</em>
          </>
        )}
        {mov.tipo === 'compra' && <strong class="pn-neg">−{pesos(mov.monto)}</strong>}
      </span>
      <button type="button" class="pn-icono-btn" aria-label={`Deshacer: ${mov.descripcion}`} onClick={() => ctx.abrir({ h: 'deshacer', mov })}>
        <Icono n="deshacer" />
      </button>
    </li>
  );
}

/* ═══════════════════════ INICIO ═══════════════════════ */
export function PantallaInicio({ ctx, irA }: { ctx: Ctx; irA: (t: Tab) => void }) {
  const { datos } = ctx;
  const mes = mesDe(hoy());
  const r = resumen(datos.movimientos, (m) => mesDe(m.fecha) === mes);
  const mapa = mapaInsumos(datos);
  const terminado = stockTerminado(datos);
  const fecha = new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <>
      <div class="pn-saludo">
        <h1 class="pn-script">¡Hola, Ruby!</h1>
        <p>{fecha.charAt(0).toUpperCase() + fecha.slice(1)}</p>
      </div>

      <BannerAlertas ctx={ctx} />

      <div class="pn-acciones">
        <button type="button" class="pn-accion is-prod" onClick={() => ctx.abrir({ h: 'produccion' })}>
          <Icono n="produccion" />
          <span>Hice</span>
          <small>producción</small>
        </button>
        <button type="button" class="pn-accion is-venta" onClick={() => ctx.abrir({ h: 'venta' })}>
          <Icono n="venta" />
          <span>Vendí</span>
          <small>venta</small>
        </button>
        <button type="button" class="pn-accion is-compra" onClick={() => ctx.abrir({ h: 'compra' })}>
          <Icono n="compra" />
          <span>Compré</span>
          <small>insumos</small>
        </button>
      </div>

      <Tarjeta titulo={<>Este mes <span class="pn-muted">· {nombreMes(mes)}</span></>}>
        <div class="pn-kpis">
          <div class="pn-kpi is-ganancia">
            <span>Ganancia</span>
            <strong>{pesos(r.ganancia)}</strong>
            <em>{r.ventas > 0 ? `${porcentaje(r.ganancia / r.ventas)} de lo que vendiste` : 'todavía sin ventas'}</em>
          </div>
          <div class="pn-kpi">
            <span>Vendiste</span>
            <strong>{pesos(r.ventas)}</strong>
            <em>
              {r.cantidadVentas} {r.cantidadVentas === 1 ? 'venta' : 'ventas'} · {r.unidadesVendidas} u.
            </em>
          </div>
          <div class="pn-kpi">
            <span>Costo de lo vendido</span>
            <strong>{pesos(r.costoVentas)}</strong>
            <em>ingredientes + envases</em>
          </div>
          <div class="pn-kpi">
            <span>Gastaste en compras</span>
            <strong>{pesos(r.compras)}</strong>
            <em>plata que salió</em>
          </div>
        </div>
      </Tarjeta>

      <div class="pn-grid2">
        <Tarjeta titulo="Listo para vender">
          {datos.productos.length === 0 ? (
            <p class="pn-muted">Sin productos.</p>
          ) : (
            <ul class="pn-lista-simple">
              {datos.productos.map((p) => {
                const n = terminado.get(p.id) ?? 0;
                return (
                  <li>
                    <span>
                      {p.emoji} {p.nombre}
                    </span>
                    <strong class={n < 0 ? 'pn-neg' : ''}>{n} u.</strong>
                  </li>
                );
              })}
            </ul>
          )}
          <p class="pn-muted pn-chico">Lo producido menos lo vendido.</p>
        </Tarjeta>

        <Tarjeta titulo="Con tu stock podés hacer">
          {datos.productos.length === 0 ? (
            <p class="pn-muted">Sin productos.</p>
          ) : (
            <ul class="pn-lista-simple">
              {datos.productos.map((p) => {
                const m = maxProducible(p, mapa);
                return (
                  <li>
                    <span>
                      {p.emoji} {p.nombre}
                      {m.limita && m.unidades !== null && <small> · te limita {m.limita.nombre.toLowerCase()}</small>}
                    </span>
                    {m.unidades === null ? (
                      <button type="button" class="pn-link" onClick={() => ctx.abrir({ h: 'producto', id: p.id })}>
                        cargar receta
                      </button>
                    ) : (
                      <strong class={m.unidades === 0 ? 'pn-neg' : ''}>{m.unidades} u.</strong>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Tarjeta>
      </div>

      <Tarjeta
        titulo="Últimos movimientos"
        accion={
          datos.movimientos.length > 0 && (
            <button type="button" class="pn-link" onClick={() => irA('historial')}>
              Ver todo
            </button>
          )
        }
      >
        {datos.movimientos.length === 0 ? (
          <p class="pn-muted">Cuando registres compras, producciones o ventas van a aparecer acá.</p>
        ) : (
          <ul class="pn-movs">
            {datos.movimientos.slice(0, 5).map((m) => (
              <FilaMovimiento mov={m} ctx={ctx} />
            ))}
          </ul>
        )}
      </Tarjeta>
    </>
  );
}

/* ═══════════════════════ STOCK ═══════════════════════ */
export function PantallaStock({ ctx }: { ctx: Ctx }) {
  const { datos } = ctx;
  const [filtro, setFiltro] = useState<'todos' | 'avisos'>('todos');
  const [cargando, setCargando] = useState(false);
  const enUso = insumosEnUso(datos);
  const conAviso = new Set(alertasStock(datos).map((a) => a.insumo.id));
  const lista = [...datos.insumos]
    .sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre))
    .filter((i) => filtro === 'todos' || conAviso.has(i.id));

  async function cargarTipicos() {
    setCargando(true);
    const existentes = new Set(datos.insumos.map((i) => i.nombre.toLowerCase()));
    const nuevos = insumosTipicos(datos.insumos.length).filter((i) => !existentes.has(i.nombre.toLowerCase()));
    await ctx.hacer({ t: 'insumos', items: nuevos }, { ...datos, insumos: [...datos.insumos, ...nuevos] }, `Agregados ${nuevos.length} insumos: completá stock y precios`);
    setCargando(false);
  }

  return (
    <>
      <div class="pn-titulo">
        <h1 class="pn-script">Stock</h1>
        <Boton icono="mas" onClick={() => ctx.abrir({ h: 'insumo' })}>
          Nuevo insumo
        </Boton>
      </div>
      <BannerAlertas ctx={ctx} />

      {datos.insumos.length === 0 ? (
        <Tarjeta>
          <Vacio icono="stock" titulo="Todavía no cargaste insumos">
            <p>Harina, azúcar, chocolate, cajas… todo lo que gastás para hacer y vender.</p>
            <div class="pn-botones">
              <Boton tipo="secundario" icono="brillo" onClick={cargarTipicos} cargando={cargando}>
                Cargar lista típica
              </Boton>
              <Boton icono="mas" onClick={() => ctx.abrir({ h: 'insumo' })}>
                Crear uno
              </Boton>
            </div>
          </Vacio>
        </Tarjeta>
      ) : (
        <>
          <Segmentos
            opciones={[
              { v: 'todos', label: `Todos (${datos.insumos.length})` },
              { v: 'avisos', label: `Con aviso (${conAviso.size})` },
            ]}
            valor={filtro}
            onCambio={setFiltro}
            ariaLabel="Filtro"
          />
          <ul class="pn-insumos">
            {lista.map((i) => {
              const nivel = nivelStock(i);
              const mostrarNivel = conAviso.has(i.id) || nivel === 'ok';
              const alcanza = alcanzaPara(i, datos.productos);
              const tope = i.minimo > 0 ? Math.max(i.minimo * 3, i.stock) : 0;
              return (
                <li class={`pn-insumo ${conAviso.has(i.id) ? `is-${nivel}` : ''}`}>
                  <div class="pn-insumo__top">
                    <div>
                      <h3>{i.nombre}</h3>
                      <p>
                        {costoUnitario(i.costo, i.unidad)}
                        {!enUso.has(i.id) && ' · no se usa en recetas'}
                      </p>
                    </div>
                    <div class="pn-insumo__stock">
                      <strong>{cantidad(i.stock, i.unidad)}</strong>
                      {mostrarNivel && (
                        <span class={`pn-pill is-${nivel}`}>{nivel === 'ok' ? 'Bien' : nivel === 'bajo' ? 'Poco' : 'Sin stock'}</span>
                      )}
                    </div>
                  </div>
                  {tope > 0 && (
                    <div class="pn-nivel" aria-hidden="true">
                      <span class="pn-nivel__fill" style={{ width: `${Math.min(100, Math.max(0, (i.stock / tope) * 100))}%` }} />
                      <span class="pn-nivel__min" style={{ left: `${(i.minimo / tope) * 100}%` }} />
                    </div>
                  )}
                  {alcanza.length > 0 && (
                    <p class="pn-insumo__alcanza">
                      Alcanza para {alcanza.map((a) => `${a.unidades} ${a.producto.nombre.toLowerCase()}`).join(' · ')}
                    </p>
                  )}
                  <div class="pn-insumo__acc">
                    <Boton tipo="secundario" icono="compra" onClick={() => ctx.abrir({ h: 'compra', insumoId: i.id })}>
                      Compré
                    </Boton>
                    <Boton tipo="fantasma" icono="editar" onClick={() => ctx.abrir({ h: 'insumo', id: i.id })}>
                      Editar
                    </Boton>
                  </div>
                </li>
              );
            })}
          </ul>
          {lista.length === 0 && <Aviso tipo="ok">Ningún insumo con poco stock.</Aviso>}
        </>
      )}
    </>
  );
}

/* ═══════════════════════ RECETAS ═══════════════════════ */
export function PantallaRecetas({ ctx }: { ctx: Ctx }) {
  const { datos } = ctx;
  const mapa = mapaInsumos(datos);
  return (
    <>
      <div class="pn-titulo">
        <h1 class="pn-script">Recetas y precios</h1>
        <Boton icono="mas" onClick={() => ctx.abrir({ h: 'producto' })}>
          Nuevo producto
        </Boton>
      </div>
      {datos.productos.length === 0 && (
        <Tarjeta>
          <Vacio icono="recetas" titulo="Sin productos">
            <p>Creá un producto y cargale la receta de una tanda.</p>
          </Vacio>
        </Tarjeta>
      )}
      {datos.productos.map((p) => {
        const cp = costoProducto(p, mapa);
        const pres = datos.presentaciones.filter((x) => x.productoId === p.id).sort((a, b) => a.orden - b.orden);
        return (
          <Tarjeta
            class="pn-producto"
            titulo={
              <>
                <span class="pn-producto__emoji">{p.emoji}</span> {p.nombre}
              </>
            }
            accion={
              <Boton tipo="fantasma" icono="editar" onClick={() => ctx.abrir({ h: 'producto', id: p.id })}>
                Receta
              </Boton>
            }
          >
            {cp.sinReceta ? (
              <Aviso tipo="alerta">
                Falta la receta: sin eso no se descuenta stock ni se calcula la ganancia.{' '}
                <button type="button" class="pn-link" onClick={() => ctx.abrir({ h: 'producto', id: p.id })}>
                  Cargarla
                </button>
              </Aviso>
            ) : (
              <div class="pn-costo-prod">
                <div>
                  <span>Cada unidad te cuesta</span>
                  <strong>{pesosFinos(cp.porUnidad)}</strong>
                  <em>
                    Tanda de {p.rinde} u.: {pesos(cp.porTanda)}
                  </em>
                </div>
                <ul class="pn-desglose">
                  {cp.desglose.map((x) => (
                    <li>
                      <span>{x.insumo.nombre}</span>
                      <span class="pn-barra-costo__track">
                        <span style={{ width: `${Math.max(2, x.parte * 100)}%` }} />
                      </span>
                      <em>{pesosFinos(x.costoPorUnidad)}</em>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {cp.sinCosto.length > 0 && (
              <Aviso tipo="alerta">Sin precio: {cp.sinCosto.map((i) => i.nombre).join(', ')}. Cargá una compra para tenerlo.</Aviso>
            )}

            <h4 class="pn-sub">Cómo lo vendés</h4>
            <ul class="pn-pres">
              {pres.map((x) => {
                const c = costoPresentacion(x, datos, mapa);
                return (
                  <li>
                    <button type="button" onClick={() => ctx.abrir({ h: 'presentacion', id: x.id, productoId: p.id })}>
                      <span class="pn-pres__n">
                        <strong>{x.nombre}</strong>
                        <em>
                          {x.unidades} u. · costo {pesos(c.total)}
                          {c.envases > 0 && ` (envase ${pesos(c.envases)})`}
                        </em>
                      </span>
                      <span class="pn-pres__p">{pesos(x.precio)}</span>
                      <span class={`pn-pres__g ${c.ganancia >= 0 ? 'pn-pos' : 'pn-neg'}`}>
                        {c.ganancia >= 0 ? '+' : ''}
                        {pesos(c.ganancia)}
                        <small>{porcentaje(c.margen)}</small>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <button type="button" class="pn-agregar" onClick={() => ctx.abrir({ h: 'presentacion', productoId: p.id })}>
              <Icono n="mas" /> Agregar forma de venta
            </button>
          </Tarjeta>
        );
      })}
    </>
  );
}

/* ═══════════════════════ GANANCIAS ═══════════════════════ */
export function PantallaGanancias({ ctx }: { ctx: Ctx }) {
  const { datos } = ctx;
  const [pid, setPid] = useState<string | null>(datos.presentaciones[0]?.id ?? null);
  const [cant, setCant] = useState(10);
  const [meta, setMeta] = useState<number | null>(100000);
  const pres = datos.presentaciones.find((p) => p.id === pid);
  const prodDe = (id: string) => datos.productos.find((p) => p.id === id);
  /** "10 mini donas" · "10 × Caja de 15 (mini donas)" */
  const frase = (p: Presentacion, n: number) => {
    const prod = prodDe(p.productoId)?.nombre.toLowerCase() ?? '';
    return p.unidades === 1 ? `${n} ${prod}` : `${n} × ${p.nombre} (${prod})`;
  };
  const sim = pres ? simular(pres, cant, datos) : null;
  const mapa = useMemo(() => mapaInsumos(datos), [datos]);

  const ranking = datos.presentaciones
    .map((p) => ({ p, c: costoPresentacion(p, datos, mapa), prod: prodDe(p.productoId) }))
    .sort((a, b) => b.c.ganancia - a.c.ganancia);
  const mejor = ranking[0];
  const incompleto = ranking.some((r) => r.c.incompleto);

  if (!datos.presentaciones.length)
    return (
      <>
        <div class="pn-titulo">
          <h1 class="pn-script">Ganancias</h1>
        </div>
        <Tarjeta>
          <Vacio icono="ganancias" titulo="Faltan productos y precios">
            <p>Cargá tus productos y cómo los vendés en la pestaña Recetas.</p>
          </Vacio>
        </Tarjeta>
      </>
    );

  return (
    <>
      <div class="pn-titulo">
        <h1 class="pn-script">Ganancias</h1>
      </div>
      {incompleto && <Aviso tipo="alerta">Hay productos sin receta o insumos sin precio: esas ganancias pueden estar infladas.</Aviso>}

      <Tarjeta titulo={<><Icono n="calculadora" /> Calculadora</>} class="pn-calc">
        <Campo label="Si vendés…">
          <Stepper valor={cant} onCambio={setCant} />
        </Campo>
        {datos.productos.map((p) => {
          const ops = datos.presentaciones.filter((x) => x.productoId === p.id);
          if (!ops.length) return null;
          return (
            <Campo label={`${p.emoji} ${p.nombre}`}>
              <Fichas opciones={ops.map((o) => ({ v: o.id, label: o.nombre, sub: pesos(o.precio) }))} valor={pid} onCambio={setPid} />
            </Campo>
          );
        })}
        {pres && sim && (
          <div class="pn-frase">
            <p>
              Si vendés <strong>{frase(pres, cant)}</strong>:
            </p>
            <div class="pn-resultado">
              <div>
                <span>Cobrás</span>
                <strong>{pesos(sim.cobras)}</strong>
              </div>
              <div>
                <span>Te cuesta</span>
                <strong>{pesos(sim.cuesta)}</strong>
              </div>
              <div class={sim.ganas >= 0 ? 'is-ganancia' : 'is-perdida'}>
                <span>Ganás</span>
                <strong>{pesos(sim.ganas)}</strong>
              </div>
            </div>
            <p class="pn-muted">
              Ganás {pesos(sim.porVenta)} {pres.unidades === 1 ? 'por unidad' : 'por cada venta'} · te quedás con el {porcentaje(sim.margen)} de lo que cobrás.
            </p>
            {sim.necesita.length > 0 && (
              <details class="pn-detalles">
                <summary>
                  Para hacerlo necesitás… {sim.necesita.some((n) => n.falta > 0) ? <span class="pn-neg">(te falta stock)</span> : <span class="pn-pos">(te alcanza)</span>}
                </summary>
                <ul class="pn-necesita">
                  {sim.necesita.map((n) => (
                    <li class={n.falta > 0 ? 'is-falta' : ''}>
                      <span>{n.insumo.nombre}</span>
                      <strong>{cantidad(n.necesita, n.insumo.unidad)}</strong>
                      <em>{n.falta > 0 ? `faltan ${cantidad(n.falta, n.insumo.unidad)}` : 'ok'}</em>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </Tarjeta>

      <Tarjeta titulo={<><Icono n="sube" /> Ganancia por cada venta</>}>
        {mejor && mejor.c.ganancia > 0 && (
          <p class="pn-destacado">
            Lo que más te deja: <strong>{mejor.p.nombre}</strong> de {mejor.prod?.nombre.toLowerCase()} ({pesos(mejor.c.ganancia)} cada una)
          </p>
        )}
        <table class="pn-tabla">
          <thead>
            <tr>
              <th>Venta</th>
              <th>Precio</th>
              <th>Costo</th>
              <th>Ganás</th>
            </tr>
          </thead>
          <tbody>
            {ranking.map(({ p, c, prod }) => (
              <tr>
                <td>
                  {prod?.emoji} {p.nombre}
                  <small>{porcentaje(c.margen)} margen</small>
                </td>
                <td>{pesos(p.precio)}</td>
                <td>{pesos(c.total)}</td>
                <td class={c.ganancia >= 0 ? 'pn-pos' : 'pn-neg'}>{pesos(c.ganancia)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Tarjeta>

      <Tarjeta titulo={<><Icono n="meta" /> ¿Cuánto querés ganar?</>}>
        <Campo label="Quiero ganar">
          <Numero valor={meta} onCambio={setMeta} prefijo="$" decimales={0} ariaLabel="Meta de ganancia" />
        </Campo>
        {meta && meta > 0 ? (
          <ul class="pn-lista-simple">
            {ranking.map(({ p, prod }) => {
              const n = ventasParaGanar(p, meta, datos);
              return (
                <li>
                  <span>
                    {prod?.emoji} {p.nombre}
                  </span>
                  <strong>{n === null ? '—' : `vendé ${n}`}</strong>
                </li>
              );
            })}
          </ul>
        ) : null}
        <p class="pn-muted pn-chico">Vendiendo sólo esa opción. Podés combinarlas.</p>
      </Tarjeta>
    </>
  );
}

/* ═══════════════════════ HISTORIAL ═══════════════════════ */
export function PantallaHistorial({ ctx }: { ctx: Ctx }) {
  const { datos } = ctx;
  const meses = [...new Set([mesDe(hoy()), ...datos.movimientos.map((m) => mesDe(m.fecha))])].sort().reverse();
  const [mes, setMes] = useState(meses[0]);
  const [tipo, setTipo] = useState<'todo' | TipoMovimiento>('todo');
  const idx = meses.indexOf(mes);
  const delMes = datos.movimientos.filter((m) => mesDe(m.fecha) === mes);
  const r = resumen(delMes);
  const lista = delMes.filter((m) => tipo === 'todo' || m.tipo === tipo);
  const porDia = new Map<string, Movimiento[]>();
  lista.forEach((m) => porDia.set(m.fecha, [...(porDia.get(m.fecha) ?? []), m]));

  return (
    <>
      <div class="pn-titulo">
        <h1 class="pn-script">Historial</h1>
      </div>
      <div class="pn-mes">
        <button type="button" class="pn-icono-btn" aria-label="Mes anterior" disabled={idx >= meses.length - 1} onClick={() => setMes(meses[idx + 1])}>
          <Icono n="flecha" class="is-izq" />
        </button>
        <strong>{nombreMes(mes)}</strong>
        <button type="button" class="pn-icono-btn" aria-label="Mes siguiente" disabled={idx <= 0} onClick={() => setMes(meses[idx - 1])}>
          <Icono n="flecha" />
        </button>
      </div>
      <div class="pn-kpis pn-kpis--3">
        <div class="pn-kpi">
          <span>Vendiste</span>
          <strong>{pesos(r.ventas)}</strong>
        </div>
        <div class="pn-kpi is-ganancia">
          <span>Ganaste</span>
          <strong>{pesos(r.ganancia)}</strong>
        </div>
        <div class="pn-kpi">
          <span>Compraste</span>
          <strong>{pesos(r.compras)}</strong>
        </div>
      </div>
      <Segmentos
        opciones={[
          { v: 'todo', label: 'Todo' },
          { v: 'venta', label: 'Ventas' },
          { v: 'produccion', label: 'Producción' },
          { v: 'compra', label: 'Compras' },
          { v: 'ajuste', label: 'Ajustes' },
        ]}
        valor={tipo}
        onCambio={setTipo}
        ariaLabel="Tipo de movimiento"
      />
      {lista.length === 0 ? (
        <Tarjeta>
          <Vacio icono="historial" titulo="Nada por acá">
            <p>No hay movimientos de este tipo en {nombreMes(mes)}.</p>
          </Vacio>
        </Tarjeta>
      ) : (
        [...porDia.entries()].map(([dia, movs]) => (
          <Tarjeta titulo={fechaCorta(dia)} class="pn-dia">
            <ul class="pn-movs">
              {movs.map((m) => (
                <FilaMovimiento mov={m} ctx={ctx} />
              ))}
            </ul>
          </Tarjeta>
        ))
      )}
    </>
  );
}
