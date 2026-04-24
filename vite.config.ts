import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Deployed at https://mhaegeman.github.io/kokken-alrum/
export default defineConfig({
  base: '/kokken-alrum/',
  plugins: [react()],
  server: { port: 5173 },
});
