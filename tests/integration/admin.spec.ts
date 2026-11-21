// The admin asset inspector (admin.html, src/admin/admin.ts) in local mode: the summary by game
// and status, a group of pieces with its status filter, the detail with the 3D view, the
// side-by-side check with the extracted scans, downloads and comments. Screenshots of each screen
// go to production/qa/evidence/trv-admin-assets-2026-11-17/. The production section of the models
// (src/admin/produzione-view.ts) has its own test and folder.
import { existsSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const ADMIN = '/admin.html?admin=local';
const EVIDENCE = 'production/qa/evidence/trv-admin-assets-2026-11-17';
/** The "Produzione modelli" section (design/art/modelli-strutturati.md §21). */
const PRODUCTION = 'production/qa/evidence/trv-produzione-modelli-2026-11-21';
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

  test('the Big Rig and Final Five boards are listed as official pictures, and a dashboard turns in 3D', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(`${ADMIN}#big_rig/plance`);
    await expect(page.locator('.grid .item')).toHaveCount(12);
    await expect.poll(() => page.locator('.grid .item img').evaluateAll(imgs => imgs.every(i => (i as HTMLImageElement).naturalWidth > 0))).toBe(true);
    await page.screenshot({ path: 'production/qa/evidence/trv-big-rig-asset-2026-11-17/plance.png' });
    await page.locator('.grid .item', { hasText: 'Cruscotto moto: cerchio' }).click();
    await expect(page.locator('#d-info')).toContainText('Ufficiale estratto');
    await expect(page.locator('#d-actions')).toContainText('Scarica asset ufficiale (WEBP)');
    await page.locator('[data-tab="3d"]').click();
    await expect(page.locator('#d-big canvas')).toBeVisible();
    await page.waitForTimeout(800);
    await page.screenshot({ path: 'production/qa/evidence/trv-big-rig-asset-2026-11-17/cruscotto-3d.png' });
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

  test('the production section lists the models, shows a sheet with its prompts to copy, a piece in 3D, the rules and the specification', async ({ page }) => {
    const errors = watchErrors(page);
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto(`${ADMIN}#produzione`);
    await expect(page.locator('main h2')).toHaveText('Produzione modelli');
    expect(await page.locator('table.models tbody tr').count()).toBeGreaterThan(10);
    // No sheet names a file the repository does not have.
    await expect(page.locator('table.models .bad')).toHaveCount(0);
    await page.screenshot({ path: `${PRODUCTION}/1-elenco.png` });

    // A sheet that follows the specification: its step, and the prompts put together from the blocks.
    await page.locator('[data-prod="car_m_v2"]').click();
    await expect(page.locator('main h2')).toHaveText('Auto media (Avenger) ridisegnata');
    await expect(page.locator('ol.steps li.now')).toContainText('Dima');
    // What to do now, in order: the template's pictures, then every piece with its two prompts to copy.
    const todo = page.locator('.todo');
    await expect(todo.locator('h3')).toHaveText('Cosa fare adesso');
    await expect(todo.locator('[data-dima-png]')).toBeVisible();
    await expect(todo).toContainText('car_m_v2_dima_carrozzeria_trequarti.png');
    await expect(todo.getByRole('link', { name: 'Scarica il riferimento di stile' })).toHaveAttribute('download', 'riferimento_stile.jpg');
    await page.setViewportSize({ width: 1366, height: 1600 });
    await todo.screenshot({ path: `${PRODUCTION}/2b-cosa-fare-adesso.png` });
    await page.setViewportSize({ width: 1366, height: 800 });
    await todo.getByRole('button', { name: 'Copia il prompt di Meshy' }).first().click();
    await expect(page.locator('#toast')).toHaveText('Prompt copiato');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('low flat open rear deck');
    const body = page.locator('#pz-car_m_v2_body');
    await expect(body.locator('.prompt pre').first()).toContainText('Photorealistic 3D render');
    await expect(body.locator('.prompt pre').first()).toContainText('one single flat neutral light grey');
    await body.locator('[data-copy]').first().click();
    await expect(page.locator('#toast')).toHaveText('Prompt copiato');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('The model: the Avenger');
    await page.screenshot({ path: `${PRODUCTION}/2-scheda-avenger.png` });

    // A model made before the specification: the prompts it was made with, and a piece in 3D.
    await page.locator('[data-prod=""]').click();
    await page.locator('[data-prod="big_rig"]').click();
    const front = page.locator('#pz-big_rig_front_body');
    await expect(front.locator('.prompt pre').first()).toContainText('Edit the road train image you made');
    await front.locator('[data-glb]').click();
    await expect(page.locator('#p-3d canvas')).toBeVisible();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${PRODUCTION}/3-scheda-big-rig-3d.png` });

    // A comment on the model stays under it.
    await page.locator('#p-comments textarea').fill('Rivedere la sezione centrale');
    await page.locator('#p-comments button[type=submit]').click();
    await expect(page.locator('#p-comments .list li')).toContainText('Rivedere la sezione centrale');

    // The rules, their numbers read from the rules file, and the specification laid out.
    await page.locator('nav [data-view="produzione/regole"]').click();
    await expect(page.locator('main h2')).toHaveText('Regole e misure');
    await expect(page.locator('table.pt', { hasText: 'Auto media (Avenger)' }).first()).toContainText('38 mm');
    await page.screenshot({ path: `${PRODUCTION}/4-regole.png` });
    await page.locator('nav [data-view="produzione/specifica"]').click();
    await expect(page.locator('.doc h2').first()).toContainText('Modelli strutturati');
    expect(await page.locator('.doc h3').count()).toBeGreaterThan(15);
    expect(await page.locator('.doc table').count()).toBeGreaterThan(15);
    await page.screenshot({ path: `${PRODUCTION}/5-specifica.png` });
    expect(errors).toEqual([]);
  });

  test('the template of a model: the figure in its seats in 3D, the check of the seats, the pictures for Gemini', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(`${ADMIN}#produzione/car_m_v2`);
    // The check of the seats, worked out from the sheet's numbers: nothing out of its limits.
    await expect(page.locator('#dima-check')).toContainText('passa');
    await expect(page.locator('#dima-check .bad')).toHaveCount(0);
    await page.locator('details.allrows summary').click();
    await expect(page.locator('details.allrows table.check tbody tr', { hasText: 'Gomito sinistro' }).first()).toContainText('ok');
    await page.locator('details.allrows summary').click();

    // The template in 3D, then the wheel fully turned with the figure see-through.
    await page.locator('[data-dima-show]').click();
    await expect(page.locator('#p-3d canvas')).toBeVisible();
    await page.waitForTimeout(1000);
    await page.locator('#p-3d').screenshot({ path: `${PRODUCTION}/6-dima-avenger-3d.png` });
    await page.locator('.dimabar [data-opt="position"]').selectOption('1');
    await page.locator('.dimabar [data-opt="figure"]').selectOption('ghost');
    await page.locator('.dimabar [data-opt="ground"]').uncheck();
    await page.waitForTimeout(1000);
    await page.locator('#p-3d').screenshot({ path: `${PRODUCTION}/7-dima-avenger-volante.png` });

    // The pictures to attach to Gemini come down as PNG files, the .glb as one file.
    const files: string[] = [];
    page.on('download', d => { files.push(d.suggestedFilename()); void d.saveAs(`${PRODUCTION}/dima/${d.suggestedFilename()}`); });
    await page.locator('.dimabar [data-dima-png]').click();
    await expect.poll(() => files.length, { timeout: 30_000 }).toBe(7);
    expect(files).toContain('car_m_v2_dima_carrozzeria_lato.png');
    expect(files).toContain('car_m_v2_dima_arma_lato.png'); // the gun alone, with who holds it
    await page.locator('.dimabar [data-dima-glb]').click();
    await expect.poll(() => files, { timeout: 30_000 }).toContain('car_m_v2_dima.glb');
    await page.waitForTimeout(500);

    // Every other template of the repository passes the check of its seats and gives its pictures.
    // Six pictures each, and one more for every piece drawn alone: a gun somebody holds, the motorcycle's front end.
    for (const [id, more] of [["car_s_v2", 0], ["car_l_v2", 1], ["moto_2", 1], ["big_rig_front_v2", 1], ["big_rig_mid_v2", 0], ["big_rig_rear_v2", 1]] as const) {
      const had = files.length;
      await page.locator("[data-prod='']").click();
      await page.locator(`[data-prod="${id}"]`).click();
      await expect(page.locator("#dima-check"), id).toContainText("passa");
      await page.locator(".dimabar [data-dima-png]").click();
      await expect.poll(() => files.length, { timeout: 30_000 }).toBe(had + 6 + more);
    }
    await page.waitForTimeout(500);
    expect(errors).toEqual([]);
  });
});
