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
