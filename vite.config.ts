import { PluginOption, defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import vike from 'vike/plugin';
import tsconfigPaths from 'vite-tsconfig-paths';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { cjsInterop } from 'vite-plugin-cjs-interop';
import { pwaPlugin } from './src/pwa-config';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

const ReactCompilerConfig = {
  // compilationMode: 'annotation'
};

const isProduction = process.env.NODE_ENV === 'production';

export default defineConfig({
  ssr: {
    // noExternal: ['react']
  },
  logLevel: 'info',
  plugins: [
    tsconfigPaths(),
    cjsInterop({
      dependencies: ['path-browserify']
    }),
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler', ReactCompilerConfig]]
      }
    }) as PluginOption,
    vike(),
    pwaPlugin
  ],
  base: process.env.BASE_URL,
  resolve: {
    alias: {
      '~': new URL('./src/', import.meta.url).pathname,
      'styled-system': join(__dirname, './styled-system/')
    }
  },
  build: {
    sourcemap: !isProduction,
    cssMinify: isProduction,
    minify: isProduction,
    outDir: 'dist/client',
    commonjsOptions: {
      exclude: ['react/cjs', 'react-dom/cjs']
    },
    rollupOptions: {}
  }
});
