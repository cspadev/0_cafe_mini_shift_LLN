import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Výstup do složky dist (výchozí nastavení Vite), relativní cesty k souborům.
export default defineConfig({
  plugins: [react()],
  base: './',
});
