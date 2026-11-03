import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  // The same source builds for production (/atmo) and the isolated dev route
  // (/dev/atmo). Keep asset URLs aligned with the ingress path.
  base: process.env.VITE_BASE_PATH || '/atmo/',
  plugins: [vue()],
})
