import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import vike from 'vike/plugin';
import tsconfigPaths from 'vite-tsconfig-paths';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  plugins: [tsconfigPaths(), react(), vike()],
  resolve: {
    alias: {
      '~': new URL('./src/', import.meta.url).pathname,
      'styled-system': join(__dirname, './styled-system/')
    }
  },
  build: {
    sourcemap: true,
    outDir: 'dist/client'
  }
});
