import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Ver en consola si realmente cargó esta config
console.log('⚙️  Vite config cargada (plugin-react activo)')

export default defineConfig({
  plugins: [react()],
})
