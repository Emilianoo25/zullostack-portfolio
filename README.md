# ZulloStack Portfolio

Portfolio profesional para ZulloStack — desarrollo web y agentes de IA para PyMEs en Buenos Aires.

## Stack

- **Astro 5** — framework estático
- **Tailwind CSS v4** — estilos con `@tailwindcss/vite`
- **MDX** — casos de estudio
- **Content Collections** — tipado de contenido

## Comandos

```bash
npm run dev       # servidor local en http://localhost:4321
npm run build     # build estático en /dist
npm run preview   # preview del build
npm run check     # chequeo de tipos Astro + TS
```

## Variables de entorno

Copiar `.env.example` a `.env` y completar:

```
PUBLIC_CAL_URL=https://cal.com/tu-usuario/15min
PUBLIC_EMAIL=tu@email.com
PUBLIC_WHATSAPP=https://wa.me/54XXXXXXXXXX
```

## Deploy en Vercel

1. Subir repo a GitHub
2. En Vercel: **Add New Project** → importar el repo
3. Framework Preset: **Astro** (lo detecta solo)
4. Agregar las variables de entorno del `.env` en Settings → Environment Variables
5. Deploy

El sitio queda en `https://tu-proyecto.vercel.app`. Para dominio propio: Settings → Domains.

## Agregar un caso de estudio

1. Crear `src/content/casos/nombre-del-caso.mdx` con el frontmatter requerido (ver `mateo-sanitarios.mdx` como ejemplo)
2. El caso aparece automáticamente en `/casos` y tiene su página en `/casos/nombre-del-caso`
3. Para marcarlo como destacado en el home: editar `src/components/FeaturedCase.astro`

## Catálogo Dulce Ruby (`/dulce-ruby`)

Catálogo-recetario tipo libro (flipbook) para compartir por link: `https://zullostack.vercel.app/dulce-ruby/`

- **Contenido** (productos, precios, promos, lugares, fotos): todo en `src/data/dulce-ruby.ts`.
  Productos nuevos → copiar un bloque de `categorias`; aparecen solos en el menú, el índice y como 2 páginas nuevas.
  El ahorro ("Ahorrás $X"), el precio por unidad y la "mejor opción" se calculan solos.
- **Fotos**: subir a `public/dulce-ruby/fotos/` y poner la ruta en `foto: '/dulce-ruby/fotos/donas.jpg'`.
  Sin foto se muestra una ilustración. Ideal: JPG/WebP horizontal 4:3, ~1200px, < 250 KB.
- **Links directos por sección**: `/dulce-ruby/#donas`, `#chipitas`, `#promos`, `#donde`, `#pedir`.
- **Preview en WhatsApp**: `public/dulce-ruby/og.jpg` (1200×630).
- **Pedido con carrito**: "+ Agregar" suma al pedido (no abre WhatsApp). El cliente revisa, completa nombre,
  retiro/envío (+ dirección), para cuándo, pago (efectivo/transferencia) y comentario; recién ahí se abre WhatsApp
  con el pedido armado y el total. Lógica: `src/scripts/dulce-ruby-carrito.ts`. Las consultas (pedidos grandes,
  dónde retirar) siguen yendo directo a WhatsApp.
- Estilos: `src/styles/dulce-ruby.css` · Lógica del libro: `src/scripts/dulce-ruby-book.ts`
  (usa `page-flip` 2.0.7 fijado; el input táctil/mouse es propio porque el de la librería falla con swipes medios).

## Panel Dulce Ruby (`/dulce-ruby/panel/`)

Panel privado para Ruby: stock de insumos, recetas, costos, producción, ventas y ganancias.

- **Sin configurar** funciona en **modo prueba**: datos de ejemplo guardados sólo en ese navegador.
- **Modo nube** (datos reales, desde cualquier dispositivo): se conecta a un proyecto Supabase **de Dulce Ruby**.

### Conectar la cuenta de Supabase de Ruby (una sola vez)

1. Crear cuenta en supabase.com con el mail de Ruby → **New project** `dulce-ruby`, región **South America (São Paulo)**. Guardar la contraseña de la base.
2. **SQL Editor → New query** → pegar todo `supabase/dulce-ruby-panel.sql` → **Run**.
3. **Authentication → URL Configuration** → *Site URL*: `https://zullostack.vercel.app/dulce-ruby/panel/` (y agregarla en *Redirect URLs*).
4. **Project Settings → API**: copiar *Project URL* y la *Publishable key* (o *anon public*) en `src/data/dulce-ruby-panel.ts`
   (o como variables `PUBLIC_DR_SUPABASE_URL` / `PUBLIC_DR_SUPABASE_KEY` en Vercel) y volver a deployar. **Nunca** la *secret/service_role*.
5. Ruby abre el panel → **Crear cuenta** → confirma el mail → entra. Productos y precios se cargan solos desde el catálogo.
6. Después: **Authentication → Sign In / Providers** → desactivar *Allow new users to sign up* (nadie más puede crear cuenta).

Ojo: en el plan gratis, Supabase pausa el proyecto si nadie lo usa por 7 días; se reactiva desde el dashboard.

### Cómo calcula
- Receta por **tanda** + "rinde N unidades" → consumo y costo por unidad (ej: 150 g de chocolate rinden 3 donas → 50 g c/u).
- **Compra**: suma stock y fija el precio por g/ml/u con lo que se pagó la última vez.
- **Producción**: descuenta los insumos de la receta. **Venta**: cobra, descuenta envases y calcula la ganancia.
- **Avisos**: insumo con stock ≤ mínimo (o en cero si se usa en recetas). Todo movimiento se puede deshacer.

Código: `src/components/dulce-ruby/panel/` (lógica en `modelo.ts`) · Estilos: `src/styles/dulce-ruby-panel.css`.
