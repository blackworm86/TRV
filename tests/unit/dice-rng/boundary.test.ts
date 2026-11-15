// GDD #2 — AC-03b: static check of the rules-core boundary. The core (src/core/) may not
// reference clocks, timers or entropy; the single exception is the entropy module, which lives
// outside the core on purpose.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..', '..', '..');
const CORE = join(ROOT, 'src', 'core');
/** The one allowed exception (RNG-2). Adding a second one must fail this suite. */
const EXCEPTIONS = ['src/platform/entropy.ts'];

const FORBIDDEN: [string, RegExp][] = [
  ['Math.random', /\bMath\s*\.\s*random\b/],
  ['Date', /\bDate\b/],
  ['performance.now', /\bperformance\b/],
  ['crypto', /\bcrypto\b/],
  ['setTimeout', /\bsetTimeout\b/],
  ['setInterval', /\bsetInterval\b/],
  ['requestAnimationFrame', /\brequestAnimationFrame\b/],
  ['require()', /\brequire\s*\(/],
];

/** Removes comments so that documentation may mention what code may not use. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/** Names of forbidden references found in a piece of source code. */
function violations(source: string): string[] {
  const code = stripComments(source);
  return FORBIDDEN.filter(([, re]) => re.test(code)).map(([name]) => name);
}

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesUnder(path) : path.endsWith('.ts') ? [path] : [];
  });
}

describe('rules-core boundary (AC-03b)', () => {
  it('finds no clock, timer or entropy reference in src/core', () => {
    const files = filesUnder(CORE);
    expect(files.length).toBeGreaterThan(0); // the check really looked at something
    const found = files
      .map((file) => ({ file: relative(ROOT, file).replaceAll('\\', '/'), bad: violations(readFileSync(file, 'utf8')) }))
      .filter((f) => f.bad.length > 0 && !EXCEPTIONS.includes(f.file));
    expect(found).toEqual([]);
  });

  it('allows exactly one exception, the entropy module', () => {
    expect(EXCEPTIONS).toEqual(['src/platform/entropy.ts']);
  });

  it('catches each forbidden reference in code but not in comments (the check can fail)', () => {
    expect(violations('const x = Math.random();')).toEqual(['Math.random']);
    expect(violations("import { randomBytes } from 'node:crypto';")).toEqual(['crypto']);
    expect(violations('const t = Date.now(); setTimeout(f, 1);')).toEqual(['Date', 'setTimeout']);
    expect(violations('// Math.random is forbidden here\n/* and Date too */ const ok = 1;')).toEqual([]);
  });
});
