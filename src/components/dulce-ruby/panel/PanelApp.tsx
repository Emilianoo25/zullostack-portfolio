/** Panel Dulce Ruby — raíz de la app (Preact, client:only) */
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import type { SupabaseClient } from '@supabase/supabase-js';
import { backendNube, backendPrueba, configNube, type Backend, type Cambio } from './datos';
import { alertasStock, datosVacios, type Datos } from './modelo';
import { datosDemo, productosDelCatalogo } from './semillas';
import {
  HojaAlertas,
  HojaCompra,
  HojaDeshacer,
  HojaInsumo,
  HojaPresentacion,
  HojaProduccion,
  HojaProducto,
  HojaVenta,
  type Ctx,
  type HojaAbierta,
} from './formularios';
import { PantallaGanancias, PantallaHistorial, PantallaInicio, PantallaRecetas, PantallaStock, type Tab } from './pantallas';
import { Aviso, Boton, Campo, Icono, Texto } from './ui';
import type { NombreIcono } from './iconos';

export default function PanelApp() {
  const cfg = configNube();
  return cfg ? <ConNube url={cfg.url} clave={cfg.key} /> : <Panel backend={backendPrueba()} />;
}

/* ═══════════════════════ MODO NUBE: sesión ═══════════════════════ */
function ConNube({ url, clave }: { url: string; clave: string }) {
  const [sb, setSb] = useState<SupabaseClient | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [recuperando, setRecuperando] = useState(false);
  const [listo, setListo] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let off = () => {};
    import('@supabase/supabase-js')
      .then(({ createClient }) => {
        const c = createClient(url, clave, { auth: { persistSession: true, storageKey: 'dr-panel-auth' } });
        setSb(c);
        c.auth.getSession().then(({ data }) => {
          setEmail(data.session?.user.email ?? null);
          setListo(true);
        });
        const { data } = c.auth.onAuthStateChange((ev, sesion) => {
          if (ev === 'PASSWORD_RECOVERY') setRecuperando(true);
          setEmail(sesion?.user.email ?? null);
        });
        off = () => data.subscription.unsubscribe();
      })
      .catch(() => setError('No se pudo conectar. Revisá tu internet y recargá.'));
    return () => off();
  }, [url, clave]);

  if (error)
    return (
      <div class="pn-login">
        <Aviso tipo="error">{error}</Aviso>
      </div>
    );
  if (!sb || !listo) return <Cargando />;
  if (recuperando) return <NuevaClave sb={sb} onListo={() => setRecuperando(false)} />;
  if (!email) return <Login sb={sb} />;
  return <Panel backend={backendNube(sb)} usuaria={email} onSalir={() => sb.auth.signOut()} />;
}

const traducir = (m: string) =>
  /invalid login/i.test(m)
    ? 'Mail o contraseña incorrectos.'
    : /not confirmed/i.test(m)
      ? 'Falta confirmar el mail: abrí el correo de confirmación que te llegó.'
      : /already registered|already been registered/i.test(m)
        ? 'Ese mail ya tiene cuenta: entrá con tu contraseña.'
        : /password should be at least/i.test(m)
          ? 'La contraseña tiene que tener al menos 6 caracteres.'
          : /rate limit|too many/i.test(m)
            ? 'Demasiados intentos: esperá unos minutos.'
            : /signups not allowed|signup is disabled/i.test(m)
              ? 'No se pueden crear cuentas nuevas.'
              : m;

function Login({ sb }: { sb: SupabaseClient }) {
  const [modo, setModo] = useState<'entrar' | 'crear' | 'olvide'>('entrar');
  const [mail, setMail] = useState('');
  const [clave, setClave] = useState('');
  const [cargando, setCargando] = useState(false);
  const [msg, setMsg] = useState<{ t: 'ok' | 'error'; m: string } | null>(null);
  const volver = location.origin + location.pathname;

  async function enviar(e: Event) {
    e.preventDefault();
    setCargando(true);
    setMsg(null);
    try {
      if (modo === 'entrar') {
        const { error } = await sb.auth.signInWithPassword({ email: mail.trim(), password: clave });
        if (error) throw error;
      } else if (modo === 'crear') {
        const { data, error } = await sb.auth.signUp({ email: mail.trim(), password: clave, options: { emailRedirectTo: volver } });
        if (error) throw error;
        if (!data.session) setMsg({ t: 'ok', m: 'Listo. Te mandamos un mail: tocá el link para confirmar la cuenta y después entrá acá.' });
      } else {
        const { error } = await sb.auth.resetPasswordForEmail(mail.trim(), { redirectTo: volver });
        if (error) throw error;
        setMsg({ t: 'ok', m: 'Te mandamos un mail con un link para crear una contraseña nueva.' });
      }
    } catch (err) {
      setMsg({ t: 'error', m: traducir((err as Error).message) });
    } finally {
      setCargando(false);
    }
  }

  return (
    <div class="pn-login">
      <form class="pn-login__card" onSubmit={enviar}>
        <img src="/dulce-ruby/logo.webp" alt="Dulce Ruby" width="160" height="150" />
        <h1 class="pn-script">Panel de Ruby</h1>
        <p class="pn-muted">{modo === 'crear' ? 'Creá tu cuenta' : modo === 'olvide' ? 'Recuperar contraseña' : 'Stock, recetas y ganancias'}</p>
        <Campo label="Mail">
          <Texto valor={mail} onCambio={setMail} type="email" autoComplete="email" required placeholder="tu@mail.com" />
        </Campo>
        {modo !== 'olvide' && (
          <Campo label="Contraseña">
            <Texto
              valor={clave}
              onCambio={setClave}
              type="password"
              autoComplete={modo === 'crear' ? 'new-password' : 'current-password'}
              required
              minLength={6}
            />
          </Campo>
        )}
        {msg && <Aviso tipo={msg.t}>{msg.m}</Aviso>}
        <Boton submit cargando={cargando} icono={modo === 'entrar' ? 'ir' : 'ok'}>
          {modo === 'entrar' ? 'Entrar' : modo === 'crear' ? 'Crear cuenta' : 'Mandarme el link'}
        </Boton>
        <div class="pn-login__links">
          {modo !== 'entrar' && (
            <button type="button" class="pn-link" onClick={() => (setModo('entrar'), setMsg(null))}>
              Ya tengo cuenta
            </button>
          )}
          {modo === 'entrar' && (
            <>
              <button type="button" class="pn-link" onClick={() => (setModo('olvide'), setMsg(null))}>
                Me olvidé la contraseña
              </button>
              <button type="button" class="pn-link" onClick={() => (setModo('crear'), setMsg(null))}>
                Crear cuenta
              </button>
            </>
          )}
        </div>
      </form>
    </div>
  );
}

function NuevaClave({ sb, onListo }: { sb: SupabaseClient; onListo: () => void }) {
  const [clave, setClave] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  async function guardar(e: Event) {
    e.preventDefault();
    setCargando(true);
    const { error } = await sb.auth.updateUser({ password: clave });
    setCargando(false);
    if (error) setError(traducir(error.message));
    else onListo();
  }
  return (
    <div class="pn-login">
      <form class="pn-login__card" onSubmit={guardar}>
        <h1 class="pn-script">Contraseña nueva</h1>
        <Campo label="Nueva contraseña">
          <Texto valor={clave} onCambio={setClave} type="password" autoComplete="new-password" required minLength={6} />
        </Campo>
        {error && <Aviso tipo="error">{error}</Aviso>}
        <Boton submit cargando={cargando} icono="ok">
          Guardar
        </Boton>
      </form>
    </div>
  );
}

function Cargando() {
  return (
    <div class="pn-cargando" role="status" aria-live="polite">
      <span class="pn-dona" aria-hidden="true" />
      <span>Cargando…</span>
    </div>
  );
}

/* ═══════════════════════ PANEL ═══════════════════════ */
const TABS: { id: Tab; label: string; icono: NombreIcono }[] = [
  { id: 'inicio', label: 'Inicio', icono: 'inicio' },
  { id: 'stock', label: 'Stock', icono: 'stock' },
  { id: 'recetas', label: 'Recetas', icono: 'recetas' },
  { id: 'ganancias', label: 'Ganancias', icono: 'ganancias' },
  { id: 'historial', label: 'Historial', icono: 'historial' },
];

const tabDeHash = (): Tab => {
  const h = location.hash.replace('#', '') as Tab;
  return TABS.some((t) => t.id === h) ? h : 'inicio';
};

function Panel({ backend, usuaria, onSalir }: { backend: Backend; usuaria?: string; onSalir?: () => void }) {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [errorCarga, setErrorCarga] = useState('');
  const [tab, setTab] = useState<Tab>(tabDeHash);
  const [hoja, setHoja] = useState<HojaAbierta | null>(null);
  const [toast, setToast] = useState<{ m: string; t: 'ok' | 'error'; k: number } | null>(null);
  const timer = useRef<number>();

  const avisar = useCallback((m: string, t: 'ok' | 'error' = 'ok') => {
    window.clearTimeout(timer.current);
    setToast({ m, t, k: Date.now() });
    timer.current = window.setTimeout(() => setToast(null), t === 'error' ? 6000 : 2800);
  }, []);

  const cargar = useCallback(async () => {
    setErrorCarga('');
    try {
      let d = await backend.cargar();
      if (backend.modo === 'prueba' && !d) {
        d = datosDemo();
        await backend.sync({ t: 'reemplazarTodo' }, d);
      }
      if (backend.modo === 'nube' && d && d.productos.length === 0 && d.insumos.length === 0 && d.movimientos.length === 0) {
        // Primera vez: productos y precios del catálogo
        const sem = productosDelCatalogo();
        for (const p of sem.productos) await backend.sync({ t: 'producto', item: p }, d);
        await backend.sync({ t: 'presentaciones', items: sem.presentaciones }, d);
        d = { ...d, ...sem };
      }
      setDatos(d ?? datosVacios());
    } catch (e) {
      setErrorCarga((e as Error).message || 'No se pudieron cargar los datos.');
    }
  }, [backend]);

  useEffect(() => {
    cargar();
  }, []);

  useEffect(() => {
    const onHash = () => setTab(tabDeHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const irA = (t: Tab) => {
    setTab(t);
    history.replaceState(null, '', t === 'inicio' ? location.pathname : `#${t}`);
    window.scrollTo({ top: 0 });
  };

  const hacer = useCallback(
    async (c: Cambio, siguiente: Datos, mensaje?: string) => {
      try {
        await backend.sync(c, siguiente);
        setDatos(siguiente);
        if (mensaje) avisar(mensaje);
        return true;
      } catch (e) {
        avisar((e as Error).message || 'No se pudo guardar. Probá de nuevo.', 'error');
        return false;
      }
    },
    [backend, avisar],
  );

  async function reiniciarPrueba(conEjemplo: boolean) {
    const d = conEjemplo ? datosDemo() : { ...datosVacios(), ...productosDelCatalogo() };
    await hacer({ t: 'reemplazarTodo' }, d, conEjemplo ? 'Datos de ejemplo restaurados' : 'Panel vacío: empezá a cargar lo tuyo');
  }

  if (errorCarga)
    return (
      <div class="pn-login">
        <div class="pn-login__card">
          <Aviso tipo="error">{errorCarga}</Aviso>
          <Boton icono="deshacer" onClick={cargar}>
            Reintentar
          </Boton>
          {onSalir && (
            <Boton tipo="fantasma" icono="salir" onClick={onSalir}>
              Salir
            </Boton>
          )}
        </div>
      </div>
    );
  if (!datos) return <Cargando />;

  const ctx: Ctx = { datos, hacer, abrir: setHoja, cerrar: () => setHoja(null) };
  const nAlertas = alertasStock(datos).length;
  const esDemo = backend.modo === 'prueba';

  return (
    <div class="pn-app">
      <header class="pn-top">
        <a class="pn-marca" href="/dulce-ruby/" title="Ver el catálogo">
          <img src="/dulce-ruby/logo-sm.webp" alt="" width="40" height="38" />
          <span class="pn-script">Dulce Ruby</span>
          <small>Panel</small>
        </a>
        <div class="pn-top__acc">
          <span class={`pn-modo ${esDemo ? 'is-prueba' : 'is-nube'}`} title={esDemo ? 'Los datos se guardan sólo en este navegador' : `Guardado en la nube · ${usuaria}`}>
            <Icono n={esDemo ? 'celu' : 'nube'} />
            {esDemo ? 'Prueba' : 'Nube'}
          </span>
          <button type="button" class="pn-campana" aria-label={nAlertas ? `${nAlertas} avisos de stock` : 'Sin avisos de stock'} onClick={() => setHoja({ h: 'alertas' })}>
            <Icono n="alerta" />
            {nAlertas > 0 && <span class="pn-campana__n">{nAlertas}</span>}
          </button>
          {onSalir && (
            <button type="button" class="pn-icono-btn" aria-label="Salir" title="Salir" onClick={onSalir}>
              <Icono n="salir" />
            </button>
          )}
        </div>
      </header>

      <nav class="pn-nav" aria-label="Secciones del panel">
        {TABS.map((t) => (
          <button type="button" class={tab === t.id ? 'is-on' : ''} aria-current={tab === t.id ? 'page' : undefined} onClick={() => irA(t.id)}>
            <Icono n={t.icono} />
            <span>{t.label}</span>
            {t.id === 'stock' && nAlertas > 0 && <span class="pn-nav__dot" aria-hidden="true" />}
          </button>
        ))}
      </nav>

      <main class="pn-main">
        {esDemo && (
          <div class="pn-demo">
            <Icono n="info" />
            <p>
              <strong>Modo prueba:</strong> los números son de ejemplo y se guardan sólo en este navegador.
            </p>
            <div>
              <button type="button" class="pn-link" onClick={() => reiniciarPrueba(false)}>
                Empezar de cero
              </button>
              <button type="button" class="pn-link" onClick={() => reiniciarPrueba(true)}>
                Restaurar ejemplo
              </button>
            </div>
          </div>
        )}
        <div class="pn-pantalla" key={tab}>
          {tab === 'inicio' && <PantallaInicio ctx={ctx} irA={irA} />}
          {tab === 'stock' && <PantallaStock ctx={ctx} />}
          {tab === 'recetas' && <PantallaRecetas ctx={ctx} />}
          {tab === 'ganancias' && <PantallaGanancias ctx={ctx} />}
          {tab === 'historial' && <PantallaHistorial ctx={ctx} />}
        </div>
      </main>

      {hoja?.h === 'produccion' && <HojaProduccion ctx={ctx} productoId={hoja.productoId} key={hoja.productoId} />}
      {hoja?.h === 'venta' && <HojaVenta ctx={ctx} presentacionId={hoja.presentacionId} key={hoja.presentacionId} />}
      {hoja?.h === 'compra' && <HojaCompra ctx={ctx} insumoId={hoja.insumoId} key={hoja.insumoId} />}
      {hoja?.h === 'insumo' && <HojaInsumo ctx={ctx} id={hoja.id} key={hoja.id ?? 'nuevo'} />}
      {hoja?.h === 'producto' && <HojaProducto ctx={ctx} id={hoja.id} key={hoja.id ?? 'nuevo'} />}
      {hoja?.h === 'presentacion' && <HojaPresentacion ctx={ctx} id={hoja.id} productoId={hoja.productoId} key={hoja.id ?? hoja.productoId} />}
      {hoja?.h === 'alertas' && <HojaAlertas ctx={ctx} />}
      {hoja?.h === 'deshacer' && <HojaDeshacer ctx={ctx} mov={hoja.mov} />}

      {toast && (
        <div class={`pn-toast is-${toast.t}`} role="status" aria-live="polite" key={toast.k}>
          <Icono n={toast.t === 'ok' ? 'ok' : 'aviso'} />
          {toast.m}
        </div>
      )}
    </div>
  );
}
