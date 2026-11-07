import { PageFlip, type Orientation } from 'page-flip/dist/js/page-flip.module.js';

/**
 * Flipbook del catálogo Dulce Ruby.
 * - Menú superior / índice / botones → saltan de página con animación.
 * - Links directos: /dulce-ruby/#donas abre el libro en esa sección.
 * - Teclado: ← →
 * - La orientación (1 página vs. doble página) la decide page-flip según el ancho;
 *   el CSS ajusta el tamaño del libro según la clase is-portrait / is-landscape.
 */
export function initBook(): void {
  const root = document.documentElement;
  const bookEl = document.getElementById('dr-book');
  if (!bookEl) return;

  const pages = Array.from(bookEl.querySelectorAll<HTMLElement>(':scope > .dr-page'));
  const last = pages.length - 1;
  const sections = pages.map((p) => p.dataset.section ?? 'inicio');
  const chips = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-chip]'));
  const counter = document.querySelector<HTMLElement>('[data-counter]');
  const progress = document.querySelector<HTMLElement>('[data-progress]');
  const prevBtn = document.querySelector<HTMLButtonElement>('[data-prev]');
  const nextBtn = document.querySelector<HTMLButtonElement>('[data-next]');
  const hint = document.querySelector<HTMLElement>('[data-hint]');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /** Primera página de cada sección (para links #seccion) */
  const sectionStart = new Map<string, number>();
  sections.forEach((s, i) => {
    if (!sectionStart.has(s)) sectionStart.set(s, i);
  });
  chips.forEach((c) => sectionStart.set(c.dataset.chip!, Number(c.dataset.goto)));

  const pageFromHash = (): number | null => {
    const id = decodeURIComponent(location.hash.replace('#', ''));
    return id && sectionStart.has(id) ? sectionStart.get(id)! : null;
  };

  let orientation: Orientation = root.classList.contains('is-landscape') ? 'landscape' : 'portrait';
  let current = 0;
  let requested: number | null = null;
  let interacted = false;
  const startPage = pageFromHash() ?? 0;

  const pf = new PageFlip(bookEl, {
    width: 500,
    height: 714,
    size: 'stretch',
    // umbral: si el contenedor mide < 2×minWidth → una sola página (móvil / tablet vertical)
    minWidth: 320,
    maxWidth: 640,
    minHeight: 300,
    maxHeight: 914,
    showCover: true,
    usePortrait: true,
    autoSize: true,
    drawShadow: true,
    maxShadowOpacity: 0.4,
    flippingTime: reduceMotion ? 380 : 850,
    showPageCorners: true,
    // El input (mouse + táctil) lo maneja attachInput(): el de page-flip 2.0.7
    // interpreta mal los swipes de velocidad media en el celular.
    useMouseEvents: false,
    startPage,
  });

  const setOrientation = (o: Orientation) => {
    if (o === orientation && root.classList.contains('is-' + o)) return;
    orientation = o;
    root.classList.remove('is-portrait', 'is-landscape');
    root.classList.add('is-' + o);
    // El ancho del contenedor cambió por CSS → recalcular el libro
    requestAnimationFrame(() => pf.update());
  };

  const visiblePages = (i: number): number[] => {
    if (orientation === 'portrait') return [i];
    if (i === 0) return [0];
    if (i === last) return [last];
    return [i, i + 1].filter((n) => n <= last);
  };

  const onPage = (i: number) => {
    current = i;
    const visible = visiblePages(i);

    // Sección activa: la pedida (si está a la vista) o la de la página izquierda
    const activeSection =
      requested !== null && visible.includes(requested) ? sections[requested] : sections[i];
    chips.forEach((c) => {
      const on = c.dataset.chip === activeSection;
      c.classList.toggle('is-active', on);
      if (on) c.setAttribute('aria-current', 'page');
      else c.removeAttribute('aria-current');
    });
    const activeChip = chips.find((c) => c.dataset.chip === activeSection);
    activeChip?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });

    // Contador
    if (counter) {
      counter.textContent =
        i === 0
          ? 'Tapa'
          : i === last
            ? 'Contratapa'
            : visible.length === 2
              ? `Págs. ${visible[0]}–${visible[1]}`
              : `Pág. ${i} de ${last - 1}`;
    }
    if (progress) progress.style.transform = `scaleX(${Math.max(0.04, i / last)})`;
    if (prevBtn) prevBtn.disabled = i === 0;
    if (nextBtn) nextBtn.disabled = visible.includes(last);

    // Tapa / contratapa centradas en modo doble página
    root.classList.toggle('at-cover', i === 0);
    root.classList.toggle('at-back', i === last);

    // Animaciones de entrada del contenido
    visible.forEach((n) => pages[n]?.classList.add('is-shown'));

    // URL compartible: /dulce-ruby/#chipitas
    if (interacted) {
      const sec = activeSection === 'inicio' ? '' : '#' + activeSection;
      history.replaceState(null, '', location.pathname + location.search + sec);
    }
    requested = null;
  };

  const markInteracted = () => {
    if (interacted) return;
    interacted = true;
    root.classList.add('has-flipped');
    hint?.classList.add('is-hidden');
  };

  const goTo = (target: number) => {
    markInteracted();
    if (visiblePages(current).includes(target)) {
      requested = target;
      onPage(current);
      return;
    }
    requested = target;
    pf.flip(target);
  };

  pf.on('init', (e) => {
    setOrientation(e.data.mode);
    onPage(e.data.page);
    root.classList.add('book-ready');
  });
  pf.on('flip', (e) => onPage(e.data));
  pf.on('changeOrientation', (e) => setOrientation(e.data));
  pf.on('changeState', (e) => {
    if (e.data === 'user_fold' || e.data === 'flipping') markInteracted();
    root.classList.toggle('is-flipping', e.data === 'flipping' || e.data === 'user_fold');
  });

  pf.loadFromHTML(pages);
  attachInput(pf, bookEl, markInteracted);

  // Corrige la orientación real tras el primer cálculo
  setOrientation(pf.getOrientation());

  // ── Controles ───────────────────────────────────────────
  prevBtn?.addEventListener('click', () => {
    markInteracted();
    pf.flipPrev();
  });
  nextBtn?.addEventListener('click', () => {
    markInteracted();
    pf.flipNext();
  });

  document.querySelectorAll<HTMLElement>('[data-goto]').forEach((el) => {
    el.addEventListener('click', (ev) => {
      ev.preventDefault();
      goTo(Number(el.dataset.goto));
    });
  });

  document.addEventListener('keydown', (ev) => {
    if (ev.altKey || ev.ctrlKey || ev.metaKey) return;
    if (root.classList.contains('cart-open')) return; // con el pedido abierto no se pasan páginas
    const tag = (ev.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (ev.key === 'ArrowRight') {
      markInteracted();
      pf.flipNext();
    } else if (ev.key === 'ArrowLeft') {
      markInteracted();
      pf.flipPrev();
    }
  });

  window.addEventListener('hashchange', () => {
    const p = pageFromHash();
    if (p !== null) goTo(p);
  });

  // Recalcular cuando cambia el alto disponible (barra del navegador móvil, rotación)
  let resizeRaf = 0;
  const onResize = () => {
    cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(() => pf.update());
  };
  window.visualViewport?.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);
}

/* ───────────────────────────────────────────────────────────────────────────
 * Input propio sobre la API pública de page-flip (startUserTouch / userMove / userStop).
 *
 * Problemas de page-flip 2.0.7 (sin releases desde 2022, versión fijada) que esto evita:
 *  - En táctil el arrastre recién arranca a los 250 ms; un swipe de ~300 ms se tomaba
 *    como "tap en el punto final" → swipe a la izquierda pasaba la página HACIA ATRÁS.
 *  - La dirección del giro se decidía con la posición del dedo en el primer movimiento,
 *    no con el gesto.
 * Acá: bloqueo de eje (vertical = scroll, horizontal = página), la hoja sigue al dedo
 * desde el primer pixel, la dirección la define el gesto y un flick completa el giro.
 * ─────────────────────────────────────────────────────────────────────────── */
type Point = { x: number; y: number };
type Rect = { left: number; top: number; width: number; height: number; pageWidth: number };
interface FlipCtl {
  calc: { getPosition(): Point; getCorner(): 'top' | 'bottom' } | null;
  fold(pos: Point): void;
  start(pos: Point): boolean;
  getBoundsRect(): Rect;
  animateFlippingTo(from: Point, to: Point, isTurned: boolean, needReset?: boolean): void;
}
interface PageFlipInternals {
  mousePosition?: Point;
  getFlipController(): FlipCtl;
  startUserTouch(pos: Point): void;
  userMove(pos: Point, isTouch: boolean): void;
  userStop(pos: Point, isSwipe?: boolean): void;
}

function attachInput(pf: PageFlip, bookEl: HTMLElement, onInteract: () => void): void {
  const app = pf as unknown as PageFlipInternals;
  const fc = app.getFlipController();
  const block = bookEl.querySelector<HTMLElement>('.stf__block') ?? bookEl;

  // El giro arranca desde el punto donde empezó el gesto (no donde está el dedo ahora)
  const originalFold = fc.fold.bind(fc);
  fc.fold = (pos: Point) => {
    if (fc.calc === null && app.mousePosition) fc.start(app.mousePosition);
    originalFold(pos);
  };

  const rel = (x: number, y: number): Point => {
    const r = block.getBoundingClientRect();
    return { x: x - r.left, y: y - r.top };
  };
  const isInteractive = (t: EventTarget | null) =>
    t instanceof Element && t.closest('a, button') !== null;

  /** Punto de agarre sintético en el borde, según la dirección del gesto */
  const grabPoint = (forward: boolean, y: number): Point => {
    const r = fc.getBoundsRect();
    if (forward) return { x: r.left + r.width - 10, y };
    return { x: pf.getOrientation() === 'portrait' ? r.left + r.pageWidth + 10 : r.left + 10, y };
  };

  // ── Mouse (desktop): igual que page-flip, con la dirección corregida ──
  let mouseActive = false;
  block.addEventListener('mousedown', (e) => {
    if (e.button !== 0 || isInteractive(e.target)) return;
    mouseActive = true;
    app.startUserTouch(rel(e.clientX, e.clientY));
    e.preventDefault();
  });
  window.addEventListener('mousemove', (e) => {
    if (!mouseActive && document.documentElement.classList.contains('cart-open')) return;
    app.userMove(rel(e.clientX, e.clientY), false);
  });
  window.addEventListener('mouseup', (e) => {
    if (!mouseActive) return;
    mouseActive = false;
    app.userStop(rel(e.clientX, e.clientY));
  });

  // ── Táctil ──
  let start: { x: number; y: number; t: number } | null = null;
  let axis: 'none' | 'x' | 'y' = 'none';
  let last: Point = { x: 0, y: 0 };
  let forward = true;

  block.addEventListener(
    'touchstart',
    (e) => {
      // (también sobre links: un tap abre el link; si se arrastra en horizontal, el
      // preventDefault del touchmove cancela el click y se pasa la página)
      if (e.touches.length !== 1 || pf.getState() === 'flipping') {
        start = null;
        return;
      }
      const t = e.touches[0];
      start = { x: t.clientX, y: t.clientY, t: performance.now() };
      last = { x: t.clientX, y: t.clientY };
      axis = 'none';
    },
    { passive: true },
  );

  block.addEventListener(
    'touchmove',
    (e) => {
      if (!start) return;
      const t = e.touches[0];
      last = { x: t.clientX, y: t.clientY };
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      if (axis === 'none') {
        if (Math.hypot(dx, dy) < 8) return;
        axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
        if (axis === 'x') {
          onInteract();
          forward = dx < 0;
          app.startUserTouch(grabPoint(forward, rel(start.x, start.y).y));
        }
      }
      if (axis === 'x') {
        if (e.cancelable) e.preventDefault();
        app.userMove(rel(t.clientX, t.clientY), true);
      }
    },
    { passive: false },
  );

  const end = (cancelled: boolean) => {
    if (!start) return;
    const s = start;
    start = null;
    if (axis !== 'x') return;
    const pos = rel(last.x, last.y);
    const dx = last.x - s.x;
    const dt = Math.max(1, performance.now() - s.t);
    const dir = forward ? -1 : 1; // signo esperado de dx según el giro que arrancó
    const along = dx * dir; // cuánto se movió en la dirección del giro
    const pageW = fc.getBoundsRect().pageWidth;
    const flick = along > 30 && (dt < 380 || along / dt > 0.5);
    // page-flip, en modo una página, sólo completa si soltás en el borde izquierdo:
    // con >35% del ancho ya cuenta como "pasar la página"
    const far = along > pageW * 0.35;

    if (!cancelled && (flick || far) && fc.calc) {
      app.userStop(pos, true);
      const r = fc.getBoundsRect();
      const y = fc.calc.getCorner() === 'bottom' ? r.height : 0;
      fc.animateFlippingTo(fc.calc.getPosition(), { x: -r.pageWidth, y }, true);
    } else if (!cancelled && flick) {
      app.userStop(pos, true);
      if (forward) pf.flipNext();
      else pf.flipPrev();
    } else {
      // Poco recorrido o cambio de idea: page-flip decide (normalmente vuelve atrás)
      app.userStop(pos, false);
    }
  };
  block.addEventListener('touchend', () => end(false));
  block.addEventListener('touchcancel', () => end(true));
}
