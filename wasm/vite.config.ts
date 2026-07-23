import { defineConfig } from 'vite';
import path from 'path';


export default defineConfig({
  server: {
    port: 3000,
    open: true,
    headers: {
      // Force overwrite any phantom HTTP CSP headers
      'Content-Security-Policy': "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: ws: wss:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; script-src-elem 'self' 'unsafe-inline' 'unsafe-eval';"
    },
    fs: {
      // Allow Vite to serve files from this specific directory
      allow: [
        // Include BOTH the project root AND the external wasm directory
        __dirname, // Allows the directory containing this vite.config.ts (your project root)
        path.resolve(__dirname, './rust/pkg') // Allows the specific wasm package directory
      ]
    }
  },
  build: {
    target: 'esnext',
    outDir: 'dist'
  },
  optimizeDeps: {
    exclude: ['k4_manifold'] 
  }
});
