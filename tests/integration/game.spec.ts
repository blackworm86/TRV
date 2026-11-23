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
  render(): void;
  undo(): void;
  canUndo(): boolean;
  choices: number;
  skipBeats(): void;
  playBeats(frames: unknown[]): void;
  snapshot(): unknown;
  playing: boolean;
  camera: { fov: number };
  scenes: { played: { scene: { kind: string }; from: number; to: number }[]; phase: string; clock: number; shown: number; log: { frame: { kind: string; snap: unknown } }[] };
  shownSnap: unknown;
  markers: { option: number; ahead: boolean; x: number; y: number }[];
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
async function open(page: Page, opts: { save?: number[]; setup?: object; settings?: object; query?: string; leaders?: string[] } = {}): Promise<string[]> {
  const errors = watchErrors(page);
  await page.addInitScript(([saveKey, settingsKey, save, settings]) => {
    if (sessionStorage.getItem('trv-test-init')) return; // only on the first load of the test
    sessionStorage.setItem('trv-test-init', '1');
    localStorage.clear();
    if (save) localStorage.setItem(saveKey as string, JSON.stringify(save));
    localStorage.setItem(settingsKey as string, JSON.stringify(settings));
  }, [SAVE_KEY, SETTINGS_KEY, opts.save ? { setup: opts.setup ?? { seed: SEED, startSide: 'a',
    ...(opts.leaders ? { players: PLAYERS.map((p, i) => ({ ...p, leader: opts.leaders![i] })), leaders: true } : { players: PLAYERS }) }, choices: opts.save } : null,
    // Fast animations unless a test checks them (asked by the user, 2026-11-20): it names its speed.
    { quality: 'low', speed: 'fast', ...opts.settings }] as const);
  // The first screen connects to the online store at once (its home lists one's games and friends):
  // the checks use the local store, never the real Firebase project.
  await page.goto(GAME + (opts.query ?? '?net=local'));
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

/** From the first screen: names the player, goes to the lobby and creates a room with the default options. */
async function createRoom(page: Page, name: string): Promise<void> {
  await page.locator('#myname').fill(name);
  await page.locator('#mPlay').click();
  await page.locator('#mCreate').click(); // the room is made at once, with the last options
  await expect.poll(() => page.locator('#lcode').textContent()).toMatch(/^[A-Z0-9]{5}$/);
}

test.describe('game', () => {
  test('first screen opens with no errors @boot', async ({ page }) => {
    const errors = await open(page);
    await expect(page.locator('#mHot')).toBeVisible();
    await expect(page.locator('#mPlay')).toBeVisible();
    await expect(page.locator('#mMine')).toBeVisible();
    await expect(page.locator('#mFriends')).toBeVisible();
    await same(page, 'first-screen.png', 0.02);
    expect(errors).toEqual([]);
  });

  test('while a command is asked, a click on a lit space is no command and that step', async ({ page }) => {
    // Asked by the user (2026-11-22): moving the car is "no command" (rulebook p. 8: the command comes before the move).
    const errors = await open(page, { save: [] });
    await expect(page.locator('#turnsplash')).toHaveCount(1, { timeout: 60_000 });
    await page.keyboard.press('Shift');
    await expect(page.locator('#turnsplash')).toHaveCount(0);
    // Arrange: dice on the cars until the rules ask for a command.
    await expect.poll(async () => {
      const k = await page.evaluate(() => window.trv!.decision?.kind);
      if (k && k !== 'command') await playFirst(page, 1);
      return k;
    }, { timeout: 60_000 }).toBe('command');
    await page.evaluate(() => window.trv!.render());
    await expect.poll(() => page.evaluate(() => window.trv!.markers.filter(m => m.ahead).length)).toBeGreaterThan(0);
    const before = await page.evaluate(() => window.trv!.choices);
    const m = (await page.evaluate(() => window.trv!.markers.find(x => x.ahead)))!;
    // Act
    await page.mouse.click(m.x, m.y);
    // Assert: "no command" and the step were both chosen.
    await expect.poll(() => page.evaluate(() => window.trv!.choices)).toBeGreaterThanOrEqual(before + 2);
    expect(errors).toEqual([]);
  });

  test('a retro graphics style draws the table with few rows of pixels, and the modern one gives them back', async ({ page }) => {
    // Asked by the user (2026-11-22): a nineties console style and an arcade pixel-art style.
    const errors = await open(page, { save: [] });
    await expect(page.locator('#turnsplash')).toHaveCount(1, { timeout: 60_000 });
    await page.mouse.click(600, 400);
    const rows = (): Promise<number> => page.evaluate(() => (document.querySelector('canvas.retro') as HTMLCanvasElement | null)?.height ?? 0);
    // Act: the console style from the menu's Graphics tab.
    await page.locator('#menu').click();
    await page.locator('#mtabs [data-tab="gfx"]').click();
    await page.locator('[data-set="style"] [data-v="console"]').click();
    // Assert: fewer rows of pixels than the canvas is high on the screen, enlarged with hard edges.
    await expect.poll(rows).toBeGreaterThan(100);
    expect(await rows()).toBeLessThan(await page.evaluate(() => (document.querySelector('canvas.retro') as HTMLCanvasElement).clientHeight));
    expect(await page.evaluate(() => getComputedStyle(document.querySelector('canvas.retro')!).imageRendering)).toBe('pixelated');
    await expect(page.locator('#crt')).not.toHaveClass(/on/);
    await page.locator('[data-set="style"] [data-v="arcade"]').click();
    await expect.poll(rows).toBeGreaterThan(100);
    // The arcade cabinet's tube lies over the table (asked by the user, 2026-11-23).
    await expect(page.locator('#crt')).toHaveClass(/on/);
    // Act and assert: back to modern, no retro canvas.
    await page.locator('[data-set="style"] [data-v="modern"]').click();
    await expect.poll(rows).toBe(0);
    await expect(page.locator('#crt')).not.toHaveClass(/on/);
    expect(errors).toEqual([]);
  });

  test('on a tablet a long press shows what the mouse shows by pointing, and chooses nothing', async ({ browser }) => {
    // Asked by the user (2026-11-22): the whole game on a tablet, with no mouse hover.
    const context = await browser.newContext({ hasTouch: true, viewport: { width: 1180, height: 820 } });
    const page = await context.newPage();
    const errors = await open(page, { save: [] });
    await expect(page.locator('#turnsplash')).toHaveCount(1, { timeout: 60_000 });
    await page.touchscreen.tap(600, 400);
    await expect(page.locator('#turnsplash')).toHaveCount(0);
    await expect(page.locator('html')).toHaveClass(/touch/);
    const cdp = await context.newCDPSession(page);
    const press = async (x: number, y: number, ms: number): Promise<void> => {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      await page.waitForTimeout(ms);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    };
    // Arrange: a command of the owner's board, where the pop-up of the command is.
    const quarter = page.locator('#strip [data-cmd-name]').first();
    await expect(quarter).toBeVisible();
    const box = (await quarter.boundingBox())!;
    const before = await page.evaluate(() => window.trv!.choices);
    // Act: a long press on it.
    await press(box.x + box.width / 2, box.y + box.height / 2, 700);
    // Assert: the pop-up stays up after the finger lifts, and nothing was chosen.
    await expect(page.locator('#cmdtip')).toHaveClass(/show/);
    expect(await page.evaluate(() => window.trv!.choices)).toBe(before);
    // A touch somewhere else takes it away.
    await press(600, 80, 60);
    await expect(page.locator('#cmdtip')).not.toHaveClass(/show/);
    expect(errors).toEqual([]);
    await context.close();
  });

  test('the local game can be deleted from the menu, after a confirmation', async ({ page }) => {
    // Arrange: a saved hot seat game, the menu opened over it.
    const errors = await open(page, { save: [] });
    await expect.poll(() => page.evaluate(() => !!window.trv?.game)).toBe(true);
    await page.evaluate(() => document.getElementById('quit')!.click());
    await expect(page.locator('#mResumeRow')).toBeVisible();
    await expect(page.locator('#mResumeWhat')).toContainText('round');
    // Act and assert: Annulla keeps it, Elimina deletes it here and in storage.
    await page.locator('#mDrop').click();
    await page.locator('#sureNo').click();
    await expect(page.locator('#mResumeRow')).toBeVisible();
    await page.locator('#mDrop').click();
    await page.locator('#sureOk').click();
    await expect(page.locator('#mResumeRow')).toBeHidden();
    expect(await page.evaluate(k => localStorage.getItem(k), SAVE_KEY)).toBeNull();
    await page.reload();
    await expect(page.locator('#mHot')).toBeVisible();
    expect(await page.evaluate(() => !!window.trv!.game)).toBe(false);
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

  test('the hot seat panel sets colours, a bot, the Big Rig and the tile, and the game starts with them', async ({ page }) => {
    // Arrange: the local game panel.
    const errors = await open(page);
    await page.locator('#mHot').click();
    // Act: four players; the third takes purple from the palette, where the first's red is taken;
    // the second plays the Big Rig, the fourth is a TRV9000 at level 3; tile 1b, Carnage on.
    await page.locator('#npseg [data-v="4"]').click();
    await page.locator('#hotrows .crew[data-i="2"] .sw').click();
    await expect(page.locator('#crewpal [data-crew="crimson"]')).toBeDisabled();
    await page.locator('#crewpal [data-crew="purple"]').click();
    await expect(page.locator('#n2')).toHaveValue('Viola');
    await page.locator('#hotrows .crew[data-i="1"] [data-team="big_rig"]').click();
    await expect(page.locator('#hotrows .crew[data-i="0"] [data-team="big_rig"]')).toBeDisabled();
    await page.locator('#hotrows .crew[data-i="3"] .bot').click();
    await page.locator('#botseg [data-v="3"]').click();
    await page.locator('#sideseg [data-v="b"]').click();
    await page.locator('label.switch:has(#carnage)').click();
    await page.locator('#start').click();
    // Assert: the saved game holds what the panel set.
    await expect.poll(() => page.evaluate(k => !!localStorage.getItem(k), SAVE_KEY), { timeout: 60_000 }).toBe(true);
    const setup = await page.evaluate(k => JSON.parse(localStorage.getItem(k)!).setup, SAVE_KEY) as {
      startSide: string; carnage?: boolean; players: { crew: string; team?: string; bot?: { protocol: number } }[] };
    expect(setup.players.map(p => p.crew)).toEqual(['crimson', 'royal', 'purple', 'green']);
    expect(setup.players[1].team).toBe('big_rig');
    expect(setup.players[3].bot).toEqual({ protocol: 3 });
    expect(setup.players.filter(p => p.bot)).toHaveLength(1);
    expect(setup.startSide).toBe('b');
    expect(setup.carnage).toBe(true);
    expect(errors).toEqual([]);
  });

  test('with One Shots on, each person holds a card that is shown when it can be played and leaves once played', async ({ page }) => {
    // Arrange: a hot seat game started from the panel with the One Shots switch on.
    const errors = await open(page);
    await page.locator('#mHot').click();
    await page.locator('label.switch:has(#oneshots)').click();
    await page.locator('#start').click();
    await expect.poll(() => page.evaluate(() => window.trv!.decision?.kind)).toBeTruthy();
    const held = await page.evaluate(() => window.trv!.game!.oneShots);
    expect(held?.every(c => typeof c === 'string')).toBe(true);
    await expect(page.locator('#players .pl .mini .mbacks .mb.os')).toHaveCount(held!.length);
    // Act: every hand becomes Radar Array, offered at the start of each turn while face-down hazards
    // are on the table (the deal is random: some cards may never come up in a short game); then the
    // first options, until it is offered.
    await page.evaluate(() => { const x = window.trv!.game!; x.oneShots = x.oneShots!.map(c => (c ? 'radar_array' : c)); });
    // Between two questions the page may still be playing beats (no decision yet): it waits for them.
    // Targets are shot, so that the cards played when shooting come up too.
    let offered: string | null = null;
    for (let k = 0; k < 3000 && !offered; k++) {
      const r = await page.evaluate(() => {
        const t = window.trv!;
        t.skipBeats();
        const d = t.decision;
        if (!d) return { wait: true, card: null };
        if (d.kind === 'playCard') return { wait: false, card: d.options[1].card! };
        const safe = d.options.findIndex(o => !o.danger);
        t.choose(d.kind === 'shoot' && d.options.length > 1 ? 1 : Math.max(0, safe));
        return { wait: false, card: null };
      });
      offered = r.card;
      if (r.wait) await page.waitForTimeout(50);
    }
    expect(offered).not.toBeNull();
    await expect.poll(() => page.evaluate(() => { window.trv!.skipBeats(); return window.trv!.playing; })).toBe(false);
    // Assert: the card heads the question, with its play button; played, it leaves the hand.
    await expect(page.locator('#actions .oscard')).toBeVisible();
    const seat = await page.evaluate(() => window.trv!.decision!.player);
    // The play button is the one on Enter (the bar is redrawn while the car models load, so the
    // button is pressed through its key rather than waited on to stand still).
    await expect(page.locator('#actions button[data-key="Enter"]')).toHaveText(/^Gioca /);
    // A turn splash still up from the turns played above takes the first key for itself: closed first.
    if (await page.locator('#turnsplash').count()) {
      await page.keyboard.press('Shift');
      await expect(page.locator('#turnsplash')).toHaveCount(0);
    }
    await page.keyboard.press('Enter');
    await expect.poll(() => page.evaluate(s => window.trv!.game!.oneShots![s], seat)).toBeNull();
    // The question about that card is gone (the other person, holding the same card, may be asked next).
    await expect.poll(() => page.evaluate(s => { const d = window.trv!.decision; return !!d && d.kind === 'playCard' && d.player === s; }, seat)).toBe(false);
    expect(errors).toEqual([]);
  });

  test('with every mini expansion on, the hand, the Bonus Command and the Road Condition flags are on the table', async ({ page }) => {
    // Arrange: a hot seat game started from the panel with "tutte" the mini expansions.
    const errors = await open(page);
    await page.locator('#mHot').click();
    await page.locator('#pHot [data-minis="1"]').click();
    await page.locator('#start').click();
    await expect.poll(() => page.evaluate(() => window.trv!.decision?.kind)).toBeTruthy();
    // Assert: every module is on, and the table shows its cards.
    const g = await page.evaluate(() => { const x = window.trv!.game!; return { b: x.bonusCommands, o: x.oneShots, t: x.bounties, a: x.airstrikes, r: x.roads?.cards }; });
    for (const hand of [g.b, g.o, g.t, g.a]) expect(hand?.every(c => typeof c === 'string')).toBe(true);
    expect(g.r?.filter(Boolean)).toHaveLength(2);
    // The hand is in the tray over the command board; the Bonus Command is a die space of the board.
    await expect(page.locator('#cmdhand .mslot')).toHaveCount(3);
    await expect(page.locator('#strip [data-bonus]')).toHaveCount(1);
    await expect(page.locator('#fx .rcflag')).toHaveCount(2);
    await expect(page.locator('#players .pl .mini .mbacks').first().locator('.mb')).toHaveCount(4);
    const spots = await page.evaluate(() => ({
      hand: document.querySelector('#cmdhand')!.getBoundingClientRect().bottom,
      // The command board's die diamonds that are drawn (the strip keeps others, unseen).
      corner: Math.min(...[...document.querySelectorAll('#strip path[data-drop^="cmd:"]')].map(e => e.getBoundingClientRect()).filter(r => r.width > 0).map(r => r.top)),
    }));
    expect(spots.hand).toBeLessThan(spots.corner);
    // Pointing at a card of the hand, or at the Bonus Command's space, shows the card large.
    const zoom = page.locator('#minis .mzoom');
    await expect(zoom).toBeHidden();
    await page.locator('#cmdhand .mslot').first().hover();
    await expect(zoom).toBeVisible();
    await page.mouse.move(5, 300);
    await expect(zoom).toBeHidden();
    await page.locator('#strip [data-bonus]').hover();
    await expect(zoom.locator('svg[data-id]')).toHaveAttribute('data-id', await page.evaluate(() => window.trv!.game!.bonusCommands![window.trv!.decision!.player]!));
    // Pointing at a Road Condition's symbol opens its card; a click keeps its text over the banner.
    const flag = page.locator('#fx .rcflag').first();
    await flag.hover();
    await expect(flag.locator('.rcpop')).toBeVisible();
    await expect(flag.locator('.rctext')).toBeHidden();
    await flag.click();
    await expect(flag.locator('.rctext')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('the Beta gate over the first screen takes the click on its Google button', async ({ page }) => {
    // Arrange: the first screen, with the gate shown over it as on the real site.
    const errors = await open(page);
    await page.evaluate(() => {
      document.getElementById('beta')!.hidden = false;
      document.getElementById('beta-wait')!.hidden = true;
      document.getElementById('beta-login')!.hidden = false;
      const s = document.getElementById('setup')!;
      s.style.display = 'none';
      s.style.display = 'grid'; // the menus close and open again: what is behind them turns inert
    });
    // Act: what a click in the middle of the button lands on.
    await expect(page.locator('#beta-google')).toBeVisible();
    const hit = await page.evaluate(async () => {
      await new Promise(r => setTimeout(r, 50));
      const b = document.getElementById('beta-google')!, r = b.getBoundingClientRect();
      return { inert: document.getElementById('beta')!.inert, at: document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.id };
    });
    // Assert
    expect(hit).toEqual({ inert: false, at: 'beta-google' });
    expect(errors).toEqual([]);
  });

  test('the profile window sets the avatar, adds up the statistics and deletes the profile', async ({ page }) => {
    // Arrange: an account (on this browser's store) that chooses its user name.
    const errors = await open(page, { query: '?net=local&account' });
    await expect(page.locator('#pUser')).toBeVisible();
    await page.locator('#uname').fill('ada_e2e');
    await page.locator('#usave').click();
    await expect(page.locator('#mecode')).toContainText('@ada_e2e');
    // The windows over the first screen take clicks and typing (they were inert there before).
    await page.locator('#reporthome').click();
    await page.locator('#rep-text').fill('Prova');
    await page.locator('#rep-cancel').click();
    await expect(page.locator('#report')).toBeHidden();
    // Two finished online matches in its statistics, as the end of a match records them.
    await page.evaluate(async () => {
      const { openStore } = await import('/src/app/online.ts');
      const s = await openStore(), uid = await s.uid();
      const r = { players: 3, crew: 'crimson', team: null, bots: 0, botLevel: 0, carnage: true, rounds: 6 };
      await s.write(`users/${uid}/results/AAAAA-1`, { ...r, at: 1, won: true, leader: 'betty', upgrades: ['snowplow'], jumps: 2 });
      await s.write(`users/${uid}/results/BBBBB-2`, { ...r, at: 2, won: false, leader: 'betty', upgrades: ['snowplow', 'ghost_mode'], jumps: 1 });
    });
    // Act and assert: the avatar in the header opens the window; a face becomes the avatar.
    await page.locator('#meav').click();
    await expect(page.locator('#profile')).toBeVisible();
    await page.locator('#pf-avatars [data-avatar="cruft"]').click();
    await expect(page.locator('#meav')).toHaveClass(/pic/);
    // The statistics add the two matches up.
    await page.locator('#pf-tabs [data-tab="stats"]').click();
    await expect(page.locator('#pf-stats')).toContainText('50%');
    await expect(page.locator('#pf-stats')).toContainText('Ms. Betty');
    await expect(page.locator('#pf-stats')).toContainText('Snowplow');
    await expect(page.locator('#pf-stats .pf-tile', { hasText: 'salti con le rampe' })).toContainText('3');
    await page.locator('#pf-tabs [data-tab="ach"]').click();
    await expect(page.locator('#profile .pf-soon')).toContainText('Coming soon');
    // Deleting asks for the user name, then the profile is gone: the next visit asks for a name again.
    await page.locator('#pf-tabs [data-tab="dati"]').click();
    await page.locator('#pf-delete').click();
    await page.locator('#pf-confirmname').fill('ada_e');
    await expect(page.locator('#pf-deleteok')).toBeDisabled();
    await page.locator('#pf-confirmname').fill('ada_e2e');
    page.once('dialog', d => void d.accept());
    await page.locator('#pf-deleteok').click();
    await expect(page.locator('#pUser')).toBeVisible({ timeout: 20_000 });
    expect(await page.evaluate(async () => {
      const { openStore } = await import('/src/app/online.ts');
      const s = await openStore();
      return [await s.read(`users/${await s.uid()}`), await s.read('usernames/ada_e2e')];
    })).toEqual([null, null]);
    expect(errors).toEqual([]);
  });

  test('a tester’s report carries the game and the table, and the admin page opens it at that point', async ({ page, context }) => {
    test.setTimeout(300_000); // three pages, two of them tables drawn in software
    // Arrange: a local game a few choices in.
    const errors = await open(page, { save: [] });
    const made = await playFirst(page, 6);
    const round = await page.evaluate(() => window.trv!.game!.round);
    // Act: Menu > Segnala, a kind, a text, send.
    await page.locator('#menu').click();
    await page.locator('#reportopen').click({ force: true });
    await expect(page.locator('#report')).toBeVisible();
    await expect(page.locator('#rep-shot')).toBeChecked();
    // The table behind is drawn in software and never rests: the window's own controls are clicked as they are.
    await page.locator('#rep-kinds [data-kind="regola"]').click({ force: true });
    await page.locator('#rep-text').fill('Lo slam non doveva spingere la Grande.');
    await page.locator('#rep-send').click({ force: true });
    // Sent: kept in this browser's store (?net=local) and the window closed. (The thanks shows for 3 s
    // only: with tables drawn in software a check could miss it.)
    await expect.poll(() => page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('trv-reports') ?? '{"cards":{}}').cards).length)).toBe(1);
    await expect(page.locator('#report')).toBeHidden();
    // Assert: the admin page lists it with its picture, and its game opens at that point.
    const admin = await context.newPage();
    const adminErrors = watchErrors(admin);
    await admin.goto('/admin.html?admin=local#segnalazioni');
    const head = admin.locator('.rep-head', { hasText: 'Lo slam non doveva spingere la Grande.' });
    await expect(head).toContainText('Regola applicata male');
    await head.click();
    await expect(admin.locator('.rep-pic img')).toBeVisible();
    await expect(admin.locator('.rep.open .st')).toHaveText('Vista');
    const href = await admin.locator('.rep-pic a.btn').getAttribute('href');
    const saveBefore = await page.evaluate(k => localStorage.getItem(k), SAVE_KEY);
    const again = await context.newPage();
    const againErrors = watchErrors(again);
    await again.goto(`/${href!.replace(/^\.\//, '')}`);
    await expect.poll(() => again.evaluate(() => window.trv?.choices ?? -1)).toBe(made);
    expect(await again.evaluate(() => window.trv!.game!.round)).toBe(round);
    // A report's game is only looked at: playing on in it leaves the browser's own game as it was.
    await again.evaluate(() => { window.trv!.choose(0); window.trv!.skipBeats(); });
    expect(await again.evaluate(k => localStorage.getItem(k), SAVE_KEY)).toBe(saveBefore);
    expect([...errors, ...adminErrors, ...againErrors]).toEqual([]);
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
    await again.goto(GAME + '?net=local'); // the real site's Beta gate is not part of this check
    await expect.poll(() => again.evaluate(() => typeof window.trv?.snapshot)).toBe('function');
    await expect.poll(() => again.evaluate(() => JSON.stringify(window.trv!.snapshot()))).toBe(first);
    expect(errors).toEqual([]);
    expect(errors2).toEqual([]);
  });

  test('map and zenith views switch and come back; the chase view is switched off', async ({ page }) => {
    const errors = await open(page, { save: [] });
    // The turn splash comes once the opening roll has played, sooner the faster the table is drawn:
    // it is waited for and closed (any key), so the picture never depends on that timing.
    await expect(page.locator('#turnsplash')).toHaveCount(1, { timeout: 60_000 });
    await page.keyboard.press('Shift');
    await expect(page.locator('#turnsplash')).toHaveCount(0);
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
    test.setTimeout(300_000);
    const errors = await open(page, { save: [], settings: { speed: 'full', actionCam: true } });
    await page.evaluate(() => {
      const t = window.trv!;
      const car = t.game!.vehicles.find(v => v.owner === 0)!;
      t.playBeats([{ kind: 'damage', vehicleId: car.id, snap: t.snapshot() }]);
    });
    // The beat is a scene: it starts once the table is still, and the playback clock runs slowly when
    // the table is drawn in software, hence the roomy waits.
    await expect.poll(() => page.evaluate(() => window.trv!.cam.action), { timeout: 120_000 }).toBe(true);
    await expect.poll(() => page.evaluate(() => !window.trv!.cam.action && !window.trv!.cam.back), { timeout: 120_000 }).toBe(true);
    expect(errors).toEqual([]);
  });

  test('an online room in local mode: create, join, start, play a move', async ({ page, context }) => {
    test.setTimeout(240_000); // two tables drawn in software, a move and an Undo
    const errors = await open(page, { query: '?net=local' });
    await createRoom(page, 'Host');
    const code = (await page.locator('#lcode').textContent())!;

    const guest = await context.newPage();
    const guestErrors = watchErrors(guest);
    await guest.goto(GAME + '?net=local');
    await expect.poll(() => guest.evaluate(() => typeof window.trv?.choose)).toBe('function');
    await guest.locator('#myname').fill('Ospite');
    await guest.locator('#mPlay').click();
    await guest.locator('#ocode').fill(code);
    await guest.locator('#ojoin').click();
    await expect(page.locator('#lseats')).toContainText('Ospite');

    // Every guest confirms being ready before the host can start (asked by the user, 2026-11-22).
    await expect(page.locator('#lstart')).toBeDisabled();
    await expect(page.locator('#lstate')).toContainText('pronto');
    await guest.locator('#lready').click();
    await expect(page.locator('#lseats .lrdy.on')).toHaveCount(1);
    await expect(page.locator('#lstart')).toBeEnabled();
    await page.locator('#lstart').click();
    await expect.poll(() => page.evaluate(() => !!window.trv!.game)).toBe(true);
    await expect.poll(() => guest.evaluate(() => !!window.trv!.game)).toBe(true);
    // Whoever decides first makes a move: both tables end up the same. (The opening roll plays first
    // on two tables drawn in software: 20 s was not always enough in the full suite, 2026-11-20.)
    await expect.poll(async () => (await page.evaluate(() => !!window.trv!.decision)) || (await guest.evaluate(() => !!window.trv!.decision)), { timeout: 45_000 }).toBe(true);
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
    try {
      await expect.poll(() => page.evaluate(() => window.trv!.choices), { timeout: 45_000 }).toBe(before - 1);
      await expect.poll(() => guest.evaluate(() => window.trv!.choices), { timeout: 45_000 }).toBe(before - 1);
      await expect.poll(async () => (await page.evaluate(() => JSON.stringify(window.trv!.snapshot())))
        === (await guest.evaluate(() => JSON.stringify(window.trv!.snapshot()))), { timeout: 45_000 }).toBe(true);
    } catch (e) {
      // This check failed once in a while (2026-11-21: the host at 2 choices instead of 0) and never when
      // watched: what both tables and the shared room hold goes to the report, for the next time.
      const table = (p: Page): Promise<string> => p.evaluate(() => {
        const t = window.trv!, d = t.decision as { kind: string; player: number } | null;
        return JSON.stringify({ choices: t.choices, canUndo: t.canUndo(), decision: d && `${d.kind} of player ${d.player}`, playing: t.playing });
      });
      const room = await page.evaluate(() => {
        const tree = JSON.parse(localStorage.getItem('trv-net-local') ?? '{}') as { rooms?: Record<string, Record<string, unknown>> };
        return JSON.stringify(Object.values(tree.rooms ?? {}).map(r => ({ log: r.log ?? null, intents: r.intents ?? null, turn: r.turn ?? null })));
      });
      console.log(`UNDO FAILED: undo asked by the ${undoer === page ? 'host' : 'guest'} at ${before} choices\n  host  ${await table(page)}\n  guest ${await table(guest)}\n  room  ${room}`);
      throw e;
    }
    expect(errors).toEqual([]);
    expect(guestErrors).toEqual([]);
  });
  test('an online room with a TRV9000 team: the host seats it, starts, and the bot plays its turns', async ({ page }) => {
    test.setTimeout(180_000);
    const errors = await open(page, { query: '?net=local' });
    await createRoom(page, 'Host');
    // A free seat lets the host add a team; its level is set with the options.
    await page.locator('#lseats .laddbot').first().click();
    await expect(page.locator('#lseats .seat.bot')).toHaveCount(1);
    await page.locator('#lbotlvseg [data-v="2"]').click();
    await expect(page.locator('#lseats .bottag')).toContainText('livello 2');
    await expect(page.locator('#lstart')).toBeEnabled();
    await page.locator('#lstart').click();
    await expect.poll(() => page.evaluate(() => !!window.trv!.game)).toBe(true);
    const bot = await page.evaluate(() => (window.trv!.game as unknown as { players: { bot?: { protocol: number } }[] }).players[1].bot?.protocol);
    expect(bot).toBe(2);
    // The person plays; the decisions never belong to the bot, and its cars leave the start.
    const moved = (): Promise<boolean> => page.evaluate(() => window.trv!.game!.vehicles.some(v => v.owner === 1 && !(v as unknown as { inStart: boolean }).inStart));
    for (let i = 0; i < 60 && !(await moved()); i++) {
      await expect.poll(() => page.evaluate(() => !!window.trv!.decision), { timeout: 30_000 }).toBe(true);
      expect(await page.evaluate(() => window.trv!.decision!.player)).toBe(0);
      await page.evaluate(() => { window.trv!.choose(0); window.trv!.skipBeats(); });
    }
    expect(await moved()).toBe(true);
    expect(errors).toEqual([]);
  });

  test('friends: an account with its user name, a friend link, a request accepted, an invitation, the lobby and one’s games', async ({ page, context }) => {
    test.setTimeout(120_000);
    // Ada has an account: she chooses her user name first (asked by the user, 2026-11-20), then her shown name.
    const errors = await open(page, { query: '?net=local&account' });
    await expect(page.locator('#pUser')).toHaveClass(/on/);
    await page.locator('#uname').fill('Ada_92');
    await page.locator('#usave').click();
    await expect(page.locator('#mecode')).toHaveText(/^@ada_92 · TRV-[A-Z0-9]{6}$/);
    await page.locator('#myname').fill('Ada');
    await page.locator('#myname').press('Tab');
    const friendCode = (await page.locator('#mecode').textContent())!.slice(-6);

    // A guest (no account) is asked to sign in before having friends.
    const guest = await context.newPage();
    await guest.goto(`${GAME}?net=local`);
    await guest.locator('#mFriends').click();
    await expect(guest.locator('#fguest')).toBeVisible();
    await expect(guest.locator('#fmain')).toBeHidden();
    await guest.close();

    // Bo opens Ada's friend link: he registers (a user name already taken is refused), and asks to be friends; Ada accepts.
    const bo = await context.newPage();
    const boErrors = watchErrors(bo);
    await bo.goto(`${GAME}?net=local&account&friend=${friendCode}`);
    await expect(bo.locator('#pUser')).toHaveClass(/on/);
    await bo.locator('#uname').fill('ada_92');
    await bo.locator('#usave').click();
    await expect(bo.locator('#umsg')).toContainText('già preso');
    await bo.locator('#uname').fill('bo');
    await bo.locator('#usave').click();
    await expect(bo.locator('#umsg')).toContainText('Da 3 a 20');
    await bo.locator('#uname').fill('bo.rossi');
    await bo.locator('#usave').click();
    await expect(bo.locator('#pFriends')).toHaveClass(/on/);
    await expect(bo.locator('#faddcode')).toHaveValue(`TRV-${friendCode}`);
    await bo.locator('#fadd').click();
    await expect(bo.locator('#faddmsg')).toContainText('Richiesta mandata');
    await page.locator('#mFriends').click();
    // Bo wrote no shown name: the others see his user name, never "Giocatore".
    await expect(page.locator('#frequests')).toContainText('bo.rossi');
    await page.locator('#frequests .facc').click();
    await expect(page.locator('#flist')).toContainText('@bo.rossi');
    // Bo then changes his shown name: Ada's list shows the new one with his user name, not the one kept when he asked.
    await bo.locator('#myname').fill('Bo Rossi');
    await bo.locator('#myname').press('Tab');
    await page.locator('#pFriends [data-back]').click();
    await page.locator('#mFriends').click();
    await expect(page.locator('#flist')).toContainText('Bo Rossi');
    await expect(page.locator('#flist')).toContainText('@bo.rossi');

    // Ada invites Bo from the friends' list into a new public room.
    await page.locator('#flist .fplay').click();
    // The room is made at once, with Bo invited.
    await expect.poll(() => page.locator('#lcode').textContent()).toMatch(/^[A-Z0-9]{5}$/);
    const code = (await page.locator('#lcode').textContent())!;

    // Bo finds the room in the lobby, marked as a friend's, and the invitation in his games.
    await bo.locator('#pFriends [data-back]').click();
    await bo.locator('#mPlay').click();
    await expect(bo.locator('#lobbyList')).toContainText('Ada');
    await expect(bo.locator('#lobbyList tr.friend')).toHaveCount(1);
    await bo.locator('#lobbyList [data-back], #pLobby [data-back]').first().click();
    // The invitation is on the home, under one's games.
    await expect(bo.locator('#homeGames')).toContainText(code);
    await bo.locator('#homeGames .ijoin').click();
    await expect(page.locator('#lseats')).toContainText('Bo Rossi');
    await bo.locator('#lready').click();
    await expect(page.locator('#lstart')).toBeEnabled();

    // Started: the room leaves the lobby, and Bo's list says whose turn it is.
    await page.locator('#lstart').click();
    await expect.poll(() => bo.evaluate(() => !!window.trv!.game)).toBe(true);
    await bo.evaluate(() => document.getElementById('quit')!.click());
    await bo.locator('#mMine').click();
    await expect(bo.locator('#mineList')).toContainText(code);
    await expect(bo.locator('#mineList')).toContainText(/In corso/);
    expect(errors).toEqual([]);
    expect(boErrors).toEqual([]);
  });

  test('Movimento nuovo: a recorded game plays its slams, shots, jumps and eliminations one scene at a time, the bubbles never ahead', async ({ page }) => {
    test.setTimeout(900_000);
    // A Carnage game with three teams, chosen by a fixed chooser that avoids the options marked as
    // dangerous: it holds a slam, a shot that deals damage, a ramp jump and an elimination.
    const players = [...PLAYERS, { name: 'Arancio', color: '#ec9230', crew: 'orange' }];
    const errors = await open(page, { save: [], setup: { seed: '06'.repeat(32), startSide: 'a', players, carnage: true }, settings: { speed: 'fast' } });
    // Every animation frame: while the beats play, once a choice's first frame is shown the table shows the
    // state of the last frame shown, never a later one (before it, the state before the choice).
    await page.evaluate(() => {
      const w = window as unknown as { trvAhead: string[]; trvChecks: number };
      w.trvAhead = []; w.trvChecks = 0;
      let base = -1;
      const look = (): void => {
        const t = window.trv!;
        const log = t.scenes.log;
        if (!t.playing) base = -1;
        else if (base < 0) base = log.length;
        if (t.playing && log.length > base) {
          w.trvChecks++;
          const last = log[log.length - 1].frame;
          if (t.shownSnap !== last.snap) w.trvAhead.push(`${t.scenes.phase} after ${last.kind} (${log.length - base} shown)`);
        }
        requestAnimationFrame(look);
      };
      requestAnimationFrame(look);
    });
    // The choices that show an event still to see play out as scenes; the others are skipped to their end.
    let wanted = ['slam', 'shot', 'jump', 'elim'];
    let state = { x: 11, n: 0 };
    while (wanted.length && state.n < 1200) {
      // The table is drawn in software here: a choice with many events plays for minutes.
      await page.waitForFunction(() => !window.trv!.playing && !!window.trv!.decision, null, { timeout: 240_000, polling: 500 }).catch(async () => {
        const st = await page.evaluate(() => ({ playing: window.trv!.playing, phase: window.trv!.scenes.phase, decision: !!window.trv!.decision }));
        throw new Error(`after choice ${state.n}: the table never came back to a decision ${JSON.stringify(st)}`);
      });
      const r = await page.evaluate(([st, wanted]) => {
        const t = window.trv!;
        let { x, n } = st;
        while (t.decision && n < 1200) {
          x = (x * 1103515245 + 12345) & 0x7fffffff; n++;
          const from = t.game!.frames.length;
          const opts = t.decision.options as { danger?: boolean }[];
          const safe = opts.map((o, i) => (o.danger ? -1 : i)).filter(i => i >= 0);
          t.choose(safe.length ? safe[x % safe.length] : x % opts.length);
          const fr = t.game!.frames.slice(from) as { kind: string }[];
          const kinds = fr.map((f, i) => (f.kind === 'shot' ? (fr.slice(i + 1).some(d => d.kind === 'damage') ? 'shot' : 'miss') : f.kind));
          if (kinds.some(k => wanted.includes(k))) return { x, n, kinds };
          t.skipBeats();
        }
        return { x, n, kinds: [] as string[] };
      }, [state, wanted] as const);
      state = { x: r.x, n: r.n };
      wanted = wanted.filter(k => !r.kinds.includes(k));
      if (!r.kinds.length) break;
    }
    expect(wanted).toEqual([]);
    await expect.poll(() => page.evaluate(() => window.trv!.playing), { timeout: 240_000 }).toBe(false);
    const st = await page.evaluate(() => {
      const s = window.trv!.scenes;
      const w = window as unknown as { trvAhead: string[]; trvChecks: number };
      return { played: s.played.map(p => ({ kind: p.scene.kind, from: p.from, to: p.to })), ahead: w.trvAhead, checks: w.trvChecks };
    });
    const kindsPlayed = new Set(st.played.map(p => p.kind));
    for (const k of ['slam', 'shot', 'jump']) expect([...kindsPlayed], k).toContain(k);
    // One scene at a time: each starts once the one before is over.
    for (let k = 1; k < st.played.length; k++) expect(st.played[k].from, `scene ${k}`).toBeGreaterThanOrEqual(st.played[k - 1].to - 1e-6);
    expect(st.checks).toBeGreaterThan(100);
    expect(st.ahead).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('Percorso mode still plans in the next game after a path sent to the host as an online guest', async ({ page }) => {
    // The bug (2026-11-19): a guest's path marked the choices up to its end as sent (waypoints.ts), and
    // that mark outlived the game; in the next one the choices start again from 0, so Percorso stayed
    // off, the table moved one step per click, until the page was loaded again.
    const errors = await open(page, { save: [], settings: { speed: 'skip', move: 'path' } });
    const r = await page.evaluate(async players => {
      const W = await import('/src/app/waypoints.ts');
      const G = await import('/src/app/game.ts');
      const { S } = await import('/src/app/state.ts');
      const t = window.trv!;
      // Up to the first step decision.
      for (let i = 0; i < 20 && t.decision && t.decision.kind !== 'step'; i++) { t.choose(0); t.skipBeats(); }
      if (t.decision?.kind !== 'step') return { first: false, sent: false, next: false };
      // A guest of an online room: the path goes to the host (the write is not looked at here).
      const net = { store: { write: async () => {} }, code: 'ABCDE', uid: 'u', host: false, room: null, stop: () => {}, lobbyOpen: false, qrFor: '' };
      S.net = net as unknown as typeof S.net;
      const first = W.planning();
      W.addPoint(0); W.confirmStop(); W.go();
      const sent = !t.decision; // sent: waiting for the host
      S.net = null;
      // The next game, from the hot seat setup: its first step decision.
      G.startGame({ setup: { seed: '9'.repeat(64), startSide: 'a', players }, choices: [] }, true);
      t.skipBeats();
      for (let i = 0; i < 20 && t.decision && t.decision.kind !== 'step'; i++) { t.choose(0); t.skipBeats(); }
      return { first, sent, next: t.decision?.kind === 'step' && W.planning() };
    }, PLAYERS);
    expect(r).toEqual({ first: true, sent: true, next: true });
    expect(errors).toEqual([]);
  });

  test('an online room with crew leaders: both players see their own two boards and pick at once', async ({ page, context }) => {
    test.setTimeout(240_000); // two tables drawn in software
    // Asked by the user (2026-11-19): while one player picked a crew leader, the others could do nothing.
    const errors = await open(page, { query: '?net=local' });
    await page.locator('#myname').fill('Host');
    await page.locator('#mPlay').click();
    await page.locator('#mCreate').click();
    await page.locator('#lleaders').check(); // set in the waiting room
    await expect.poll(() => page.locator('#lcode').textContent()).toMatch(/^[A-Z0-9]{5}$/);
    const code = (await page.locator('#lcode').textContent())!;
    const guest = await context.newPage();
    const guestErrors = watchErrors(guest);
    await guest.goto(GAME + '?net=local');
    await expect.poll(() => guest.evaluate(() => typeof window.trv?.choose)).toBe('function');
    await guest.locator('#myname').fill('Ospite');
    await guest.locator('#mPlay').click();
    await guest.locator('#ocode').fill(code);
    await guest.locator('#ojoin').click();
    await expect(page.locator('#lseats')).toContainText('Ospite');
    await guest.locator('#lready').click();
    await expect(page.locator('#lstart')).toBeEnabled();
    await page.locator('#lstart').click();
    // Act: both tables show their own two boards at once, whoever the rules ask first.
    for (const p of [page, guest]) await expect(p.locator('#leaderpick .leader')).toHaveCount(2, { timeout: 60_000 });
    // The one not asked yet picks first: it is told to wait for the others.
    const asked = (await page.evaluate(() => !!window.trv!.decision && window.trv!.decision.kind === 'leader')) ? page : guest;
    const early = asked === page ? guest : page;
    await early.locator('#leaderpick .leader').first().click();
    await expect(early.locator('#leaderpick h2')).toContainText('in attesa', { timeout: 30_000 });
    await asked.locator('#leaderpick .leader').last().click();
    // Assert: both picks are taken, the two tables the same.
    const leaders = (p: Page): Promise<string> => p.evaluate(() => JSON.stringify((window.trv!.game as unknown as { players: { leader?: string }[] }).players.map(x => !!x.leader)));
    await expect.poll(() => leaders(page), { timeout: 60_000 }).toBe('[true,true]');
    await expect.poll(() => leaders(guest), { timeout: 60_000 }).toBe('[true,true]');
    await expect.poll(async () => (await page.evaluate(() => JSON.stringify(window.trv!.snapshot())))
      === (await guest.evaluate(() => JSON.stringify(window.trv!.snapshot()))), { timeout: 45_000 }).toBe(true);
    expect(errors).toEqual([]);
    expect(guestErrors).toEqual([]);
  });

  test('a waypoint path ending with "no road die" before a shot is asked: the car drives its path once, never back', async ({ page }) => {
    test.setTimeout(600_000);
    // The bug (2026-11-19): declining the road die shows nothing when a shot is asked right after; the
    // table was then drawn as the rules had it, the car slid straight to its last space while its
    // moves were still queued, went back to the first and drove the path.
    const players = [...PLAYERS, { name: 'Arancio', color: '#ec9230', crew: 'orange' }];
    const errors = await open(page, { save: [], setup: { seed: SEED, startSide: 'a', players }, settings: { speed: 'full', move: 'path' } });
    // Arrange: skip through the game to a path all on road whose "no road die" produces no frame.
    const mine = await page.evaluate(async ([saveKey]) => {
      const W = await import('/src/app/waypoints.ts');
      const E = await import('/src/game/trv/engine.ts');
      const t = window.trv!;
      const framesAfter = (extra: number[]): number => {
        const s = JSON.parse(localStorage.getItem(saveKey)!) as { setup: Parameters<typeof E.newGame>[0]; choices: number[] };
        const g = E.newGame(s.setup), it = E.play(g);
        let r = it.next(0);
        for (const c of [...s.choices, ...extra]) { if (r.done) break; r = it.next(c); }
        return g.frames.length;
      };
      let x = 11;
      for (let n = 0; n < 1500 && t.decision; n++) {
        if (t.decision.kind === 'step' && W.planning()) {
          const path: number[] = [];
          for (let k = 0; k < 9; k++) {
            const d = W.planDecision();
            if (!d) break;
            // The road space farthest ahead.
            let best = -1, col = -1;
            d.options.forEach((o, i) => { const q = o as { pos?: { c: number }; label: string }; if (q.pos && /: strada$/.test(q.label) && q.pos.c > col) { col = q.pos.c; best = i; } });
            if (best < 0) break;
            W.addPoint(best); path.push(best);
          }
          const asksRoadDie = /Tutto su strada/.test(document.querySelector('#wpwin h4')?.textContent ?? '');
          W.restart();
          if (asksRoadDie && path.length >= 2 && framesAfter([...path, 0]) === framesAfter(path)) return path;
        }
        x = (x * 1103515245 + 12345) & 0x7fffffff;
        const opts = t.decision.options as { danger?: boolean }[];
        const safe = opts.map((o, i) => (o.danger ? -1 : i)).filter(i => i >= 0);
        t.choose(safe.length ? safe[x % safe.length] : x % opts.length);
        // A face-down hazard asks first: yes.
        const ask = document.getElementById('hzask');
        if (ask && ask.style.display !== 'none') [...ask.querySelectorAll('button')].find(b => /^s/i.test(b.textContent!.trim()))?.click();
        t.skipBeats();
      }
      return null;
    }, [SAVE_KEY] as const);
    expect(mine, 'a path all on road whose road die answer shows nothing').not.toBe(null);
    await page.waitForTimeout(1500);
    // Act: the path is planned again and run with VAI! (Enter: without the road die); the car is watched.
    await page.evaluate(async mine => {
      const W = await import('/src/app/waypoints.ts');
      const { carObjs } = await import('/src/app/board.ts');
      const G = await import('/src/app/game.ts');
      const o = carObjs.get(G.g!.activeCar!)!;
      for (const c of mine) W.addPoint(c);
      const w = window as unknown as { trvBack: number };
      w.trvBack = 0;
      let far = o.position.x;
      const look = (): void => { w.trvBack = Math.max(w.trvBack, far - o.position.x); far = Math.max(far, o.position.x); requestAnimationFrame(look); };
      requestAnimationFrame(look);
      dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    }, mine!);
    await expect.poll(() => page.evaluate(() => !window.trv!.playing && !!window.trv!.decision), { timeout: 300_000 }).toBe(true);
    // Assert: it never went back along the road (a road space is about 1.5 units long).
    expect(await page.evaluate(() => (window as unknown as { trvBack: number }).trvBack)).toBeLessThan(0.2);
    expect(errors).toEqual([]);
  });
});
