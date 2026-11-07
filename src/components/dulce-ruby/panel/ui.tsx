/** Componentes de interfaz del panel (Preact) */
import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { ICONOS, type NombreIcono } from './iconos';
import { leerNumero, numero } from './formato';

export function Icono({ n, class: c = '' }: { n: NombreIcono; class?: string }) {
  return <svg class={`pi ${c}`} viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML={{ __html: ICONOS[n] }} />;
}

/* ── Hoja inferior (bottom sheet / modal) ───────────────────────── */
export function Hoja({
  titulo,
  subtitulo,
  onCerrar,
  children,
  pie,
}: {
  titulo: string;
  subtitulo?: string;
  onCerrar: () => void;
  children: ComponentChildren;
  pie?: ComponentChildren;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar();
    document.addEventListener('keydown', onKey);
    document.documentElement.classList.add('pn-bloqueo');
    ref.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.documentElement.classList.remove('pn-bloqueo');
      prev?.focus?.();
    };
  }, []);
  return (
    <div class="pn-hoja-fondo" onClick={(e) => e.target === e.currentTarget && onCerrar()}>
      <div class="pn-hoja" role="dialog" aria-modal="true" aria-label={titulo} tabIndex={-1} ref={ref}>
        <div class="pn-hoja__asa" aria-hidden="true" />
        <header class="pn-hoja__cab">
          <div>
            <h2>{titulo}</h2>
            {subtitulo && <p>{subtitulo}</p>}
          </div>
          <button type="button" class="pn-icono-btn" onClick={onCerrar} aria-label="Cerrar">
            <Icono n="cerrar" />
          </button>
        </header>
        <div class="pn-hoja__cuerpo">{children}</div>
        {pie && <footer class="pn-hoja__pie">{pie}</footer>}
      </div>
    </div>
  );
}

/* ── Campos ─────────────────────────────────────────────────────── */
export function Campo({ label, ayuda, children }: { label: string; ayuda?: ComponentChildren; children: ComponentChildren }) {
  return (
    <label class="pn-campo">
      <span class="pn-campo__label">{label}</span>
      {children}
      {ayuda && <span class="pn-campo__ayuda">{ayuda}</span>}
    </label>
  );
}

// Muestra con separador de miles (1.500) — leerNumero lo vuelve a leer bien
const mostrar = (v: number | null, dec: number) => (v === null || Number.isNaN(v) ? '' : numero(v, dec));

/** Input numérico que acepta "1,5" y "1.500" (formato argentino) */
export function Numero({
  valor,
  onCambio,
  placeholder,
  prefijo,
  sufijo,
  decimales = 2,
  autoFocus,
  ariaLabel,
}: {
  valor: number | null;
  onCambio: (n: number | null) => void;
  placeholder?: string;
  prefijo?: string;
  sufijo?: ComponentChildren;
  decimales?: number;
  autoFocus?: boolean;
  ariaLabel?: string;
}) {
  const [txt, setTxt] = useState(mostrar(valor, decimales));
  // Si el valor cambia desde afuera (botones rápidos), reflejarlo sin pisar lo que se está escribiendo
  useEffect(() => {
    const actual = leerNumero(txt);
    const igual =
      valor === null
        ? txt.trim() === '' || Number.isNaN(actual)
        : !Number.isNaN(actual) && Math.abs(actual - valor) < 1e-9;
    if (!igual) setTxt(mostrar(valor, decimales));
  }, [valor]);
  return (
    <span class="pn-input">
      {prefijo && <span class="pn-input__pre">{prefijo}</span>}
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={txt}
        placeholder={placeholder}
        autoFocus={autoFocus}
        aria-label={ariaLabel}
        onInput={(e) => {
          const raw = (e.currentTarget as HTMLInputElement).value;
          setTxt(raw);
          const n = leerNumero(raw);
          onCambio(raw.trim() === '' || Number.isNaN(n) ? null : n);
        }}
      />
      {sufijo && <span class="pn-input__suf">{sufijo}</span>}
    </span>
  );
}

export function Texto({
  valor,
  onCambio,
  type = 'text',
  placeholder,
  autoComplete,
  autoFocus,
  required,
  minLength,
}: {
  valor: string;
  onCambio: (s: string) => void;
  type?: 'text' | 'email' | 'password';
  placeholder?: string;
  autoComplete?: string;
  autoFocus?: boolean;
  required?: boolean;
  minLength?: number;
}) {
  return (
    <span class="pn-input">
      <input
        type={type}
        value={valor}
        placeholder={placeholder}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        required={required}
        minLength={minLength}
        onInput={(e) => onCambio((e.currentTarget as HTMLInputElement).value)}
      />
    </span>
  );
}

export function Fecha({ valor, onCambio }: { valor: string; onCambio: (s: string) => void }) {
  return (
    <span class="pn-input">
      <input type="date" value={valor} onInput={(e) => onCambio((e.currentTarget as HTMLInputElement).value)} />
    </span>
  );
}

/** Control segmentado */
export function Segmentos<T extends string | number>({
  opciones,
  valor,
  onCambio,
  ariaLabel,
}: {
  opciones: { v: T; label: ComponentChildren }[];
  valor: T;
  onCambio: (v: T) => void;
  ariaLabel?: string;
}) {
  return (
    <div class="pn-seg" role="radiogroup" aria-label={ariaLabel}>
      {opciones.map((o) => (
        <button
          type="button"
          role="radio"
          aria-checked={o.v === valor}
          class={o.v === valor ? 'is-on' : ''}
          onClick={() => onCambio(o.v)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Fichas seleccionables (scroll horizontal en celular) */
export function Fichas<T extends string>({
  opciones,
  valor,
  onCambio,
}: {
  opciones: { v: T; label: ComponentChildren; sub?: ComponentChildren }[];
  valor: T | null;
  onCambio: (v: T) => void;
}) {
  return (
    <div class="pn-fichas">
      {opciones.map((o) => (
        <button type="button" class={`pn-ficha ${o.v === valor ? 'is-on' : ''}`} aria-pressed={o.v === valor} onClick={() => onCambio(o.v)}>
          <span class="pn-ficha__t">{o.label}</span>
          {o.sub && <span class="pn-ficha__s">{o.sub}</span>}
        </button>
      ))}
    </div>
  );
}

export function Stepper({ valor, onCambio, min = 1 }: { valor: number; onCambio: (n: number) => void; min?: number }) {
  return (
    <div class="pn-stepper">
      <button type="button" aria-label="Menos" onClick={() => onCambio(Math.max(min, valor - 1))} disabled={valor <= min}>
        <Icono n="menos" />
      </button>
      <Numero valor={valor} decimales={0} onCambio={(n) => onCambio(Math.max(min, Math.round(n ?? min)))} ariaLabel="Cantidad" />
      <button type="button" aria-label="Más" onClick={() => onCambio(valor + 1)}>
        <Icono n="mas" />
      </button>
    </div>
  );
}

export function Boton({
  children,
  tipo = 'primario',
  icono,
  onClick,
  disabled,
  cargando,
  submit,
  class: c = '',
}: {
  children: ComponentChildren;
  tipo?: 'primario' | 'secundario' | 'peligro' | 'fantasma';
  icono?: NombreIcono;
  onClick?: () => void;
  disabled?: boolean;
  cargando?: boolean;
  submit?: boolean;
  class?: string;
}) {
  return (
    <button
      type={submit ? 'submit' : 'button'}
      class={`pn-btn pn-btn--${tipo} ${c}`}
      onClick={onClick}
      disabled={disabled || cargando}
      aria-busy={cargando}
    >
      {cargando ? <span class="pn-spin" aria-hidden="true" /> : icono && <Icono n={icono} />}
      <span>{children}</span>
    </button>
  );
}

export function Vacio({ icono, titulo, children }: { icono: NombreIcono; titulo: string; children?: ComponentChildren }) {
  return (
    <div class="pn-vacio">
      <span class="pn-vacio__ico">
        <Icono n={icono} />
      </span>
      <strong>{titulo}</strong>
      {children}
    </div>
  );
}

export function Aviso({ tipo = 'info', children }: { tipo?: 'info' | 'alerta' | 'error' | 'ok'; children: ComponentChildren }) {
  return (
    <div class={`pn-aviso pn-aviso--${tipo}`} role={tipo === 'error' ? 'alert' : undefined}>
      <Icono n={tipo === 'ok' ? 'ok' : tipo === 'info' ? 'info' : 'aviso'} />
      <div>{children}</div>
    </div>
  );
}

export function Tarjeta({ children, class: c = '', titulo, accion }: { children: ComponentChildren; class?: string; titulo?: ComponentChildren; accion?: ComponentChildren }) {
  return (
    <section class={`pn-card ${c}`}>
      {(titulo || accion) && (
        <header class="pn-card__cab">
          {titulo && <h3>{titulo}</h3>}
          {accion}
        </header>
      )}
      {children}
    </section>
  );
}
