/**
 * A 32-bit FNV-1a hash of `text`: the seed a drawing takes from a name, so the same tile or piece
 * always comes out the same. Example: `fnv1a('1a')`.
 */
export function fnv1a(text: string): number {
  let n = 2166136261;
  for (let i = 0; i < text.length; i++) n = Math.imul(n ^ text.charCodeAt(i), 16777619);
  return n >>> 0;
}
