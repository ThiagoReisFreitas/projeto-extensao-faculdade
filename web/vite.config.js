import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// dev: `npm run dev` -> proxy /api pro backend local em :3000.
// prod: o container `proxy` (nginx) resolve /api, este proxy nao e usado.
export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': 'http://localhost:3000' } },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/setupTests.js'],
  },
});
