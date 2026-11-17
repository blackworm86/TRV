// npm run build        -> dist/: the folder build, for shipping (itch.io, a website)
// npm run build:single -> dist-single/index.html: one file with everything
//                         inlined, which every check opens from disk
// npm run build:pages  -> dist-pages/: the site published on GitHub Pages: the game
//                         (index.html), its gallery and the admin asset inspector
//                         (admin.html); tools/pages/finish.mjs adds the old addresses
//                         (prototypes/trv-play-spike/) as redirects.
// Vitest reads the test block; Playwright has its own config.
import { defineConfig } from 'vitest/config';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig(({ mode }) => ({
  // Relative paths, so the build works from any folder, itch.io included.
  base: './',
  // Assets are imported in the code (new URL('../assets/x.png', import.meta.url)),
  // so Vite hashes them and the single file inlines them. A public folder would
  // not be inlined, so there is none.
  publicDir: false,
  plugins: mode === 'single' ? [viteSingleFile()] : [],
  // The game's page only: other pages in the project (one-shots in prototypes/)
  // are not scanned for packages.
  optimizeDeps: { entries: ['index.html'] },
  build: {
    outDir: mode === 'single' ? 'dist-single' : mode === 'pages' ? 'dist-pages' : 'dist',
    emptyOutDir: true,
    ...(mode === 'pages' ? { rolldownOptions: { input: ['index.html', 'gallery.html', 'admin.html'] } } : {}),
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    // Whole simulated games and terrain generation take seconds; the CI machine is slower than a desk one.
    testTimeout: 30_000,
  },
}));
