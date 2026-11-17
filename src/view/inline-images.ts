// SVG drawings that show a picture (the printed tokens, the card illustrations) point at it with
// <image href="…">. An SVG drawn as a picture (a WebGL texture, the admin's 3D views) or saved to
// disk loads nothing else, so the picture must first be put inside it as data.

/** The data of each picture already fetched, by address. */
const fetched = new Map<string, Promise<string>>();

function asDataUrl(url: string): Promise<string> {
  let p = fetched.get(url);
  if (!p) {
    p = fetch(url).then(r => r.blob()).then(blob => new Promise<string>((ok, fail) => {
      const reader = new FileReader();
      reader.onload = () => ok(String(reader.result));
      reader.onerror = () => fail(reader.error);
      reader.readAsDataURL(blob);
    }));
    fetched.set(url, p);
  }
  return p;
}

/** True when the SVG shows a picture from a file (an `<image href>` that is not data yet). */
export function hasLinkedImages(svg: string): boolean {
  return /<image\b[^>]*\bhref="(?!data:|#)[^"]+"/.test(svg);
}

/**
 * The SVG with every `<image href="…">` that points at a file replaced by the file's data, so it
 * draws on its own. Each file is fetched once.
 * Example: `await inlineImages(damageTokenSvg('dent', true))`.
 */
export async function inlineImages(svg: string): Promise<string> {
  const urls = [...new Set([...svg.matchAll(/<image\b[^>]*\bhref="([^"#][^"]*)"/g)].map(m => m[1]).filter(u => !u.startsWith('data:')))];
  let out = svg;
  for (const url of urls) out = out.split(`href="${url}"`).join(`href="${await asDataUrl(url)}"`);
  return out;
}
