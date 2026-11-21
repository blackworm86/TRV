// Finishes the GitHub Pages build (npm run build:pages). The game now sits at the top of the
// site; until 2026-11 it was at prototypes/trv-play-spike/, and links to that address are out
// there (room invites above all). So each old page is kept as a redirect to its new place,
// carrying the query string and the hash (?room=CODE keeps working). Also tells Pages not to
// run Jekyll.
import { mkdirSync, writeFileSync } from 'node:fs';

const OLD = 'prototypes/trv-play-spike';
/** Old page -> new page, relative to the site's top. */
const MOVED = { 'index.html': '', 'admin.html': 'admin.html', 'gallery.html': 'gallery.html' };

mkdirSync(`dist-pages/${OLD}`, { recursive: true });
for (const [from, to] of Object.entries(MOVED)) {
  const target = `../../${to}`;
  writeFileSync(`dist-pages/${OLD}/${from}`, `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<title>Destruction Burger: Retribution</title>
<script>location.replace('${target}' + location.search + location.hash);</script>
</head>
<body><a href="${target}">Destruction Burger: Retribution</a></body>
</html>
`);
}
writeFileSync('dist-pages/.nojekyll', '');
console.log(`dist-pages/ ready: the game at the top, ${OLD}/ redirects to it`);
