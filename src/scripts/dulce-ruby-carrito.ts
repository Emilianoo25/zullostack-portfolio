/**
 * Carrito del catálogo Dulce Ruby.
 * - "+ Agregar" (precios y promos) suma al pedido; nada abre WhatsApp directo.
 * - El pedido se confirma en 2 pasos: lo elegido → datos (nombre, entrega, pago…).
 * - Recién ahí se abre WhatsApp con el mensaje armado.
 * - Carrito y datos quedan en el navegador del cliente (localStorage) por si vuelve.
 * Usa delegación de eventos: funciona también con las copias de página que crea el flipbook.
 */

interface ItemCatalogo {
  key: string;
  producto: string;
  emoji: string;
  opcion: string;
  unidades: number;
  precio: number;
}
interface Catalogo {
  whatsapp: string;
  primeraSeccion: string;
  items: ItemCatalogo[];
}
type Carrito = Record<string, number>;
type Paso = 'lista' | 'datos' | 'listo';
interface DatosCliente {
  nombre: string;
  entrega: 'retiro' | 'envio';
  direccion: string;
  cuando: string;
  pago: 'efectivo' | 'transferencia';
  comentario: string;
}

const CLAVE_CARRITO = 'dr-carrito-v1';
const CLAVE_CLIENTE = 'dr-cliente-v1';
const MAX_POR_ITEM = 99;

const pesos = (n: number) => '$' + Math.round(n).toLocaleString('es-AR').replace(/,/g, '.');

const leer = <T>(k: string): T | null => {
  try {
    const raw = localStorage.getItem(k);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};
const guardar = (k: string, v: unknown) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* modo incógnito / sin espacio: el carrito sigue funcionando en memoria */
  }
};

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Línea del pedido: "1 × Caja de 15 de mini donas" · "6 × Mini donas (por unidad)" */
const nombreLinea = (it: ItemCatalogo, n: number) =>
  it.unidades === 1 ? `${n} × ${it.producto} (por unidad)` : `${n} × ${it.opcion} de ${it.producto.toLowerCase()}`;

export function armarMensaje(lineas: { it: ItemCatalogo; n: number }[], d: DatosCliente): string {
  const total = lineas.reduce((s, l) => s + l.it.precio * l.n, 0);
  const envio = d.entrega === 'envio';
  const partes = [
    '¡Hola Dulce Ruby! 👋 Te hago este pedido desde la página:',
    '',
    ...lineas.map((l) => `• ${nombreLinea(l.it, l.n)} — ${pesos(l.it.precio * l.n)}`),
    '',
    `*Total: ${pesos(total)}*${envio ? ' (sin el envío)' : ''}`,
    '',
    `*Nombre:* ${d.nombre}`,
    `*Entrega:* ${envio ? `Envío a ${d.direccion}` : 'Lo retiro'}`,
  ];
  if (d.cuando) partes.push(`*Para cuándo:* ${d.cuando}`);
  partes.push(
    `*Pago:* ${d.pago === 'transferencia' ? 'Transferencia — pasame el alias y te mando el comprobante' : 'Efectivo'}`,
  );
  if (d.comentario) partes.push(`*Comentario:* ${d.comentario}`);
  partes.push(
    '',
    envio ? '¿Me confirmás disponibilidad y el costo del envío? ¡Gracias!' : '¿Me confirmás disponibilidad y dónde lo retiro? ¡Gracias!',
  );
  return partes.join('\n');
}

export function initCarrito(): void {
  const nodoCatalogo = document.getElementById('dr-catalogo');
  const nodoCarrito = document.querySelector<HTMLElement>('[data-cart]');
  if (!nodoCatalogo || !nodoCarrito) return;
  const raiz: HTMLElement = nodoCarrito;
  const catalogo = JSON.parse(nodoCatalogo.textContent || '{}') as Catalogo;
  const porClave = new Map(catalogo.items.map((i) => [i.key, i]));
  const html = document.documentElement;

  // Sólo claves que siguen existiendo en el catálogo (precios siempre actuales)
  const carrito: Carrito = {};
  Object.entries(leer<Carrito>(CLAVE_CARRITO) ?? {}).forEach(([k, n]) => {
    if (porClave.has(k) && n > 0) carrito[k] = Math.min(MAX_POR_ITEM, Math.floor(n));
  });

  const $ = <T extends Element = HTMLElement>(sel: string) => raiz.querySelector<T>(sel)!;
  const $$ = <T extends Element = HTMLElement>(sel: string, el: ParentNode = document) => Array.from(el.querySelectorAll<T>(sel));
  const panel = $('.dr-cart__panel');
  const form = $<HTMLFormElement>('form[data-paso="datos"]');
  const toast = document.querySelector<HTMLElement>('[data-toast]');
  let paso: Paso = 'lista';
  let abridor: HTMLElement | null = null;
  let ultimoLink = '';

  const lineas = () =>
    catalogo.items.filter((it) => (carrito[it.key] ?? 0) > 0).map((it) => ({ it, n: carrito[it.key] }));
  const total = () => lineas().reduce((s, l) => s + l.it.precio * l.n, 0);
  const cantidad = () => lineas().reduce((s, l) => s + l.n, 0);

  /* ── pintar ─────────────────────────────────────────── */
  function pintar() {
    // Botones dentro del libro (incluye copias del flipbook)
    $$<HTMLElement>('[data-add-wrap]').forEach((w) => w.classList.toggle('has-qty', (carrito[w.dataset.addWrap!] ?? 0) > 0));
    $$<HTMLElement>('[data-qty-of]').forEach((e) => (e.textContent = String(carrito[e.dataset.qtyOf!] ?? 0)));
    $$<HTMLElement>('[data-badge-of]').forEach((e) => {
      const n = carrito[e.dataset.badgeOf!] ?? 0;
      e.hidden = n === 0;
      e.textContent = n ? `✓ ${n} en tu pedido` : '';
    });

    // Botón del pedido (barra inferior / flotante)
    const n = cantidad();
    $$<HTMLElement>('[data-cart-count]').forEach((e) => {
      e.hidden = n === 0;
      e.textContent = String(n);
    });
    $$<HTMLElement>('[data-cart-label]').forEach((e) => (e.textContent = n ? `Tu pedido · ${pesos(total())}` : 'Hacé tu pedido'));
    html.classList.toggle('cart-has-items', n > 0);

    // Lista del carrito
    const ls = lineas();
    $('[data-cart-items]').innerHTML = ls
      .map(
        ({ it, n: q }) => `
      <li class="dr-cart__item">
        <span class="dr-cart__emoji" aria-hidden="true">${esc(it.emoji)}</span>
        <span class="dr-cart__info">
          <strong>${esc(it.unidades === 1 ? `${it.producto} (por unidad)` : it.opcion)}</strong>
          <small>${esc(it.unidades === 1 ? '' : `${it.producto} · `)}${pesos(it.precio)} c/u</small>
        </span>
        <span class="dr-cart__qty">
          <button type="button" data-menos="${esc(it.key)}" aria-label="Quitar uno">${q === 1 ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 11v6m4-6v6m5-11v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>' : '−'}</button>
          <span aria-live="polite">${q}</span>
          <button type="button" data-add="${esc(it.key)}" aria-label="Sumar uno"${q >= MAX_POR_ITEM ? ' disabled' : ''}>+</button>
        </span>
        <span class="dr-cart__sub">${pesos(it.precio * q)}</span>
      </li>`,
      )
      .join('');
    $('[data-cart-vacio]').hidden = ls.length > 0;
    $('[data-cart-pie]').hidden = ls.length === 0;
    $$<HTMLElement>('[data-cart-total]', raiz).forEach((e) => (e.textContent = pesos(total())));
    if (paso === 'datos' && ls.length === 0) irA('lista');
  }

  const persistir = () => guardar(CLAVE_CARRITO, carrito);

  function cambiar(key: string, delta: number, origen?: HTMLElement) {
    const it = porClave.get(key);
    if (!it) return;
    const antes = carrito[key] ?? 0;
    const nuevo = Math.max(0, Math.min(MAX_POR_ITEM, antes + delta));
    if (nuevo === 0) delete carrito[key];
    else carrito[key] = nuevo;
    persistir();
    pintar();
    if (delta > 0 && nuevo > antes && !raiz.classList.contains('is-open')) {
      avisar(`Agregado: ${it.unidades === 1 ? `${it.producto} (por unidad)` : `${it.opcion} · ${it.producto}`}`);
      rebote();
    }
    origen?.blur?.();
  }

  /* ── avisos ─────────────────────────────────────────── */
  let tToast = 0;
  function avisar(msg: string) {
    if (!toast) return;
    toast.innerHTML = `<span>${esc(msg)}</span><button type="button" data-cart-open>Ver pedido</button>`;
    toast.hidden = false;
    toast.classList.remove('is-in');
    void toast.offsetWidth;
    toast.classList.add('is-in');
    window.clearTimeout(tToast);
    tToast = window.setTimeout(() => (toast.hidden = true), 3200);
  }
  function rebote() {
    $$<HTMLElement>('.dr-fab, .dr-controls__order').forEach((b) => {
      b.classList.remove('is-bump');
      void b.offsetWidth;
      b.classList.add('is-bump');
    });
  }

  /* ── abrir / cerrar / pasos ─────────────────────────── */
  const TITULOS: Record<Paso, [string, string]> = {
    lista: ['Tu pedido', 'Revisá lo que elegiste'],
    datos: ['Tus datos', 'Así sabemos a quién y cómo entregarlo'],
    listo: ['¡Pedido listo!', 'Ya casi: falta tocar Enviar en WhatsApp'],
  };

  function irA(p: Paso) {
    paso = p;
    $$<HTMLElement>('[data-paso]', raiz).forEach((el) => (el.hidden = el.dataset.paso !== p));
    $('[data-cart-titulo]').textContent = TITULOS[p][0];
    $('[data-cart-sub]').textContent = TITULOS[p][1];
    $('.dr-cart__atras').hidden = p !== 'datos';
    $('[data-cart-error]').hidden = true;
    if (p === 'datos') {
      const nombre = form.elements.namedItem('nombre') as HTMLInputElement;
      requestAnimationFrame(() => (nombre.value ? form.querySelector<HTMLElement>('button[type="submit"]') : nombre)?.focus());
    } else {
      requestAnimationFrame(() => panel.focus());
    }
  }

  function abrir(desde?: HTMLElement | null) {
    abridor = desde ?? null;
    if (toast) toast.hidden = true;
    pintar();
    irA(cantidad() === 0 || paso === 'listo' ? 'lista' : paso);
    raiz.hidden = false;
    requestAnimationFrame(() => raiz.classList.add('is-open'));
    html.classList.add('cart-open');
  }

  function cerrar() {
    raiz.classList.remove('is-open');
    html.classList.remove('cart-open');
    // Pedido ya enviado → se vacía al cerrar
    if (paso === 'listo') {
      Object.keys(carrito).forEach((k) => delete carrito[k]);
      persistir();
      paso = 'lista';
      pintar();
    }
    window.setTimeout(() => (raiz.hidden = true), 260);
    abridor?.focus?.();
  }

  /* ── datos del cliente ──────────────────────────────── */
  const guardados = leer<Partial<DatosCliente>>(CLAVE_CLIENTE);
  if (guardados) {
    (['nombre', 'direccion'] as const).forEach((k) => {
      const el = form.elements.namedItem(k) as HTMLInputElement | null;
      if (el && guardados[k]) el.value = guardados[k]!;
    });
    (['entrega', 'pago'] as const).forEach((k) => {
      const v = guardados[k];
      const el = v ? form.querySelector<HTMLInputElement>(`input[name="${k}"][value="${v}"]`) : null;
      if (el) el.checked = true;
    });
  }
  const sincronizarEnvio = () => {
    const envio = (form.elements.namedItem('entrega') as RadioNodeList).value === 'envio';
    form.querySelector<HTMLElement>('[data-solo-envio]')!.hidden = !envio;
  };
  sincronizarEnvio();
  form.addEventListener('change', (e) => {
    if ((e.target as HTMLInputElement).name === 'entrega') sincronizarEnvio();
  });
  // El error se va apenas la persona corrige
  form.addEventListener('input', () => ($('[data-cart-error]').hidden = true));

  function datosDelForm(): DatosCliente {
    const v = (n: string) => ((form.elements.namedItem(n) as HTMLInputElement | null)?.value ?? '').trim().replace(/\s+/g, ' ');
    return {
      nombre: v('nombre'),
      entrega: (form.elements.namedItem('entrega') as RadioNodeList).value === 'envio' ? 'envio' : 'retiro',
      direccion: v('direccion'),
      cuando: v('cuando'),
      pago: (form.elements.namedItem('pago') as RadioNodeList).value === 'transferencia' ? 'transferencia' : 'efectivo',
      comentario: ((form.elements.namedItem('comentario') as HTMLTextAreaElement).value ?? '').trim(),
    };
  }

  function error(msg: string, campo?: string) {
    const e = $('[data-cart-error]');
    e.textContent = msg;
    e.hidden = false;
    if (campo) (form.elements.namedItem(campo) as HTMLElement | null)?.focus();
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const d = datosDelForm();
    if (!lineas().length) return irA('lista');
    if (d.nombre.length < 2) return error('Decinos tu nombre para saber de quién es el pedido.', 'nombre');
    if (d.entrega === 'envio' && d.direccion.length < 4) return error('Para el envío necesitamos la dirección o la zona.', 'direccion');
    guardar(CLAVE_CLIENTE, { nombre: d.nombre, entrega: d.entrega, direccion: d.direccion, pago: d.pago });

    ultimoLink = `https://wa.me/${catalogo.whatsapp}?text=${encodeURIComponent(armarMensaje(lineas(), d))}`;
    $<HTMLAnchorElement>('[data-cart-wa]').href = ultimoLink;
    // (sin 'noopener' en features: con eso window.open devuelve null aunque abra)
    const ventana = window.open(ultimoLink, '_blank');
    if (ventana) ventana.opener = null;
    irA('listo');
    // Navegadores internos (Instagram, etc.) que bloquean ventanas nuevas
    if (!ventana) window.location.href = ultimoLink;
  });

  /* ── eventos (delegados) ────────────────────────────── */
  document.addEventListener('click', (e) => {
    const t = (e.target as Element | null)?.closest<HTMLElement>(
      '[data-add], [data-menos], [data-cart-open], [data-cart-close], [data-cart-step], [data-cart-vaciar], [data-cart-nuevo], [data-cart-ver-productos]',
    );
    if (!t) return;
    if (t.dataset.add !== undefined) {
      e.preventDefault();
      cambiar(t.dataset.add, +1, t);
    } else if (t.dataset.menos !== undefined) {
      e.preventDefault();
      cambiar(t.dataset.menos, -1, t);
    } else if (t.hasAttribute('data-cart-open')) {
      e.preventDefault();
      abrir(t);
    } else if (t.hasAttribute('data-cart-close')) {
      cerrar();
    } else if (t.dataset.cartStep) {
      irA(t.dataset.cartStep as Paso);
    } else if (t.hasAttribute('data-cart-vaciar')) {
      Object.keys(carrito).forEach((k) => delete carrito[k]);
      persistir();
      pintar();
    } else if (t.hasAttribute('data-cart-nuevo')) {
      Object.keys(carrito).forEach((k) => delete carrito[k]);
      persistir();
      paso = 'lista';
      pintar();
      cerrar();
    } else if (t.hasAttribute('data-cart-ver-productos')) {
      cerrar();
      window.setTimeout(() => (location.hash = catalogo.primeraSeccion), 120);
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && raiz.classList.contains('is-open')) cerrar();
  });

  // Otra pestaña cambió el carrito
  window.addEventListener('storage', (e) => {
    if (e.key !== CLAVE_CARRITO) return;
    Object.keys(carrito).forEach((k) => delete carrito[k]);
    Object.assign(carrito, leer<Carrito>(CLAVE_CARRITO) ?? {});
    pintar();
  });

  pintar();
}
