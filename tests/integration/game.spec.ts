// Playwright: the real game (the hot seat and online table), served by the Vite dev server
// (playwright.config.ts, project "game"). The safety net for moving the client out of
// prototypes/ into src/ and splitting it: what a player does, driven through the page and the window.trv hook,
// plus reference screenshots of the main screens. npm run test:e2e runs it (npm run smoke: @boot only).
import { expect, test, type Page } from '@playwright/test';

/** Where the game's page is served. The one line to change when the page moves. */
const GAME = '/';
/** A fixed seed: the same game every run (64 hex characters, as newSeed() makes). */
const SEED = '7'.repeat(64);
/** The saved hot seat game the page resumes (its localStorage key and shape: main.ts, Saved). */
const SAVE_KEY = 'trv-hotseat-v3';
const SETTINGS_KEY = 'trv-settings';
const PLAYERS = [
  { name: 'Grigio', color: '#c9c8c2', crew: 'grey' },
  { name: 'Verde', color: '#5b7a52', crew: 'green' },
];

type Trv = {
  game: { round: number; frames: unknown[]; vehicles: { id: string; owner: number | null; size: string }[] } | null;
  decision: { kind: string; player: number; options: unknown[] } | null;
  choose(i: number): void;
  undo(): void;
  canUndo(): boolean;
  choices: number;
  skipBeats(): void;
  playBeats(frames: unknown[]): void;
  snapshot(): unknown;
  playing: boolean;
  camera: { fov: number };
  cam: { chase: string | null; action: boolean; back: boolean; settings: { zenith: boolean } };
};
declare global { interface Window { trv?: Trv } }

/** Collects every page error and console error of `page`. */
function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => {
    // The browser asks for /favicon.ico by itself; the page declares no icon. Not the game's error.
    if (m.type() === 'error' && !m.location().url.endsWith('/favicon.ico')) errors.push(`${m.text()} ${m.location().url}`.trim());
  });
  return errors;
}

/**
 * Opens the game. `save` puts a hot seat game in storage first (the page resumes it), with the
 * given choices already made; `settings` sets the display options.
 */
async function open(page: Page, opts: { save?: number[]; settings?: object; query?: string; leaders?: string[] } = {}): Promise<string[]> {
  const errors = watchErrors(page);
  await page.addInitScript(([saveKey, settingsKey, save, settings]) => {
    if (sessionStorage.getItem('trv-test-init')) return; // only on the first load of the test
    sessionStorage.setItem('trv-test-init', '1');
    localStorage.clear();
    if (save) localStorage.setItem(saveKey as string, JSON.stringify(save));
    localStorage.setItem(settingsKey as string, JSON.stringify(settings));
  }, [SAVE_KEY, SETTINGS_KEY, opts.save ? { setup: { seed: SEED, startSide: 'a',
    ...(opts.leaders ? { players: PLAYERS.map((p, i) => ({ ...p, leader: opts.leaders![i] })), leaders: true } : { players: PLAYERS }) }, choices: opts.save } : null,
    { quality: 'low', ...opts.settings }] as const);
  await page.goto(GAME + (opts.query ?? ''));
  await expect.poll(() => page.evaluate(() => typeof window.trv?.choose)).toBe('function');
  return errors;
}

/**
 * Compares the page with its reference screenshot (tests/integration/game.spec.ts-snapshots/),
 * allowing `ratio` of the pixels to differ: the 3D table never stands still (flames, glows,
 * rotors), so a picture-perfect match is not asked, only that nothing moved or went missing.
 */
async function same(page: Page, name: string, ratio: number): Promise<void> {
  expect(await page.screenshot()).toMatchSnapshot(name, { maxDiffPixelRatio: ratio });
}

/** Makes `n` decisions, always the first option, letting the beats finish (skipped) after each. */
async function playFirst(page: Page, n: number): Promise<number> {
  return page.evaluate(n => {
    const t = window.trv!;
    let made = 0;
    for (; made < n && t.decision; made++) { t.choose(0); t.skipBeats(); }
    return made;
  }, n);
}

test.describe('game', () => {
  test('first screen opens with no errors @boot', async ({ page }) => {
    const errors = await open(page);
    await expect(page.locator('#mHot')).toBeVisible();
    await expect(page.locator('#mCreate')).toBeVisible();
    await same(page, 'first-screen.png', 0.02);
    expect(errors).toEqual([]);
  });

  test('a hot seat game starts from the menu and asks to assign a die', async ({ page }) => {
    const errors = await open(page);
    await page.locator('#mHot').click();
    await page.locator('#start').click();
    await expect.poll(() => page.evaluate(() => window.trv!.decision?.kind)).toBe('assign');
    const players = await page.evaluate(() => (window.trv!.game as unknown as { players: unknown[] }).players.length);
    expect(players).toBe(Number(await page.locator('#np').inputValue()));
    expect(errors).toEqual([]);
  });

  test('the same seed and choices give the same game (resumed from storage)', async ({ page, context }) => {
    const errors = await open(page, { save: [] });
    const made = await playFirst(page, 40);
    expect(made).toBeGreaterThan(10);
    const first = await page.evaluate(() => JSON.stringify(window.trv!.snapshot()));
    const round = await page.evaluate(() => window.trv!.game!.round);
    expect(round).toBeGreaterThanOrEqual(1);
    // Reloading resumes the saved choices: the table must be exactly the same.
    const again = await context.newPage();
    const errors2 = watchErrors(again);
    await again.goto(GAME);
    await expect.poll(() => again.evaluate(() => typeof window.trv?.snapshot)).toBe('function');
    await expect.poll(() => again.evaluate(() => JSON.stringify(window.trv!.snapshot()))).toBe(first);
    expect(errors).toEqual([]);
    expect(errors2).toEqual([]);
  });

  test('map and zenith views switch and come back; the chase view is switched off', async ({ page }) => {
    const errors = await open(page, { save: [] });
    await page.waitForTimeout(1500);
    await same(page, 'map-angled.png', 0.03);
    // V: from the angled map to the view from above, and back.
    await page.keyboard.press('v');
    await expect.poll(() => page.evaluate(() => window.trv!.cam.settings.zenith)).toBe(true);
    await page.waitForTimeout(1500);
    await same(page, 'map-zenith.png', 0.03);
    await page.keyboard.press('v');
    await expect.poll(() => page.evaluate(() => window.trv!.cam.settings.zenith)).toBe(false);
    // The chase view is switched off for now (presentation_base.json, chase.enabled): no button, no view.
    await expect(page.locator('.chasebtn')).toHaveCount(0);
    await page.evaluate(() => (window as unknown as { __fx: { chase(id: string): void } }).__fx.chase('p0S'));
    expect(await page.evaluate(() => window.trv!.cam.chase)).toBeNull();
    expect(await page.evaluate(() => window.trv!.camera.fov)).toBe(30);
    expect(errors).toEqual([]);
  });

  test('the owner’s strip: the leader’s tab comes out, a die goes from the drawer to a car, Undo takes it back', async ({ page }) => {
    // Many pointer steps, each a frame of the 3D table drawn in software (about 2.5 s here).
    test.setTimeout(240_000);
    const errors = await open(page, { save: [], leaders: ['betty', 'asha'] });
    await page.waitForTimeout(1500);
    const strip = page.locator('#strip');
    // The tab: at rest only its portrait's edge; a click pulls it out.
    await expect(strip.locator('svg[data-strip="2"] .ptab')).toHaveCount(1);
    await strip.locator('[data-ptab]').click({ position: { x: 20, y: 60 } });
    await expect(strip).toHaveClass(/tab-open/);
    // The drawer is open with the player's four dice: one is dragged onto the small car's move slot.
    await expect(page.locator('#cmddock')).toHaveClass(/ask/);
    await expect(page.locator('#cmddice [data-mydie]')).toHaveCount(4);
    const die = (await page.locator('#cmddice [data-mydie="0"]').boundingBox())!;
    const slot = (await strip.locator('[data-drop^="move:"]').first().boundingBox())!;
    await page.mouse.move(die.x + die.width / 2, die.y + die.height / 2);
    await page.mouse.down();
    await page.mouse.move(die.x + 30, die.y - 20);
    await page.mouse.move(slot.x + slot.width / 2, slot.y + slot.height / 2, { steps: 2 });
    await page.mouse.up();
    // The seat whose turn it is (the seed starts with the second player).
    const seat = await page.evaluate(() => (window.trv!.decision as unknown as { player: number }).player);
    const used = (): Promise<boolean> => page.evaluate(s => (window.trv!.game as unknown as { players: { used: boolean[] }[] }).players[s].used[0], seat);
    await expect.poll(used).toBe(true);
    // Undo, on its plate on the board.
    await expect(strip.locator('.undoplate')).not.toHaveClass(/off/);
    await strip.locator('[data-undo]').click();
    await expect.poll(used).toBe(false);
    expect(errors).toEqual([]);
  });

  test('the action camera takes a shot for an event and gives the view back', async ({ page }) => {
    const errors = await open(page, { save: [], settings: { speed: 'full', actionCam: true } });
    await page.evaluate(() => {
      const t = window.trv!;
      const car = t.game!.vehicles.find(v => v.owner === 0)!;
      t.playBeats([{ kind: 'damage', vehicleId: car.id, snap: t.snapshot() }]);
    });
    await expect.poll(() => page.evaluate(() => window.trv!.cam.action)).toBe(true);
    await expect.poll(() => page.evaluate(() => !window.trv!.cam.action && !window.trv!.cam.back), { timeout: 15_000 }).toBe(true);
    expect(errors).toEqual([]);
  });

  test('an online room in local mode: create, join, start, play a move', async ({ page, context }) => {
    test.setTimeout(240_000); // two tables drawn in software, a move and an Undo
    const errors = await open(page, { query: '?net=local' });
    await page.locator('#mCreate').click();
    await page.locator('#oname').fill('Host');
    await page.locator('#ocreate').click();
    await expect.poll(() => page.locator('#lcode').textContent()).toMatch(/^[A-Z0-9]{5}$/);
    const code = (await page.locator('#lcode').textContent())!;

    const guest = await context.newPage();
    const guestErrors = watchErrors(guest);
    await guest.goto(GAME + '?net=local');
    await expect.poll(() => guest.evaluate(() => typeof window.trv?.choose)).toBe('function');
    await guest.locator('#mJoin').click();
    await guest.locator('#jname').fill('Ospite');
    await guest.locator('#ocode').fill(code);
    await guest.locator('#ojoin').click();
    await expect(page.locator('#lseats')).toContainText('Ospite');

    await page.locator('#lstart').click();
    await expect.poll(() => page.evaluate(() => !!window.trv!.game)).toBe(true);
    await expect.poll(() => guest.evaluate(() => !!window.trv!.game)).toBe(true);
    // Whoever decides first makes a move: both tables end up the same.
    await expect.poll(async () => (await page.evaluate(() => !!window.trv!.decision)) || (await guest.evaluate(() => !!window.trv!.decision))).toBe(true);
    const mover = (await page.evaluate(() => !!window.trv!.decision)) ? page : guest;
    await mover.evaluate(() => { window.trv!.choose(0); window.trv!.skipBeats(); });
    await expect.poll(async () => (await page.evaluate(() => JSON.stringify(window.trv!.snapshot())))
      === (await guest.evaluate(() => JSON.stringify(window.trv!.snapshot()))), { timeout: 45_000 }).toBe(true);
    // Undo online: play on until the player who just chose may take it back, then take it back.
    const same = async (): Promise<boolean> => (await page.evaluate(() => window.trv!.choices)) === (await guest.evaluate(() => window.trv!.choices));
    let undoer = null;
    for (let i = 0; i < 40 && !undoer; i++) {
      await expect.poll(same, { timeout: 45_000 }).toBe(true);
      for (const p of [page, guest]) if (await p.evaluate(() => window.trv!.canUndo())) undoer = p;
      if (undoer) break;
      await expect.poll(async () => (await page.evaluate(() => !!window.trv!.decision)) || (await guest.evaluate(() => !!window.trv!.decision)), { timeout: 45_000 }).toBe(true);
      const p = (await page.evaluate(() => !!window.trv!.decision)) ? page : guest;
      await p.evaluate(() => { const d = window.trv!.decision!; window.trv!.choose(d.options.length - 1); window.trv!.skipBeats(); });
    }
    expect(undoer).not.toBe(null);
    const other = undoer === page ? guest : page;
    expect(await other.evaluate(() => window.trv!.canUndo())).toBe(false); // not the other player's choice
    const before = await page.evaluate(() => window.trv!.choices);
    await undoer!.evaluate(() => window.trv!.undo());
    await expect.poll(() => page.evaluate(() => window.trv!.choices), { timeout: 45_000 }).toBe(before - 1);
    await expect.poll(() => guest.evaluate(() => window.trv!.choices), { timeout: 45_000 }).toBe(before - 1);
    await expect.poll(async () => (await page.evaluate(() => JSON.stringify(window.trv!.snapshot())))
      === (await guest.evaluate(() => JSON.stringify(window.trv!.snapshot()))), { timeout: 45_000 }).toBe(true);
    expect(errors).toEqual([]);
    expect(guestErrors).toEqual([]);
  });
});
