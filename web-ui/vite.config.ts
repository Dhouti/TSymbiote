import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    BUILD_VERSION: JSON.stringify(process.env.BUILD_VERSION || 'dev'),
    REDACT_NODE_TITLES: JSON.stringify(process.env.REDACT_NODE_TITLES === 'true'),
  },
})
