// npm run build        -> dist/: the folder build, for shipping (itch.io, a website)
// npm run build:single -> dist-single/index.html: one file with everything
//                         inlined, which every check opens from disk
// npm run build:pages  -> dist-pages/: the site published on GitHub Pages. For now it is the
//                         playable prototype (prototypes/trv-play-spike/), its gallery and
//                         the admin asset inspector (admin.html);
//                         tools/pages/index.html at the top sends visitors to it.
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
    ...(mode === 'pages' ? { rolldownOptions: { input: ['prototypes/trv-play-spike/index.html', 'prototypes/trv-play-spike/gallery.html', 'prototypes/trv-play-spike/admin.html'] } } : {}),
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
  },
}));
