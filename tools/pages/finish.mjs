// Finishes the GitHub Pages build (npm run build:pages): puts a front page at the top of
// dist-pages/ that sends the visitor to the game, keeping the query string (an invite link
// to a room works from the short address too), and tells Pages not to run Jekyll.
import { writeFileSync } from 'node:fs';

const GAME = 'prototypes/trv-play-spike/';
writeFileSync('dist-pages/index.html', `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<title>Thunder Road Vendetta</title>
<script>location.replace('${GAME}' + location.search + location.hash);</script>
</head>
<body><a href="${GAME}">Thunder Road Vendetta</a></body>
</html>
`);
writeFileSync('dist-pages/.nojekyll', '');
console.log('dist-pages/ ready: front page -> ' + GAME);
