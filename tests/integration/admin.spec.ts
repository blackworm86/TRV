// The admin asset inspector (admin.html, src/admin/admin.ts) in local mode: the summary by game
// and status, a group of pieces with its status filter, the detail with the 3D view, the
// side-by-side check with the extracted scans, downloads and comments. Screenshots of each screen
// go to production/qa/evidence/trv-admin-assets-2026-11-17/.
import { existsSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const ADMIN = '/admin.html?admin=local';
const EVIDENCE = 'production/qa/evidence/trv-admin-assets-2026-11-17';
/** The extracted scans live only on a computer that has the original files (assets/estratti, outside git). */
const HAS_SCANS = existsSync('assets/estratti/base/hazards/mine.png');

/** Collects every page error and console error of `page` (the favicon the browser asks for by itself aside). */
function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => {
    if (m.type() === 'error' && !m.location().url.endsWith('/favicon.ico')) errors.push(`${m.text()} ${m.location().url}`.trim());
  });
  return errors;
}

test.describe('admin inspector', () => {
  test('the summary counts the assets of every game by status @boot', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(ADMIN);
    await expect(page.locator('main h2')).toHaveText('Riepilogo');
    const base = page.locator('table.sum tbody tr', { hasText: 'Gioco base' });
    await expect(base).toBeVisible();
    // Every game of the catalogue has its row, and the base game has official traced art.
    await expect(page.locator('table.sum tbody tr')).toHaveCount(5);
    expect(Number(await base.locator('td').nth(1).textContent())).toBeGreaterThan(0);
    await page.screenshot({ path: `${EVIDENCE}/1-riepilogo.png` });
    expect(errors).toEqual([]);
  });

  test('a group shows its pieces with their status, and the filter narrows them', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(`${ADMIN}#carnage/segnalini`);
    await expect(page.locator('.grid .item').first()).toBeVisible();
    await page.screenshot({ path: `${EVIDENCE}/2-carnage-segnalini.png` });
    // The base tokens mix printed (damage) and traced (hazards): only the printed ones.
    await page.goto('about:blank'); // a new hash alone does not reload the inspector
    await page.goto(`${ADMIN}#base/segnalini`);
    await expect(page.locator('.grid .item')).toHaveCount(15);
    const items = page.locator('.grid .item');
    const all = await items.count();
    await page.locator('.chip', { hasText: 'Ufficiale estratto' }).click();
    const printed = await items.count();
    expect(printed).toBeGreaterThan(0);
    expect(printed).toBeLessThan(all);
    await expect(page.locator('.grid .item .st-ricalcato')).toHaveCount(0);
    await page.screenshot({ path: `${EVIDENCE}/2b-danni-stampati.png` });
    expect(errors).toEqual([]);
  });

  test('the crew leaders’ avatars are listed as official pictures', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(`${ADMIN}#choppe_shoppe/personaggi`);
    await expect(page.locator('.grid .item')).toHaveCount(11);
    await expect.poll(() => page.locator('.grid .item img').evaluateAll(imgs => imgs.every(i => (i as HTMLImageElement).naturalWidth > 0))).toBe(true);
    await page.screenshot({ path: `${EVIDENCE}/7-avatar-personaggi.png` });
    expect(errors).toEqual([]);
  });

  test('the detail turns a token in 3D, sets it beside its scan and offers its files', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(`${ADMIN}#base/segnalini`);
    await page.locator('.grid .item', { hasText: 'Pericolo Mina' }).click();
    await expect(page.locator('#d-info')).toContainText('Ufficiale ricalcato');
    await expect(page.locator('#d-actions button').first()).toHaveText('Scarica template (SVG)');
    await page.locator('[data-tab="3d"]').click();
    await expect(page.locator('#d-big canvas')).toBeVisible();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${EVIDENCE}/3-mina-3d.png` });
    await expect(page.locator('[data-tab="source"]')).toBeVisible();
    await page.locator('[data-tab="source"]').click();
    if (HAS_SCANS) {
      // The front and the back as printed, loaded from the extracted scans.
      await expect.poll(() => page.locator('.scans img').evaluateAll(imgs => imgs.map(i => (i as HTMLImageElement).naturalWidth > 0))).toEqual([true, true]);
    }
    expect(errors).toEqual([]);
  });

  test('a card is drawn for the game, offers the official scan and turns in 3D', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(`${ADMIN}#choppe_shoppe/carte`);
    await page.locator('.grid .item', { hasText: 'Rail Gun' }).click();
    await expect(page.locator('#d-info')).toContainText('Ufficiale ricalcato');
    // The digital card: the illustration, the Italian text and the printed pictogram.
    const card = page.locator('#d-big svg[data-id="rail_gun"]');
    await expect(card).toContainText('Questa auto può');
    await expect(card.locator('image')).toHaveCount(2);
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${EVIDENCE}/4-carta-digitale.png` });
    await expect(page.locator('#d-actions')).toContainText('Scarica asset ufficiale (JPG)');
    await page.locator('[data-tab="3d"]').click();
    await expect(page.locator('#d-big canvas')).toBeVisible();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${EVIDENCE}/4b-carta-3d.png` });
    // The ongoing effect cards, drawn the same way with the red panel.
    await page.goto('about:blank');
    await page.goto(`${ADMIN}#carnage/carte`);
    await page.locator('.grid .item', { hasText: 'Perdita di nitro' }).click({ force: true });
    await expect(page.locator('#d-big svg[data-id="nitro_leak"]')).toContainText('PERDITA DI NITRO');
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${EVIDENCE}/4c-carta-effetto-continuo.png` });
    expect(errors).toEqual([]);
  });

  test('a die turns in 3D with its six faces', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(`${ADMIN}#base/dadi`);
    await page.locator('.grid .item', { hasText: 'Dado Direzione' }).click();
    await page.locator('[data-tab="3d"]').click();
    await expect(page.locator('#d-big canvas')).toBeVisible();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${EVIDENCE}/5-dado-3d.png` });
    expect(errors).toEqual([]);
  });

  test('a comment written on an asset is listed under it, and only there', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(`${ADMIN}#base/modelli`);
    await page.evaluate(() => localStorage.removeItem('trv-asset-comments'));
    await page.locator('.grid .item', { hasText: 'Auto piccola' }).click();
    await expect(page.locator('#d-comments')).toContainText('Nessun commento.');
    await page.locator('#c-text').fill('Le ruote posteriori sono troppo piccole.');
    await page.locator('#d-comments button[type="submit"]').click();
    await expect(page.locator('#d-comments .list li')).toHaveText(/Le ruote posteriori sono troppo piccole\./);
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${EVIDENCE}/6-modello-commento.png` });
    // Another asset has none.
    await page.locator('.grid .item', { hasText: 'Auto media' }).click();
    await expect(page.locator('#d-comments')).toContainText('Nessun commento.');
    expect(errors).toEqual([]);
  });
});
