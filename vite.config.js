import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

const src = (path = '') => fileURLToPath(new URL(`./src/${path}`, import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      App: src('App.jsx'),
      api: src('api'),
      appEnv: src('appEnv.js'),
      buyers: src('buyers'),
      components: src('components'),
      config: src('config.js'),
      layout: src('layout'),
      'menu-items': src('menu-items'),
      pages: src('pages'),
      routes: src('routes'),
      services: src('services'),
      themes: src('themes'),
      utils: src('utils')
    }
  },
  server: {
    host: '0.0.0.0',
    port: 3000
  }
});
