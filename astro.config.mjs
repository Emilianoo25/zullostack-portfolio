import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import preact from '@astrojs/preact';

export default defineConfig({
  site: 'https://zullostack.vercel.app',
  integrations: [
    mdx(),
    // El panel de Dulce Ruby es privado: fuera del sitemap
    sitemap({ filter: (page) => !page.includes('/dulce-ruby/panel') }),
    preact(),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
