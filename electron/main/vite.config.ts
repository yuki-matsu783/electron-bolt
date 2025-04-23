import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: resolve('electron/main/index.ts'),
      formats: ['es'],
    },
    rollupOptions: {
      external: [
        'vite',
        'electron',
        ...[
          'electron-log',

          // electron-log uses fs internally
          'fs',
          'util',
        ],

        // Add all Node.js built-in modules as external
        'node:fs',
        'node:path',
        'node:url',
        'node:util',
        'node:stream',
        'node:events',
        'electron-store',
        '@remix-run/node',

        // "mime", // NOTE: don't enable. not working if it's external.
        'electron-updater',
      ],
      output: {
        dir: 'build/electron',
        entryFileNames: 'main/[name].mjs',
        format: 'esm',
      },
    },
    minify: false,
    emptyOutDir: false,
    // 開発モード向け: ソースマップを有効化
    sourcemap: true,
  },
  // 開発モードの場合の設定
  watch: process.env.NODE_ENV === 'development' ? {
    include: ['electron/main/**'],
    exclude: ['node_modules/**', 'dist/**', 'build/client/**'],
  } : null,
});
