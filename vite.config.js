import { defineConfig } from 'vite';
import lygia from './src/index.js';

export default defineConfig({
  build: { sourcemap: true },
  plugins: [lygia()],

  server: {
    open: false,
    port: 8080
  }
});
