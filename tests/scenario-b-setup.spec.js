const { test, expect } = require('@playwright/test');
const { resetSession } = require('./helpers/firebase');
const { loginAdmin } = require('./helpers/browser');

test.describe('Scénario B — Setup de session (admin seul)', () => {

  test.beforeAll(async () => {
    await resetSession('Session B');
  });

  test('B1 — modifier le nom de session et sauvegarder', async ({ page }) => {
    await loginAdmin(page);
    await page.fill('#session-name', 'Mon Atelier Test');
    await page.click('button:has-text("Save")');
    await expect(page.locator('.toast')).toContainText('Saved');

    // Recharger pour vérifier la persistance
    await page.reload();
    await page.waitForFunction(
      () => document.getElementById('auth-overlay').style.display === 'none',
      { timeout: 10_000 }
    );
    await expect(page.locator('#session-name')).toHaveValue('Mon Atelier Test');
  });

  test('B2 — ajouter une idée pré-chargée', async ({ page }) => {
    await loginAdmin(page);
    await page.fill('#admin-idea-title', 'Idée pré-chargée');
    await page.fill('#admin-idea-desc', 'Description de test');
    await page.click('button:has-text("Add")');

    await expect(page.locator('#admin-ideas-list')).toContainText('Idée pré-chargée');
  });

  test('B3 — supprimer une idée pré-chargée', async ({ page }) => {
    await loginAdmin(page);
    // Ajouter une idée à supprimer
    await page.fill('#admin-idea-title', 'Idée à supprimer');
    await page.click('button:has-text("Add")');
    await expect(page.locator('#admin-ideas-list')).toContainText('Idée à supprimer');

    // Cliquer sur l'idée pour ouvrir la modale
    await page.locator('#admin-ideas-list').getByText('Idée à supprimer').click();
    await page.waitForSelector('#admin-idea-modal.open');

    // Confirmer la suppression (window.confirm auto-accepté)
    page.on('dialog', dialog => dialog.accept());
    await page.click('#aim-delete-btn');
    await expect(page.locator('#admin-ideas-list')).not.toContainText('Idée à supprimer');
  });

  test('B4 — démarrer la session → navigation vers Ideation', async ({ page }) => {
    await loginAdmin(page);
    await page.click('.big-btn-green');

    await expect(page.locator('#step-1')).toHaveClass(/active/);
    await expect(page.locator('#pane-1')).toHaveClass(/active/);

    // QR code et URL affichés
    await expect(page.locator('#short-url')).not.toContainText('—');
    await expect(page.locator('#qr-generated, #qr-canvas')).toBeTruthy();
  });

  test('B5 — "Close ideation" bloqué si aucune idée', async ({ page }) => {
    await resetSession('Session B5');
    await loginAdmin(page);

    // Démarrer la session directement (saute B4)
    await page.click('.big-btn-green');
    await expect(page.locator('#pane-1')).toHaveClass(/active/);

    // Tenter de fermer l'ideation sans idée
    await page.click('.big-btn-orange');
    await expect(page.locator('.toast')).toContainText('Add at least one idea first');
    await expect(page.locator('#pane-1')).toHaveClass(/active/); // toujours sur pane-1
  });

});
