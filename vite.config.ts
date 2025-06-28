import { defineConfig } from 'vite';
import { externalizeDeps } from 'vite-plugin-externalize-deps';
import path from 'node:path';

export default defineConfig({
  plugins: [externalizeDeps()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    lib: {
      entry: {
        index: path.resolve(__dirname, 'src/index.ts'),
        cli: path.resolve(__dirname, 'src/cli/index.ts'),
      },
      formats: ['es'],
    },
  },
});
