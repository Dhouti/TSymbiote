import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    BUILD_VERSION: JSON.stringify(process.env.BUILD_VERSION || 'dev'),
  },
})
