import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: resolve('electron/preload/index.ts'),
      formats: ['cjs'],
    },
    rollupOptions: {
      external: ['electron'],
      output: {
        dir: 'build/electron',

        /*
         * preload must be cjs format.
         * if mjs, it will be error:
         *   - Unable to load preload script.
         *   - SyntaxError: Cannot use import statement outside a module.
         */
        entryFileNames: 'preload/[name].cjs',
        format: 'cjs',
      },
    },
    minify: false,
    emptyOutDir: false,
    // 開発モード向け: ソースマップを有効化
    sourcemap: true,
  },
  esbuild: {
    platform: 'node',
  },
  // 開発モードの場合の設定
  watch: process.env.NODE_ENV === 'development' ? {
    include: ['electron/preload/**'],
    exclude: ['node_modules/**', 'dist/**', 'build/client/**'],
  } : null,
});
